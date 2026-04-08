export interface DriverStint {
  stint: number
  compound: string
  start_lap: number
  end_lap: number
  laps: number
}

export interface FastestPitstop {
  driver_id: string
  abbreviation: string
  pit_duration_seconds: number
  lap_number: number
}

export interface DriverStintData {
  driver_id: string
  abbreviation: string
  full_name: string
  finish_position: number
  stints: DriverStint[]
}

export interface StintSummaryResponse {
  race_id: number
  race_name: string
  round_number: number
  total_laps: number
  drivers: DriverStintData[]
  fastest_pitstop: FastestPitstop | null
}

export interface CompoundUsagePerRace {
  race_id: number
  round_number: number
  race_name: string
  compounds: Record<string, number>
}

export interface CompoundUsageResponse {
  total: Record<string, number>
  per_race: CompoundUsagePerRace[]
}

export interface StrategyClusterEntry {
  race_id: number
  round_number: number
  race_name: string
}

export interface RaceStrategyRow extends StrategyClusterEntry {
  avg_stops: number
  dominant_strategy: string
  winner: string | null
}

export interface StrategyClustersResponse {
  clusters: {
    '1-stop': StrategyClusterEntry[]
    '2-stop': StrategyClusterEntry[]
    '3-stop+': StrategyClusterEntry[]
  }
  race_strategies: RaceStrategyRow[]
}

export interface CompoundPerformance {
  compound: string
  avg_lap_time: number | null
  total_laps: number
  degradation_per_lap: number
}

export interface DriverRaceStrategy {
  race_id: number
  round_number: number
  race_name: string
  total_laps: number
  finish_position: number | null
  stints: DriverStint[]
}
