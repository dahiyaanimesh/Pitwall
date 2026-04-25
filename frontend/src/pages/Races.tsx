import { useState, useEffect } from 'react'
import axios from 'axios'
import { Flag, Clock, Hash, MapPin, Calendar, Timer, ChevronDown, ChevronRight } from 'lucide-react'
import { API_BASE } from '../config'
import { useSeason } from '../context/SeasonContext'
import LoadingSpinner from '../components/LoadingSpinner'
import ErrorMessage from '../components/ErrorMessage'
import DriverAvatar from '../components/DriverAvatar'
import TyreChip from '../components/strategy/TyreChip'
import type { Race, RaceResult, PitStop } from '../types/f1'
import TrackMap from '../components/TrackMap'
import { getCircuitKey } from '../utils/circuitKeys'
import TimingTab from '../components/races/TimingTab'
import { shortName } from '../utils/formatters'

// Gold / Silver / Bronze
const MEDAL_STYLES: Record<number, { bg: string; text: string; glow: string; label: string }> = {
  1: { bg: 'rgba(245,158,11,0.15)', text: '#F59E0B', glow: 'rgba(245,158,11,0.4)', label: '1st' },
  2: { bg: 'rgba(148,163,184,0.12)', text: '#94A3B8', glow: 'rgba(148,163,184,0.3)', label: '2nd' },
  3: { bg: 'rgba(205,124,47,0.12)',  text: '#CD7C2F', glow: 'rgba(205,124,47,0.3)', label: '3rd' },
}

const MAX_PTS = 25

// ─── Results sub-panel ────────────────────────────────────────────────────────

