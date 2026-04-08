import { useState, useCallback, useRef, useEffect } from 'react'
import { usePitWindow } from '../../hooks/useStrategy'
import LoadingSpinner from '../LoadingSpinner'
import { COMPOUND_COLORS } from './TyreChip'
import type { Race } from '../../types/f1'

interface DriverOption {
  driver_id: string
  full_name: string
  team_id: string | null
}

interface Props {
  raceId: number | null
  races: Race[]
  driverId: string
  setDriverId: (id: string) => void
  availableDrivers: DriverOption[]
}

const ACTION_STYLES = {
  PIT_NOW:  {
    bg: 'rgba(34,211,165,0.06)', border: 'rgba(34,211,165,0.22)', badgeBg: '#22D3A5', badgeText: '#0a0a0a',
    textColor: '#22D3A5', label: 'PIT NOW',
  },
  MARGINAL: {
    bg: 'rgba(245,158,11,0.06)', border: 'rgba(245,158,11,0.22)', badgeBg: '#F59E0B', badgeText: '#0a0a0a',
    textColor: '#F59E0B', label: 'MARGINAL',
  },
  STAY_OUT: {
    bg: '#111111', border: '#1f1f1f', badgeBg: '#1f1f1f', badgeText: '#6b7280',
    textColor: '#6b7280', label: 'STAY OUT',
  },
}

function fmtGap(v: number | null | undefined) {
  if (v == null) return '—'
  return `${v.toFixed(1)}s`
}

function StateCell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg flex flex-col" style={{ background: '#141414', border: '1px solid #1f1f1f', minHeight: 120, padding: 20 }}>
      <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#6b7280', marginBottom: 10 }}>
        {label}
      </p>
      {children}
    </div>
  )
}

// Per-session cache keyed by "raceId-driverId-lap"
const _cache: Map<string, any> = new Map()

