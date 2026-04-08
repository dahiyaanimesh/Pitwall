"""
Pitwall — SHAP Explainer

Loads trained models, computes SHAP values for a single prediction row,
and returns the top-N features driving that prediction.

Designed to be called once per server startup (models cached in memory),
then shap_for_row() called per request.
"""

import pickle
import warnings
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd
import shap

warnings.filterwarnings("ignore")

ML_DIR     = Path(__file__).resolve().parent
MODELS_DIR = ML_DIR / "models"

# ─── Human-readable feature names ─────────────────────────────────────────────
FEATURE_LABELS = {
    "grid_position":               "Grid Position",
    "qual_gap_to_pole":            "Quali Gap to Pole",
    "avg_finish_last3":            "Avg Finish (last 3)",
    "avg_finish_last5":            "Avg Finish (last 5)",
    "avg_points_last3":            "Avg Points (last 3)",
    "dnf_rate_last3":              "DNF Rate (last 3)",
    "avg_consistency_last3":       "Lap Consistency (last 3)",
    "cumulative_points":           "Season Points (to date)",
    "championship_rank":           "Championship Rank",
    "circuit_type":                "Circuit Type",
    "circuit_history_avg_finish":  "Circuit History",
    "team_avg_finish_last3":       "Team Form (last 3)",
    "team_points_last3":           "Team Points (last 3)",
}


class ShapExplainer:
    """
    Singleton-style explainer: load once, explain many times.
    Call ShapExplainer.instance() to get the cached singleton.
    """

    _instance: Optional["ShapExplainer"] = None

    def __init__(self):
        self.reg_bundle  = self._load("finish_regressor.pkl")
        self.cls_bundle  = self._load("podium_classifier.pkl")
        self.reg_model   = self.reg_bundle["model"]
        self.cls_model   = self.cls_bundle["model"]
        self.feature_cols = self.reg_bundle["features"]

        # Build SHAP explainers — TreeExplainer works for both RF and XGB
        self.reg_explainer = shap.TreeExplainer(self.reg_model)
        self.cls_explainer = shap.TreeExplainer(self.cls_model)

    @classmethod
    def instance(cls) -> "ShapExplainer":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    @classmethod
    def reset(cls):
        """Force reload on next access (call after re-training)."""
        cls._instance = None

    @staticmethod
    def _load(filename: str) -> dict:
        path = MODELS_DIR / filename
        if not path.exists():
            raise FileNotFoundError(
                f"Model artifact not found: {path}\n"
                "Run: python backend/ml/train.py --season 2021"
            )
        with open(path, "rb") as f:
            return pickle.load(f)

    def shap_for_row(
        self,
        row: pd.Series,
        model_type: str = "regressor",
        top_n: int = 5,
    ) -> list[dict]:
        """
        Compute SHAP values for a single feature row.

        Args:
            row:        pd.Series with FEATURE_COLS values
            model_type: 'regressor' or 'classifier'
            top_n:      number of top features to return

        Returns list of dicts:
          [{"feature": str, "label": str, "shap_value": float,
            "feature_value": float, "direction": "positive"|"negative"}, ...]

        Note: For the regressor, a NEGATIVE shap_value means the feature
        pushes the prediction LOWER (better finish position), so we flip
        the direction label: negative shap = "better" direction.
        """
        X = pd.DataFrame([row[self.feature_cols]], columns=self.feature_cols)

        if model_type == "regressor":
            explainer = self.reg_explainer
            shap_vals = explainer.shap_values(X)
            # shap_values returns array shape (1, n_features)
            if isinstance(shap_vals, list):
                # Multi-output RF — take first output
                vals = np.array(shap_vals[0]).flatten()
            else:
                vals = np.array(shap_vals).flatten()
            base_value = float(explainer.expected_value
                               if np.isscalar(explainer.expected_value)
                               else explainer.expected_value[0])
        else:
            explainer = self.cls_explainer
            shap_vals = explainer.shap_values(X)
            # For RF classifier: shap_values returns [class0_vals, class1_vals]
            if isinstance(shap_vals, list) and len(shap_vals) == 2:
                vals = np.array(shap_vals[1]).flatten()   # class=1 (podium)
                base_value = float(explainer.expected_value[1]
                                   if hasattr(explainer.expected_value, "__len__")
                                   else explainer.expected_value)
            else:
                vals = np.array(shap_vals).flatten()
                base_value = float(explainer.expected_value
                                   if np.isscalar(explainer.expected_value)
                                   else explainer.expected_value[0])

        # Build sorted result
        features = self.feature_cols
        results = []
        for feat, sv, fv in zip(features, vals, row[self.feature_cols].values):
            results.append({
                "feature": feat,
                "label": FEATURE_LABELS.get(feat, feat),
                "shap_value": float(sv),
                "feature_value": float(fv) if not pd.isna(fv) else None,
            })

        # Sort by abs(shap_value) descending
        results.sort(key=lambda x: abs(x["shap_value"]), reverse=True)
        top = results[:top_n]

        # Direction: for regressor, negative shap = predicts better (lower) finish
        # For classifier, positive shap = more likely to podium
        for item in top:
            sv = item["shap_value"]
            if model_type == "regressor":
                item["direction"] = "better" if sv < 0 else "worse"
            else:
                item["direction"] = "positive" if sv > 0 else "negative"
            item["impact"] = round(abs(sv), 4)
            item["shap_value"] = round(sv, 4)

        return top

    def explain_race(
        self,
        season_df: pd.DataFrame,
        round_number: int,
        top_n: int = 5,
    ) -> list[dict]:
        """
        Explain predictions for every driver in a given race round.

        Returns list of per-driver dicts with predicted finish, podium prob,
        and SHAP features.
        """
        race_df = season_df[season_df["round_number"] == round_number].copy()
        if race_df.empty:
            return []

        reg_model = self.reg_model
        cls_model = self.cls_model

        X = race_df[self.feature_cols]
        pred_finish = reg_model.predict(X)
        pred_proba  = cls_model.predict_proba(X)[:, 1]

        results = []
        for i, (idx, row) in enumerate(race_df.iterrows()):
            shap_features = self.shap_for_row(row, model_type="regressor", top_n=top_n)
            results.append({
                "driver_id":              row["driver_id"],
                "team_id":                row.get("team_id"),
                "predicted_finish":       round(float(pred_finish[i]), 2),
                "predicted_finish_rank":  0,   # filled below
                "podium_probability":     round(float(pred_proba[i]), 3),
                "actual_finish":          int(row["finish_position"]) if not pd.isna(row["finish_position"]) else None,
                "grid_position":          int(row["grid_position"]) if not pd.isna(row["grid_position"]) else None,
                "shap_features":          shap_features,
            })

        # Rank by predicted finish
        results.sort(key=lambda x: x["predicted_finish"])
        for rank, r in enumerate(results, 1):
            r["predicted_finish_rank"] = rank

        return results
