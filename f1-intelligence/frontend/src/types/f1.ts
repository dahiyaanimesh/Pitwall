// ─── Core entities ────────────────────────────────────────────────────────────

export interface Driver {
  driver_id: string
  full_name: string
  abbreviation: string
  nationality: string | null
  team_name: string | null
  team_id: string | null
  total_points: number | null
}

export interface Race {
  race_id: number
  season_year: number
  round_number: number
  race_name: string
  race_date: string | null
  total_laps: number | null
  circuit_id: string | null
  circuit_name: string | null
  country: string | null
  city: string | null
}

export interface RaceResult {
  result_id: number
  race_id: number
  driver_id: string
  full_name: string
  abbreviation: string
  team_id: string | null
  team_name: string | null
  grid_position: number | null
  finish_position: number | null
  classified_position: string | null
  points: number | null
  laps_completed: number | null
  status: string | null
  fastest_lap: number
  fastest_lap_time: number | null
}

export interface LapTime {
  lap_id: number
  race_id: number
  driver_id: string
  lap_number: number
  lap_time_seconds: number | null
  sector1_seconds: number | null
  sector2_seconds: number | null
  sector3_seconds: number | null
  is_personal_best: number
  compound: string | null
  tyre_life: number | null
  track_status: string
  position: number | null
}

export interface PitStop {
  pit_id: number
  race_id: number
  driver_id: string
  full_name: string
  lap_number: number
  pit_duration_seconds: number | null
  compound_in: string | null
  compound_out: string | null
  stop_number: number
}

// ─── Driver performance ────────────────────────────────────────────────────────

export interface DriverSeasonStats {
  stat_id: number
  season_year: number
  driver_id: string
  team_id: string | null
  total_points: number
  wins: number
  podiums: number
  poles: number
  fastest_laps: number
  dnfs: number
  avg_finish_position: number | null
  avg_grid_position: number | null
  avg_lap_consistency: number | null
  overperformance_score: number | null
  full_name: string
  team_name: string | null
}

export interface SeasonArcPoint {
  round_number: number
  race_name: string
  race_date: string | null
  finish_position: number | null
  points_scored: number
  cumulative_points: number
  avg_lap_time: number | null
  best_lap_time: number | null
  lap_count: number
  lap_consistency_stddev: number | null
}

export interface SeasonArcResponse {
  driver_id: string
  season: number
  arc: SeasonArcPoint[]
}

export interface PaceProfilePoint {
  round_number: number
  race_name: string
  race_date: string | null
  avg_lap_time: number | null
  median_lap_time: number | null
  best_lap_time: number | null
  consistency_stddev: number | null
  lap_count: number
}

export interface PaceProfileResponse {
  driver_id: string
  season: number
  profile: PaceProfilePoint[]
}

// ─── Teammate battle ───────────────────────────────────────────────────────────

export interface TeammateDriverStats {
  driver_id: string
  full_name: string
  total_points: number
  wins: number
  podiums: number
  avg_finish_position: number | null
  avg_lap_consistency: number | null
  overperformance_score: number | null
  avg_clean_lap: number | null
}

export interface TeammateStats {
  team_id: string
  team_name: string
  driver1: TeammateDriverStats
  driver2: TeammateDriverStats | null
  head_to_head_wins: {
    driver1_ahead: number
    driver2_ahead: number
    total_races: number
  } | null
  points_delta: number | null
  avg_finish_delta: number | null
  avg_lap_delta_ms: number | null
}

// ─── Overperformers ───────────────────────────────────────────────────────────

export interface OverperformerRow {
  rank: number
  driver_id: string
  full_name: string
  team_name: string | null
  team_id: string | null
  total_points: number
  wins: number
  podiums: number
  avg_finish_position: number | null
  avg_grid_position: number | null
  overperformance_score: number | null
  position_delta: number | null
}

// ─── Compare ──────────────────────────────────────────────────────────────────

export interface CompareResponse {
  season: number
  driver1: DriverSeasonStats & { avg_lap_time: number | null }
  driver2: DriverSeasonStats & { avg_lap_time: number | null }
  head_to_head: {
    points_gap: number
    wins_gap: number
    podiums_gap: number
  }
}
