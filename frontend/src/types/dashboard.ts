export interface StandingsEntry {
  driver_id: string
  full_name: string
  team_name: string | null
  team_id: string | null
  total_points: number
  wins: number
  podiums: number
  avg_finish_position: number | null
  overperformance_score: number | null
}

export interface ConstructorEntry {
  team_name: string | null
  team_id: string | null
  points: number
  wins: number
  drivers: number
}

export interface TrajectoryPoint {
  round: number
  label: string
  [driverId: string]: number | string
}

export interface SeasonStats {
  race_count: number
  winner_count: number
  points_gap: number | null
}

export interface DominantDriver {
  driver_id: string
  full_name: string
  team_name: string | null
  overperformance_score: number
  avg_finish_position: number | null
  avg_grid_position: number | null
}

export interface ClosestBattle {
  team_id: string
  team_name: string | null
  d1_id: string
  d2_id: string
  avg_qual_delta_ms: number
}

export interface MostPitstops {
  race_name: string
  season_year: number
  round_number: number
  driver_id: string
  total_stops: number
  city: string | null
}

export interface DashboardSummary {
  season: number
  standings: StandingsEntry[]
  constructors: ConstructorEntry[]
  top5_ids: string[]
  trajectory: TrajectoryPoint[]
  season_stats: SeasonStats
  callouts: {
    most_dominant: DominantDriver | null
    closest_battle: ClosestBattle | null
    most_pitstops: MostPitstops | null
  }
  insight: string | null
}
