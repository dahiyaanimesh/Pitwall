"""
Predictions API routes — ML-powered race outcome predictions with SHAP.
"""

import json
import sqlite3
from functools import lru_cache
from pathlib import Path
import pandas as pd
from fastapi import APIRouter, HTTPException, Query

DB_PATH   = Path(__file__).resolve().parent.parent.parent / "database" / "f1.db"
ML_DIR    = Path(__file__).resolve().parent.parent.parent / "ml"
MODELS_DIR = ML_DIR / "models"

router = APIRouter()


# ── Lazy-loaded singletons ─────────────────────────────────────────────────────

def _get_explainer():
    """Import and return ShapExplainer singleton. Lazy to avoid startup cost."""
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent))
    from backend.ml.shap_explainer import ShapExplainer
    return ShapExplainer.instance()


@lru_cache(maxsize=4)
def _load_features(season: int) -> pd.DataFrame:
    path = ML_DIR / f"features_{season}.parquet"
    if not path.exists():
        raise FileNotFoundError(
            f"Feature matrix not found for {season}. "
            f"Run: python backend/ml/train.py --season {season}"
        )
    return pd.read_parquet(path, engine='fastparquet')


@lru_cache(maxsize=4)
def _load_predictions(season: int) -> pd.DataFrame:
    path = MODELS_DIR / f"predictions_{season}.parquet"
    if not path.exists():
        raise FileNotFoundError(f"Predictions parquet not found for {season}")
    return pd.read_parquet(path, engine='fastparquet')


@lru_cache(maxsize=4)
def _load_metrics(season: int) -> dict:
    path = MODELS_DIR / f"metrics_{season}.json"
    if not path.exists():
        raise FileNotFoundError(f"Metrics file not found for {season}")
    with open(path) as f:
        return json.load(f)


def _get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _models_available(season: int) -> bool:
    return (
        (MODELS_DIR / "finish_regressor.pkl").exists()
        and (MODELS_DIR / "podium_classifier.pkl").exists()
        and (ML_DIR / f"features_{season}.parquet").exists()
    )


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("")
def predictions_status():
    """Check whether ML models are trained and ready."""
    season = 2021
    ready = _models_available(season)
    return {
        "status": "ready" if ready else "not_trained",
        "message": (
            "Models loaded and ready."
            if ready else
            "Run: python backend/ml/train.py --season 2021"
        ),
        "models": {
            "finish_regressor": (MODELS_DIR / "finish_regressor.pkl").exists(),
            "podium_classifier": (MODELS_DIR / "podium_classifier.pkl").exists(),
            "features_2021": (ML_DIR / "features_2021.parquet").exists(),
        },
    }


@router.get("/race")
def predict_race(
    season: int = Query(2021),
    round: int  = Query(..., description="Round number 1-22"),
):
    """
    For each driver entered in a race:
    - predicted_finish_position
    - podium_probability
    - top5_shap_features
    - actual_finish (for comparison, if race already happened)
    """
    if not _models_available(season):
        raise HTTPException(
            status_code=503,
            detail="ML models not trained. Run: python backend/ml/train.py --season 2021",
        )

    try:
        features_df = _load_features(season)
        explainer   = _get_explainer()
    except FileNotFoundError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Model load error: {e}")

    if round not in features_df["round_number"].values:
        raise HTTPException(status_code=404, detail=f"Round {round} not found in {season} season data")

    try:
        race_predictions = explainer.explain_race(features_df, round_number=round, top_n=5)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction error: {e}")

    # Enrich with driver/team names from DB
    conn = _get_conn()
    driver_meta = {
        row["driver_id"]: dict(row)
        for row in conn.execute(
            "SELECT driver_id, full_name, abbreviation FROM drivers"
        ).fetchall()
    }
    team_meta = {
        row["team_id"]: dict(row)
        for row in conn.execute(
            "SELECT team_id, team_name FROM teams"
        ).fetchall()
    }
    race_meta = conn.execute(
        "SELECT race_name, race_date FROM races WHERE season_year=? AND round_number=?",
        (season, round),
    ).fetchone()
    conn.close()

    for pred in race_predictions:
        d = driver_meta.get(pred["driver_id"], {})
        t = team_meta.get(pred.get("team_id"), {})
        pred["full_name"]  = d.get("full_name")
        pred["team_name"]  = t.get("team_name")

    return {
        "season":     season,
        "round":      round,
        "race_name":  race_meta["race_name"]  if race_meta else None,
        "race_date":  race_meta["race_date"]  if race_meta else None,
        "predictions": race_predictions,
        "model_note": (
            "Temporal split: model trained on R1-R17, tested on R18-R22. "
            "With 440 training rows expect MAE ~3 positions."
        ),
    }


