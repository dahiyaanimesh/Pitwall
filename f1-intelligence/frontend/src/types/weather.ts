export type TrackStatus = 'Green' | 'Yellow' | 'SC' | 'VSC' | 'Red'

export interface LapStatus {
  lap: number
  status: TrackStatus
}

export interface PittedDriver {
  driver_id: string
  abbreviation: string
  full_name: string
}

export interface SafetyCarEvent {
  race_id: number
  race_name: string
  round: number
  lap_start: number
  lap_end: number
  type: 'SC' | 'VSC'
  laps_neutralised: number
  drivers_pitted: PittedDriver[]
}

export interface StatusSummary {
  race_id: number
  green_laps: number
  yellow_laps: number
  sc_laps: number
  vsc_laps: number
  red_flag_laps: number
  total_laps: number
  green_pct: number
  interventions: number
}

export interface RaceSeasonOverview {
  race_id: number
  round_number: number
  race_name: string
  total_laps: number
  lap_statuses: Record<string, TrackStatus>
  green_pct: number
  sc_laps: number
  vsc_laps: number
  interventions: number
}
