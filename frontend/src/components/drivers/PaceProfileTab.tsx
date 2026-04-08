import { useState } from 'react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { usePaceProfile } from '../../hooks/usePaceProfile'
import { TEAM_COLORS } from '../DriverAvatar'
import LoadingSpinner from '../LoadingSpinner'
import ErrorMessage from '../ErrorMessage'
import type { Driver } from '../../types/f1'

function shortRaceName(name: string): string {
  const parts = name.replace('FORMULA 1 ', '').replace(/\d{4}$/, '').trim()
  const words = parts.split(' ')
  if (words.length <= 2) return parts
  const drop = ['GRAND', 'PRIX', 'GP', 'FORMULA', '1']
  return words.filter((w) => !drop.includes(w.toUpperCase())).slice(0, 2).join(' ')
}

function formatLapTime(seconds: number | null): string {
  if (seconds === null) return 'N/A'
  const m = Math.floor(seconds / 60)
  const s = (seconds % 60).toFixed(3)
  return `${m}:${s.padStart(6, '0')}`
}

interface Props {
  season: number
  drivers: Driver[]
}

export default function PaceProfileTab({ season, drivers }: Props) {
  const [driverId, setDriverId] = useState<string>('VER')

  const { data, loading, error } = usePaceProfile(driverId, season)

  function colorForDriver(id: string) {
    const d = drivers.find((d) => d.driver_id === id)
    if (!d?.team_id) return '#6b7280'
    return TEAM_COLORS[d.team_id.toLowerCase()] ?? '#6b7280'
  }

  const color = colorForDriver(driverId)

  const chartData = data?.profile
    .filter((p) => p.lap_count > 0)
    .map((p) => ({
      label: shortRaceName(p.race_name ?? ''),
      avg: p.avg_lap_time,
      best: p.best_lap_time,
      stddev: p.consistency_stddev,
      laps: p.lap_count,
      // tooltip extras
      avgFmt: formatLapTime(p.avg_lap_time),
      bestFmt: formatLapTime(p.best_lap_time),
      medFmt: formatLapTime(p.median_lap_time),
    })) ?? []

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    const d = payload[0]?.payload
    return (
      <div className="rounded-lg p-3 text-xs space-y-1 min-w-[160px]" style={{ background: '#1a1a1a', border: '1px solid #2a2a2a' }}>
        <p className="font-semibold mb-2" style={{ color: 'rgba(255,255,255,0.8)' }}>{label}</p>
        <p style={{ color: '#6b7280' }}>Avg: <span className="font-mono" style={{ color: 'rgba(255,255,255,0.9)' }}>{d.avgFmt}</span></p>
        <p style={{ color: '#6b7280' }}>Median: <span className="font-mono" style={{ color: 'rgba(255,255,255,0.9)' }}>{d.medFmt}</span></p>
        <p style={{ color: '#6b7280' }}>Best: <span className="font-mono" style={{ color: 'rgba(255,255,255,0.9)' }}>{d.bestFmt}</span></p>
        <p style={{ color: '#6b7280' }}>Consistency σ: <span className="font-mono" style={{ color: 'rgba(255,255,255,0.9)' }}>{d.stddev?.toFixed(3) ?? 'N/A'}s</span></p>
        <p style={{ color: '#6b7280' }}>Laps: <span style={{ color: 'rgba(255,255,255,0.9)' }}>{d.laps}</span></p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Driver selector */}
      <div className="flex items-center gap-3">
        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
        <label className="text-xs text-white/50 uppercase tracking-widest">Driver</label>
        <select
          value={driverId}
          onChange={(e) => setDriverId(e.target.value)}
          className="bg-f1gray border border-f1border text-white text-sm rounded px-3 py-1.5 focus:outline-none focus:border-f1red"
        >
          {drivers.map((d) => (
            <option key={d.driver_id} value={d.driver_id}>
              {d.driver_id} — {d.full_name}
            </option>
          ))}
        </select>
      </div>

      {error && <ErrorMessage message={error} />}

      {loading ? (
        <LoadingSpinner message="Loading pace profile…" />
      ) : (
        <div className="rounded-lg p-5" style={{ background: '#111111', border: '1px solid #1f1f1f' }}>
          <p className="section-label mb-1">Avg Clean Lap Time by Race</p>
          <p className="mb-4" style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
            Green-flag laps only, lap &gt; 1. Line shows consistency σ (lower = more consistent).
          </p>
          <ResponsiveContainer width="100%" height={340}>
            <ComposedChart data={chartData} margin={{ top: 5, right: 30, left: 10, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: '#4b5563', fontSize: 10, fontFamily: '"JetBrains Mono"' }}
                angle={-40}
                textAnchor="end"
                height={70}
                interval={0}
                axisLine={{ stroke: '#1f1f1f' }}
                tickLine={false}
              />
              {/* Left axis: lap time in seconds */}
              <YAxis
                yAxisId="time"
                orientation="left"
                tick={{ fill: '#4b5563', fontSize: 10, fontFamily: '"JetBrains Mono"' }}
                tickFormatter={(v) => `${v}s`}
                domain={['auto', 'auto']}
                width={50}
                axisLine={false}
                tickLine={false}
              />
              {/* Right axis: consistency stddev */}
              <YAxis
                yAxisId="stddev"
                orientation="right"
                tick={{ fill: '#4b5563', fontSize: 10, fontFamily: '"JetBrains Mono"' }}
                tickFormatter={(v) => `${v.toFixed(1)}σ`}
                domain={[0, 'auto']}
                width={45}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#6b7280', paddingTop: 8 }} />
              <Bar
                yAxisId="time"
                dataKey="avg"
                fill={color + '88'}
                stroke={color}
                strokeWidth={1}
                name="Avg lap (s)"
                radius={[2, 2, 0, 0]}
              />
              <Line
                yAxisId="stddev"
                type="monotone"
                dataKey="stddev"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={{ r: 3, fill: '#f59e0b' }}
                name="Consistency σ"
                connectNulls
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
