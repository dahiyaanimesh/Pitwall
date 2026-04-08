import { useSeason } from '../context/SeasonContext'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { TrendingUp, ArrowUp, ArrowDown, Minus, BarChart2 } from 'lucide-react'
import { useDashboard } from '../hooks/useDashboard'
import LoadingSpinner from '../components/LoadingSpinner'
import ErrorMessage from '../components/ErrorMessage'
import { TEAM_COLORS } from '../components/DriverAvatar'

// ─── helpers ─────────────────────────────────────────────────────────────────

function teamColor(id: string | null | undefined) {
  if (!id) return '#6b7280'
  const lower = id.toLowerCase()
  for (const [k, v] of Object.entries(TEAM_COLORS)) {
    if (lower.includes(k) || k.includes(lower)) return v
  }
  return '#6b7280'
}

// ─── Chart tooltip ────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const pt = payload[0]?.payload
  const header = pt?.roundLabel ?? ''
  return (
    <div className="rounded px-3 py-2 text-xs" style={{ background: '#1a1a1a', border: '1px solid #2a2a2a' }}>
      <p className="mb-1.5 font-semibold" style={{ color: 'rgba(255,255,255,0.8)' }}>{header}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2 mb-0.5 last:mb-0">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: p.color }} />
          <span className="font-mono text-white/60 w-8">{p.dataKey}</span>
          <span className="text-white font-mono font-semibold">{p.value}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Stat card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  badge: string
  value: string
  label: string
  sub?: string
  color: string
}

function StatCard({ badge, value, label, sub, color }: StatCardProps) {
  return (
    <div
      className="rounded-lg p-6 relative overflow-hidden"
      style={{ background: '#111111', border: '1px solid #1f1f1f' }}
    >
      {/* Badge */}
      <div
        className="absolute top-4 right-4 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider"
        style={{ background: `${color}18`, border: `1px solid ${color}35`, color }}
      >
        {badge}
      </div>
      {/* Value */}
      <div
        className="font-display leading-none mb-2 mt-1"
        style={{ fontSize: 38, fontWeight: 700, color }}
      >
        {value}
      </div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-f1muted">{label}</p>
      {sub && <p className="text-[11px] text-white/40 mt-0.5">{sub}</p>}
    </div>
  )
}

// ─── Constructor bars ─────────────────────────────────────────────────────────

const TEAM_EXACT: Record<string, string> = {
  mercedes:   '#00D2BE',
  'red bull': '#0600EF',
  ferrari:    '#DC0000',
  mclaren:    '#FF8700',
  alpine:     '#0090FF',
  alphatauri: '#2B4562',
  'aston martin': '#006F62',
  williams:   '#005AFF',
  'alfa romeo': '#900000',
  haas:       '#FFFFFF',
}

function resolveTeamColor(name: string, id: string | null | undefined) {
  const n = (name ?? '').toLowerCase()
  for (const [k, v] of Object.entries(TEAM_EXACT)) {
    if (n.includes(k)) return v
  }
  return teamColor(id)
}

