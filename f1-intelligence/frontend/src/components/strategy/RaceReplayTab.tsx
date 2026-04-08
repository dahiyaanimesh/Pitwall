import { useMemo } from 'react'
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell, Bar,
} from 'recharts'
import { useRaceReplay } from '../../hooks/useStrategy'
import LoadingSpinner from '../LoadingSpinner'
import ErrorMessage from '../ErrorMessage'
import TyreChip, { COMPOUND_COLORS } from './TyreChip'
import type { ReplayLap } from '../../types/strategy'

interface DriverOption {
  driver_id: string
  full_name: string
  team_id: string | null
}

interface Props {
  raceId: number | null
  driverId: string
  setDriverId: (id: string) => void
  availableDrivers: DriverOption[]
}

const REC_COLOR: Record<string, string> = {
  PIT_NOW:  '#22D3A5',
  MARGINAL: '#f59e0b',
  STAY_OUT: '#4b5563',
}

function fmtGap(v: number | null) {
  if (v == null) return '—'
  return `${v.toFixed(1)}s`
}

const ABU_DHABI_2021 = 22

export default function RaceReplayTab({ raceId, driverId, setDriverId, availableDrivers }: Props) {
  const { data, loading, error } = useRaceReplay(raceId, driverId)

  const scLaps = useMemo(() => {
    if (!data) return []
    return data.laps.filter((l) => l.track_status === 'SC' || l.track_status === 'VSC').map((l) => l.lap)
  }, [data])

  const pitLaps = useMemo(() => {
    if (!data) return []
    return data.laps.filter((l) => l.actual_pit !== null).map((l) => l.lap)
  }, [data])

  const isAbuDhabi2021 = raceId === ABU_DHABI_2021

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    const row = payload[0]?.payload as ReplayLap
    return (
      <div className="rounded-lg px-3 py-2 text-xs space-y-1" style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', minWidth: 180 }}>
        <p className="font-semibold text-white mb-1">Lap {label}</p>
        <p style={{ color: '#6b7280' }}>Position: <span className="text-white font-mono">P{row.position ?? '?'}</span></p>
        <p style={{ color: '#6b7280' }} className="flex items-center gap-1">
          Tyre: <TyreChip compound={row.compound} age={row.tyre_life} size="xs" />
        </p>
        {row.lap_time && (
          <p style={{ color: '#6b7280' }}>Lap time: <span className="font-mono text-white">{row.lap_time.toFixed(3)}s</span></p>
        )}
        <p style={{ color: '#6b7280' }}>Gap ahead: <span className="font-mono text-white">{fmtGap(row.gap_to_ahead)}</span></p>
        {row.track_status !== 'Green' && (
          <p style={{ color: '#f59e0b', fontWeight: 600 }}>{row.track_status}</p>
        )}
        <div className="flex items-center gap-1.5 pt-1" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <span className="rounded-full" style={{ width: 8, height: 8, background: REC_COLOR[row.recommendation], display: 'inline-block' }} />
          <span style={{ color: REC_COLOR[row.recommendation], fontWeight: 600 }}>{row.recommendation.replace('_', ' ')}</span>
        </div>
        {row.actual_pit && (
          <p style={{ color: '#60a5fa', fontWeight: 600, borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 4 }}>
            Pit: {row.actual_pit.compound_in}→{row.actual_pit.compound_out}
            {row.actual_pit.duration_sec && ` (${row.actual_pit.duration_sec.toFixed(1)}s)`}
          </p>
        )}
      </div>
    )
  }

  if (!raceId) return (
    <div className="py-16 text-center" style={{ color: 'rgba(255,255,255,0.4)' }}>
      Select a race to replay its strategy.
    </div>
  )

  return (
    <div className="space-y-5">

      {/* Abu Dhabi 2021 controversy callout */}
      {isAbuDhabi2021 && (
        <div className="rounded-lg p-5" style={{ background: 'rgba(225,6,0,0.06)', border: '1px solid rgba(225,6,0,0.2)', borderLeft: '3px solid #E10600' }}>
          <div className="flex items-center gap-2 mb-2">
            <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#e10600' }}>
              SC Controversy
            </span>
            <span className="font-mono font-bold" style={{ fontSize: 10, background: 'rgba(34,211,165,0.12)', color: '#22D3A5', border: '1px solid rgba(34,211,165,0.25)', borderRadius: 4, padding: '1px 6px' }}>
              PIT_NOW
            </span>
          </div>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: 'rgba(255,255,255,0.75)' }}>
            Lap 54: Safety Car deployed. VER pitted for fresh SOFT tyres. HAM stayed out on 41-lap-old HARD tyres.
            After restart on lap 58, VER overtook HAM to claim the World Championship on the final lap.
          </p>
          <p className="italic" style={{ fontSize: 13, color: '#6b7280', marginTop: 8 }}>
            The model correctly outputs <span className="font-bold not-italic" style={{ color: '#22D3A5' }}>PIT_NOW</span> on lap 54 for HAM —
            pit loss drops to ~5s under SC, making it the dominant strategy with 5 laps remaining.
          </p>
        </div>
      )}

      {/* Driver selector + legend */}
      <div className="flex flex-wrap items-end gap-6">
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#6b7280', marginBottom: 6 }}>
            Driver
          </label>
          <select
            value={driverId}
            onChange={(e) => setDriverId(e.target.value)}
            className="font-mono text-white text-sm rounded-lg px-3 py-2 focus:outline-none cursor-pointer"
            style={{ background: '#141414', border: '1px solid #2a2a2a', minWidth: 160 }}
          >
            {availableDrivers.length > 0 ? (
              availableDrivers.map((d) => (
                <option key={d.driver_id} value={d.driver_id}>
                  {d.driver_id} — {d.full_name}
                </option>
              ))
            ) : (
              <option value={driverId}>{driverId}</option>
            )}
          </select>
        </div>
        {data && (
          <div className="flex flex-wrap gap-4 pb-1">
            {[
              { color: '#22D3A5', label: 'PIT NOW' },
              { color: '#f59e0b', label: 'MARGINAL' },
              { color: '#4b5563', label: 'STAY OUT' },
              { color: '#f59e0b', label: 'SC/VSC', dashed: true },
              { color: '#60a5fa', label: 'Pit stop', solid: true },
            ].map(({ color, label, dashed, solid }) => (
              <div key={label} className="flex items-center gap-1.5">
                {dashed ? (
                  <div style={{ width: 14, height: 0, borderTop: `2px dashed ${color}` }} />
                ) : solid ? (
                  <div style={{ width: 14, height: 2, background: color }} />
                ) : (
                  <div className="rounded-full" style={{ width: 8, height: 8, background: color }} />
                )}
                <span style={{ fontSize: 11, color: '#6b7280' }}>{label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <LoadingSpinner message="Loading race replay…" />
      ) : error ? (
        <ErrorMessage message={error} />
      ) : data ? (
        <>
          {/* Race position chart */}
          <div className="rounded-lg p-5" style={{ background: '#111111', border: '1px solid #1f1f1f' }}>
            <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#6b7280', marginBottom: 4 }}>
              Race Position — {data.driver_id}
            </p>
            <p style={{ fontSize: 11, color: '#6b7280', marginBottom: 16 }}>
              Dot colour = strategy recommendation · Yellow dashed = SC/VSC · Blue = pit stop
            </p>
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart data={data.laps} margin={{ top: 5, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" vertical={false} />
                <XAxis
                  dataKey="lap"
                  tick={{ fill: '#4b5563', fontSize: 10, fontFamily: '"JetBrains Mono"' }}
                  axisLine={{ stroke: '#1f1f1f' }}
                  tickLine={false}
                  height={20}
                />
                <YAxis
                  reversed
                  domain={[1, 20]}
                  ticks={[1, 5, 10, 15, 20]}
                  tickFormatter={(v) => `P${v}`}
                  tick={{ fill: '#4b5563', fontSize: 10, fontFamily: '"JetBrains Mono"' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                {scLaps.slice(0, 1).map((lap) => (
                  <ReferenceLine key={`sc-${lap}`} x={lap} stroke="#f59e0b" strokeWidth={1.5}
                    strokeDasharray="3 2"
                    label={{ value: 'SC', fill: '#f59e0b', fontSize: 9, position: 'top' }}
                  />
                ))}
                {pitLaps.map((lap) => (
                  <ReferenceLine key={`pit-${lap}`} x={lap} stroke="#60a5fa" strokeWidth={1.5}
                    label={{ value: 'PIT', fill: '#60a5fa', fontSize: 9, position: 'top' }}
                  />
                ))}
                <Line
                  type="monotone"
                  dataKey="position"
                  stroke="#e10600"
                  strokeWidth={2}
                  dot={(props: any) => {
                    const { cx, cy, payload } = props
                    const color = REC_COLOR[payload.recommendation] ?? '#6b7280'
                    return <circle key={`dot-${payload.lap}`} cx={cx} cy={cy} r={3} fill={color} stroke="none" />
                  }}
                  name="Position"
                  connectNulls
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Tyre compound timeline */}
          <div className="rounded-lg p-5" style={{ background: '#111111', border: '1px solid #1f1f1f' }}>
            <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#6b7280', marginBottom: 12 }}>
              Tyre Compound Timeline
            </p>
            <ResponsiveContainer width="100%" height={56}>
              <ComposedChart data={data.laps} margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                <XAxis dataKey="lap" tick={{ fill: '#4b5563', fontSize: 9 }} axisLine={false} tickLine={false} height={16} />
                <YAxis hide domain={[0, 1]} />
                <Bar dataKey={() => 1} isAnimationActive={false}>
                  {data.laps.map((lap) => (
                    <Cell key={`cell-${lap.lap}`} fill={COMPOUND_COLORS[lap.compound] ?? '#555'} opacity={0.85} />
                  ))}
                </Bar>
              </ComposedChart>
            </ResponsiveContainer>
            <div className="flex gap-4 mt-2 flex-wrap">
              {Array.from(new Set(data.laps.map((l) => l.compound))).map((c) => (
                <span key={c} className="flex items-center gap-1.5" style={{ fontSize: 11, color: '#6b7280' }}>
                  <span className="rounded-sm" style={{ width: 10, height: 10, background: COMPOUND_COLORS[c] ?? '#555', display: 'inline-block' }} />
                  {c}
                </span>
              ))}
              {pitLaps.length > 0 && (
                <span style={{ fontSize: 11, color: '#6b7280' }}>Pit stops: lap {pitLaps.join(', ')}</span>
              )}
            </div>
          </div>

          {/* Key Decision Laps table */}
          <div className="rounded-lg overflow-hidden" style={{ background: '#111111', border: '1px solid #1f1f1f' }}>
            <div className="px-5 py-3" style={{ borderBottom: '1px solid #1f1f1f', background: '#0d0d0d' }}>
              <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#6b7280' }}>
                Key Decision Laps
              </p>
            </div>
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid #1a1a1a', background: '#0d0d0d' }}>
                  {['Lap', 'Pos', 'Tyre', 'Status', 'Gap Ahead', 'Recommendation', 'Action'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left" style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#4b5563' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.laps
                  .filter((l) => l.recommendation === 'PIT_NOW' || l.actual_pit !== null || l.track_status !== 'Green')
                  .map((l) => {
                    const isCritical = l.lap === 54
                    return (
                      <tr key={l.lap} style={{ borderBottom: '1px solid #161616', background: isCritical ? 'rgba(225,6,0,0.07)' : undefined }}>
                        <td className="px-4 py-3 font-mono font-semibold" style={{ fontSize: 13, color: isCritical ? '#e10600' : 'rgba(255,255,255,0.7)' }}>
                          {l.lap}{isCritical && ' ⚠'}
                        </td>
                        <td className="px-4 py-3 font-mono" style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>
                          {l.position ? `P${l.position}` : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <TyreChip compound={l.compound} age={l.tyre_life} size="xs" />
                        </td>
                        <td className="px-4 py-3">
                          {l.track_status !== 'Green' ? (
                            <span className="font-mono font-bold" style={{ fontSize: 11, background: 'rgba(245,158,11,0.15)', color: '#f59e0b', padding: '2px 7px', borderRadius: 4 }}>
                              {l.track_status}
                            </span>
                          ) : (
                            <span style={{ fontSize: 11, color: '#6b7280' }}>Green</span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono" style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>
                          {fmtGap(l.gap_to_ahead)}
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-semibold" style={{ fontSize: 12, color: REC_COLOR[l.recommendation] }}>
                            {l.recommendation.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {l.actual_pit ? (
                            <span className="font-semibold" style={{ fontSize: 12, color: '#22D3A5' }}>
                              PIT ({l.actual_pit.compound_in}→{l.actual_pit.compound_out})
                            </span>
                          ) : (
                            <span style={{ fontSize: 12, color: '#6b7280' }}>stayed out</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  )
}
