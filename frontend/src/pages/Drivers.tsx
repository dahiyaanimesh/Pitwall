import { useState, useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Radar } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip as ChartTooltip2,
} from 'chart.js'
import { useDrivers } from '../hooks/useDrivers'
import { useOverperformers } from '../hooks/useOverperformers'
import { useDriverSeasonArc } from '../hooks/useDriverSeasonArc'
import { useSeason } from '../context/SeasonContext'
import { TEAM_COLORS } from '../components/DriverAvatar'
import LoadingSpinner from '../components/LoadingSpinner'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine,
} from 'recharts'
import type { OverperformerRow } from '../types/f1'

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, ChartTooltip2)

// ── Color tokens ──────────────────────────────────────────────────────────────
// T1 #ffffff    — values, active items
// T2 #d1d5db    — section headers, stat names, axis ticks
// T3 #9ca3af    — secondary labels, legend items, inactive drivers
// T4 #6b7280    — decorative: ranks, team abbrevs, borders

// ── helpers ───────────────────────────────────────────────────────────────────

function teamColor(teamId: string | null | undefined): string {
  if (!teamId) return '#6b7280'
  const lower = teamId.toLowerCase()
  for (const [k, v] of Object.entries(TEAM_COLORS)) {
    if (lower.includes(k) || k.includes(lower)) return v
  }
  return '#6b7280'
}

function teamShort(name: string | null | undefined): string {
  if (!name) return '—'
  return name
    .replace(/ Racing$/i, '')
    .replace(/Formula One/i, '')
    .replace(/BWT/i, '')
    .trim()
    .toUpperCase()
    .slice(0, 3)
}

function normalize(val: number, min: number, max: number): number {
  if (max === min) return 0.5
  return Math.max(0, Math.min(1, (val - min) / (max - min)))
}

// ── Radar chart (Chart.js) ────────────────────────────────────────────────────

const RADAR_DIMS = ['OUTRIGHT', 'RACE PACE', 'WINS', 'PODIUMS', 'OVERTAKE', 'CONSISTENCY']
const RADAR_DESC = ['Qualifying pace', 'Race finish avg', 'Race wins', 'Podium finishes', 'Positions gained', 'Consistency score']

function RadarChart({ scores, color }: { scores: number[]; color: string }) {
  const values = scores.map(s => Math.round(s * 100))

  const chartData = {
    labels: RADAR_DIMS,
    datasets: [{
      data: values,
      backgroundColor: color + '1a',
      borderColor: color,
      borderWidth: 1.5,
      pointBackgroundColor: color,
      pointRadius: 3,
      pointHoverRadius: 5,
    }],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: true,
    animation: { duration: 500, easing: 'easeOutQuart' as const },
    scales: {
      r: {
        min: 0,
        max: 100,
        ticks: { display: false, stepSize: 25 },
        grid: { color: '#252525' },
        angleLines: { color: '#252525' },
        pointLabels: {
          color: '#d1d5db',
          font: { family: '"JetBrains Mono", monospace', size: 9 },
        },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1a1a1a',
        borderColor: '#2a2a2a',
        borderWidth: 1,
        titleColor: '#d1d5db',
        bodyColor: '#ffffff',
        titleFont: { family: '"JetBrains Mono", monospace', size: 10 },
        bodyFont: { family: '"JetBrains Mono", monospace', size: 12 },
        callbacks: {
          title: (items: any[]) => RADAR_DIMS[items[0].dataIndex],
          label: (ctx: any) => ` ${ctx.raw} / 100 — ${RADAR_DESC[ctx.dataIndex]}`,
        },
      },
    },
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 220, height: 220 }}>
        <Radar data={chartData} options={options} />
      </div>
      {/* Value grid legend */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px 16px', width: 220 }}>
        {RADAR_DIMS.map((dim, i) => (
          <div key={dim} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 8, color: '#9ca3af', letterSpacing: '0.05em' }}>
              {dim.split(' ')[0]}
            </span>
            <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, fontWeight: 700, color }}>
              {values[i]}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Overperformance ranked table ──────────────────────────────────────────────

