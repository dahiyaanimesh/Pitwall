export interface ShapFeature {
  feature: string
  label: string
  shap_value: number
  feature_value: number | null
  direction: 'better' | 'worse' | 'positive' | 'negative'
  impact: number
}

export interface DriverPrediction {
  driver_id: string
  full_name: string | null
  team_id: string | null
  team_name: string | null
  predicted_finish: number
  predicted_finish_rank: number
  podium_probability: number
  actual_finish: number | null
  grid_position: number | null
  shap_features: ShapFeature[]
}

export interface RacePredictionResponse {
  season: number
  round: number
  race_name: string | null
  race_date: string | null
  predictions: DriverPrediction[]
  model_note: string
}

export interface PerRoundMAE {
  round_number: number
  race_name: string
  mae: number
  in_test_set: boolean
}

export interface DriverSeriesPoint {
  round_number: number
  race_name: string
  actual_finish: number
  pred_finish: number
  error: number
  in_test_set: boolean
}

export interface AccuracyResponse {
  season: number
  metrics: {
    model: string
    best_mae: number
    best_r2: number
    rf_mae: number
    xgb_mae: number
  }
  classifier_metrics: {
    model: string
    best_acc: number
    best_f1: number
  }
  train_rounds: string
  test_rounds: string
  full_season_mae: number
  best_round: number
  worst_round: number
  per_round_mae: PerRoundMAE[]
  driver_series: {
    VER: DriverSeriesPoint[]
    HAM: DriverSeriesPoint[]
  }
  worst_prediction: {
    driver_id: string
    round_number: number
    actual: number
    predicted: number
    error: number
  } | null
}
