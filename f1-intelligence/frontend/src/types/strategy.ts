// ─── Tyre Degradation ─────────────────────────────────────────────────────────

export interface DegradationPoint {
  tyre_life: number
  avg_lap_time: number
  std: number | null
  n: number
  fitted_lap_time: number | null
}

export interface CompoundCurve {
  compound: string
  degradation_rate_per_lap: number | null   // null = insufficient clean data
  base_lap_time: number | null
  data_points: number
  curve: DegradationPoint[]
}

export interface TyreDegradationResponse {
  race_id: number
  race_name: string
  compounds: CompoundCurve[]
}

// ─── Pit Window ───────────────────────────────────────────────────────────────

export interface Recommendation {
  action: 'PIT_NOW' | 'MARGINAL' | 'STAY_OUT'
  undercut_viable: boolean
  overcut_viable: boolean
  undercut_gain_estimate: number
  effective_pit_loss: number
  pace_delta_vs_fresh: number
  reasoning: string
}

export interface CurrentState {
  position: number | null
  compound: string
  tyre_life: number
  lap_time: number | null
  track_status: string
  gap_to_ahead: number | null
  gap_to_behind: number | null
  grid_position: number | null
  prev_lap_time: number | null
}

export interface PitWindowResponse {
  race_id: number
  race_name: string
  driver_id: string
  lap: number
  total_laps: number
  laps_remaining: number
  current_state: CurrentState
  recommendation: Recommendation
}

// ─── Race Replay ──────────────────────────────────────────────────────────────

export interface ActualPit {
  compound_in: string | null
  compound_out: string | null
  duration_sec: number | null
}

export interface ReplayLap {
  lap: number
  position: number | null
  compound: string
  tyre_life: number
  lap_time: number | null
  track_status: string
  gap_to_ahead: number | null
  gap_to_behind: number | null
  laps_remaining: number
  recommendation: 'PIT_NOW' | 'MARGINAL' | 'STAY_OUT'
  undercut_viable: boolean
  pace_delta: number
  actual_pit: ActualPit | null
}

export interface RaceReplayResponse {
  race_id: number
  race_name: string
  driver_id: string
  total_laps: number
  laps: ReplayLap[]
}
