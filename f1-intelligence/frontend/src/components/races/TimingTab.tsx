import { useState, useEffect } from 'react'
import axios from 'axios'
import { API_BASE } from '../../config'
import LoadingSpinner from '../LoadingSpinner'
import DriverAvatar from '../DriverAvatar'

// ─── Types ────────────────────────────────────────────────────────────────────

interface OverallBest {
  s1: number
  s2: number
  s3: number
  lap: number
}

interface DriverTiming {
  driver_id: string
  full_name: string
  abbreviation: string
  team_id: string | null
  team_name: string | null
  best_s1: number | null
  best_s2: number | null
  best_s3: number | null
  best_lap: number | null
  total_laps: number
  finish_position: number | null
  has_fastest_lap: number  // 0 or 1 from SQLite
}

interface TimingResponse {
  overall_best: OverallBest | null
  drivers: DriverTiming[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatSectorTime(seconds: number): string {
  if (seconds < 60) return seconds.toFixed(3)
  const mins = Math.floor(seconds / 60)
  const secs = (seconds % 60).toFixed(3).padStart(6, '0')
  return `${mins}:${secs}`
}

function formatGap(gap: number): string {
  return `+${gap.toFixed(3)}`
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const PURPLE = '#b455f5'
const GREEN  = '#22D3A5'
const MUTED  = 'rgba(255,255,255,0.35)'

function SectorCell({ time, overallBest }: { time: number | null; overallBest: number }) {
  if (time == null) return <span className="font-mono" style={{ color: MUTED }}>—</span>
  const isPurple = time === overallBest
  return (
    <span className="font-mono text-sm font-semibold" style={{ color: isPurple ? PURPLE : GREEN }}>
      {formatSectorTime(time)}
    </span>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function TimingTab({ raceId }: { raceId: number }) {
  const [data, setData]       = useState<TimingResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    setLoading(true); setError(null)
    axios.get<TimingResponse>(`${API_BASE}/races/${raceId}/timing`)
      .then((r) => setData(r.data))
      .catch((e) => setError(e.response?.data?.detail ?? e.message))
      .finally(() => setLoading(false))
  }, [raceId])

  if (loading) return <LoadingSpinner message="Loading timing data…" />
  if (error)   return (
    <p className="text-center py-10 text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
      {error}
    </p>
  )
  if (!data || !data.overall_best || !data.drivers.length) return (
    <p className="text-center py-10 text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
      Sector timing data not available for this race.
    </p>
  )

  const { overall_best, drivers } = data

  return (
    <div>
      {/* Legend */}
      <div
        className="flex items-center justify-end gap-5 px-5 py-2.5"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: '#0d0d0d' }}
      >
        {[
          { color: PURPLE, label: 'Overall fastest' },
          { color: GREEN,  label: 'Personal best' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: color, flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full" style={{ minWidth: 760, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#0d0d0d', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              {[
                { label: 'POS',           w: 50  },
                { label: 'DRIVER',        w: 200 },
                { label: 'TEAM',          w: 150 },
                { label: 'BEST LAP',      w: 120 },
                { label: 'S1',            w: 90  },
                { label: 'S2',            w: 90  },
                { label: 'S3',            w: 90  },
                { label: 'GAP TO FASTEST', w: 120 },
              ].map(({ label, w }) => (
                <th
                  key={label}
                  className="px-4 py-3 text-left"
                  style={{ minWidth: w, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#6b7280' }}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {drivers.map((d, i) => {
              const isOverallLap = d.best_lap === overall_best.lap
              const gap = d.best_lap != null ? d.best_lap - overall_best.lap : null
              const rowBg = i % 2 === 0 ? '#141414' : '#111111'

              return (
                <tr
                  key={d.driver_id}
                  style={{ background: rowBg, borderBottom: '1px solid #1a1a1a', height: 48 }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#1a1a1a')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = rowBg)}
                >
                  {/* POS */}
                  <td className="px-4" style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.4)', fontFamily: '"JetBrains Mono"' }}>
                    {d.finish_position ?? '—'}
                  </td>

                  {/* DRIVER */}
                  <td className="px-4">
                    <DriverAvatar
                      driverId={d.driver_id}
                      teamId={d.team_id}
                      size="sm"
                      showName
                      fullName={d.full_name}
                    />
                  </td>

                  {/* TEAM */}
                  <td className="px-4">
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                      {d.team_name?.replace(' Racing', '').replace('Formula One', '').trim() ?? '—'}
                    </span>
                  </td>

                  {/* BEST LAP */}
                  <td className="px-4">
                    <div className="flex items-center gap-2">
                      <span
                        className="font-mono font-semibold"
                        style={{ fontSize: 13, color: isOverallLap ? PURPLE : 'rgba(255,255,255,0.75)' }}
                      >
                        {d.best_lap != null ? formatSectorTime(d.best_lap) : '—'}
                      </span>
                      {!!d.has_fastest_lap && (
                        <span
                          className="font-mono font-bold"
                          style={{
                            fontSize: 10, padding: '1px 5px', borderRadius: 4,
                            background: 'rgba(180,85,245,0.15)',
                            color: PURPLE,
                            border: '1px solid rgba(180,85,245,0.3)',
                          }}
                        >
                          FL
                        </span>
                      )}
                    </div>
                  </td>

                  {/* S1 */}
                  <td className="px-4">
                    <SectorCell time={d.best_s1} overallBest={overall_best.s1} />
                  </td>

                  {/* S2 */}
                  <td className="px-4">
                    <SectorCell time={d.best_s2} overallBest={overall_best.s2} />
                  </td>

                  {/* S3 */}
                  <td className="px-4">
                    <SectorCell time={d.best_s3} overallBest={overall_best.s3} />
                  </td>

                  {/* GAP TO FASTEST */}
                  <td className="px-4">
                    {isOverallLap ? (
                      <span className="font-mono font-bold" style={{ fontSize: 12, color: PURPLE }}>
                        FASTEST
                      </span>
                    ) : gap != null ? (
                      <span className="font-mono" style={{ fontSize: 13, color: '#f59e0b' }}>
                        {formatGap(gap)}
                      </span>
                    ) : (
                      <span className="font-mono" style={{ color: MUTED }}>—</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
