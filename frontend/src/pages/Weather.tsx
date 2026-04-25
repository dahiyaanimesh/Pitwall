import { useState, useRef, useEffect } from 'react'
import RaceSwiper from '../components/RaceSwiper'
import { useTrackStatus, useSafetyCars, useStatusSummary, useSeasonOverview } from '../hooks/useWeather'
import { useSeason } from '../context/SeasonContext'
import type { TrackStatus, RaceSeasonOverview } from '../types/weather'
import { shortName } from '../utils/formatters'
import { TEMP_DATA, RAIN_DATA } from '../data/weatherData'

// ── Status colours ────────────────────────────────────────────────────────────
const STATUS_COLOR: Record<TrackStatus, string> = {
  Green:  '#22D3A5',
  Yellow: '#f59e0b',
  SC:     '#e10600',
  VSC:    '#f97316',
  Red:    '#dc2626',
}

const STATUS_BG: Record<TrackStatus, string> = {
  Green:  'rgba(34,211,165,0.08)',
  Yellow: 'rgba(245,158,11,0.08)',
  SC:     'rgba(225,6,0,0.08)',
  VSC:    'rgba(249,115,22,0.08)',
  Red:    'rgba(225,6,0,0.08)',
}

// Simple team colour lookup (abbreviated, covers main 2021 field)
const DRIVER_COLOR: Record<string, string> = {
  VER: '#3671C6', PER: '#3671C6',
  HAM: '#6CD3BF', BOT: '#6CD3BF',
  LEC: '#E8002D', SAI: '#E8002D',
  NOR: '#FF8000', RIC: '#FF8000',
  ALO: '#0090FF', OCO: '#0090FF',
  GAS: '#4E7C9B', TSU: '#4E7C9B',
  STR: '#358C75', VET: '#358C75',
  RAI: '#900000', GIO: '#900000',
  MSC: '#787878', MAZ: '#787878',
  LAT: '#37BEDD', RUS: '#37BEDD',
}

function StatusBadge({ type }: { type: 'SC' | 'VSC' }) {
  const color = type === 'SC' ? '#e10600' : '#f97316'
  return (
    <span
      style={{
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: 10,
        fontWeight: 700,
        color,
        background: `${color}22`,
        border: `1px solid ${color}55`,
        borderRadius: 4,
        padding: '2px 7px',
        letterSpacing: '0.1em',
      }}
    >
      {type}
    </span>
  )
}

// ── Season Heatmap (div-based) ────────────────────────────────────────────────
const HM_CELL_H  = 20   // px per row
const HM_ROW_GAP  = 3   // gap between rows (px)
const HM_GROUP_GAP = 6  // gap every 5 rows
const HM_LABEL_W  = 240 // fixed label column width

// Heatmap-specific colours (distinct from timeline bar)
const HEATMAP_COLOR: Record<string, string> = {
  Green:  '#166534',
  Yellow: '#ca8a04',
  SC:     '#dc2626',
  VSC:    '#ea580c',
  Red:    '#7c3aed',
}

const HEATMAP_LEGEND = [
  { label: 'Green',       color: '#166534' },
  { label: 'Safety Car',  color: '#dc2626' },
  { label: 'Virtual SC',  color: '#ea580c' },
  { label: 'Yellow',      color: '#ca8a04' },
  { label: 'Red Flag',    color: '#7c3aed' },
  { label: 'Race ended',  color: '#0a0a0a', border: '#1f1f1f' },
]

function heatmapLabel(name: string) {
  return name
    .replace(/FORMULA 1\s*/i, '')
    .replace(/\d{4}/g, '')
    .replace(/GRAND PRIX/i, 'GP')
    .trim()
}

