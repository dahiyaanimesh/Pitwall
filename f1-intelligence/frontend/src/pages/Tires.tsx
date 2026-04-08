import React, { useState, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'
import {
  useStintSummary,
  useCompoundUsage,
  useStrategyClusters,
  useCompoundPerformance,
  useDriverStrategy,
} from '../hooks/useTires'
import type { DriverStintData, DriverStint, DriverRaceStrategy } from '../types/tires'
import { useSeason } from '../context/SeasonContext'

// ── Compound constants ────────────────────────────────────────────────────────
const COMPOUND_COLOR: Record<string, string> = {
  SOFT:         '#FF3333',
  MEDIUM:       '#FFF200',
  HARD:         '#eeeeee',
  INTERMEDIATE: '#39B54A',
  INTER:        '#39B54A',
  WET:          '#0067FF',
  UNKNOWN:      '#4b5563',
}

const COMPOUND_TEXT: Record<string, string> = {
  SOFT:         '#ffffff',
  MEDIUM:       '#111111',
  HARD:         '#111111',
  INTERMEDIATE: '#ffffff',
  INTER:        '#ffffff',
  WET:          '#ffffff',
  UNKNOWN:      '#6b7280',
}

const COMPOUND_ABBREV: Record<string, string> = {
  SOFT:         'S',
  MEDIUM:       'M',
  HARD:         'H',
  INTERMEDIATE: 'I',
  INTER:        'I',
  WET:          'W',
  UNKNOWN:      '?',
}

// Canonical compound order for stacked bars
const COMPOUND_ORDER = ['SOFT', 'MEDIUM', 'HARD', 'INTERMEDIATE', 'WET']

const SEASON_DRIVERS = [
  'VER', 'HAM', 'BOT', 'PER', 'SAI', 'LEC', 'NOR', 'RIC',
  'GAS', 'ALO', 'STR', 'OCO', 'VET', 'TSU', 'RAI', 'GIO',
  'LAT', 'RUS', 'MSC', 'MAZ',
]

// ── Helpers ───────────────────────────────────────────────────────────────────
function shortName(name: string) {
  return name
    .replace('FORMULA 1 ', '')
    .replace(/\d{4}/g, '')
    .replace(/GRAND PRIX/i, 'GP')
    .trim()
    .split(' ')
    .slice(0, 3)
    .join(' ')
}

function compoundTag(compound: string) {
  const c = compound.toUpperCase()
  const bg   = COMPOUND_COLOR[c] ?? '#4b5563'
  const text = COMPOUND_TEXT[c] ?? '#fff'
  return (
    <span
      key={compound}
      style={{
        background:    bg,
        color:         text,
        fontFamily:    '"JetBrains Mono", monospace',
        fontSize:      10,
        fontWeight:    700,
        borderRadius:  4,
        padding:       '2px 7px',
        letterSpacing: '0.06em',
      }}
    >
      {c}
    </span>
  )
}

// ── Gantt chart (shared by Race + Driver views) ───────────────────────────────
const GANTT_LABEL_W = 72
const ROW_H         = 32
const ROW_GAP       = 4
const PAD_TOP       = 26

interface GanttRow {
  id:        string
  label:     string
  subLabel?: string
  stints:    DriverStint[]
  totalLaps: number
}

function GanttChart({
  rows,
  maxLaps,
  highlightRow,
  onRowHover,
}: {
  rows:          GanttRow[]
  maxLaps:       number
  highlightRow?: string | null
  onRowHover?:   (id: string | null) => void
}) {
  const [tooltip, setTooltip] = useState<{ mx: number; my: number; text: string } | null>(null)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [containerW, setContainerW] = React.useState(800)

  React.useEffect(() => {
    if (!containerRef.current) return
    const obs = new ResizeObserver((entries) => {
      setContainerW(entries[0].contentRect.width)
    })
    obs.observe(containerRef.current)
    return () => obs.disconnect()
  }, [])

  const barW  = containerW - GANTT_LABEL_W - 4
  const lapW  = barW / Math.max(maxLaps, 1)
  const svgW  = containerW
  const svgH  = PAD_TOP + rows.length * (ROW_H + ROW_GAP) + 20

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      {/* Fixed cursor-following tooltip */}
      {tooltip && (
        <div style={{
          position:   'fixed',
          top:        tooltip.my - 40,
          left:       tooltip.mx + 12,
          background: '#1f2937',
          border:     '1px solid #2a2a2a',
          borderRadius: 4,
          padding:    '5px 10px',
          fontSize:   11,
          color:      '#ffffff',
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
          zIndex:     100,
        }}>
          {tooltip.text}
        </div>
      )}
      <svg
        width={svgW}
        height={svgH}
        style={{ display: 'block', fontFamily: "'JetBrains Mono', monospace" }}
      >
        {/* Lap-number header ticks every 10 laps */}
        {[1, 10, 20, 30, 40, 50, 60, 70, 80].filter((l) => l <= maxLaps).map((lap) => {
          const x = GANTT_LABEL_W + (lap - 1) * lapW
          return (
            <g key={lap}>
              <line
                x1={x} y1={PAD_TOP - 4}
                x2={x} y2={svgH - 16}
                stroke="rgba(255,255,255,0.04)"
                strokeWidth={1}
              />
              <text x={x} y={PAD_TOP - 8} textAnchor="middle" fill="rgba(255,255,255,0.22)" fontSize={9}>
                {lap}
              </text>
            </g>
          )
        })}

        {/* Rows */}
        {rows.map((row, ri) => {
          const y         = PAD_TOP + ri * (ROW_H + ROW_GAP)
          const isHovered = highlightRow === row.id

          // Check if all stints are UNKNOWN — dim this row
          const allUnknown = row.stints.every((s) => s.compound.toUpperCase() === 'UNKNOWN')

          return (
            <g
              key={row.id}
              onMouseEnter={() => onRowHover?.(row.id)}
              onMouseLeave={() => onRowHover?.(null)}
              style={{ cursor: 'default', opacity: allUnknown ? 0.4 : 1 }}
            >
              {/* Row background */}
              <rect
                x={0} y={y - 2}
                width={svgW} height={ROW_H + 3}
                fill={isHovered ? 'rgba(255,255,255,0.04)' : ri % 2 === 1 ? 'rgba(255,255,255,0.012)' : 'none'}
                rx={2}
              />

              {/* Sub-label (finish pos) */}
              {row.subLabel && (
                <text
                  x={4} y={y + ROW_H / 2 + 4}
                  fill="rgba(255,255,255,0.22)"
                  fontSize={8}
                  fontWeight="600"
                >
                  {row.subLabel}
                </text>
              )}

              {/* Primary label */}
              <text
                x={row.subLabel ? 30 : 6}
                y={y + ROW_H / 2 + 4}
                fill={isHovered ? '#ffffff' : 'rgba(255,255,255,0.65)'}
                fontSize={10}
                fontWeight="700"
              >
                {row.label}
              </text>

              {/* Stint rectangles */}
              {row.stints.map((stint) => {
                const sx        = GANTT_LABEL_W + (stint.start_lap - 1) * lapW
                const sw        = Math.max(stint.laps * lapW - 1, 2)
                const c         = stint.compound.toUpperCase()
                const isUnknown = c === 'UNKNOWN'
                const color     = isUnknown ? '#1f1f1f' : (COMPOUND_COLOR[c] ?? '#4b5563')
                const tCol      = COMPOUND_TEXT[c] ?? '#fff'
                const abbr      = COMPOUND_ABBREV[c] ?? '?'

                return (
                  <g key={stint.stint}>
                    <rect
                      x={sx} y={y + 4}
                      width={sw} height={ROW_H - 8}
                      fill={color}
                      rx={3}
                      onMouseMove={(e) => {
                        setTooltip({
                          mx:   e.clientX,
                          my:   e.clientY,
                          text: isUnknown
                            ? 'No compound data — race not started'
                            : `${row.label} · ${c} · Laps ${stint.start_lap}–${stint.end_lap} (${stint.laps}L)`,
                        })
                      }}
                      onMouseLeave={() => setTooltip(null)}
                    />
                    {!isUnknown && sw > 20 && (
                      <text
                        x={sx + sw / 2} y={y + ROW_H / 2 + 4}
                        textAnchor="middle"
                        fill={tCol}
                        fontSize={11}
                        fontWeight="800"
                        style={{ pointerEvents: 'none' }}
                      >
                        {abbr}
                      </text>
                    )}
                  </g>
                )
              })}
            </g>
          )
        })}

      </svg>
    </div>
  )
}