function ConstructorBars({ data }: { data: any[] }) {
  const max = data[0]?.points ?? 1
  return (
    <div>
      {data.slice(0, 6).map((c, i) => {
        const color = resolveTeamColor(c.team_name, c.team_id)
        const label = c.team_name
          .replace(/ Racing$/i, '')
          .replace(/Formula One/i, '')
          .replace(/BWT/i, '')
          .trim()
          .toUpperCase()
          .slice(0, 14)
        return (
          <div key={c.team_id}>
            {i > 0 && <div style={{ height: 1, background: '#1a1a1a' }} />}
            <div className="py-3">
              <div className="flex justify-between items-baseline mb-1.5">
                <span
                  className="font-semibold uppercase"
                  style={{ fontSize: 11, letterSpacing: '0.12em', color: '#9CA3AF' }}
                >
                  {label}
                </span>
                <span className="font-mono text-white/50" style={{ fontSize: 11 }}>{c.points}</span>
              </div>
              <div className="rounded-full" style={{ height: 4, background: '#1f1f1f' }}>
                <div
                  className="h-full rounded-full animate-bar-fill"
                  style={{
                    width: `${(c.points / max) * 100}%`,
                    background: color,
                    animationDelay: `${i * 80}ms`,
                  }}
                />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function Dashboard() {
  const { season } = useSeason()
  const { data, loading, error } = useDashboard(season)

  const p1 = data?.standings[0]
  const p2 = data?.standings[1]
  const p3 = data?.standings[2]
  const champPts = p1?.total_points ?? 1

  if (loading) return <LoadingSpinner message="Loading season data…" />
  if (error)   return <ErrorMessage message={error} />
  if (!data)   return null

  // X-axis: use round number labels, show only R01/R05/R10/R15/R22
  const wantedRounds = new Set([1, 5, 10, 15, 22])
  const trajectoryWithLabel = data.trajectory.map((pt: any) => ({
    ...pt,
    roundLabel: `R${String(pt.round).padStart(2, '0')}`,
  }))
  const xTicks = trajectoryWithLabel
    .filter((pt: any) => wantedRounds.has(pt.round))
    .map((pt: any) => pt.roundLabel)

  return (
    <div className="space-y-4 pb-10 animate-fade-in">

      {/* ── 1. Championship Standings Hero ─────────────────────────────── */}
      <div
        className="rounded-lg overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #1a0a0a 0%, #0f0f0f 40%, #0a0a0a 100%)',
          border: '1px solid #2a1a1a',
        }}
      >
        {/* Header */}
        <div
          className="px-6 py-5 flex items-start justify-between"
          style={{ borderBottom: '1px solid #1f1418' }}
        >
          <div>
            <h2
              className="font-display font-bold uppercase text-white"
              style={{ fontSize: 22, letterSpacing: '0.08em' }}
            >
              Championship Standings
            </h2>
            <p
              className="mt-1 font-semibold uppercase"
              style={{ fontSize: 10, letterSpacing: '0.18em', color: '#6b7280' }}
            >
              Driver Championship &nbsp;·&nbsp; {season} Season
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#6b7280' }}>
              Points Gap
            </p>
            <p className="font-display font-bold leading-none mt-0.5" style={{ fontSize: 28, color: '#ffffff' }}>
              {data.season_stats.points_gap ?? '—'}<span style={{ fontSize: 12, color: '#4b5563', marginLeft: 3 }}>pts</span>
            </p>
          </div>
        </div>

        {/* Podium: P1 | P2 | P3 */}
        <div className="grid grid-cols-3">
          {/* P1 */}
          {p1 && (
            <div className="px-6 py-6" style={{ borderRight: '1px solid #1f1418' }}>
              <div className="flex items-baseline gap-4 mb-4">
                <span className="font-display font-bold leading-none" style={{ fontSize: 72, color: '#E10600', lineHeight: 1 }}>
                  01
                </span>
                <div>
                  <p className="font-display font-bold text-white leading-none" style={{ fontSize: 24 }}>{p1.driver_id}</p>
                  <p className="uppercase font-semibold mt-1" style={{ fontSize: 10, letterSpacing: '0.12em', color: teamColor(p1.team_id) }}>
                    {p1.team_name?.replace(' Racing', '').replace('Formula One', '').trim()}
                  </p>
                </div>
              </div>
              <div className="flex gap-6">
                <div>
                  <p style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#6b7280', fontWeight: 600 }}>Points</p>
                  <p className="font-display font-bold text-white" style={{ fontSize: 22 }}>{p1.total_points}</p>
                </div>
                <div>
                  <p style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#6b7280', fontWeight: 600 }}>Wins</p>
                  <p className="font-display font-bold text-white" style={{ fontSize: 22 }}>{p1.wins}</p>
                </div>
              </div>
              <div className="mt-4 rounded-full" style={{ height: 3, background: '#1f1f1f' }}>
                <div className="h-full rounded-full animate-bar-fill" style={{ width: '100%', background: '#E10600' }} />
              </div>
            </div>
          )}

          {/* P2 */}
          {p2 && (
            <div className="px-6 py-6" style={{ borderRight: '1px solid #1f1418' }}>
              <div className="flex items-baseline gap-3 mb-4">
                <span className="font-display font-bold leading-none" style={{ fontSize: 48, color: '#4b5563', lineHeight: 1 }}>
                  02
                </span>
                <div>
                  <p className="font-display font-bold text-white/70 leading-none" style={{ fontSize: 18 }}>{p2.driver_id}</p>
                  <p className="uppercase font-semibold mt-1" style={{ fontSize: 10, letterSpacing: '0.12em', color: teamColor(p2.team_id) }}>
                    {p2.team_name?.replace(' Racing', '').replace('Formula One', '').trim()}
                  </p>
                </div>
              </div>
              <div className="flex gap-6">
                <div>
                  <p style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#6b7280', fontWeight: 600 }}>Points</p>
                  <p className="font-display font-bold text-white/70" style={{ fontSize: 18 }}>{p2.total_points}</p>
                </div>
                <div>
                  <p style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#6b7280', fontWeight: 600 }}>Wins</p>
                  <p className="font-display font-bold text-white/70" style={{ fontSize: 18 }}>{p2.wins}</p>
                </div>
              </div>
              <div className="mt-4 rounded-full" style={{ height: 3, background: '#1f1f1f' }}>
                <div
                  className="h-full rounded-full animate-bar-fill"
                  style={{ width: `${(p2.total_points / champPts) * 100}%`, background: teamColor(p2.team_id) }}
                />
              </div>
            </div>
          )}

          {/* P3 */}
          {p3 && (
            <div className="px-6 py-6">
              <div className="flex items-baseline gap-3 mb-4">
                <span className="font-display font-bold leading-none" style={{ fontSize: 36, color: '#374151', lineHeight: 1 }}>
                  03
                </span>
                <div>
                  <p className="font-display font-bold leading-none" style={{ fontSize: 15, color: 'rgba(255,255,255,0.45)' }}>{p3.driver_id}</p>
                  <p className="uppercase font-semibold mt-1" style={{ fontSize: 10, letterSpacing: '0.12em', color: teamColor(p3.team_id) }}>
                    {p3.team_name?.replace(' Racing', '').replace('Formula One', '').trim()}
                  </p>
                </div>
              </div>
              <div className="flex gap-6">
                <div>
                  <p style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#4b5563', fontWeight: 600 }}>Points</p>
                  <p className="font-display font-bold" style={{ fontSize: 15, color: 'rgba(255,255,255,0.45)' }}>{p3.total_points}</p>
                </div>
                <div>
                  <p style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#4b5563', fontWeight: 600 }}>Wins</p>
                  <p className="font-display font-bold" style={{ fontSize: 15, color: 'rgba(255,255,255,0.45)' }}>{p3.wins}</p>
                </div>
              </div>
              <div className="mt-4 rounded-full" style={{ height: 3, background: '#1a1a1a' }}>
                <div
                  className="h-full rounded-full animate-bar-fill"
                  style={{ width: `${(p3.total_points / champPts) * 100}%`, background: teamColor(p3.team_id) }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── 2. Stat cards ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {data.callouts.most_dominant && (
          <StatCard
            badge="OVERPRF"
            value={`+${data.callouts.most_dominant.overperformance_score.toFixed(1)}`}
            label="Most Dominant"
            sub={`(${data.callouts.most_dominant.driver_id ?? ''})`}
            color="#E10600"
          />
        )}
        {data.callouts.closest_battle && (() => {
          const ms: number = data.callouts.closest_battle.avg_qual_delta_ms ?? 0
          const fmtMs = ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`
          const teamFirst = data.callouts.closest_battle.team_name?.split(' ')[0] ?? ''
          return (
            <StatCard
              badge="Delta"
              value={fmtMs}
              label="Closest Teammates"
              sub={`(${teamFirst}: ${data.callouts.closest_battle.d1_id} vs ${data.callouts.closest_battle.d2_id})`}
              color="#f97316"
            />
          )
        })()}
        <StatCard
          badge="Model"
          value="3.3"
          label="Best MAE"
          sub="(positions avg error)"
          color="#3b82f6"
        />
        {data.callouts.most_pitstops && (
          <StatCard
            badge="PIT STOP"
            value={`${data.callouts.most_pitstops.total_stops} Pits`}
            label="Most Aggressive"
            sub={`${data.callouts.most_pitstops.driver_id} · ${data.callouts.most_pitstops.city ?? 'GP'} ${data.callouts.most_pitstops.season_year}`}
            color="#f97316"
          />
        )}
      </div>

      {/* ── 3+4+5. Charts row ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-3">

        {/* 4. Points trajectory — top 2 drivers dynamic */}
        {(() => {
          const topTwo = [...(data.standings ?? [])]
            .sort((a: any, b: any) => b.total_points - a.total_points)
            .slice(0, 2)
          const d1 = topTwo[0]
          const d2 = topTwo[1]
          const c1 = d1 ? teamColor(d1.team_id) : '#0600EF'
          const c2 = d2 ? teamColor(d2.team_id) : '#6b7280'
          return (
            <div
              className="xl:col-span-3 rounded-lg p-6 flex flex-col"
              style={{ background: '#111111', border: '1px solid #1f1f1f', minHeight: 260 }}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <TrendingUp size={12} className="text-f1red" />
                  <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#6b7280' }}>
                    Championship Points Trajectory
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  {d1 && (
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-[2px]" style={{ background: c1 }} />
                      <span className="font-mono text-[10px] text-f1muted">{d1.driver_id}</span>
                    </div>
                  )}
                  {d2 && (
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-[2px]" style={{ background: c2 }} />
                      <span className="font-mono text-[10px] text-f1muted">{d2.driver_id}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex-1" style={{ minHeight: 180 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={trajectoryWithLabel}
                    margin={{ top: 8, right: 4, left: -28, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" vertical={false} />
                    <XAxis
                      dataKey="roundLabel"
                      tick={{ fill: '#4b5563', fontSize: 9, fontFamily: '"JetBrains Mono"' }}
                      textAnchor="middle"
                      height={20}
                      ticks={xTicks}
                      axisLine={{ stroke: '#1f1f1f' }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: '#4b5563', fontSize: 9, fontFamily: '"JetBrains Mono"' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    {d1 && (
                      <Line
                        type="monotone"
                        dataKey={d1.driver_id}
                        stroke={c1}
                        strokeWidth={2.5}
                        dot={false}
                        connectNulls
                      />
                    )}
                    {d2 && (
                      <Line
                        type="monotone"
                        dataKey={d2.driver_id}
                        stroke={c2}
                        strokeWidth={2.5}
                        strokeDasharray="6 3"
                        dot={false}
                        connectNulls
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )
        })()}

        {/* 5. Constructor standings */}
        <div
          className="xl:col-span-2 rounded-lg p-6"
          style={{ background: '#111111', border: '1px solid #1f1f1f' }}
        >
          <div className="flex items-center gap-2 mb-3">
            <BarChart2 size={12} className="text-f1muted" />
            <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#6b7280' }}>
              Constructor Standings
            </p>
          </div>
          <ConstructorBars data={data.constructors} />
        </div>
      </div>

      {/* ── Full standings table ────────────────────────────────────────── */}
      <div
        className="rounded-lg overflow-hidden"
        style={{ background: '#111111', border: '1px solid #1f1f1f' }}
      >
        <div className="px-6 py-4" style={{ borderBottom: '1px solid #1f1f1f' }}>
          <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#6b7280' }}>
            Driver Championship — {season}
          </p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: '#0d0d0d', borderBottom: '1px solid #1a1a1a' }}>
              {['Pos', 'Driver', 'Team', 'Pts', 'Gap', 'Wins', 'Avg'].map((h, i) => (
                <th
                  key={h}
                  style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#4b5563' }}
                  className={`px-4 py-3 ${i > 2 ? 'text-right' : 'text-left'} ${i === 2 ? 'hidden sm:table-cell' : ''} ${i === 6 ? 'hidden md:table-cell' : ''}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.standings.map((s, i) => {
              const color = teamColor(s.team_id)
              const gap   = (p1?.total_points ?? 0) - s.total_points
              const delta = s.overperformance_score ?? 0
              return (
                <tr
                  key={s.driver_id}
                  className="table-row-hover"
                  style={{ borderBottom: '1px solid #161616' }}
                >
                  <td className="px-4 py-3 w-12">
                    <span className={`font-mono text-sm font-bold ${i < 3 ? 'text-f1red' : 'text-white/20'}`}>{i + 1}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-[3px] h-5 rounded-full flex-shrink-0" style={{ background: color }} />
                      <span className="font-mono text-[11px] text-f1muted w-8">{s.driver_id}</span>
                      <span className="text-[13px] text-white/80 font-medium hidden sm:inline">{s.full_name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className="text-[11px] text-white/25">{s.team_name?.replace(' Racing','').replace('Formula One','').trim().slice(0,14) ?? '—'}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-display font-bold text-white">{s.total_points}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-mono text-[11px] text-white/25">{i === 0 ? '—' : `−${gap}`}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-mono text-[12px] text-white/65">{s.wins}</span>
                  </td>
                  <td className="px-4 py-3 text-right hidden md:table-cell">
                    <div className="flex items-center justify-end gap-1">
                      {delta > 0.3 ? <ArrowUp size={10} style={{ color: '#22D3A5' }} /> :
                       delta < -0.3 ? <ArrowDown size={10} style={{ color: '#E10600' }} /> :
                       <Minus size={10} className="text-white/15" />}
                      <span className="font-mono text-[11px] text-white/30">{s.avg_finish_position?.toFixed(1) ?? '—'}</span>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* ── 7. Insight callout ─────────────────────────────────────────── */}
      {data.insight && (() => {
        // Parse "X outperformed ... by an average of Y places per race."
        const match = data.insight.match(/by an average of ([\d.]+) places/i)
        const highlight = match?.[1]
        if (highlight) {
          const [before, after] = data.insight.split(/[\d.]+\s*places/i)
          return (
            <div
              className="flex items-start gap-4 px-6 py-5 rounded-lg"
              style={{
                background: '#111111',
                border: '1px solid #1f1f1f',
                borderLeft: '3px solid #E10600',
              }}
            >
              <div className="w-2 h-2 rounded-full bg-f1red flex-shrink-0 mt-1 animate-pulse-soft" />
              <p className="text-[13px] leading-relaxed italic" style={{ color: 'rgba(255,255,255,0.65)' }}>
                {before}
                <span className="font-bold not-italic" style={{ color: '#E10600' }}>{highlight} places</span>
                {after}
              </p>
            </div>
          )
        }
        return (
          <div
            className="flex items-start gap-4 px-6 py-5 rounded-lg"
            style={{ background: '#111111', border: '1px solid #1f1f1f', borderLeft: '3px solid #E10600' }}
          >
            <div className="w-2 h-2 rounded-full bg-f1red flex-shrink-0 mt-1 animate-pulse-soft" />
            <p className="text-[13px] leading-relaxed italic" style={{ color: 'rgba(255,255,255,0.65)' }}>{data.insight}</p>
          </div>
        )
      })()}
    </div>
  )
}