function OverperfTable({ data, highlightId, onSelect }: { data: OverperformerRow[]; highlightId: string; onSelect: (id: string) => void }) {
  const sorted = [...data]
    .filter(r => r.position_delta !== null && (r.total_points ?? 0) > 0)
    .sort((a, b) => (b.position_delta ?? 0) - (a.position_delta ?? 0))

  const maxAbs = Math.max(...sorted.map(r => Math.abs(r.position_delta ?? 0)), 1)

  return (
    <div>
      {/* Axis legend */}
      <div className="flex items-center justify-between mb-3 pb-2" style={{ borderBottom: '1px solid #1f1f1f' }}>
        <span className="font-mono" style={{ fontSize: 10, color: '#E10600', letterSpacing: '0.08em' }}>← LOST POSITIONS</span>
        <span className="font-mono" style={{ fontSize: 9, color: '#9ca3af', letterSpacing: '0.06em' }}>avg per race vs grid start</span>
        <span className="font-mono" style={{ fontSize: 10, color: '#22D3A5', letterSpacing: '0.08em' }}>GAINED POSITIONS →</span>
      </div>

      {sorted.map((row, i) => {
        const delta = row.position_delta ?? 0
        const isPos = delta >= 0
        const isActive = row.driver_id === highlightId
        const pillColor = isPos ? '#22D3A5' : '#E10600'
        const barW = Math.abs(delta) / maxAbs * 44
        const tcol = teamColor(row.team_id)

        return (
          <div
            key={row.driver_id}
            onClick={() => onSelect(row.driver_id)}
            className="flex items-center gap-2 py-[7px]"
            style={{
              borderBottom: '1px solid #111111',
              background: isActive ? 'rgba(255,255,255,0.05)' : 'transparent',
              borderRadius: 3,
              cursor: 'pointer',
              transition: 'background 0.12s ease',
            }}
            onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.03)' }}
            onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
          >
            {/* Rank */}
            <span className="font-mono flex-shrink-0" style={{ fontSize: 10, color: '#6b7280', width: 16, textAlign: 'right' }}>
              {i + 1}
            </span>

            {/* Team colour pip */}
            <div className="flex-shrink-0 rounded-full" style={{ width: 3, height: 14, background: tcol }} />

            {/* Driver ID */}
            <span
              className="font-mono flex-shrink-0"
              style={{ fontSize: 11, fontWeight: isActive ? 700 : 500, color: isActive ? '#ffffff' : '#d1d5db', width: 30 }}
            >
              {row.driver_id}
            </span>

            {/* Team abbrev */}
            <span className="font-mono flex-shrink-0" style={{ fontSize: 9, color: '#6b7280', width: 22 }}>
              {teamShort(row.team_name)}
            </span>

            {/* Bidirectional bar */}
            <div className="flex-1 relative flex items-center" style={{ height: 6 }}>
              <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: '#1f1f1f' }} />
              <div
                style={{
                  position: 'absolute',
                  height: '100%',
                  borderRadius: 2,
                  background: pillColor,
                  opacity: isActive ? 0.85 : 0.35,
                  width: `${barW}%`,
                  left: isPos ? '50%' : `calc(50% - ${barW}%)`,
                  transition: 'width 0.3s ease',
                }}
              />
            </div>

            {/* Value pill */}
            <span
              className="font-mono flex-shrink-0"
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: pillColor,
                background: `${pillColor}18`,
                border: `1px solid ${pillColor}35`,
                borderRadius: 4,
                padding: '2px 8px',
                minWidth: 52,
                textAlign: 'right',
                letterSpacing: '0.03em',
              }}
            >
              {delta > 0 ? '+' : ''}{delta.toFixed(1)}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ── Season form tooltip + dot ─────────────────────────────────────────────────

function isDnfStatus(status: string | null | undefined): boolean {
  if (!status) return false
  return status !== 'Finished' && !status.startsWith('+')
}

function FormTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const pt = payload[0]?.payload
  const isDnf = isDnfStatus(pt?.status)
  return (
    <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 4, padding: '6px 12px', fontSize: 10 }}>
      <p style={{ color: '#d1d5db', marginBottom: 3, fontFamily: '"JetBrains Mono", monospace' }}>
        R{String(pt?.round_number).padStart(2, '0')} · {pt?.race_name?.replace(/FORMULA 1\s*/i, '').replace(/GRAND PRIX/i, 'GP').trim()}
      </p>
      <p style={{ color: isDnf ? '#E10600' : '#ffffff', fontFamily: '"JetBrains Mono", monospace', fontWeight: 700, fontSize: 13 }}>
        {isDnf ? `DNF (${pt.status})` : `P${pt.finish_position}`}
      </p>
    </div>
  )
}