@router.get("/accuracy")
def model_accuracy(season: int = Query(2021)):
    """
    Season-level model accuracy:
    - overall MAE, R²
    - per-race breakdown
    - best/worst predicted race
    - full pred vs actual for charting
    """
    if not _models_available(season):
        raise HTTPException(
            status_code=503,
            detail="Models not trained. Run: python backend/ml/train.py --season 2021",
        )

    try:
        metrics  = _load_metrics(season)
        preds_df = _load_predictions(season)
    except FileNotFoundError as e:
        raise HTTPException(status_code=503, detail=str(e))

    # Predicted vs actual for VER and HAM across the season
    def driver_series(driver_id: str) -> list[dict]:
        rows = (
            preds_df[preds_df["driver_id"] == driver_id]
            .sort_values("round_number")
        )
        # Enrich with race names
        conn = _get_conn()
        race_names = {
            r["round_number"]: r["race_name"]
            for r in conn.execute(
                "SELECT round_number, race_name FROM races WHERE season_year=?", (season,)
            ).fetchall()
        }
        conn.close()

        return [
            {
                "round_number":    int(row["round_number"]),
                "race_name":       race_names.get(int(row["round_number"]), f"R{int(row['round_number'])}"),
                "actual_finish":   int(row["finish_position"]),
                "pred_finish":     round(float(row["pred_finish"]), 2),
                "error":           round(abs(float(row["pred_finish"]) - float(row["finish_position"])), 2),
                "in_test_set":     int(row["round_number"]) > 17,
            }
            for _, row in rows.iterrows()
        ]

    # Per-round error summary across ALL drivers
    per_round = (
        preds_df.assign(error=lambda d: abs(d["pred_finish"] - d["finish_position"]))
        .groupby("round_number")
        .agg(mae=("error", "mean"), drivers=("driver_id", "count"))
        .reset_index()
        .sort_values("round_number")
    )
    conn = _get_conn()
    race_names = {
        r["round_number"]: r["race_name"]
        for r in conn.execute(
            "SELECT round_number, race_name FROM races WHERE season_year=?", (season,)
        ).fetchall()
    }
    conn.close()
    per_round["race_name"] = per_round["round_number"].map(race_names)

    # Most surprising error (largest single-driver error in test set)
    test_preds = preds_df[preds_df["round_number"] > 17].copy()
    test_preds["error"] = abs(test_preds["pred_finish"] - test_preds["finish_position"])
    worst_row = test_preds.loc[test_preds["error"].idxmax()] if not test_preds.empty else None

    return {
        "season": season,
        "metrics": metrics["regressor"],
        "classifier_metrics": metrics["classifier"],
        "train_rounds": f"R1-R{17}",
        "test_rounds":  f"R{18}-R22",
        "full_season_mae": metrics.get("full_season_mae"),
        "best_round":  metrics.get("best_round"),
        "worst_round": metrics.get("worst_round"),
        "per_round_mae": [
            {
                "round_number": int(r["round_number"]),
                "race_name": r["race_name"],
                "mae": round(float(r["mae"]), 3),
                "in_test_set": int(r["round_number"]) > 17,
            }
            for _, r in per_round.iterrows()
        ],
        "driver_series": {
            "VER": driver_series("VER"),
            "HAM": driver_series("HAM"),
        },
        "worst_prediction": {
            "driver_id":     str(worst_row["driver_id"])      if worst_row is not None else None,
            "round_number":  int(worst_row["round_number"])   if worst_row is not None else None,
            "actual":        int(worst_row["finish_position"]) if worst_row is not None else None,
            "predicted":     round(float(worst_row["pred_finish"]), 1) if worst_row is not None else None,
            "error":         round(float(worst_row["error"]), 1)       if worst_row is not None else None,
        } if worst_row is not None else None,
    }
