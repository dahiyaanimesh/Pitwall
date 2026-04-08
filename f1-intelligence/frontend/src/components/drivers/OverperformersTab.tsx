import { useState } from 'react'
import { useOverperformers } from '../../hooks/useOverperformers'
import { TEAM_COLORS } from '../DriverAvatar'
import LoadingSpinner from '../LoadingSpinner'
import ErrorMessage from '../ErrorMessage'

const TOOLTIP_TEXT = `Overperformance Score = average of (grid position − finish position) across all races.
A positive score means the driver consistently gained positions from where they started.
A score of +3 means the driver finished ~3 places ahead of their grid slot on average.
Reflects racecraft, strategy execution, and car management vs. raw qualifying pace.`

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-white/40 text-sm font-mono">N/A</span>
  const neutral = Math.abs(score) < 0.25
  const positive = score > 0
  const style = neutral
    ? { color: 'rgba(255,255,255,0.5)', background: '#1f1f1f', border: '1px solid #2a2a2a' }
    : positive
    ? { color: '#22D3A5', background: 'rgba(34,211,165,0.08)', border: '1px solid rgba(34,211,165,0.2)' }
    : { color: '#E10600', background: 'rgba(225,6,0,0.08)', border: '1px solid rgba(225,6,0,0.2)' }
  return (
    <span className="inline-block px-2 py-0.5 rounded text-sm font-mono font-semibold" style={style}>
      {score > 0 ? '+' : ''}{score.toFixed(2)}
    </span>
  )
}

function TeamDot({ teamId }: { teamId: string | null }) {
  const color = TEAM_COLORS[teamId?.toLowerCase() ?? ''] ?? '#6b7280'
  return <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: color }} />
}

interface Props {
  season: number
}

export default function OverperformersTab({ season }: Props) {
  const { data, loading, error } = useOverperformers(season)
  const [showTooltip, setShowTooltip] = useState(false)

  if (loading) return <LoadingSpinner message="Ranking overperformers…" />
  if (error) return <ErrorMessage message={error} />

  const withScore = data.filter((r) => r.overperformance_score !== null)
  const noScore = data.filter((r) => r.overperformance_score === null)

  return (
    <div className="space-y-4">
      {/* Header with tooltip */}
      <div className="flex items-start gap-2">
        <p className="text-xs text-f1muted flex-1">
          Ranked by overperformance score — who squeezed the most out of their car.
        </p>
        <div className="relative">
          <button
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            className="w-5 h-5 rounded-full border border-f1border text-f1muted text-xs hover:border-gray-400 hover:text-white/70 transition-colors flex items-center justify-center flex-shrink-0"
          >
            ?
          </button>
          {showTooltip && (
            <div className="absolute right-0 top-7 w-72 bg-f1gray border border-f1border rounded-lg p-3 text-xs text-white/50 z-10 shadow-xl whitespace-pre-line">
              {TOOLTIP_TEXT}
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-f1gray border border-f1border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-f1border text-xs text-f1muted uppercase tracking-widest">
              <th className="px-4 py-3 text-left w-8">#</th>
              <th className="px-4 py-3 text-left">Driver</th>
              <th className="px-4 py-3 text-left">Team</th>
              <th className="px-4 py-3 text-right">Score</th>
              <th className="px-4 py-3 text-right">Avg Finish</th>
              <th className="px-4 py-3 text-right">Avg Grid</th>
              <th className="px-4 py-3 text-right">Pts</th>
            </tr>
          </thead>
          <tbody>
            {withScore.map((row, i) => (
              <tr
                key={row.driver_id}
                className={`border-b border-f1border/50 table-row-hover transition-colors ${
                  i === 0 ? 'bg-[rgba(34,211,165,0.03)]' : ''
                }`}
              >
                <td className="px-4 py-3 text-white/35 font-mono text-xs">{row.rank}</td>
                <td className="px-4 py-3">
                  <div>
                    <span className="font-bold text-white font-mono">{row.driver_id}</span>
                    <span className="text-white/50 text-xs ml-2">{row.full_name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-white/50 text-xs">
                  <TeamDot teamId={row.team_id} />
                  {row.team_name ?? '—'}
                </td>
                <td className="px-4 py-3 text-right">
                  <ScoreBadge score={row.overperformance_score} />
                </td>
                <td className="px-4 py-3 text-right text-white/70 font-mono text-xs">
                  {row.avg_finish_position !== null ? `P${row.avg_finish_position.toFixed(1)}` : 'N/A'}
                </td>
                <td className="px-4 py-3 text-right text-white/50 font-mono text-xs">
                  {row.avg_grid_position !== null ? `P${row.avg_grid_position.toFixed(1)}` : 'N/A'}
                </td>
                <td className="px-4 py-3 text-right text-white font-semibold">
                  {row.total_points}
                </td>
              </tr>
            ))}
            {noScore.length > 0 && (
              <tr className="border-b border-f1border/30">
                <td colSpan={7} className="px-4 py-2 text-xs text-white/40 italic">
                  {noScore.length} driver(s) without grid position data
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
