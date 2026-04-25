import { useState } from 'react'
import { shortName } from '../../utils/formatters'
import { ChevronDown } from 'lucide-react'
import { useRacePrediction } from '../../hooks/usePredictions'
import { TEAM_COLORS } from '../DriverAvatar'
import ShapDrawer from './ShapDrawer'
import LoadingSpinner from '../LoadingSpinner'
import ErrorMessage from '../ErrorMessage'
import type { DriverPrediction } from '../../types/predictions'

const DRAWER_W = 420

function errorRowStyle(pred: number, actual: number | null, isSelected: boolean): React.CSSProperties {
  // Fix 8: 3px border, #141414 bg on selected
  if (isSelected) return { background: '#141414', borderLeft: '3px solid #e10600', paddingLeft: 13 }
  if (actual === null) return {}
  const err = Math.abs(pred - actual)
  if (err >= 5) return { background: 'rgba(225, 6, 0, 0.06)' }
  return {}
}

function ErrorBadge({ pred, actual }: { pred: number; actual: number | null }) {
  if (actual === null) return <span style={{ color: '#404040', fontSize: 12 }}>—</span>
  const err = Math.abs(pred - actual)
  const color = err <= 2 ? '#22D3A5' : err >= 5 ? '#e10600' : '#f59e0b'
  return <span className="font-mono font-semibold" style={{ color, fontSize: 12 }}>±{err.toFixed(1)}</span>
}

function PodiumBar({ prob }: { prob: number }) {
  const pct = Math.round(prob * 100)
  const color = pct >= 70 ? '#22D3A5' : pct >= 30 ? '#f59e0b' : '#6b7280'
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="flex-1 rounded-full overflow-hidden" style={{ height: 4, background: '#1f1f1f', minWidth: 60 }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="font-mono flex-shrink-0" style={{ color, fontSize: 11, width: 30, textAlign: 'right' }}>{pct}%</span>
    </div>
  )
}

function TeamDot({ teamId }: { teamId: string | null }) {
  const color = TEAM_COLORS[teamId?.toLowerCase() ?? ''] ?? '#6b7280'
  return <span className="inline-block rounded-full flex-shrink-0" style={{ width: 8, height: 8, background: color }} />
}

interface Props {
  season: number
  races: { round_number: number; race_name: string; race_date?: string | null }[]
}

const BASE_VALUE = 10.5