function SeasonHeatmap({ races, season }: { races: RaceSeasonOverview[]; season: number }) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerW, setContainerW] = useState(1000)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const obs = new ResizeObserver((entries) => setContainerW(entries[0].contentRect.width))
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const maxLap    = Math.max(...races.map((r) => r.total_laps), 1)
  const lastRound = Math.max(...races.map((r) => r.round_number))

  // Dynamic cell width: fill available space after label column
  const availableW = Math.max(containerW - HM_LABEL_W - 12, 400)
  const cellW      = Math.max(Math.floor(availableW / maxLap), 8)
  const cellGap    = 1

  const AXIS_H = 22
  const lapAxisTicks = Array.from({ length: Math.floor(maxLap / 10) }, (_, i) => (i + 1) * 10)

  const ENDED_BG = 'repeating-linear-gradient(45deg,#0f0f0f,#0f0f0f 2px,#141414 2px,#141414 6px)'

  return (
    <div ref={containerRef}>
      {/* Title row with legend */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.15em', color: '#d1d5db', marginBottom: 2 }}>
            {season} Season — Track Status Heatmap
          </p>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Each cell = one lap · Hover for details</p>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          {HEATMAP_LEGEND.map(({ label, color, border }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{
                width: 12, height: 12, borderRadius: 2,
                background: color,
                border: border ? `1px solid ${border}` : undefined,
                flexShrink: 0,
              }} />
              <span style={{ fontSize: 10, color: '#d1d5db', whiteSpace: 'nowrap' }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Heatmap body */}
      <div
        style={{ display: 'flex', fontFamily: "'JetBrains Mono', monospace", overflowX: 'auto' }}
        onMouseLeave={() => setTooltip(null)}
      >
        {/* ── Label column ── */}
        <div style={{ flexShrink: 0, width: HM_LABEL_W, borderRight: '1px solid #1f1f1f', paddingRight: 8 }}>
          <div style={{ height: AXIS_H }} />
          {races.map((race, ri) => {
            const isLast = race.round_number === lastRound
            const rowGap = ri > 0 && ri % 5 === 0 ? HM_GROUP_GAP : (ri > 0 ? HM_ROW_GAP : 0)
            const label  = `R${String(race.round_number).padStart(2, '0')} ${heatmapLabel(race.race_name)}`
            return (
              <div
                key={race.race_id}
                style={{
                  height: HM_CELL_H,
                  marginTop: rowGap,
                  display: 'flex',
                  alignItems: 'center',
                  borderLeft: isLast ? '3px solid #e10600' : undefined,
                  paddingLeft: isLast ? 6 : 0,
                  background: isLast ? 'rgba(225,6,0,0.04)' : undefined,
                }}
              >
                <span
                  style={{
                    fontSize: 10,
                    color: isLast ? '#ffffff' : '#6b7280',
                    fontWeight: isLast ? 700 : 400,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: HM_LABEL_W - 10,
                    display: 'block',
                  }}
                  title={heatmapLabel(race.race_name)}
                >
                  {label}
                </span>
              </div>
            )
          })}
        </div>

        {/* ── Cells column ── */}
        <div style={{ width: 'fit-content' }}>
          {/* Lap axis */}
          <div style={{ height: AXIS_H, position: 'relative' }}>
            {lapAxisTicks.map((lap) => (
              <div
                key={lap}
                style={{
                  position: 'absolute',
                  left: (lap - 1) * (cellW + cellGap) + cellW / 2,
                  top: 0,
                  fontSize: 10,
                  color: '#d1d5db',
                  transform: 'translateX(-50%)',
                  whiteSpace: 'nowrap',
                  lineHeight: `${AXIS_H}px`,
                }}
              >
                {lap}
              </div>
            ))}
          </div>

          {/* Race rows */}
          {races.map((race, ri) => {
            const rowGap = ri > 0 && ri % 5 === 0 ? HM_GROUP_GAP : (ri > 0 ? HM_ROW_GAP : 0)
            const raceName = heatmapLabel(race.race_name)
            return (
              <div
                key={race.race_id}
                style={{ display: 'flex', gap: cellGap, marginTop: rowGap, height: HM_CELL_H }}
              >
                {Array.from({ length: maxLap }, (_, li) => {
                  const lap     = li + 1
                  const status  = race.lap_statuses[String(lap)] as TrackStatus | undefined
                  const isEnded = !status
                  const isEndMarker = lap === race.total_laps + 1

                  return (
                    <div
                      key={lap}
                      style={{
                        width: cellW,
                        height: HM_CELL_H,
                        flexShrink: 0,
                        background: isEnded ? ENDED_BG : (HEATMAP_COLOR[status!] ?? '#4b5563'),
                        opacity: isEnded ? 0.3 : 1,
                        borderRadius: 1,
                        borderLeft: isEndMarker ? '1px solid #2a2a2a' : undefined,
                      }}
                      onMouseEnter={(e) => {
                        if (!isEnded) {
                          setTooltip({
                            x: e.clientX,
                            y: e.clientY,
                            text: `R${race.round_number} ${raceName} — Lap ${lap} — ${status}`,
                          })
                        } else {
                          setTooltip(null)
                        }
                      }}
                      onMouseMove={(e) => {
                        if (!isEnded) setTooltip((t) => t ? { ...t, x: e.clientX, y: e.clientY } : null)
                      }}
                    />
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>

      {/* Cursor tooltip */}
      {tooltip && (
        <div style={{
          position: 'fixed',
          left: tooltip.x + 14,
          top: tooltip.y - 30,
          background: '#1a1a1a',
          border: '1px solid #2a2a2a',
          borderRadius: 4,
          padding: '5px 10px',
          fontSize: 11,
          color: '#fff',
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
          zIndex: 200,
          fontFamily: "'JetBrains Mono', monospace",
        }}>
          {tooltip.text}
        </div>
      )}
    </div>
  )
}

// ── Timeline Bar ──────────────────────────────────────────────────────────────
interface TimelineProps {
  lapStatuses: Array<{ lap: number; status: string }>
  totalLaps: number
}

function TimelineBar({ lapStatuses, totalLaps }: TimelineProps) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null)
  const barRef = useRef<HTMLDivElement>(null)

  // Expand deduped statuses into full lap array
  const full: string[] = []
  for (let i = 0; i < lapStatuses.length; i++) {
    const curr = lapStatuses[i]
    const nextLap = lapStatuses[i + 1]?.lap ?? totalLaps + 1
    for (let lap = curr.lap; lap < nextLap; lap++) {
      full.push(curr.status)
    }
  }

  const actual = full.length || totalLaps

  // Count total SC+VSC interventions by lap index
  function scCountUpTo(lapIdx: number) {
    let count = 0
    let inSCVSC = false
    for (let i = 0; i <= lapIdx; i++) {
      const s = full[i]
      const isHot = s === 'SC' || s === 'VSC'
      if (isHot && !inSCVSC) { count++; inSCVSC = true }
      if (!isHot) inSCVSC = false
    }
    return count
  }

  return (
    <div>
      {/* Bar */}
      <div
        ref={barRef}
        style={{ display: 'flex', height: 64, borderRadius: 6, overflow: 'hidden', position: 'relative' }}
        onMouseLeave={() => setTooltip(null)}
      >
        {full.map((status, i) => {
          const color = STATUS_COLOR[status as TrackStatus] ?? '#4b5563'
          return (
            <div
              key={i}
              style={{
                flex: 1,
                background: color,
                opacity: status === 'Green' ? 0.5 : status === 'Yellow' ? 0.75 : 0.95,
                transition: 'opacity 60ms',
              }}
              onMouseEnter={(e) => {
                const intCount = scCountUpTo(i)
                const isNeutral = status === 'SC' || status === 'VSC'
                setTooltip({
                  x: e.clientX,
                  y: e.clientY,
                  text: `Lap ${i + 1} — ${status}${isNeutral || intCount > 0 ? ` · ${intCount} intervention${intCount !== 1 ? 's' : ''} so far` : ''}`,
                })
              }}
            />
          )
        })}
      </div>

      {/* Fixed tooltip */}
      {tooltip && (
        <div
          style={{
            position: 'fixed',
            left: tooltip.x + 12,
            top: tooltip.y - 32,
            background: '#1f1f1f',
            border: '1px solid #2a2a2a',
            borderRadius: 4,
            padding: '5px 10px',
            fontSize: 11,
            color: '#fff',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            zIndex: 100,
          }}
        >
          {tooltip.text}
        </div>
      )}

      {/* Lap axis labels every 5 laps */}
      <div style={{ display: 'flex', marginTop: 5, position: 'relative', height: 16 }}>
        {Array.from({ length: Math.floor(actual / 5) }, (_, i) => (i + 1) * 5)
          .filter((l) => l <= actual)
          .map((lap) => (
            <span
              key={lap}
              style={{
                position: 'absolute',
                left: `${((lap - 1) / actual) * 100}%`,
                fontSize: 10,
                color: '#d1d5db',
                fontFamily: '"JetBrains Mono", monospace',
                transform: 'translateX(-50%)',
              }}
            >
              {lap}
            </span>
          ))}
        <span
          style={{
            position: 'absolute',
            right: 0,
            fontSize: 10,
            color: '#d1d5db',
            fontFamily: '"JetBrains Mono", monospace',
          }}
        >
          {actual}
        </span>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginTop: 18, flexWrap: 'wrap' }}>
        {(Object.entries(STATUS_COLOR) as [TrackStatus, string][]).map(([status, color]) => (
          <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 12, height: 12, borderRadius: 2, background: color }} />
            <span style={{ fontSize: 11, color: '#d1d5db' }}>
              {status === 'SC' ? 'Safety Car' : status === 'VSC' ? 'Virtual SC' : status === 'Red' ? 'Red Flag' : status}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Summary Card with mini bar ────────────────────────────────────────────────
function SummaryCard({
  label, value, color, sub, barPct,
}: {
  label: string; value: string | number; color: string; sub: string; barPct: number
}) {
  return (
    <div style={{ background: '#111111', border: '1px solid #1f1f1f', borderRadius: 8, padding: '16px 20px', overflow: 'hidden', position: 'relative' }}>
      <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.15em', color: '#d1d5db', marginBottom: 8 }}>
        {label}
      </p>
      <p style={{ fontSize: 28, fontWeight: 700, fontFamily: '"JetBrains Mono", monospace', color, lineHeight: 1, marginBottom: 4 }}>
        {value}
      </p>
      <p style={{ fontSize: 11, color: '#9ca3af', marginBottom: 10 }}>{sub}</p>
      {/* Mini proportion bar */}
      <div style={{ height: 3, background: '#1f1f1f', borderRadius: 2, overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: `${Math.min(barPct, 100)}%`,
            background: color,
            borderRadius: 2,
            opacity: 0.7,
            transition: 'width 0.4s ease',
          }}
        />
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Weather() {
  const { season: SEASON } = useSeason()
  const [selectedRaceId, setSelectedRaceId] = useState<number | null>(null)

  const { data: overview, loading: overviewLoading } = useSeasonOverview(SEASON)
  const { data: trackStatus, loading: statusLoading } = useTrackStatus(selectedRaceId)
  const { data: summary } = useStatusSummary(selectedRaceId)
  const { data: safetyCars, loading: scLoading } = useSafetyCars(SEASON)

  // Reset race selection when season changes
  useEffect(() => { setSelectedRaceId(null) }, [SEASON])

  // Once overview loads, default to round 1
  const races = overview ?? []
  if (overview && selectedRaceId === null && overview.length > 0) {
    setSelectedRaceId(overview[0].race_id)
  }

  const selectedRace = races.find((r) => r.race_id === selectedRaceId) ?? null
  const raceScEvents = safetyCars?.filter((e) => e.race_id === selectedRaceId) ?? []

  return (
    <div className="space-y-5 pb-10 animate-fade-in">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={{ borderBottom: '1px solid #1a1a1a', paddingBottom: 16 }}>
        <div className="flex items-center gap-2 mb-1">
          <span style={{ color: '#E10600', fontSize: 10 }}>◆</span>
          <span className="font-mono uppercase" style={{ fontSize: 10, letterSpacing: '0.2em', color: '#d1d5db' }}>WEATHER</span>
        </div>
        <div style={{ height: 1, background: '#1a1a1a', marginBottom: 8, maxWidth: 40 }} />
        <p className="font-mono uppercase" style={{ fontSize: 10, letterSpacing: '0.18em', color: '#d1d5db', marginBottom: 4 }}>
          TRACK CONDITIONS · PER SESSION
        </p>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)' }}>Air, track, humidity, wind.</p>
      </div>

      {/* ── Race selector ────────────────────────────────────────────────── */}
      {overviewLoading ? (
        <div style={{ color: '#9ca3af', fontSize: 12 }}>Loading races…</div>
      ) : (
        <RaceSwiper
          races={races}
          selectedId={selectedRaceId}
          onSelect={setSelectedRaceId}
          badge={(race) => {
            if (race.sc_laps > 0) return <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#e10600', display: 'inline-block', flexShrink: 0 }} />
            if (race.vsc_laps > 0) return <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#f97316', display: 'inline-block', flexShrink: 0 }} />
            return null
          }}
        />
      )}

      {selectedRace && (
        <>
          {/* ── Section 1: Race Status Timeline ──────────────────────────── */}
          <div
            style={{
              background: '#111111',
              border: '1px solid #1f1f1f',
              borderRadius: 8,
              padding: '20px 24px',
            }}
          >
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.15em', color: '#d1d5db', marginBottom: 4 }}>
                Race Status Timeline
              </p>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#ffffff' }}>
                {shortName(selectedRace.race_name)}
                <span style={{ color: '#d1d5db', fontWeight: 400, marginLeft: 8, fontSize: 12 }}>
                  Round {selectedRace.round_number} · {selectedRace.total_laps} laps
                </span>
              </p>
            </div>

            {statusLoading ? (
              <div style={{ height: 64, background: '#1a1a1a', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 12, color: '#9ca3af' }}>Loading…</span>
              </div>
            ) : trackStatus ? (
              <TimelineBar lapStatuses={trackStatus} totalLaps={selectedRace.total_laps} />
            ) : null}

            {/* SC event cards */}
            {raceScEvents.length > 0 && (
              <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {raceScEvents.map((ev, i) => (
                  <div
                    key={i}
                    style={{
                      background: STATUS_BG[ev.type],
                      border: `1px solid ${STATUS_COLOR[ev.type]}33`,
                      borderRadius: 8,
                      padding: '12px 16px',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 14,
                    }}
                  >
                    <StatusBadge type={ev.type} />
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: '#ffffff', marginBottom: 4 }}>
                        Laps {ev.lap_start}–{ev.lap_end}
                        <span style={{ color: '#d1d5db', fontWeight: 400, marginLeft: 8, fontSize: 12 }}>
                          ({ev.laps_neutralised} lap{ev.laps_neutralised !== 1 ? 's' : ''} neutralised)
                        </span>
                      </p>
                      {ev.drivers_pitted.length > 0 && (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                          <span style={{ fontSize: 10, color: '#d1d5db', textTransform: 'uppercase', letterSpacing: '0.1em', alignSelf: 'center' }}>
                            Pitted:
                          </span>
                          {ev.drivers_pitted.map((d) => {
                            const bg = DRIVER_COLOR[d.abbreviation] ?? '#4b5563'
                            return (
                              <span
                                key={d.driver_id}
                                style={{
                                  width: 28,
                                  height: 22,
                                  borderRadius: 4,
                                  background: `${bg}22`,
                                  border: `1px solid ${bg}55`,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: 10,
                                  fontWeight: 700,
                                  fontFamily: '"JetBrains Mono", monospace',
                                  color: bg,
                                }}
                              >
                                {d.abbreviation}
                              </span>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Section 2: Summary Cards ──────────────────────────────────── */}
          {summary && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              <SummaryCard
                label="Green Flag"
                value={`${summary.green_pct}%`}
                color="#22D3A5"
                sub={`${summary.green_laps} laps`}
                barPct={summary.green_pct}
              />
              <SummaryCard
                label="SC Laps"
                value={summary.sc_laps}
                color="#e10600"
                sub={summary.sc_laps === 0 ? 'None' : 'under safety car'}
                barPct={(summary.sc_laps / (summary.green_laps + summary.sc_laps + summary.vsc_laps + 0.001)) * 100}
              />
              <SummaryCard
                label="VSC Laps"
                value={summary.vsc_laps}
                color="#f97316"
                sub={summary.vsc_laps === 0 ? 'None' : 'virtual SC'}
                barPct={(summary.vsc_laps / (summary.green_laps + summary.sc_laps + summary.vsc_laps + 0.001)) * 100}
              />
              <SummaryCard
                label="Interventions"
                value={summary.interventions}
                color="#6b7280"
                sub="total deployments"
                barPct={Math.min(summary.interventions * 20, 100)}
              />
            </div>
          )}
        </>
      )}

      {/* ── Section 3: Season Heatmap ──────────────────────────────────────── */}
      <div
        style={{
          background: '#111111',
          border: '1px solid #1f1f1f',
          borderRadius: 8,
          padding: '20px 24px',
        }}
      >
        {overviewLoading ? (
          <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 12, color: '#9ca3af' }}>Loading heatmap…</span>
          </div>
        ) : races.length > 0 ? (
          <SeasonHeatmap races={races} season={SEASON} />
        ) : null}
      </div>

      {/* ── Section 4: SC Impact Analysis ─────────────────────────────────── */}
      <div
        style={{
          background: '#111111',
          border: '1px solid #1f1f1f',
          borderRadius: 8,
          padding: '20px 24px',
        }}
      >
        <div style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.15em', color: '#d1d5db', marginBottom: 4 }}>
            SC Impact Analysis
          </p>
          <p style={{ fontSize: 12, color: '#9ca3af' }}>All safety car &amp; virtual safety car deployments — {SEASON} season</p>
        </div>

        {scLoading ? (
          <div style={{ color: '#9ca3af', fontSize: 12 }}>Loading…</div>
        ) : safetyCars && safetyCars.length > 0 ? (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #1f1f1f' }}>
                {['Race', 'Rnd', 'Laps', 'Type', 'Duration', 'Championship Impact', 'Drivers Pitted'].map((h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: 'left',
                      padding: '8px 12px',
                      fontSize: 10,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.12em',
                      color: '#9ca3af',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {safetyCars.map((ev, i) => {
                const isAbuDhabi = ev.round === 22 && ev.type === 'SC' && SEASON === 2021
                const isMajor = ev.laps_neutralised >= 5
                return (
                  <tr
                    key={i}
                    style={{
                      borderBottom: '1px solid #161616',
                      background: isAbuDhabi ? 'rgba(225,6,0,0.07)' : 'transparent',
                    }}
                  >
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ color: isAbuDhabi ? '#ffffff' : '#6b7280', fontWeight: isAbuDhabi ? 600 : 400 }}>
                        {shortName(ev.race_name)}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', fontFamily: '"JetBrains Mono", monospace', color: '#d1d5db', whiteSpace: 'nowrap' }}>
                      R{ev.round}
                    </td>
                    <td style={{ padding: '10px 12px', fontFamily: '"JetBrains Mono", monospace', color: '#ffffff', whiteSpace: 'nowrap' }}>
                      {ev.lap_start}–{ev.lap_end}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <StatusBadge type={ev.type} />
                    </td>
                    <td style={{ padding: '10px 12px', fontFamily: '"JetBrains Mono", monospace', color: '#d1d5db', whiteSpace: 'nowrap' }}>
                      {ev.laps_neutralised} lap{ev.laps_neutralised !== 1 ? 's' : ''}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {isAbuDhabi ? (
                        <span
                          style={{
                            fontSize: 9,
                            fontWeight: 700,
                            color: '#f59e0b',
                            background: '#f59e0b22',
                            border: '1px solid #f59e0b44',
                            borderRadius: 4,
                            padding: '2px 7px',
                            letterSpacing: '0.08em',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          ⚠ CHAMPIONSHIP DECIDER
                        </span>
                      ) : isMajor ? (
                        <span style={{ fontSize: 10, color: '#d1d5db' }}>Significant</span>
                      ) : (
                        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                        {ev.drivers_pitted.slice(0, 10).map((d) => {
                          const bg = DRIVER_COLOR[d.abbreviation] ?? '#4b5563'
                          return (
                            <span
                              key={d.driver_id}
                              title={d.abbreviation}
                              style={{
                                width: 28,
                                height: 20,
                                borderRadius: 3,
                                background: `${bg}1a`,
                                border: `1px solid ${bg}44`,
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 9,
                                fontWeight: 700,
                                fontFamily: '"JetBrains Mono", monospace',
                                color: bg,
                              }}
                            >
                              {d.abbreviation}
                            </span>
                          )
                        })}
                        {ev.drivers_pitted.length > 10 && (
                          <span style={{ fontSize: 10, color: '#9ca3af', alignSelf: 'center' }}>+{ev.drivers_pitted.length - 10}</span>
                        )}
                        {ev.drivers_pitted.length === 0 && (
                          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <p style={{ fontSize: 12, color: '#9ca3af' }}>No safety car deployments found.</p>
        )}
      </div>

      {/* ── Section 5: Temperature Ranges + Rain Sessions ──────────────── */}
      {(() => {
        const temps = TEMP_DATA[SEASON]
        const rain  = RAIN_DATA[SEASON]
        if (!temps || !rain) return null

        const allMin = Math.min(...temps.map(t => t.min))
        const allMax = Math.max(...temps.map(t => t.max))
        const totalRange = allMax - allMin

        const rainRounds = new Set(rain.rounds)
        const rounds = Array.from({ length: rain.totalRounds }, (_, i) => i + 1)
        const half = Math.ceil(rain.totalRounds / 2)
        const rows = [rounds.slice(0, half), rounds.slice(half)]

        return (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

            {/* Temperature ranges */}
            <div style={{ background: '#111111', border: '1px solid #1f1f1f', borderRadius: 8, padding: '20px 24px' }}>
              <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.15em', color: '#d1d5db', marginBottom: 4 }}>
                Temperature Ranges · Season
              </p>
              <p style={{ fontSize: 11, color: '#9ca3af', marginBottom: 16 }}>Approximate air temperature range per venue</p>
              {temps.map(({ name, min, max }) => {
                const barStart = ((min - allMin) / totalRange) * 100
                const barWidth = ((max - min) / totalRange) * 100
                const hot = max >= 38
                return (
                  <div key={name} className="flex items-center gap-3 mb-2">
                    <span style={{ width: 90, fontSize: 10, color: '#d1d5db', flexShrink: 0, textAlign: 'right' }}>{name}</span>
                    <div style={{ flex: 1, height: 6, background: '#1a1a1a', borderRadius: 3, position: 'relative' }}>
                      <div
                        style={{
                          position: 'absolute',
                          left: `${barStart}%`,
                          width: `${barWidth}%`,
                          height: '100%',
                          borderRadius: 3,
                          background: hot
                            ? 'linear-gradient(90deg, #60a5fa, #f97316)'
                            : 'linear-gradient(90deg, #60a5fa, #fb923c)',
                        }}
                      />
                    </div>
                    <span style={{ width: 60, fontSize: 9, color: '#9ca3af', flexShrink: 0, fontFamily: '"JetBrains Mono", monospace' }}>
                      {min}°–{max}°C
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Rain sessions */}
            <div style={{ background: '#111111', border: '1px solid #1f1f1f', borderRadius: 8, padding: '20px 24px' }}>
              <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.15em', color: '#d1d5db', marginBottom: 4 }}>
                Rain Sessions · Logged
              </p>
              <p style={{ fontSize: 11, color: '#9ca3af', marginBottom: 16 }}>Race rounds affected by precipitation</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {rows.map((row, ri) => (
                  <div key={ri} style={{ display: 'flex', gap: 6 }}>
                    {row.map((r) => {
                      const isRain = rainRounds.has(r)
                      return (
                        <div
                          key={r}
                          style={{
                            flex: 1,
                            aspectRatio: '1',
                            borderRadius: 4,
                            background: isRain ? '#0ea5e9' : '#161616',
                            border: `1px solid ${isRain ? '#38bdf8' : '#1f1f1f'}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 10,
                            fontFamily: '"JetBrains Mono", monospace',
                            color: isRain ? '#ffffff' : '#2a2a2a',
                            fontWeight: isRain ? 700 : 400,
                          }}
                        >
                          {r}
                        </div>
                      )
                    })}
                  </div>
                ))}
                <p style={{ fontSize: 10, color: '#9ca3af', marginTop: 8, lineHeight: 1.6 }}>
                  {rain.rounds.length} of {rain.totalRounds} races saw rain — incl. {rain.label}
                </p>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
