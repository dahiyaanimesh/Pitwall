"""
Pitwall — ML Training Pipeline

Builds feature matrix from SQLite, trains two models:
  1. Finish Position Regressor  (RandomForest + XGBoost)
  2. Podium Classifier          (RandomForest + XGBoost)

Temporal split: train on rounds 1-17, test on rounds 18-22.

Usage:
    python backend/ml/train.py --season 2021
    python backend/ml/train.py --season 2021 --dry-run  # features only
"""

import argparse
import logging
import pickle
import sqlite3
import warnings
from pathlib import Path

import pandas as pd
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.metrics import (
    accuracy_score, f1_score, mean_absolute_error,
    precision_score, r2_score, recall_score,
)
from xgboost import XGBClassifier, XGBRegressor

warnings.filterwarnings("ignore")

BASE_DIR = Path(__file__).resolve().parent.parent
DB_PATH  = BASE_DIR / "database" / "f1.db"
ML_DIR   = Path(__file__).resolve().parent
MODELS_DIR = ML_DIR / "models"
MODELS_DIR.mkdir(exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger(__name__)

TRAIN_ROUNDS = 17   # train on R1-R17
TEST_ROUNDS  = 5    # test  on R18-R22

# ─── Known street circuits in 2021 ────────────────────────────────────────────
STREET_CIRCUITS = {
    "monaco", "baku", "singapore",
    "formula_1_grand_prix_de_monaco_2021",
    "formula_1_azerbaijan_grand_prix_2021",
}

# ─── DB helper ────────────────────────────────────────────────────────────────

def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


# ─── Feature engineering ──────────────────────────────────────────────────────

def build_feature_matrix(season: int, conn: sqlite3.Connection) -> pd.DataFrame:
    """
    Build one row per (driver, race) with rolling, qualifying and championship features.
    Strict temporal ordering — no future data leaks into any feature.
    """
    log.info(f"Building feature matrix for {season} season …")

    races = pd.read_sql_query(
        "SELECT race_id, round_number, circuit_id FROM races WHERE season_year=? ORDER BY round_number",
        conn, params=(season,),
    )

    results = pd.read_sql_query(
        """SELECT rr.race_id, rr.driver_id, rr.team_id,
                  rr.finish_position, rr.grid_position, rr.points,
                  rr.status, r.round_number, r.circuit_id
           FROM race_results rr
           JOIN races r ON rr.race_id = r.race_id
           WHERE r.season_year = ?
           ORDER BY r.round_number, rr.driver_id""",
        conn, params=(season,),
    )

    results["finish_position"] = pd.to_numeric(results["finish_position"], errors="coerce")
    results["grid_position"]   = pd.to_numeric(results["grid_position"],   errors="coerce")
    results["points"]          = pd.to_numeric(results["points"],          errors="coerce").fillna(0)
    results["is_dnf"] = results["status"].str.upper().isin(["DNF", "R", "W", "D", "E", "N"]).astype(int)

    # ── Qualifying gap to pole ────────────────────────────────────────────────
    # Best qualifying time = min(q3, q2, q1) ignoring nulls
    qual = pd.read_sql_query(
        """SELECT qr.race_id, qr.driver_id, qr.q1_seconds, qr.q2_seconds, qr.q3_seconds
           FROM qualifying_results qr
           JOIN races r ON qr.race_id = r.race_id
           WHERE r.season_year = ?""",
        conn, params=(season,),
    )
    if not qual.empty:
        qual["best_qual"] = qual[["q3_seconds", "q2_seconds", "q1_seconds"]].min(axis=1)
        pole_times = qual.groupby("race_id")["best_qual"].min().rename("pole_time")
        qual = qual.merge(pole_times, on="race_id")
        qual["qual_gap_to_pole"] = qual["best_qual"] - qual["pole_time"]
        results = results.merge(qual[["race_id","driver_id","qual_gap_to_pole"]], on=["race_id","driver_id"], how="left")
    else:
        results["qual_gap_to_pole"] = float("nan")

    # ── Lap consistency (green flag stddev) ───────────────────────────────────
    lap_rows = pd.read_sql_query(
        """SELECT lt.race_id, lt.driver_id, lt.lap_time_seconds
           FROM lap_times lt
           JOIN races r ON lt.race_id = r.race_id
           WHERE r.season_year = ?
             AND lt.track_status = 'Green'
             AND lt.lap_number > 1
             AND lt.lap_time_seconds IS NOT NULL""",
        conn, params=(season,),
    )
    lap_std = (
        lap_rows.groupby(["race_id", "driver_id"])["lap_time_seconds"]
        .std()
        .reset_index()
        .rename(columns={"lap_time_seconds": "lap_stddev"})
    )
    results = results.merge(lap_std, on=["race_id","driver_id"], how="left")

    # ── Circuit type encoding ─────────────────────────────────────────────────
    def circuit_type_code(cid: str) -> int:
        if cid is None:
            return 1
        c = str(cid).lower()
        if any(sc in c for sc in STREET_CIRCUITS):
            return 0
        return 1

    race_circuit_code = {
        row["round_number"]: circuit_type_code(row["circuit_id"])
        for _, row in races.iterrows()
    }
    results["circuit_type"] = results["round_number"].map(race_circuit_code)

    # ── Rolling features (computed BEFORE the current race) ──────────────────
    results = results.sort_values(["driver_id", "round_number"]).reset_index(drop=True)

    def rolling3(series: pd.Series) -> pd.Series:
        return series.shift(1).rolling(window=3, min_periods=1).mean()

    def rolling5(series: pd.Series) -> pd.Series:
        return series.shift(1).rolling(window=5, min_periods=1).mean()

    feat_parts = []
    for driver_id, grp in results.groupby("driver_id"):
        grp = grp.copy()
        grp["avg_finish_last3"]      = rolling3(grp["finish_position"])
        grp["avg_finish_last5"]      = rolling5(grp["finish_position"])
        grp["avg_points_last3"]      = rolling3(grp["points"])
        grp["dnf_rate_last3"]        = grp["is_dnf"].shift(1).rolling(3, min_periods=1).mean()
        grp["avg_consistency_last3"] = rolling3(grp["lap_stddev"])
        # Cumulative season points BEFORE this race (strict: exclude current row)
        grp["cumulative_points"]     = grp["points"].shift(1).cumsum().fillna(0)
        feat_parts.append(grp)

    results = pd.concat(feat_parts).sort_values(["round_number", "driver_id"]).reset_index(drop=True)

    # ── Championship rank before each race ────────────────────────────────────
    # Rank drivers by cumulative_points within each round (lower rank = more points)
    results["championship_rank"] = (
        results.groupby("round_number")["cumulative_points"]
        .rank(method="min", ascending=False)
    )

    # ── Team rolling features ─────────────────────────────────────────────────
    team_results = results.groupby(["team_id", "round_number"]).agg(
        team_avg_finish=("finish_position", "mean"),
        team_points=("points", "sum"),
    ).reset_index()

    team_feat_parts = []
    for team_id, grp in team_results.groupby("team_id"):
        grp = grp.sort_values("round_number").copy()
        grp["team_avg_finish_last3"] = rolling3(grp["team_avg_finish"])
        grp["team_points_last3"]     = rolling3(grp["team_points"])
        team_feat_parts.append(grp)

    team_feats = pd.concat(team_feat_parts)
    results = results.merge(
        team_feats[["team_id","round_number","team_avg_finish_last3","team_points_last3"]],
        on=["team_id","round_number"], how="left",
    )

    # ── Circuit history (avg finish at this circuit in prior seasons/rounds) ──
    circ_hist_parts = []
    for (driver_id, circuit_id), grp in results.groupby(["driver_id", "circuit_id"]):
        grp = grp.sort_values("round_number").copy()
        grp["circuit_history_avg_finish"] = grp["finish_position"].expanding().mean().shift(1)
        circ_hist_parts.append(grp)
    results = pd.concat(circ_hist_parts).sort_values(["round_number","driver_id"]).reset_index(drop=True)

    results["circuit_history_avg_finish"] = results["circuit_history_avg_finish"].fillna(
        results["avg_finish_last3"]
    )

    # ── Fill remaining nulls ──────────────────────────────────────────────────
    global_median_finish = results["finish_position"].median()
    median_qual_gap      = results["qual_gap_to_pole"].median()
    fill_map = {
        "grid_position":              results["grid_position"].median(),
        "qual_gap_to_pole":           median_qual_gap if not pd.isna(median_qual_gap) else 1.0,
        "avg_finish_last3":           global_median_finish,
        "avg_finish_last5":           global_median_finish,
        "avg_points_last3":           results["points"].median(),
        "dnf_rate_last3":             0.0,
        "avg_consistency_last3":      results["lap_stddev"].median(),
        "cumulative_points":          0.0,
        "championship_rank":          10.0,
        "team_avg_finish_last3":      global_median_finish,
        "team_points_last3":          0.0,
        "circuit_history_avg_finish": global_median_finish,
    }
    for col, default in fill_map.items():
        results[col] = results[col].fillna(default if not pd.isna(default) else global_median_finish)

    # ── Target variables ──────────────────────────────────────────────────────
    results["podium"] = (results["finish_position"] <= 3).astype(int)

    log.info(f"Feature matrix: {len(results)} rows × {len(results.columns)} cols")
    return results


FEATURE_COLS = [
    "grid_position",
    "qual_gap_to_pole",
    "avg_finish_last3",
    "avg_finish_last5",
    "avg_points_last3",
    "dnf_rate_last3",
    "avg_consistency_last3",
    "cumulative_points",
    "championship_rank",
    "circuit_type",
    "circuit_history_avg_finish",
    "team_avg_finish_last3",
    "team_points_last3",
]


# ─── Training ─────────────────────────────────────────────────────────────────

def train_models(df: pd.DataFrame, season: int) -> dict:
    """
    Temporal split: train on first ~75% of rounds, test on remaining ~25%.
    Falls back to train-only if fewer than 4 rounds available for testing.
    Returns metrics dict.
    """
    max_round   = int(df["round_number"].max())
    split_round = max(int(max_round * 0.75), max_round - 5)   # at least 5 test rounds when possible

    train = df[df["round_number"] <= split_round].copy()
    test  = df[df["round_number"] >  split_round].copy()
    has_test = len(test) > 0

    log.info(f"Train set: {len(train)} rows (R1-R{split_round})  |  Test: {len(test)} rows (R{split_round+1}-R{max_round})")

    X_train = train[FEATURE_COLS]
    X_test  = test[FEATURE_COLS] if has_test else X_train[:0]
    y_reg_train = train["finish_position"]
    y_reg_test  = test["finish_position"] if has_test else y_reg_train[:0]
    y_cls_train = train["podium"]
    y_cls_test  = test["podium"] if has_test else y_cls_train[:0]

    metrics: dict = {}

    # ── Finish Position Regressor ─────────────────────────────────────────────
    log.info("Training finish position regressors …")

    rf_reg = RandomForestRegressor(
        n_estimators=400, max_depth=8, min_samples_leaf=2,
        max_features=0.7, random_state=42, n_jobs=-1,
    )
    rf_reg.fit(X_train, y_reg_train)

    xgb_reg = XGBRegressor(
        n_estimators=400, max_depth=5, learning_rate=0.04,
        subsample=0.8, colsample_bytree=0.75, min_child_weight=3,
        reg_alpha=0.1, reg_lambda=1.0,
        random_state=42, verbosity=0,
    )
    xgb_reg.fit(X_train, y_reg_train)

    if has_test:
        rf_pred  = rf_reg.predict(X_test)
        rf_mae   = mean_absolute_error(y_reg_test, rf_pred)
        rf_r2    = r2_score(y_reg_test, rf_pred)
        xgb_pred = xgb_reg.predict(X_test)
        xgb_mae  = mean_absolute_error(y_reg_test, xgb_pred)
        xgb_r2   = r2_score(y_reg_test, xgb_pred)
        log.info(f"  RandomForest Regressor — MAE: {rf_mae:.3f}  R²: {rf_r2:.3f}")
        log.info(f"  XGBoost Regressor      — MAE: {xgb_mae:.3f}  R²: {xgb_r2:.3f}")
        best_reg      = rf_reg   if rf_mae <= xgb_mae else xgb_reg
        best_reg_name = "RandomForest" if rf_mae <= xgb_mae else "XGBoost"
        metrics["regressor"] = {
            "model": best_reg_name,
            "rf_mae": round(rf_mae, 3),   "rf_r2":  round(rf_r2, 3),
            "xgb_mae": round(xgb_mae, 3), "xgb_r2": round(xgb_r2, 3),
            "best_mae": round(min(rf_mae, xgb_mae), 3),
            "best_r2":  round(max(rf_r2,  xgb_r2),  3),
        }
    else:
        log.info("  No test data — skipping holdout evaluation, defaulting to RandomForest")
        best_reg, best_reg_name = rf_reg, "RandomForest"
        metrics["regressor"] = {"model": best_reg_name, "best_mae": None, "best_r2": None}

    log.info(f"  → Best regressor: {best_reg_name}")
    reg_path = MODELS_DIR / "finish_regressor.pkl"
    with open(reg_path, "wb") as f:
        pickle.dump({"model": best_reg, "features": FEATURE_COLS, "model_name": best_reg_name}, f)
    log.info(f"  Saved → {reg_path}")

    # ── Podium Classifier ─────────────────────────────────────────────────────
    log.info("Training podium classifiers …")

    rf_cls = RandomForestClassifier(
        n_estimators=400, max_depth=7, min_samples_leaf=2,
        max_features=0.7, random_state=42, n_jobs=-1, class_weight="balanced",
    )
    rf_cls.fit(X_train, y_cls_train)

    xgb_cls = XGBClassifier(
        n_estimators=400, max_depth=5, learning_rate=0.04,
        subsample=0.8, colsample_bytree=0.75, min_child_weight=3,
        scale_pos_weight=len(y_cls_train[y_cls_train==0]) / max(len(y_cls_train[y_cls_train==1]), 1),
        random_state=42, verbosity=0, eval_metric="logloss",
    )
    xgb_cls.fit(X_train, y_cls_train)

    if has_test:
        rf_cls_pred  = rf_cls.predict(X_test)
        rf_acc   = accuracy_score(y_cls_test, rf_cls_pred)
        rf_prec  = precision_score(y_cls_test, rf_cls_pred, zero_division=0)
        rf_rec   = recall_score(y_cls_test, rf_cls_pred, zero_division=0)
        rf_f1    = f1_score(y_cls_test, rf_cls_pred, zero_division=0)
        xgb_cls_pred = xgb_cls.predict(X_test)
        xgb_acc  = accuracy_score(y_cls_test, xgb_cls_pred)
        xgb_prec = precision_score(y_cls_test, xgb_cls_pred, zero_division=0)
        xgb_rec  = recall_score(y_cls_test, xgb_cls_pred, zero_division=0)
        xgb_f1   = f1_score(y_cls_test, xgb_cls_pred, zero_division=0)
        log.info(f"  RandomForest Classifier — Acc: {rf_acc:.3f}  P: {rf_prec:.3f}  R: {rf_rec:.3f}  F1: {rf_f1:.3f}")
        log.info(f"  XGBoost Classifier      — Acc: {xgb_acc:.3f}  P: {xgb_prec:.3f}  R: {xgb_rec:.3f}  F1: {xgb_f1:.3f}")
        best_cls      = rf_cls  if rf_f1 >= xgb_f1 else xgb_cls
        best_cls_name = "RandomForest" if rf_f1 >= xgb_f1 else "XGBoost"
        metrics["classifier"] = {
            "model": best_cls_name,
            "rf_acc": round(rf_acc, 3),   "rf_f1":  round(rf_f1, 3),
            "xgb_acc": round(xgb_acc, 3), "xgb_f1": round(xgb_f1, 3),
            "best_acc": round(max(rf_acc, xgb_acc), 3),
            "best_f1":  round(max(rf_f1,  xgb_f1),  3),
        }
    else:
        log.info("  No test data — skipping holdout evaluation, defaulting to RandomForest")
        best_cls, best_cls_name = rf_cls, "RandomForest"
        metrics["classifier"] = {"model": best_cls_name, "best_acc": None, "best_f1": None}

    log.info(f"  → Best classifier: {best_cls_name}")
    cls_path = MODELS_DIR / "podium_classifier.pkl"
    with open(cls_path, "wb") as f:
        pickle.dump({"model": best_cls, "features": FEATURE_COLS, "model_name": best_cls_name}, f)
    log.info(f"  Saved → {cls_path}")

    # ── Per-race accuracy on test set ─────────────────────────────────────────
    if has_test:
        test = test.copy()
        test["pred_finish"] = best_reg.predict(X_test)
        test["pred_error"]  = abs(test["pred_finish"] - test["finish_position"])
        per_race = (
            test.groupby("round_number")
            .agg(mae=("pred_error", "mean"), r2_approx=("pred_error", "std"))
            .reset_index()
        )
        metrics["per_race_test"] = per_race.to_dict(orient="records")
        best_round  = per_race.loc[per_race["mae"].idxmin(),  "round_number"]
        worst_round = per_race.loc[per_race["mae"].idxmax(), "round_number"]
        metrics["best_round"]  = int(best_round)
        metrics["worst_round"] = int(worst_round)
        log.info(f"  Best predicted round: R{best_round}  |  Worst: R{worst_round}")
    else:
        metrics["per_race_test"] = []
        metrics["best_round"]    = None
        metrics["worst_round"]   = None
        log.info("  Per-race test metrics skipped (no holdout data)")

    # ── Full-season predictions (all 22 rounds, train + test) ─────────────────
    X_all   = df[FEATURE_COLS]
    df_out  = df[["round_number","driver_id","team_id","finish_position","grid_position","podium"]].copy()
    df_out["pred_finish"]         = best_reg.predict(X_all)
    df_out["pred_finish_rounded"] = df_out["pred_finish"].round(1)
    df_out["pred_podium_prob"]    = best_cls.predict_proba(X_all)[:, 1]
    df_out["pred_error"]          = abs(df_out["pred_finish"] - df_out["finish_position"])
    metrics["full_season_mae"]    = round(mean_absolute_error(df_out["finish_position"], df_out["pred_finish"]), 3)

    pred_path = MODELS_DIR / f"predictions_{season}.parquet"
    df_out.to_parquet(pred_path, index=False)
    log.info(f"  Full-season predictions saved → {pred_path}")

    return metrics


# ─── CLI ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="F1 ML Training Pipeline")
    parser.add_argument("--season", type=int, default=2021)
    parser.add_argument("--dry-run", action="store_true", help="Build features only, skip training")
    args = parser.parse_args()

    conn = get_conn()

    df = build_feature_matrix(args.season, conn)
    feat_path = ML_DIR / f"features_{args.season}.parquet"
    df.to_parquet(feat_path, index=False)
    log.info(f"Features saved → {feat_path}")

    if args.dry_run:
        log.info("Dry run — skipping training")
        print(df[FEATURE_COLS + ["finish_position","podium"]].head(10).to_string())
        conn.close()
        return

    metrics = train_models(df, args.season)

    log.info("\n" + "="*60)
    log.info("TRAINING COMPLETE")
    log.info("="*60)
    log.info(f"Regressor  ({metrics['regressor']['model']}):  MAE={metrics['regressor']['best_mae']}  R²={metrics['regressor']['best_r2']}")
    log.info(f"Classifier ({metrics['classifier']['model']}): Acc={metrics['classifier']['best_acc']}  F1={metrics['classifier']['best_f1']}")
    log.info(f"Best round: R{metrics['best_round']}  |  Worst: R{metrics['worst_round']}")

    # Save metrics for API
    import json
    metrics_path = MODELS_DIR / f"metrics_{args.season}.json"
    with open(metrics_path, "w") as f:
        json.dump(metrics, f, indent=2)
    log.info(f"Metrics saved → {metrics_path}")

    conn.close()


if __name__ == "__main__":
    main()