function ResultsTable({ raceId }: { raceId: number }) {
  const [data, setData]       = useState<RaceResult[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    setLoading(true); setError(null)
    axios.get<RaceResult[]>(`${API_BASE}/races/${raceId}/results`)
      .then((r) => setData(r.data))
      .catch((e) => setError(e.response?.data?.detail ?? e.message))
      .finally(() => setLoading(false))
  }, [raceId])

  if (loading) return <LoadingSpinner message="Loading results…" />
  if (error)   return <ErrorMessage message={error} />

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.025)' }}>
            {[
              { label: 'Pos',    align: 'left',  cls: 'w-16' },
              { label: 'Driver', align: 'left',  cls: '' },
              { label: 'Team',   align: 'left',  cls: 'hidden sm:table-cell' },
              { label: 'Grid',   align: 'right', cls: 'hidden md:table-cell' },
              { label: 'Δ',      align: 'right', cls: 'hidden md:table-cell' },
              { label: 'Laps',   align: 'right', cls: 'hidden sm:table-cell' },
              { label: 'Pts',    align: 'right', cls: '' },
              { label: 'Status', align: 'left',  cls: 'hidden lg:table-cell' },
            ].map(({ label, align, cls }) => (
              <th
                key={label}
                className={`px-4 py-3 text-${align} text-[11px] font-semibold uppercase tracking-[0.12em] ${cls}`}
                style={{ color: '#d1d5db' }}
              >
                {label}
              </th>
            ))}</tr>
        </thead>
        <tbody>
          {data.map((r) => {
            const pos   = r.finish_position ?? 0
            const medal = MEDAL_STYLES[pos]
            const pts   = r.points ?? 0
            const grid  = r.grid_position ?? pos
            const delta = grid - pos
            const dnf   = r.status && r.status !== 'Finished' && r.status !== '+1 Lap' && r.status !== '+2 Laps'

            return (
              <tr
                key={r.result_id}
                className="table-row-hover group"
                style={{
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  background: medal ? medal.bg : 'transparent',
                }}
              >
                {/* Position */}
                <td className="px-4 py-3.5 w-16">
                  {medal ? (
                    <div
                      className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-sm font-bold font-mono"
                      style={{
                        background: medal.bg,
                        color: medal.text,
                        border: `1px solid ${medal.text}40`,
                        boxShadow: `0 0 12px ${medal.glow}`,
                      }}
                    >
                      {pos}
                    </div>
                  ) : (
                    <span className={`font-mono text-sm font-semibold ${dnf ? 'text-white/20' : 'text-white/40'}`}>
                      {pos || '—'}
                    </span>
                  )}
                </td>

                {/* Driver */}
                <td className="px-4 py-3.5">
                  <DriverAvatar driverId={r.driver_id} teamId={r.team_id} size="sm" showName fullName={r.full_name} />
                </td>

                {/* Team */}
                <td className="px-4 py-3.5 hidden sm:table-cell">
                  <span className="text-[12px] font-medium" style={{ color: 'rgba(255,255,255,0.75)' }}>
                    {r.team_name?.replace(' Racing', '').replace('Formula One', '').trim() ?? '—'}
                  </span>
                </td>

                {/* Grid */}
                <td className="px-4 py-3.5 text-right hidden md:table-cell">
                  <span className="font-mono text-[13px]" style={{ color: 'rgba(255,255,255,0.75)' }}>
                    {grid || '—'}
                  </span>
                </td>

                {/* Δ positions */}
                <td className="px-4 py-3.5 text-right hidden md:table-cell">
                  {delta !== 0 && !dnf ? (
                    <span
                      className="font-mono text-[13px] font-bold"
                      style={{ color: delta > 0 ? '#22D3A5' : '#E10600' }}
                    >
                      {delta > 0 ? `+${delta}` : delta}
                    </span>
                  ) : (
                    <span className="font-mono text-[13px]" style={{ color: 'rgba(255,255,255,0.3)' }}>—</span>
                  )}
                </td>

                {/* Laps */}
                <td className="px-4 py-3.5 text-right hidden sm:table-cell">
                  <span className="font-mono text-[13px]" style={{ color: 'rgba(255,255,255,0.75)' }}>
                    {r.laps_completed ?? '—'}
                  </span>
                </td>

                {/* Points */}
                <td className="px-4 py-3.5 text-right">
                  {pts > 0 ? (
                    <div className="flex items-center justify-end gap-2.5">
                      <div
                        className="w-14 h-[3px] rounded-full overflow-hidden hidden lg:block"
                        style={{ background: 'rgba(255,255,255,0.07)' }}
                      >
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${(pts / MAX_PTS) * 100}%`,
                            background: medal ? medal.text : 'rgba(255,255,255,0.4)',
                            boxShadow: medal ? `0 0 6px ${medal.glow}` : 'none',
                          }}
                        />
                      </div>
                      <span className="font-display font-bold text-white text-[15px]">{pts}</span>
                    </div>
                  ) : (
                    <span className="font-mono text-[13px]" style={{ color: 'rgba(255,255,255,0.3)' }}>0</span>
                  )}
                </td>

                {/* Status */}
                <td className="px-4 py-3.5 hidden lg:table-cell">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{
                        background: dnf ? '#E10600' : r.status === 'Finished' ? '#22D3A5' : '#F59E0B',
                        boxShadow: dnf ? '0 0 6px #E10600aa' : r.status === 'Finished' ? '0 0 6px #22D3A5aa' : 'none',
                      }}
                    />
                    <span
                      className="text-[12px] font-medium"
                      style={{ color: dnf ? 'rgba(239,68,68,0.7)' : 'rgba(255,255,255,0.75)' }}
                    >
                      {r.status ?? '—'}
                    </span>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── Pit stops sub-panel ─────────────────────────────────────────────────────

// Tyre strategy strip: first compound → each compound_out after each stop
function TyreStintStrip({ stops }: { stops: PitStop[] }) {
  const sorted = [...stops].sort((a, b) => (a.stop_number ?? 0) - (b.stop_number ?? 0))
  const stints: Array<{ compound: string; lapStart: number; lapEnd: number | null }> = []

  sorted.forEach((s, i) => {
    const lapEnd = sorted[i + 1]?.lap_number ?? null
    if (i === 0 && s.compound_in) {
      stints.push({ compound: s.compound_in, lapStart: 1, lapEnd: s.lap_number ?? null })
    }
    if (s.compound_out) {
      stints.push({ compound: s.compound_out, lapStart: s.lap_number ?? 0, lapEnd })
    }
  })

  return (
    <div className="flex items-end gap-2">
      {stints.map((c, i) => (
        <div key={i} className="flex items-end gap-2">
          {/* Each stint: chip on top, lap range below */}
          <div className="flex flex-col items-center gap-1">
            <TyreChip compound={c.compound} size="sm" />
            <span
              className="font-mono text-[11px] leading-none whitespace-nowrap"
              style={{ color: 'rgba(255,255,255,0.5)' }}
            >
              {c.lapEnd ? `${c.lapStart}–${c.lapEnd}` : `${c.lapStart}+`}
            </span>
          </div>
          {i < stints.length - 1 && (
            <span
              className="text-base mb-4 leading-none flex-shrink-0"
              style={{ color: 'rgba(255,255,255,0.3)' }}
            >
              ›
            </span>
          )}
        </div>
      ))}
    </div>
  )
}

function PitStopsTable({ raceId }: { raceId: number }) {
  const [data, setData]         = useState<PitStop[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    setLoading(true); setError(null); setExpanded(new Set())
    axios.get<PitStop[]>(`${API_BASE}/races/${raceId}/pitstops`)
      .then((r) => setData(r.data))
      .catch((e) => setError(e.response?.data?.detail ?? e.message))
      .finally(() => setLoading(false))
  }, [raceId])

  if (loading) return <LoadingSpinner message="Loading pit stops…" />
  if (error)   return <ErrorMessage message={error} />
  if (!data.length) return (
    <p className="text-white/40 text-sm py-10 text-center">No pit stop data available.</p>
  )

  // Group by driver, sort by stop count desc
  const grouped = data.reduce<Record<string, PitStop[]>>((acc, ps) => {
    const key = ps.driver_id
    if (!acc[key]) acc[key] = []
    acc[key].push(ps)
    return acc
  }, {})

  const drivers = Object.entries(grouped)
    .map(([driverId, stops]) => ({
      driverId,
      stops: stops.sort((a, b) => (a.stop_number ?? 0) - (b.stop_number ?? 0)),
      totalStops: stops.length,
      fastestStop: Math.min(...stops.map((s) => s.pit_duration_seconds ?? Infinity).filter(isFinite)),
    }))
    .sort((a, b) => b.totalStops - a.totalStops || a.driverId.localeCompare(b.driverId))

  // Overall fastest stop for badge
  const overallFastest = Math.min(...drivers.map((d) => d.fastestStop))

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  return (
    <div className="divide-y" style={{ '--tw-divide-opacity': 1 } as any}>
      {/* Header */}
      <div
        className="flex items-center px-5 py-3 gap-4"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.025)' }}
      >
        <span className="flex-1 text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: '#d1d5db' }}>Driver · Strategy</span>
        <span className="w-16 text-right text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: '#d1d5db' }}>Stops</span>
        <span className="w-28 text-right text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: '#d1d5db' }}>Best Stop</span>
        <span className="w-6" />
      </div>

      {drivers.map(({ driverId, stops, totalStops, fastestStop }) => {
        const isOpen     = expanded.has(driverId)
        const isOverallFastest = fastestStop === overallFastest && isFinite(fastestStop)

        return (
          <div key={driverId} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
            {/* Collapsed row — click to toggle */}
            <button
              onClick={() => toggle(driverId)}
              className="w-full px-5 py-4 flex items-center gap-4 hover:bg-white/[0.025] transition-colors text-left group"
            >
              {/* Driver badge */}
              <div className="w-16 flex-shrink-0">
                <span
                  className="font-mono text-[13px] font-bold px-2.5 py-1.5 rounded-lg"
                  style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.85)' }}
                >
                  {driverId}
                </span>
              </div>

              {/* Tyre stint strip */}
              <div className="flex-1 min-w-0">
                <TyreStintStrip stops={stops} />
              </div>

              {/* Stop count badge */}
              <div className="flex-shrink-0 w-16 text-right">
                <span
                  className="inline-flex items-center justify-center w-8 h-8 rounded-lg font-mono text-[13px] font-bold"
                  style={{
                    background: totalStops >= 3 ? 'rgba(225,6,0,0.15)' : 'rgba(255,255,255,0.07)',
                    color: totalStops >= 3 ? '#E10600' : 'rgba(255,255,255,0.55)',
                    border: totalStops >= 3 ? '1px solid rgba(225,6,0,0.3)' : '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  {totalStops}
                </span>
              </div>

              {/* Fastest stop */}
              <div className="flex-shrink-0 w-28 text-right">
                {isFinite(fastestStop) ? (
                  <div className="flex items-center justify-end gap-2">
                    {isOverallFastest && (
                      <span
                        className="text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded hidden sm:inline"
                        style={{ background: 'rgba(34,211,165,0.15)', color: '#22D3A5', border: '1px solid rgba(34,211,165,0.25)' }}
                      >
                        FAST
                      </span>
                    )}
                    <span
                      className="font-mono text-[14px] font-semibold"
                      style={{ color: isOverallFastest ? '#22D3A5' : 'rgba(255,255,255,0.55)' }}
                    >
                      {fastestStop.toFixed(1)}s
                    </span>
                  </div>
                ) : (
                  <span className="font-mono text-sm text-white/25">—</span>
                )}
              </div>

              {/* Chevron */}
              <div className="flex-shrink-0 transition-transform duration-200" style={{ transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)' }}>
                <ChevronDown size={15} className="text-white/30 group-hover:text-white/60 transition-colors" />
              </div>
            </button>

            {/* Expanded detail */}
            {isOpen && (
              <div
                className="px-4 pb-3"
                style={{ borderTop: '1px solid rgba(255,255,255,0.04)', background: 'rgba(255,255,255,0.015)' }}
              >
                <div className="space-y-1.5 pt-3">
                  {stops.map((ps) => {
                    const dur       = ps.pit_duration_seconds
                    const isFastest = dur !== null && dur === fastestStop

                    return (
                      <div
                        key={ps.pit_id}
                        className="flex items-center gap-4 rounded px-3 py-2"
                        style={{
                          background: isFastest ? 'rgba(34,211,165,0.05)' : 'rgba(255,255,255,0.03)',
                          border: '1px solid ' + (isFastest ? 'rgba(34,211,165,0.15)' : 'rgba(255,255,255,0.04)'),
                        }}
                      >
                        {/* Stop number */}
                        <span
                          className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-mono font-bold flex-shrink-0"
                          style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.4)' }}
                        >
                          {ps.stop_number}
                        </span>

                        {/* Lap */}
                        <div className="flex items-center gap-1 text-[11px] text-white/35 w-16">
                          <span className="text-white/20">Lap</span>
                          <span className="font-mono font-semibold text-white/60">{ps.lap_number}</span>
                        </div>

                        {/* Compound change */}
                        <div className="flex items-center gap-1.5 flex-1">
                          {ps.compound_in  && <TyreChip compound={ps.compound_in}  size="xs" />}
                          <ChevronRight size={10} className="text-white/20" />
                          {ps.compound_out && <TyreChip compound={ps.compound_out} size="xs" />}
                        </div>

                        {/* Duration */}
                        <div className="text-right flex-shrink-0">
                          {dur ? (
                            <span
                              className="font-mono text-[12px] font-semibold"
                              style={{ color: isFastest ? '#22D3A5' : 'rgba(255,255,255,0.5)' }}
                            >
                              {dur.toFixed(1)}s
                            </span>
                          ) : (
                            <span className="text-white/20 text-xs">—</span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

type SubTab = 'results' | 'pitstops' | 'timing'

export default function Races() {
  const { season }                  = useSeason()
  const [races, setRaces]           = useState<Race[]>([])
  const [racesLoading, setRL]       = useState(true)
  const [racesError, setRE]         = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [subTab, setSubTab]         = useState<SubTab>('results')

  useEffect(() => {
    setRL(true); setRE(null); setSelectedId(null)
    axios.get<Race[]>(`${API_BASE}/races`, { params: { season } })
      .then((r) => { setRaces(r.data); if (r.data.length) setSelectedId(r.data[0].race_id) })
      .catch((e) => setRE(e.response?.data?.detail ?? e.message))
      .finally(() => setRL(false))
  }, [season])

  const selected = races.find((r) => r.race_id === selectedId)

  return (
    <div className="space-y-6 pb-12">

      {/* Header */}
      <div style={{ borderBottom: '1px solid #1a1a1a', paddingBottom: 16 }} className="animate-fade-in">
        <div className="flex items-center gap-2 mb-1">
          <span style={{ color: '#E10600', fontSize: 10 }}>◆</span>
          <span className="font-mono uppercase" style={{ fontSize: 10, letterSpacing: '0.2em', color: '#d1d5db' }}>RACES</span>
        </div>
        <div style={{ height: 1, background: '#1a1a1a', marginBottom: 8, maxWidth: 40 }} />
        <p className="font-mono uppercase" style={{ fontSize: 10, letterSpacing: '0.18em', color: '#d1d5db', marginBottom: 4 }}>
          2021 SEASON · 22 ROUNDS
        </p>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)' }}>Every race. Every lap. Every decision.</p>
      </div>

      {racesLoading ? <LoadingSpinner message="Loading race calendar…" /> :
       racesError   ? <ErrorMessage message={racesError} /> : (
        <div className="flex flex-col lg:flex-row gap-5 animate-fade-up">

          {/* Calendar sidebar */}
          <div className="lg:w-52 flex-shrink-0">
            <div className="card rounded-lg overflow-hidden">
              <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <p className="section-label">{season} Season · {races.length} Rounds</p>
              </div>
              <div className="max-h-[72vh] overflow-y-auto">
                {races.map((race) => {
                  const active = race.race_id === selectedId
                  const date   = race.race_date
                    ? new Date(race.race_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
                    : null

                  return (
                    <button
                      key={race.race_id}
                      onClick={() => { setSelectedId(race.race_id); setSubTab('results') }}
                      className="w-full text-left px-4 py-3 transition-all duration-150 flex items-center gap-3"
                      style={active ? {
                        background: 'rgba(225,6,0,0.08)',
                        borderLeft: '2px solid #E10600',
                        paddingLeft: '14px',
                      } : {
                        borderLeft: '2px solid transparent',
                      }}
                    >
                      {/* Round number pill */}
                      <span
                        className="font-mono text-[10px] font-bold w-6 h-6 rounded flex items-center justify-center flex-shrink-0"
                        style={{
                          background: active ? 'rgba(225,6,0,0.2)' : 'rgba(255,255,255,0.05)',
                          color: active ? '#E10600' : 'rgba(255,255,255,0.3)',
                        }}
                      >
                        {race.round_number}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-[12px] font-medium truncate leading-tight ${active ? 'text-white' : 'text-white/45'}`}>
                          {race.country}
                        </p>
                        {date && (
                          <p className="text-[10px] text-white/30 mt-0.5">{date}</p>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Detail panel */}
          <div className="flex-1 min-w-0 space-y-4">
            {selected && (
              <>
                {/* Race header card */}
                <div
                  className="rounded-lg p-5"
                  style={{ background: '#141414', border: '1px solid #1f1f1f' }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {/* Badge row */}
                      <div className="flex items-center gap-2 mb-3 flex-wrap">
                        <span className="badge-red">Round {selected.round_number}</span>
                        <Flag size={11} className="text-white/20" strokeWidth={1.5} />
                        <span className="text-[10px] font-mono text-white/20 uppercase tracking-widest">
                          {season}
                        </span>
                      </div>

                      {/* Race name */}
                      <h2 className="font-display font-bold text-2xl text-white leading-tight mb-3">
                        {shortName(selected.race_name, 5)}
                      </h2>

                      {/* Meta pills */}
                      <div className="flex flex-wrap gap-3">
                        {[selected.city, selected.country].filter(Boolean).join(', ') && (
                          <div className="flex items-center gap-1.5">
                            <MapPin size={11} className="text-white/25" />
                            <span className="text-xs text-white/40">
                              {[selected.city, selected.country].filter(Boolean).join(', ')}
                            </span>
                          </div>
                        )}
                        {selected.race_date && (
                          <div className="flex items-center gap-1.5">
                            <Calendar size={11} className="text-white/25" />
                            <span className="text-xs text-white/40">
                              {new Date(selected.race_date).toLocaleDateString('en-GB', {
                                day: 'numeric', month: 'long', year: 'numeric',
                              })}
                            </span>
                          </div>
                        )}
                        {selected.total_laps && (
                          <div className="flex items-center gap-1.5">
                            <Timer size={11} className="text-white/25" />
                            <span className="text-xs text-white/40">{selected.total_laps} laps</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Track map + lap count */}
                    <div className="flex-shrink-0 hidden sm:flex flex-col items-end gap-1">
                      <TrackMap
                        circuitKey={getCircuitKey(selected.circuit_id)}
                        year={season}
                        width={180}
                        height={135}
                      />
                      <span className="section-label">{selected.total_laps} laps</span>
                    </div>
                  </div>
                </div>

                {/* Sub-tabs — underline style */}
                <div style={{ borderBottom: '1px solid #1f1f1f' }}>
                  <div className="flex">
                    {([
                      { id: 'results',  label: 'Race Results', icon: Hash },
                      { id: 'pitstops', label: 'Pit Stops',    icon: Clock },
                      { id: 'timing',   label: 'Timing',       icon: Timer },
                    ] as const).map(({ id, label, icon: Icon }) => (
                      <button
                        key={id}
                        onClick={() => setSubTab(id)}
                        className="relative flex items-center gap-1.5 px-5 py-3 text-[12px] font-semibold uppercase tracking-[0.1em] transition-colors"
                        style={{ color: subTab === id ? '#E10600' : '#6b7280' }}
                      >
                        <Icon size={12} strokeWidth={2} />
                        {label}
                        {subTab === id && <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-f1red" />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Table card */}
                <div className="card rounded-lg overflow-hidden">
                  {subTab === 'results'  && <ResultsTable  raceId={selected.race_id} />}
                  {subTab === 'pitstops' && <PitStopsTable raceId={selected.race_id} />}
                  {subTab === 'timing'   && <TimingTab     raceId={selected.race_id} />}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