function FormDot(props: any) {
  const { cx, cy, payload, stroke } = props
  if (isDnfStatus(payload.status)) {
    return <circle cx={cx} cy={cy} r={4} fill="none" stroke="#E10600" strokeWidth={1.5} />
  }
  return <circle cx={cx} cy={cy} r={3} fill={stroke} stroke="none" />
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Drivers() {
  const { season } = useSeason()
  const { data: drivers, loading: driversLoading } = useDrivers(season)
  const { data: overperf, loading: overperfLoading } = useOverperformers(season)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const filteredDrivers = useMemo(
    () => drivers.filter(d =>
      d.driver_id &&
      d.driver_id.length === 3 &&
      !['DEV', 'NUL'].includes(d.driver_id) &&
      (d.total_points ?? 0) > 0
    ),
    [drivers],
  )

  const activeId = selectedId ?? filteredDrivers?.[0]?.driver_id ?? null

  const { data: arcData, loading: arcLoading } = useDriverSeasonArc(activeId, season)

  const activeRow = useMemo(
    () => overperf.find(r => r.driver_id === activeId) ?? null,
    [overperf, activeId],
  )

  const activeDriver = useMemo(
    () => filteredDrivers.find(d => d.driver_id === activeId) ?? null,
    [filteredDrivers, activeId],
  )

  const color = teamColor(activeDriver?.team_id)

  const radarScores = useMemo((): number[] => {
    if (!activeRow || overperf.length === 0) return [0.5, 0.5, 0.5, 0.5, 0.5, 0.5]
    const maxWins    = Math.max(...overperf.map(r => r.wins), 1)
    const maxPodiums = Math.max(...overperf.map(r => r.podiums), 1)
    const allGrids   = overperf.map(r => r.avg_grid_position ?? 10).filter(Boolean)
    const allFinish  = overperf.map(r => r.avg_finish_position ?? 10).filter(Boolean)
    const minGrid = Math.min(...allGrids), maxGrid = Math.max(...allGrids)
    const minFin  = Math.min(...allFinish), maxFin  = Math.max(...allFinish)
    const allDeltas = overperf.map(r => r.position_delta ?? 0)
    const minDelta = Math.min(...allDeltas), maxDelta = Math.max(...allDeltas)

    return [
      1 - normalize(activeRow.avg_grid_position ?? maxGrid, minGrid, maxGrid),
      1 - normalize(activeRow.avg_finish_position ?? maxFin, minFin, maxFin),
      activeRow.wins / maxWins,
      activeRow.podiums / maxPodiums,
      normalize(activeRow.position_delta ?? 0, minDelta, maxDelta),
      (activeRow.overperformance_score ?? 0) > 0
        ? normalize(activeRow.overperformance_score ?? 0, 0, maxDelta)
        : 0,
    ]
  }, [activeRow, overperf])

  if (driversLoading) return <LoadingSpinner message="Loading drivers…" />

  const totalTeams = new Set(filteredDrivers.map(d => d.team_id)).size

  return (
    <div className="flex gap-0 animate-fade-in" style={{ minHeight: 'calc(100vh - 120px)' }}>

      {/* ── Left sidebar ─────────────────────────────────────────────────── */}
      <div
        className="flex-shrink-0"
        style={{ width: 180, borderRight: '1px solid #1f1f1f', display: 'flex', flexDirection: 'column' }}
      >
        <div className="px-4 py-5" style={{ borderBottom: '1px solid #161616' }}>
          <div className="flex items-center gap-2 mb-1">
            <span style={{ color: '#E10600', fontSize: 10 }}>◆</span>
            <span className="font-mono uppercase" style={{ fontSize: 10, letterSpacing: '0.18em', color: '#d1d5db' }}>DRIVERS</span>
          </div>
          <div style={{ height: 1, background: '#1a1a1a', marginBottom: 8 }} />
          <p className="font-mono uppercase" style={{ fontSize: 10, letterSpacing: '0.14em', color: '#9ca3af' }}>
            {filteredDrivers.length} DRIVERS · {totalTeams} TEAMS
          </p>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>
            Form, pace, and overperformance.
          </p>
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {filteredDrivers.map((d) => {
            const col = teamColor(d.team_id)
            const isActive = d.driver_id === activeId
            return (
              <button
                key={d.driver_id}
                onClick={() => setSelectedId(d.driver_id)}
                className="w-full text-left flex items-center gap-2.5 px-4 py-2.5 transition-colors"
                style={{
                  background: isActive ? '#161616' : 'transparent',
                  borderBottom: '1px solid #111111',
                  borderLeft: isActive ? `3px solid ${col}` : '3px solid transparent',
                }}
              >
                <span
                  className="font-mono font-bold flex-shrink-0"
                  style={{ fontSize: 11, color: isActive ? '#ffffff' : '#d1d5db', width: 28 }}
                >
                  {d.driver_id}
                </span>
                <span className="font-mono flex-shrink-0" style={{ fontSize: 10, color: '#6b7280' }}>
                  #{d.abbreviation?.slice(-2) ?? '—'}
                </span>
                <span className="font-mono ml-auto" style={{ fontSize: 10, color: isActive ? '#d1d5db' : '#9ca3af' }}>
                  {d.total_points ?? '—'}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Right panel ──────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto" style={{ minWidth: 0 }}>
        {!activeDriver ? (
          <div className="flex items-center justify-center h-full font-mono" style={{ color: '#6b7280' }}>
            Select a driver
          </div>
        ) : (
          <AnimatePresence mode="wait">
          <motion.div
            key={activeId}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0, transition: { duration: 0.2, ease: 'easeOut' } }}
            exit={{ opacity: 0, x: -6, transition: { duration: 0.12 } }}
          >
            {/* Driver hero */}
            <div
              className="px-8 py-6 grid grid-cols-1 xl:grid-cols-3 gap-6"
              style={{ borderBottom: '1px solid #1a1a1a' }}
            >
              <div className="xl:col-span-2">
                <p className="font-mono uppercase mb-1" style={{ fontSize: 10, letterSpacing: '0.2em', color }}>
                  {teamShort(activeDriver.team_name)}
                </p>
                <span
                  className="font-display font-bold leading-none block mb-2"
                  style={{ fontSize: 72, color: '#ffffff' }}
                >
                  {activeDriver.driver_id}
                </span>
                <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)' }}>
                  {activeDriver.full_name?.split(' ').slice(0, -1).join(' ')},{' '}
                  <span style={{ color: '#ffffff', fontWeight: 600 }}>
                    {activeDriver.full_name?.split(' ').pop()}
                  </span>
                </p>
                <p className="font-mono" style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>
                  CAR #{activeDriver.abbreviation}
                </p>

                {!overperfLoading && activeRow && (
                  <div className="flex gap-8 mt-5">
                    {[
                      { label: 'POINTS',  value: activeRow.total_points,                            sub: 'championship pts' },
                      { label: 'WINS',    value: activeRow.wins,                                     sub: 'race victories' },
                      { label: 'PODIUMS', value: activeRow.podiums,                                  sub: 'top-3 finishes' },
                      { label: 'AVG POS', value: activeRow.avg_finish_position?.toFixed(1) ?? '—',  sub: 'avg finish pos' },
                    ].map(({ label, value, sub }) => (
                      <div key={label}>
                        <p className="font-mono uppercase" style={{ fontSize: 10, letterSpacing: '0.16em', color: '#d1d5db' }}>
                          {label}
                        </p>
                        <p className="font-display font-bold text-white" style={{ fontSize: 28, lineHeight: 1.1 }}>
                          {value}
                        </p>
                        <p className="font-mono" style={{ fontSize: 9, color: '#9ca3af', marginTop: 1 }}>
                          {sub}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-col items-center justify-center">
                <RadarChart scores={radarScores} color={color} />
              </div>
            </div>

            {/* Season form chart */}
            <div className="px-8 py-5" style={{ borderBottom: '1px solid #1a1a1a' }}>
              <div className="flex items-center justify-between mb-4">
                <p className="font-mono uppercase" style={{ fontSize: 10, letterSpacing: '0.18em', color: '#d1d5db' }}>
                  SEASON FORM · FINISH POSITION BY ROUND
                </p>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <div style={{ width: 16, height: 2, background: color, borderRadius: 1 }} />
                    <span className="font-mono" style={{ fontSize: 9, color: '#9ca3af' }}>finish pos</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div style={{ width: 16, height: 0, borderTop: `2px dashed ${color}`, opacity: 0.5 }} />
                    <span className="font-mono" style={{ fontSize: 9, color: '#9ca3af' }}>season avg</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <svg width="10" height="10"><circle cx="5" cy="5" r="4" fill="none" stroke="#E10600" strokeWidth="1.5" /></svg>
                    <span className="font-mono" style={{ fontSize: 9, color: '#9ca3af' }}>DNF</span>
                  </div>
                </div>
              </div>

              {arcLoading ? (
                <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span className="font-mono" style={{ fontSize: 11, color: '#6b7280' }}>Loading…</span>
                </div>
              ) : arcData?.arc && arcData.arc.length > 0 ? (() => {
                const validPts = arcData.arc.filter((p: any) => p.finish_position != null && !isDnfStatus(p.status))
                const avgPos = validPts.length
                  ? validPts.reduce((s: number, p: any) => s + p.finish_position, 0) / validPts.length
                  : null
                return (
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={arcData.arc} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="2 6" stroke="#1a1a1a" vertical={false} />
                      <XAxis
                        dataKey="round_number"
                        tick={{ fill: '#9ca3af', fontSize: 10, fontFamily: '"JetBrains Mono"' }}
                        axisLine={{ stroke: '#1f1f1f' }}
                        tickLine={false}
                        tickFormatter={(v) => `R${String(v).padStart(2, '0')}`}
                      />
                      <YAxis
                        reversed
                        domain={[1, 20]}
                        tick={{ fill: '#9ca3af', fontSize: 10, fontFamily: '"JetBrains Mono"' }}
                        axisLine={false}
                        tickLine={false}
                        ticks={[1, 5, 10, 15, 20]}
                        tickFormatter={(v) => `P${v}`}
                      />
                      <Tooltip content={<FormTooltip />} />
                      {avgPos && (
                        <ReferenceLine
                          y={avgPos}
                          stroke={color}
                          strokeDasharray="4 4"
                          strokeOpacity={0.45}
                          label={{
                            value: `avg P${avgPos.toFixed(1)}`,
                            fill: color,
                            fontSize: 9,
                            fontFamily: '"JetBrains Mono", monospace',
                            opacity: 0.75,
                            position: 'insideTopRight',
                          }}
                        />
                      )}
                      <Line
                        type="monotone"
                        dataKey="finish_position"
                        stroke={color}
                        strokeWidth={2}
                        dot={<FormDot stroke={color} />}
                        activeDot={{ r: 5, fill: color, stroke: '#0a0a0a', strokeWidth: 2 }}
                        connectNulls={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )
              })() : (
                <div style={{ height: 200, display: 'flex', alignItems: 'center' }}>
                  <span className="font-mono" style={{ fontSize: 11, color: '#6b7280' }}>No data</span>
                </div>
              )}
            </div>

            {/* Overperformance table */}
            <div className="px-8 py-5">
              <div className="flex items-baseline justify-between mb-4">
                <p className="font-mono uppercase" style={{ fontSize: 10, letterSpacing: '0.18em', color: '#d1d5db' }}>
                  GRID vs FINISH · ALL DRIVERS
                </p>
                <p className="font-mono" style={{ fontSize: 9, color: '#9ca3af', letterSpacing: '0.06em' }}>
                  Did they beat their starting position?
                </p>
              </div>
              {overperfLoading ? (
                <LoadingSpinner message="Loading overperformers…" />
              ) : (
                <OverperfTable data={overperf} highlightId={activeId ?? ''} onSelect={setSelectedId} />
              )}
            </div>
          </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  )
}