// ── Compound legend strip ─────────────────────────────────────────────────────
function CompoundLegend({ compounds }: { compounds: string[] }) {
  return (
    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 12 }}>
      {compounds.map((c) => {
        const color = COMPOUND_COLOR[c] ?? '#4b5563'
        return (
          <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 12, height: 12, borderRadius: 2, background: color }} />
            <span style={{ fontSize: 11, color: '#6b7280' }}>
              {c === 'INTERMEDIATE' ? 'Inter' : c.charAt(0) + c.slice(1).toLowerCase()}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ── Custom tooltip for Recharts ───────────────────────────────────────────────
function BarTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; fill: string }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#1f1f1f', border: '1px solid #2a2a2a', borderRadius: 6, padding: '8px 12px', fontSize: 11 }}>
      <p style={{ color: '#6b7280', marginBottom: 6, fontWeight: 600 }}>{label}</p>
      {payload.filter((p) => p.value > 0).map((p) => (
        <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
          <div style={{ width: 8, height: 8, borderRadius: 2, background: p.fill }} />
          <span style={{ color: 'rgba(255,255,255,0.65)' }}>{p.name}: <span style={{ color: '#ffffff', fontFamily: '"JetBrains Mono", monospace' }}>{p.value.toLocaleString()}</span></span>
        </div>
      ))}
    </div>
  )
}

