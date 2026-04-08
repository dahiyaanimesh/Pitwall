import { useTeammateBattle } from '../../hooks/useTeammateBattle'
import { TEAM_COLORS } from '../DriverAvatar'
import LoadingSpinner from '../LoadingSpinner'
import ErrorMessage from '../ErrorMessage'
import type { TeammateStats, TeammateDriverStats } from '../../types/f1'

const CHAMPIONSHIP_TEAMS = new Set(['red_bull_racing', 'mercedes'])

function TeamColor({ teamId }: { teamId: string }) {
  const color = TEAM_COLORS[teamId?.toLowerCase()] ?? '#6b7280'
  return <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
}

function DriverColumn({ driver, isPrimary }: { driver: TeammateDriverStats; isPrimary: boolean }) {
  return (
    <div className={`flex-1 ${isPrimary ? 'text-left' : 'text-right'}`}>
      <p className="text-xs text-f1muted mb-0.5">{isPrimary ? 'Driver 1' : 'Driver 2'}</p>
      <p className="font-bold text-white text-base">{driver.driver_id}</p>
      <p className="text-xs text-white/50">{driver.full_name}</p>
      <div className="mt-2 space-y-0.5">
        <p className="text-sm font-semibold text-white">{driver.total_points} pts</p>
        <p className="text-xs text-white/50">{driver.wins}W / {driver.podiums}P</p>
        {driver.avg_clean_lap && (
          <p className="text-xs text-f1muted font-mono">{driver.avg_clean_lap.toFixed(3)}s avg</p>
        )}
      </div>
    </div>
  )
}

function H2HBar({ d1Ahead, d2Ahead, total, color }: { d1Ahead: number; d2Ahead: number; total: number; color: string }) {
  if (!total) return null
  const d1Pct = (d1Ahead / total) * 100
  const d2Pct = (d2Ahead / total) * 100
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-f1muted">
        <span>{d1Ahead} races</span>
        <span className="text-white/40">H2H</span>
        <span>{d2Ahead} races</span>
      </div>
      <div className="flex h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <div className="transition-all" style={{ width: `${d1Pct}%`, background: color }} />
        <div className="transition-all" style={{ width: `${d2Pct}%`, background: `${color}55` }} />
      </div>
    </div>
  )
}

function TeamCard({ team }: { team: TeammateStats }) {
  const isChampionship = CHAMPIONSHIP_TEAMS.has(team.team_id?.toLowerCase() ?? '')
  const color = TEAM_COLORS[team.team_id?.toLowerCase() ?? ''] ?? '#6b7280'
  const d1 = team.driver1
  const d2 = team.driver2

  return (
    <div
      className={`bg-f1gray rounded-lg border p-4 space-y-3 ${
        isChampionship ? 'border-f1red/40 shadow-lg shadow-f1red/5' : 'border-f1border'
      }`}
    >
      {/* Team header */}
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: color }} />
        <span className="font-semibold text-sm text-white">{team.team_name}</span>
        {isChampionship && (
          <span className="ml-auto text-[10px] font-bold uppercase tracking-wider text-f1red border border-f1red/40 px-1.5 py-0.5 rounded">
            Championship
          </span>
        )}
      </div>

      {/* Driver comparison */}
      {d1 && d2 ? (
        <>
          <div className="flex gap-2">
            <DriverColumn driver={d1} isPrimary={true} />
            <TeamColor teamId={team.team_id} />
            <DriverColumn driver={d2} isPrimary={false} />
          </div>

          {team.head_to_head_wins && (
            <H2HBar
              d1Ahead={team.head_to_head_wins.driver1_ahead}
              d2Ahead={team.head_to_head_wins.driver2_ahead}
              total={team.head_to_head_wins.total_races}
              color={color}
            />
          )}

          {/* Deltas */}
          <div className="grid grid-cols-3 gap-2 pt-1 border-t border-f1border">
            {[
              { label: 'Pts Δ', value: team.points_delta !== null ? `${team.points_delta > 0 ? '+' : ''}${team.points_delta}` : '–' },
              { label: 'Finish Δ', value: team.avg_finish_delta !== null ? `${team.avg_finish_delta > 0 ? '+' : ''}${team.avg_finish_delta?.toFixed(1)}` : '–' },
              { label: 'Lap Δ', value: team.avg_lap_delta_ms !== null ? `${team.avg_lap_delta_ms > 0 ? '+' : ''}${team.avg_lap_delta_ms}ms` : '–' },
            ].map(({ label, value }) => (
              <div key={label} className="text-center">
                <p className="text-[10px] text-white/40 uppercase tracking-wider">{label}</p>
                <p className="text-sm font-mono font-semibold text-white/70">{value}</p>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="text-xs text-f1muted">Only one driver this season</div>
      )}
    </div>
  )
}

interface Props {
  season: number
}

export default function TeammateBattleTab({ season }: Props) {
  const { data, loading, error } = useTeammateBattle(season)

  if (loading) return <LoadingSpinner message="Loading teammate battles…" />
  if (error) return <ErrorMessage message={error} />

  // Championship teams first, then alphabetical
  const sorted = [...data].sort((a, b) => {
    const aC = CHAMPIONSHIP_TEAMS.has(a.team_id?.toLowerCase() ?? '') ? 0 : 1
    const bC = CHAMPIONSHIP_TEAMS.has(b.team_id?.toLowerCase() ?? '') ? 0 : 1
    return aC - bC || (a.team_name ?? '').localeCompare(b.team_name ?? '')
  })

  return (
    <div className="space-y-4">
      <p className="text-xs text-f1muted">
        Positive Δ values = Driver 1 ahead. All metrics across races where both drivers finished.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sorted.map((team) => (
          <TeamCard key={team.team_id} team={team} />
        ))}
      </div>
    </div>
  )
}