export default function PitWindowTab({ raceId, races, driverId, setDriverId, availableDrivers }: Props) {
  const selectedRace = races.find((r) => r.race_id === raceId)
  const totalLaps    = selectedRace?.total_laps ?? 58

  const [lap, setLap]                   = useState(1)
  const [debouncedLap, setDebouncedLap] = useState(1)
  const [isStale, setIsStale]           = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Reset lap to 1 when race changes; clear cache on race or driver change
  useEffect(() => {
    setLap(1)
    setDebouncedLap(1)
    _cache.clear()
  }, [raceId])

  useEffect(() => {
    _cache.clear()
  }, [driverId])

  const cacheKey = raceId != null ? `${raceId}-${driverId}-${debouncedLap}` : null
  const cached   = cacheKey ? _cache.get(cacheKey) : undefined

  const { data: fetched, loading, error } = usePitWindow(
    cacheKey && !cached ? raceId : null,
    driverId,
    debouncedLap,
  )

  // Only trust fetched if it matches the current (race, driver, lap)
  const fetchedIsValid =
    fetched != null &&
    fetched.race_id   === raceId &&
    fetched.driver_id === driverId &&
    fetched.lap       === debouncedLap

  // Store valid fetches in cache
  useEffect(() => {
    if (fetched && cacheKey && fetchedIsValid && !_cache.has(cacheKey)) {
      _cache.set(cacheKey, fetched)
    }
  }, [fetched, cacheKey, fetchedIsValid])

  const data = cached ?? (fetchedIsValid ? fetched : null) ?? null

  // Stale = slider moved but debounce hasn't fired yet
  const handleLapChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value)
    setLap(val)
    setIsStale(true)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setDebouncedLap(val)
      setIsStale(false)
    }, 300)
  }, [])

  const isLoading = (loading || !fetchedIsValid) && !cached

  if (!raceId) return (
    <div className="py-16 text-center" style={{ color: 'rgba(255,255,255,0.4)' }}>
      Select a race to analyse the pit window.
    </div>
  )

  const style = data ? ACTION_STYLES[data.recommendation.action as keyof typeof ACTION_STYLES] : null
  const pos      = data?.current_state.position ?? null
  const gridPos  = data?.current_state.grid_position ?? null
  const posDelta = pos != null && gridPos != null ? gridPos - pos : null  // positive = gained

  const lapTime     = data?.current_state.lap_time ?? null
  const prevLapTime = data?.current_state.prev_lap_time ?? null
  const lapDelta    = lapTime != null && prevLapTime != null ? lapTime - prevLapTime : null

  return (
    <div className="space-y-5">

      {/* Controls row */}
      <div className="flex flex-wrap gap-6 items-end">
        {/* Driver dropdown */}
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

        {/* Lap slider */}
        <div className="flex-1" style={{ minWidth: 240 }}>
          <div style={{ marginBottom: 10 }}>
            <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#6b7280', marginBottom: 4 }}>
              Lap
            </p>
            <div className="flex items-baseline gap-3 flex-wrap">
              <span
                className="font-mono font-bold text-white"
                style={{ fontSize: '1.8rem', lineHeight: 1, transition: 'opacity 0.15s', opacity: isStale || isLoading ? 0.45 : 1 }}
              >
                {lap}
              </span>
              {data && !isStale && (
                <span style={{ fontSize: 13, color: '#6b7280' }}>
                  ({data.laps_remaining} remaining)
                  {data.current_state.track_status !== 'Green' && (
                    <span style={{ color: '#f59e0b', marginLeft: 8, fontWeight: 700 }}>
                      {data.current_state.track_status}
                    </span>
                  )}
                </span>
              )}
            </div>
          </div>
          <input
            type="range"
            min={1}
            max={totalLaps}
            value={lap}
            onChange={handleLapChange}
            className="w-full cursor-pointer"
            style={{ accentColor: '#e10600' }}
          />
          <div className="flex justify-between mt-1" style={{ fontSize: 10, color: '#6b7280' }}>
            <span>1</span>
            <span>{totalLaps}</span>
          </div>
        </div>
      </div>

      {isLoading && !data ? (
        <LoadingSpinner message="Computing pit window…" />
      ) : error && !data ? (
        <div className="rounded-lg p-4" style={{ background: 'rgba(225,6,0,0.06)', border: '1px solid rgba(225,6,0,0.25)', borderLeft: '3px solid #E10600' }}>
          <p style={{ color: '#e10600', fontSize: 13 }}>{error}</p>
        </div>
      ) : data ? (
        <div style={{ opacity: isStale ? 0.5 : 1, transition: 'opacity 0.15s', paddingBottom: 40 }}>

          {/* Race state cards */}
          <div className="grid grid-cols-3 md:grid-cols-6 gap-4">

            {/* POSITION */}
            <StateCell label="Position">
              <div className="flex items-baseline gap-2">
                <p className="font-mono font-black text-white" style={{ fontSize: '3rem', lineHeight: 1 }}>
                  {pos ? `P${pos}` : '—'}
                </p>
                {posDelta !== null && posDelta !== 0 && (
                  <span className="font-mono font-bold" style={{ fontSize: '1.2rem', color: posDelta > 0 ? '#22D3A5' : '#e10600' }}>
                    {posDelta > 0 ? `↑${posDelta}` : `↓${Math.abs(posDelta)}`}
                  </span>
                )}
              </div>
              <p style={{ fontSize: '0.85rem', color: '#6b7280', marginTop: 6 }}>
                {posDelta === null
                  ? 'of 20 drivers'
                  : posDelta === 0
                  ? `Started P${gridPos} — no change`
                  : posDelta > 0
                  ? `Started P${gridPos} — gained ${posDelta}`
                  : `Started P${gridPos} — lost ${Math.abs(posDelta)}`}
              </p>
            </StateCell>

            {/* TYRE */}
            <StateCell label="Tyre">
              <div className="flex items-center gap-3">
                <div
                  className="rounded-full flex items-center justify-center font-mono font-black flex-shrink-0"
                  style={{
                    width: 36, height: 36, fontSize: 14,
                    background: (COMPOUND_COLORS as Record<string, string>)[data.current_state.compound] ?? '#555',
                    color: ['MEDIUM', 'HARD'].includes(data.current_state.compound) ? '#111' : '#fff',
                  }}
                >
                  {data.current_state.compound[0] ?? '?'}
                </div>
                <div>
                  <p className="font-mono font-bold text-white" style={{ fontSize: '1.4rem', lineHeight: 1 }}>
                    {data.current_state.tyre_life}L
                  </p>
                  <p style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                    {data.current_state.compound}
                  </p>
                </div>
              </div>
            </StateCell>

            {/* LAP TIME */}
            <StateCell label="Lap Time">
              <div className="flex items-baseline gap-2">
                <p className="font-mono font-bold text-white" style={{ fontSize: '2rem', lineHeight: 1 }}>
                  {lapTime ? lapTime.toFixed(3) : '—'}
                </p>
                {lapDelta !== null && (
                  lapDelta > 5 ? (
                    <span className="font-mono font-semibold" style={{ fontSize: 12, color: '#e10600' }}>SC/INC</span>
                  ) : (
                    <span className="font-mono" style={{
                      fontSize: 12,
                      color: lapDelta < -0.1 ? '#22D3A5' : lapDelta > 0.5 ? '#e10600' : '#f59e0b',
                    }}>
                      {lapDelta > 0 ? '+' : ''}{lapDelta.toFixed(3)}s
                    </span>
                  )
                )}
              </div>
              <p style={{ fontSize: '1rem', color: '#6b7280', marginTop: 4 }}>seconds</p>
            </StateCell>

            {/* GAP AHEAD */}
            <StateCell label="Gap Ahead">
              <p className="font-mono font-bold" style={{ fontSize: '2rem', lineHeight: 1, color: '#22D3A5' }}>
                {pos === 1 || data.current_state.gap_to_ahead == null ? '—' : fmtGap(data.current_state.gap_to_ahead)}
              </p>
              <p style={{ fontSize: '1rem', color: '#6b7280', marginTop: 4 }}>
                {pos === 1 ? 'Race leader' : `to P${(pos ?? 2) - 1}`}
              </p>
            </StateCell>

            {/* GAP BEHIND */}
            <StateCell label="Gap Behind">
              <p className="font-mono font-bold" style={{ fontSize: '2rem', lineHeight: 1, color: '#e10600' }}>
                {fmtGap(data.current_state.gap_to_behind)}
              </p>
              <p style={{ fontSize: '1rem', color: '#6b7280', marginTop: 4 }}>to P{(pos ?? 1) + 1}</p>
            </StateCell>

            {/* PIT LOSS */}
            <StateCell label="Pit Loss">
              <p className="font-mono font-bold text-white" style={{ fontSize: '2rem', lineHeight: 1 }}>
                ~{data.recommendation.effective_pit_loss}s
              </p>
              <p style={{ fontSize: '1rem', color: '#6b7280', marginTop: 4 }}>
                {data.current_state.track_status === 'SC' ? 'Safety Car' : data.current_state.track_status === 'VSC' ? 'VSC active' : 'normal'}
              </p>
            </StateCell>
          </div>

          {/* Recommendation card */}
          {style && (
            <div
              className="rounded-lg"
              style={{ background: style.bg, border: `1px solid ${style.border}`, minHeight: 140, padding: '24px 28px', marginTop: 24 }}
            >
              <div className="flex items-center gap-4 flex-wrap" style={{ marginBottom: 14 }}>
                <span
                  className="font-bold font-mono"
                  style={{
                    background: style.badgeBg, color: style.badgeText,
                    padding: '6px 16px', borderRadius: 6, fontSize: '1rem', letterSpacing: '0.08em',
                  }}
                >
                  {style.label}
                </span>
                {data.recommendation.undercut_viable && (
                  <span style={{ fontSize: 14, color: '#22D3A5', fontWeight: 600 }}>
                    ↑ Undercut viable (+{data.recommendation.undercut_gain_estimate.toFixed(1)}s)
                  </span>
                )}
                {data.recommendation.overcut_viable && (
                  <span style={{ fontSize: 14, color: '#60a5fa', fontWeight: 600 }}>↑ Overcut viable</span>
                )}
              </div>
              <p style={{ fontSize: 15, lineHeight: 1.8, color: style.textColor }}>
                {data.recommendation.reasoning}
              </p>
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', marginTop: 14, paddingTop: 14 }}>
                <span className="font-mono" style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>
                  Pace vs fresh: {data.recommendation.pace_delta_vs_fresh.toFixed(3)}s/lap
                </span>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