export default function RacePredictionTab({ season, races }: Props) {
  const [selectedRound, setSelectedRound] = useState<number>(races[0]?.round_number ?? 1)
  const [expandedDriver, setExpandedDriver] = useState<string | null>(null)

  const { data, loading, error } = useRacePrediction(season, selectedRound)

  const toggleDriver = (driverId: string) =>
    setExpandedDriver((prev) => (prev === driverId ? null : driverId))

  const expandedPred = expandedDriver
    ? data?.predictions.find((p) => p.driver_id === expandedDriver) ?? null
    : null

  const drawerOpen = expandedPred !== null && (expandedPred.shap_features?.length ?? 0) > 0

  return (
    <>
      {/* Main content — shifts left when drawer open */}
      <div
        style={{
          marginRight: drawerOpen ? DRAWER_W : 0,
          transition: 'margin-right 250ms ease-out',
        }}
      >
        <div className="space-y-4">

          {/* Race selector */}
          <div className="flex items-center gap-3">
            <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#6b7280' }}>
              Race
            </span>
            <div className="relative">
              <select
                value={selectedRound}
                onChange={(e) => { setSelectedRound(Number(e.target.value)); setExpandedDriver(null) }}
                className="appearance-none font-mono text-white text-sm rounded-lg pl-3 pr-8 py-2 focus:outline-none"
                style={{ background: '#141414', border: '1px solid #2a2a2a', minWidth: 220 }}
              >
                {races.map((r) => (
                  <option key={r.round_number} value={r.round_number}>
                    R{r.round_number} — {shortName(r.race_name)}
                  </option>
                ))}
              </select>
              <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-f1red pointer-events-none" />
            </div>
            {data?.race_date && (
              <span style={{ fontSize: 12, color: '#6b7280' }}>{data.race_date}</span>
            )}
            {drawerOpen && (
              <span style={{ fontSize: 11, color: '#6b7280', marginLeft: 'auto' }}>
                Click a row to switch driver · Esc to close
              </span>
            )}
          </div>

          {error && <ErrorMessage message={error} />}

          {loading ? (
            <LoadingSpinner message="Generating predictions…" />
          ) : data ? (
            <div className="rounded-lg overflow-hidden" style={{ background: '#111111', border: '1px solid #1f1f1f' }}>
              {/* Table header */}
              <div
                className="grid gap-2 px-4 py-3"
                style={{
                  gridTemplateColumns: '2rem 2.5rem 1fr 1fr 5rem 7rem 4rem 4rem',
                  borderBottom: '1px solid #1f1f1f',
                  background: '#0d0d0d',
                }}
              >
                {['#', 'DRV', 'Driver', 'Team', 'Pred', 'Podium %', 'Actual', 'Error'].map((h, i) => (
                  <span
                    key={h}
                    style={{
                      fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
                      letterSpacing: '0.12em', color: '#4b5563',
                      textAlign: i >= 5 ? 'right' : 'left',
                    }}
                  >
                    {h}
                  </span>
                ))}
              </div>

              {/* Rows */}
              {data.predictions.map((pred: DriverPrediction) => {
                const isSelected = expandedDriver === pred.driver_id
                const hasShap    = pred.shap_features?.length > 0
                return (
                  <button
                    key={pred.driver_id}
                    onClick={() => hasShap ? toggleDriver(pred.driver_id) : undefined}
                    disabled={!hasShap}
                    className="w-full grid gap-2 px-4 py-3 text-left transition-colors"
                    style={{
                      gridTemplateColumns: '2rem 2.5rem 1fr 1fr 5rem 7rem 4rem 4rem',
                      borderBottom: '1px solid #161616',
                      cursor: hasShap ? 'pointer' : 'default',
                      ...errorRowStyle(pred.predicted_finish, pred.actual_finish, isSelected),
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected && hasShap) (e.currentTarget as HTMLElement).style.background = '#141414'
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) (e.currentTarget as HTMLElement).style.background = ''
                    }}
                  >
                    {/* # */}
                    <span className="self-center font-mono" style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
                      {pred.predicted_finish_rank}
                    </span>
                    {/* Abbr */}
                    <span className="self-center font-mono font-bold text-white" style={{ fontSize: 13 }}>
                      {pred.driver_id}
                    </span>
                    {/* Full name */}
                    <span className="self-center truncate" style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
                      {pred.full_name ?? pred.driver_id}
                    </span>
                    {/* Team */}
                    <div className="self-center flex items-center gap-1.5 min-w-0">
                      <TeamDot teamId={pred.team_id} />
                      <span className="truncate" style={{ fontSize: 11, color: '#6b7280' }}>{pred.team_name ?? '—'}</span>
                    </div>
                    {/* Pred */}
                    <span className="self-center font-mono font-semibold text-white" style={{ fontSize: 13 }}>
                      P{pred.predicted_finish.toFixed(1)}
                    </span>
                    {/* Podium bar */}
                    <div className="self-center">
                      <PodiumBar prob={pred.podium_probability} />
                    </div>
                    {/* Actual */}
                    <span className="self-center font-mono text-right" style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
                      {pred.actual_finish ? `P${pred.actual_finish}` : '—'}
                    </span>
                    {/* Error */}
                    <span className="self-center text-right">
                      <ErrorBadge pred={pred.predicted_finish} actual={pred.actual_finish} />
                    </span>
                  </button>
                )
              })}

              {/* Footer */}
              <div className="px-4 py-2.5" style={{ borderTop: '1px solid #161616' }}>
                <p style={{ fontSize: 10, color: '#6b7280' }}>
                  Click any row to open SHAP explanation · Green rows = within ±2 · Red = off by 5+
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* SHAP drawer — fixed, slides in from right */}
      {drawerOpen && expandedPred && (
        <ShapDrawer
          pred={expandedPred}
          baseValue={BASE_VALUE}
          onClose={() => setExpandedDriver(null)}
        />
      )}
    </>
  )
}