// ── Card wrapper ──────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div style={{ background: '#111111', border: '1px solid #1f1f1f', borderRadius: 8, padding: '16px 20px' }}>
      <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.15em', color: '#6b7280', marginBottom: 8 }}>
        {label}
      </p>
      <p style={{ fontSize: 26, fontWeight: 700, fontFamily: '"JetBrains Mono", monospace', color, lineHeight: 1, marginBottom: 4 }}>
        {value}
      </p>
      {sub && <p style={{ fontSize: 11, color: '#4b5563' }}>{sub}</p>}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Tires() {
  const { season: SEASON } = useSeason()
  const [selectedRaceId, setSelectedRaceId] = useState<number | null>(null)
  const [selectedDriver, setSelectedDriver] = useState<string>('VER')
  const [hoveredRow, setHoveredRow]         = useState<string | null>(null)

  // Reset race selection when season changes
  useEffect(() => { setSelectedRaceId(null) }, [SEASON])

  const { data: usage,    loading: usageLoading }    = useCompoundUsage(SEASON)
  const { data: clusters, loading: clustersLoading } = useStrategyClusters(SEASON)
  const { data: perf }                               = useCompoundPerformance(SEASON)
  const { data: stints,   loading: stintsLoading }   = useStintSummary(selectedRaceId)
  const { data: drvStrat, loading: drvLoading }      = useDriverStrategy(SEASON, selectedDriver)

  // Default to first race once usage loads
  const races = usage?.per_race ?? []
  if (usage && selectedRaceId === null && races.length > 0) {
    setSelectedRaceId(races[0].race_id)
  }

  const selectedRaceMeta = races.find((r) => r.race_id === selectedRaceId)

  // ── Derived: strategy summary cards ──────────────────────────────────────
  const winner         = stints?.drivers?.[0] ?? null
  const avgStops       = stints
    ? +(stints.drivers.reduce((s, d) => s + (d.stints.length - 1), 0) / Math.max(stints.drivers.length, 1)).toFixed(1)
    : null

  const stintSeqCounts: Record<string, number> = {}
  stints?.drivers.forEach((d) => {
    const key = d.stints.map((s) => COMPOUND_ABBREV[s.compound] ?? s.compound).join('→')
    stintSeqCounts[key] = (stintSeqCounts[key] ?? 0) + 1
  })
  const mostCommonStrategy = Object.entries(stintSeqCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—'

  // ── Derived: Gantt rows for race stint map ───────────────────────────────
  const raceGanttRows: GanttRow[] = (stints?.drivers ?? []).map((d: DriverStintData) => ({
    id:       d.driver_id,
    label:    d.abbreviation,
    subLabel: `P${d.finish_position}`,
    stints:   d.stints,
    totalLaps: stints!.total_laps,
  }))

  // ── Derived: Gantt rows for driver season strategy ───────────────────────
  const drvGanttRows: GanttRow[] = (drvStrat ?? [])
    .filter((r) => r.stints.length > 0)
    .map((r: DriverRaceStrategy) => ({
      id:       String(r.race_id),
      label:    `R${String(r.round_number).padStart(2, '0')} ${shortName(r.race_name).split(' ')[0]}`,
      subLabel: r.finish_position ? `P${r.finish_position}` : '',
      stints:   r.stints,
      totalLaps: r.total_laps,
    }))
  const drvMaxLaps = Math.max(...(drvStrat?.map((r) => r.total_laps) ?? [1]), 1)

  // ── Derived: stacked bar data ─────────────────────────────────────────────
  const barData = races.map((r) => ({
    name: `R${String(r.round_number).padStart(2, '0')}`,
    ...Object.fromEntries(
      COMPOUND_ORDER.map((c) => [c === 'INTERMEDIATE' ? 'INTER' : c, r.compounds[c] ?? r.compounds[c === 'INTERMEDIATE' ? 'INTER' : c] ?? 0])
    ),
  }))

  // ── Derived: donut data ───────────────────────────────────────────────────
  const total    = usage?.total ?? {}
  const donutRaw = COMPOUND_ORDER.map((c) => {
    const val = (total[c] ?? 0) + (c === 'INTERMEDIATE' ? (total['INTER'] ?? 0) : 0)
    return { name: c === 'INTERMEDIATE' ? 'INTER' : c, value: val, color: COMPOUND_COLOR[c] }
  }).filter((d) => d.value > 0)
  const donutTotal = donutRaw.reduce((s, d) => s + d.value, 0)

  // ── Compounds present in race stint data (for legend) ────────────────────
  const raceCompounds = Array.from(
    new Set(stints?.drivers.flatMap((d) => d.stints.map((s) => s.compound.toUpperCase())) ?? [])
  ).filter((c) => c !== 'UNKNOWN')

  // ── Dominant compound per race (for clusters table) ───────────────────────
  const dominantCompoundByRace: Record<number, string> = {}
  races.forEach((r) => {
    const compounds = r.compounds
    const dominant = Object.entries(compounds)
      .filter(([c]) => c !== 'UNKNOWN')
      .sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—'
    dominantCompoundByRace[r.race_id] = dominant
  })

  return (
    <div className="space-y-5 pb-10 animate-fade-in">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 20 }}>
        <h1 className="font-display font-bold text-[28px] uppercase tracking-[0.06em] text-white" style={{ margin: '0 0 4px' }}>
          TYRE ANALYSIS
        </h1>
        <p style={{ fontSize: 11, color: '#6b7280', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 16 }}>
          Compound Strategy &amp; Stint Analysis — {SEASON} Season
        </p>

        {/* Race selector pills */}
        {usageLoading ? (
          <div style={{ color: '#4b5563', fontSize: 12 }}>Loading races…</div>
        ) : (
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
            {races.map((race) => {
              const isActive = race.race_id === selectedRaceId
              return (
                <button
                  key={race.race_id}
                  onClick={() => setSelectedRaceId(race.race_id)}
                  style={{
                    fontSize: 11, fontWeight: 600,
                    fontFamily: '"JetBrains Mono", monospace',
                    color:      isActive ? '#E10600' : '#6b7280',
                    background: isActive ? 'rgba(225,6,0,0.15)' : '#141414',
                    border:     `1px solid ${isActive ? 'rgba(225,6,0,0.3)' : '#2a2a2a'}`,
                    borderRadius: 6,
                    padding:    '5px 10px',
                    cursor:     'pointer',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  R{race.round_number}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Row 2: Race Stint Map (full width) ──────────────────────────────── */}
      <div style={{ background: '#111111', border: '1px solid #1f1f1f', borderRadius: 8, padding: '20px 24px', marginBottom: 12 }}>
        <div style={{ marginBottom: 14 }}>
          <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.15em', color: '#6b7280', marginBottom: 4 }}>
            Race Stint Map
          </p>
          <p style={{ fontSize: 14, fontWeight: 600, color: '#ffffff' }}>
            {selectedRaceMeta ? shortName(selectedRaceMeta.race_name) : '—'}
            <span style={{ color: '#6b7280', fontWeight: 400, marginLeft: 8, fontSize: 12 }}>
              {stints ? `Round ${stints.round_number} · ${stints.total_laps} laps` : ''}
            </span>
          </p>
        </div>

        {stintsLoading ? (
          <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 12, color: '#4b5563' }}>Computing stints…</span>
          </div>
        ) : stints && raceGanttRows.length > 0 ? (
          <>
            {stints.total_laps < 10 && (
              <div style={{
                background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)',
                borderRadius: 6, padding: '8px 14px', marginBottom: 12,
                fontSize: 12, color: '#f59e0b',
              }}>
                ⚠️ Race suspended — only {stints.total_laps} lap{stints.total_laps !== 1 ? 's' : ''} completed under Safety Car conditions
              </div>
            )}
            <GanttChart
              rows={raceGanttRows}
              maxLaps={stints.total_laps}
              highlightRow={hoveredRow}
              onRowHover={setHoveredRow}
            />
            <CompoundLegend compounds={raceCompounds} />
          </>
        ) : (
          <p style={{ fontSize: 12, color: '#4b5563' }}>Select a race to view stint data.</p>
        )}
      </div>

      {/* ── Row 3: Strategy summary cards (grid-cols-4, full width) ─────────── */}
      {stints && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 12 }}>
          <StatCard
            label="Most Common Strategy"
            value={mostCommonStrategy}
            color="#ffffff"
            sub={`across ${stints.drivers.length} drivers`}
          />
          <StatCard
            label="Avg Pit Stops"
            value={avgStops ?? '—'}
            color="#f59e0b"
            sub="per driver"
          />
          <div style={{ background: '#111111', border: '1px solid #1f1f1f', borderRadius: 8, padding: '16px 20px' }}>
            <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.15em', color: '#6b7280', marginBottom: 8 }}>
              Fastest Pitstop
            </p>
            {stints.fastest_pitstop ? (
              <>
                <p style={{ fontSize: 22, fontWeight: 700, fontFamily: '"JetBrains Mono", monospace', color: '#22D3A5', lineHeight: 1, marginBottom: 4 }}>
                  {stints.fastest_pitstop.pit_duration_seconds.toFixed(1)}s
                </p>
                <p style={{ fontSize: 11, color: '#4b5563' }}>
                  {stints.fastest_pitstop.abbreviation} · Lap {stints.fastest_pitstop.lap_number}
                </p>
              </>
            ) : (
              <p style={{ fontSize: 22, fontWeight: 700, color: 'rgba(255,255,255,0.3)', lineHeight: 1 }}>—</p>
            )}
          </div>
          <div style={{ background: '#111111', border: '1px solid #1f1f1f', borderRadius: 8, padding: '16px 20px' }}>
            <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.15em', color: '#6b7280', marginBottom: 8 }}>
              Winning Strategy
            </p>
            {winner ? (
              <>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#ffffff', marginBottom: 8 }}>
                  {winner.abbreviation}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                  {winner.stints.slice(0, 4).map((s, i) => (
                    <React.Fragment key={i}>
                      {i > 0 && <span style={{ color: '#4b5563', fontSize: 11 }}>→</span>}
                      {compoundTag(s.compound)}
                    </React.Fragment>
                  ))}
                </div>
              </>
            ) : (
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>—</p>
            )}
          </div>
        </div>
      )}

      {/* ── Row 4: Season Compound Usage — bar (3fr) + donut (2fr) ──────────── */}
      <div style={{ background: '#111111', border: '1px solid #1f1f1f', borderRadius: 8, padding: '20px 24px', marginBottom: 12 }}>
        <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.15em', color: '#6b7280', marginBottom: 16 }}>
          Season Compound Usage
        </p>

        {usageLoading ? (
          <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 12, color: '#4b5563' }}>Loading…</span>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 24, alignItems: 'start' }}>

            {/* Stacked bar chart — col-span-3 */}
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 11, color: '#4b5563', marginBottom: 10 }}>Laps per compound per race</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={barData} barSize={10} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fill: '#4b5563', fontSize: 9 }} tickLine={false} axisLine={false} interval={1} />
                  <YAxis tick={{ fill: '#4b5563', fontSize: 9 }} tickLine={false} axisLine={false} />
                  <Tooltip content={<BarTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                  {COMPOUND_ORDER.map((c) => {
                    const key = c === 'INTERMEDIATE' ? 'INTER' : c
                    return <Bar key={key} dataKey={key} stackId="a" fill={COMPOUND_COLOR[c]} />
                  })}
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Donut + legend — col-span-2 */}
            <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <p style={{ fontSize: 11, color: '#4b5563', marginBottom: 10, alignSelf: 'flex-start' }}>Season totals</p>
              <div style={{ position: 'relative', width: '100%', maxWidth: 200 }}>
                <ResponsiveContainer width="100%" height={170}>
                  <PieChart>
                    <Pie data={donutRaw} cx="50%" cy="50%" innerRadius={48} outerRadius={72} paddingAngle={2} dataKey="value">
                      {donutRaw.map((entry, i) => (
                        <Cell key={i} fill={entry.color} opacity={0.9} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null
                        const d = payload[0].payload
                        return (
                          <div style={{ background: '#1f1f1f', border: '1px solid #2a2a2a', borderRadius: 6, padding: '6px 10px', fontSize: 11 }}>
                            <span style={{ color: '#6b7280' }}>{d.name}: </span>
                            <span style={{ color: '#fff', fontFamily: 'monospace' }}>{((d.value / donutTotal) * 100).toFixed(1)}%</span>
                          </div>
                        )
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none' }}>
                  <p style={{ fontSize: 9, fontWeight: 700, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{SEASON}</p>
                  <p style={{ fontSize: 8, color: '#4b5563' }}>SEASON</p>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 10, alignSelf: 'flex-start', width: '100%' }}>
                {donutRaw.map((d) => (
                  <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: d.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 11, color: '#6b7280', fontFamily: '"JetBrains Mono", monospace' }}>
                      {d.name} — {((d.value / donutTotal) * 100).toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Row 5: Driver Timeline (3fr) + Compound Performance (2fr) ────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 12, marginBottom: 12 }}>

        {/* Driver strategy Gantt */}
        <div style={{ background: '#111111', border: '1px solid #1f1f1f', borderRadius: 8, padding: '20px 24px', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.15em', color: '#6b7280', marginBottom: 2 }}>
                Driver Strategy Timeline
              </p>
              <p style={{ fontSize: 11, color: '#4b5563' }}>Full season stint history</p>
            </div>
            <select
              value={selectedDriver}
              onChange={(e) => setSelectedDriver(e.target.value)}
              style={{
                background: '#141414', border: '1px solid #2a2a2a', borderRadius: 6,
                color: '#ffffff', fontSize: 12, fontFamily: '"JetBrains Mono", monospace',
                padding: '5px 10px', cursor: 'pointer', outline: 'none', flexShrink: 0,
              }}
            >
              {SEASON_DRIVERS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          {drvLoading ? (
            <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 12, color: '#4b5563' }}>Loading…</span>
            </div>
          ) : drvGanttRows.length > 0 ? (
            <>
              <GanttChart
                rows={drvGanttRows}
                maxLaps={drvMaxLaps}
                highlightRow={hoveredRow}
                onRowHover={setHoveredRow}
              />
              <CompoundLegend compounds={['SOFT', 'MEDIUM', 'HARD', 'INTERMEDIATE', 'WET']} />
            </>
          ) : (
            <p style={{ fontSize: 12, color: '#4b5563' }}>No strategy data for {selectedDriver}.</p>
          )}
        </div>

        {/* Compound performance — compact vertical cards */}
        <div style={{ background: '#111111', border: '1px solid #1f1f1f', borderRadius: 8, padding: '20px 24px', minWidth: 0 }}>
          <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.15em', color: '#6b7280', marginBottom: 4 }}>
            Compound Performance
          </p>
          <p style={{ fontSize: 11, color: '#4b5563', marginBottom: 16 }}>Green flag laps only — 2021 season</p>

          {perf && perf.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {perf.filter((p) => p.compound !== 'UNKNOWN').map((p) => {
                const bg   = COMPOUND_COLOR[p.compound] ?? '#4b5563'
                const text = COMPOUND_TEXT[p.compound]  ?? '#fff'
                const deg  = p.degradation_per_lap
                const degColor = deg > 0.05 ? '#e10600' : deg > 0 ? '#f59e0b' : '#22D3A5'
                return (
                  <div
                    key={p.compound}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      background: '#0d0d0d', border: '1px solid #1a1a1a',
                      borderRadius: 6, padding: '10px 14px',
                    }}
                  >
                    {/* Compound badge */}
                    <div style={{
                      background: bg, color: text,
                      fontSize: 10, fontWeight: 800,
                      borderRadius: 4, padding: '3px 8px',
                      letterSpacing: '0.06em', flexShrink: 0, minWidth: 56, textAlign: 'center',
                    }}>
                      {p.compound === 'INTERMEDIATE' ? 'INTER' : p.compound}
                    </div>
                    {/* Avg lap time */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 16, fontWeight: 700, fontFamily: '"JetBrains Mono", monospace', color: '#ffffff', lineHeight: 1 }}>
                        {p.avg_lap_time ? `${p.avg_lap_time.toFixed(1)}s` : '—'}
                      </p>
                      <p style={{ fontSize: 9, color: '#4b5563', marginTop: 2 }}>{p.total_laps.toLocaleString()} laps</p>
                    </div>
                    {/* Degradation */}
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <p style={{ fontSize: 12, fontWeight: 700, fontFamily: '"JetBrains Mono", monospace', color: degColor, lineHeight: 1 }}>
                        {deg > 0 ? '+' : ''}{(deg * 1000).toFixed(1)}
                      </p>
                      <p style={{ fontSize: 9, color: '#4b5563', marginTop: 2 }}>ms/lap</p>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p style={{ fontSize: 12, color: '#4b5563' }}>Loading…</p>
          )}
        </div>
      </div>

      {/* ── Row 6: Strategy Clusters table (full width) ──────────────────────── */}
      <div style={{ background: '#111111', border: '1px solid #1f1f1f', borderRadius: 8, padding: '20px 24px' }}>
        <div style={{ marginBottom: 14 }}>
          <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.15em', color: '#6b7280', marginBottom: 4 }}>
            Strategy Clusters
          </p>
          <p style={{ fontSize: 12, color: '#4b5563' }}>Races grouped by dominant pit stop count</p>
        </div>

        {clustersLoading ? (
          <div style={{ color: '#4b5563', fontSize: 12 }}>Loading…</div>
        ) : clusters ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <colgroup>
                <col style={{ width: 80 }} />
                <col />
                <col style={{ width: 120 }} />
                <col style={{ width: 120 }} />
                <col style={{ width: 180 }} />
                <col style={{ width: 100 }} />
              </colgroup>
              <thead>
                <tr style={{ borderBottom: '1px solid #1f1f1f' }}>
                  {['Round', 'Race', 'Strategy', 'Avg Stops', 'Dominant Compound', 'Winner'].map((h) => (
                    <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#4b5563' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {clusters.race_strategies.map((r, i) => {
                  const stratColor =
                    r.dominant_strategy === '1-stop' ? '#22D3A5' :
                    r.dominant_strategy === '2-stop' ? '#f59e0b' : '#e10600'
                  const domCompound = dominantCompoundByRace[r.race_id] ?? '—'
                  const cBg   = COMPOUND_COLOR[domCompound] ?? '#4b5563'
                  const cText = COMPOUND_TEXT[domCompound]  ?? '#fff'
                  return (
                    <tr key={r.race_id} style={{ borderBottom: '1px solid #161616', background: i % 2 === 1 ? 'rgba(255,255,255,0.012)' : 'transparent' }}>
                      <td style={{ padding: '9px 12px', fontFamily: '"JetBrains Mono", monospace', color: '#6b7280' }}>
                        R{String(r.round_number).padStart(2, '0')}
                      </td>
                      <td style={{ padding: '9px 12px', color: '#6b7280' }}>
                        {shortName(r.race_name)}
                      </td>
                      <td style={{ padding: '9px 12px' }}>
                        <span style={{
                          fontSize: 10, fontWeight: 700,
                          fontFamily: '"JetBrains Mono", monospace',
                          color: stratColor, background: `${stratColor}18`,
                          border: `1px solid ${stratColor}44`,
                          borderRadius: 4, padding: '2px 8px', letterSpacing: '0.06em',
                        }}>
                          {r.dominant_strategy.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: '9px 12px', fontFamily: '"JetBrains Mono", monospace', color: '#6b7280' }}>
                        {r.avg_stops.toFixed(1)}
                      </td>
                      <td style={{ padding: '9px 12px' }}>
                        {domCompound !== '—' ? (
                          <span style={{
                            background: cBg, color: cText,
                            fontSize: 9, fontWeight: 800,
                            borderRadius: 4, padding: '2px 7px', letterSpacing: '0.06em',
                          }}>
                            {domCompound}
                          </span>
                        ) : (
                          <span style={{ color: '#4b5563' }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: '9px 12px', fontFamily: '"JetBrains Mono", monospace', fontWeight: 700, color: '#ffffff', fontSize: 12 }}>
                        {r.winner ?? '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  )
}
