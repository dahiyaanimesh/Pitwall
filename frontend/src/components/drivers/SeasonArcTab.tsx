import { useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ReferenceLine, ResponsiveContainer,
} from 'recharts'
import { useDriverSeasonArc } from '../../hooks/useDriverSeasonArc'
import { TEAM_COLORS } from '../DriverAvatar'
import LoadingSpinner from '../LoadingSpinner'
import ErrorMessage from '../ErrorMessage'
import type { Driver } from '../../types/f1'

const ABU_DHABI_ROUND = 22

function shortRaceName(name: string): string {
  // Extract country/city from long race name
  const parts = name.replace('FORMULA 1 ', '').replace(/\d{4}$/, '').trim()
  const words = parts.split(' ')
  // Take last 1-2 meaningful words
  if (words.length <= 2) return parts
  const drop = ['GRAND', 'PRIX', 'GP', 'FORMULA', '1']
  const filtered = words.filter((w) => !drop.includes(w.toUpperCase()))
  return filtered.slice(0, 2).join(' ')
}

interface Props {
  season: number
  drivers: Driver[]
}

export default function SeasonArcTab({ season, drivers }: Props) {
  const [driver1Id, setDriver1Id] = useState<string>('VER')
  const [driver2Id, setDriver2Id] = useState<string>('HAM')

  const { data: arc1, loading: l1, error: e1 } = useDriverSeasonArc(driver1Id, season)
  const { data: arc2, loading: l2, error: e2 } = useDriverSeasonArc(driver2Id, season)

  const loading = l1 || l2

  // Merge into single chart data keyed by round_number
  const chartData = (() => {
    if (!arc1 && !arc2) return []
    const rounds = arc1?.arc ?? arc2?.arc ?? []
    return rounds.map((pt, i) => {
      const a1 = arc1?.arc[i]
      const a2 = arc2?.arc[i]
      return {
        round: pt.round_number,
        label: shortRaceName(pt.race_name ?? ''),
        [`${driver1Id}_pts`]: a1?.cumulative_points ?? null,
        [`${driver2Id}_pts`]: a2?.cumulative_points ?? null,
        [`${driver1Id}_pos`]: a1?.finish_position ?? null,
        [`${driver2Id}_pos`]: a2?.finish_position ?? null,
      }
    })
  })()

  function colorForDriver(id: string) {
    const d = drivers.find((d) => d.driver_id === id)
    if (!d?.team_id) return '#6b7280'
    return TEAM_COLORS[d.team_id.toLowerCase()] ?? '#6b7280'
  }

  const d1Color = colorForDriver(driver1Id)
  const d2Color = colorForDriver(driver2Id)

  const driverOptions = drivers.map((d) => ({
    value: d.driver_id,
    label: `${d.driver_id} — ${d.full_name}`,
  }))

  return (
    <div className="space-y-6">
      {/* Driver selectors */}
      <div className="flex flex-wrap gap-4">
        {[
          { label: 'Driver 1', value: driver1Id, set: setDriver1Id, color: d1Color },
          { label: 'Driver 2', value: driver2Id, set: setDriver2Id, color: d2Color },
        ].map(({ label, value, set, color }) => (
          <div key={label} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
            <label className="text-xs text-white/50 uppercase tracking-widest">{label}</label>
            <select
              value={value}
              onChange={(e) => set(e.target.value)}
              className="bg-f1gray border border-f1border text-white text-sm rounded px-3 py-1.5 focus:outline-none focus:border-f1red"
            >
              {driverOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        ))}
      </div>

      {(e1 || e2) && <ErrorMessage message={e1 ?? e2 ?? 'Unknown error'} />}

      {loading ? (
        <LoadingSpinner message="Loading season arc data…" />
      ) : (
        <>
          {/* Cumulative points chart */}
          <div className="rounded-lg p-5" style={{ background: '#111111', border: '1px solid #1f1f1f' }}>
            <p className="section-label mb-4">Cumulative Championship Points</p>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: '#4b5563', fontSize: 10, fontFamily: '"JetBrains Mono"' }}
                  interval={1}
                  angle={-35}
                  textAnchor="end"
                  height={60}
                  axisLine={{ stroke: '#1f1f1f' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#4b5563', fontSize: 10, fontFamily: '"JetBrains Mono"' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 6 }}
                  labelStyle={{ color: '#6b7280', fontSize: 11, fontFamily: '"JetBrains Mono"' }}
                  itemStyle={{ fontSize: 11, color: 'rgba(255,255,255,0.8)' }}
                />
                <Legend wrapperStyle={{ fontSize: 11, color: '#6b7280' }} />
                <ReferenceLine
                  x={chartData.find((d) => d.round === ABU_DHABI_ROUND)?.label}
                  stroke="#e10600"
                  strokeDasharray="4 2"
                  label={{ value: 'Abu Dhabi', fill: '#e10600', fontSize: 10, position: 'insideTopRight' }}
                />
                <Line
                  type="monotone"
                  dataKey={`${driver1Id}_pts`}
                  stroke={d1Color}
                  strokeWidth={2.5}
                  dot={false}
                  name={`${driver1Id} pts`}
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey={`${driver2Id}_pts`}
                  stroke={d2Color}
                  strokeWidth={2.5}
                  dot={false}
                  name={`${driver2Id} pts`}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Finish position chart (inverted — P1 at top) */}
          <div className="rounded-lg p-5" style={{ background: '#111111', border: '1px solid #1f1f1f' }}>
            <p className="section-label mb-1">
              Race Finish Position <span className="text-white/40 normal-case font-normal tracking-normal" style={{ fontSize: 10 }}>(P1 at top)</span>
            </p>
            <ResponsiveContainer width="100%" height={240} style={{ marginTop: 16 }}>
              <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: '#4b5563', fontSize: 10, fontFamily: '"JetBrains Mono"' }}
                  interval={1}
                  angle={-35}
                  textAnchor="end"
                  height={60}
                  axisLine={{ stroke: '#1f1f1f' }}
                  tickLine={false}
                />
                <YAxis
                  reversed
                  domain={[1, 20]}
                  ticks={[1, 5, 10, 15, 20]}
                  tick={{ fill: '#4b5563', fontSize: 10, fontFamily: '"JetBrains Mono"' }}
                  tickFormatter={(v) => `P${v}`}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 6 }}
                  labelStyle={{ color: '#6b7280', fontSize: 11, fontFamily: '"JetBrains Mono"' }}
                  formatter={(v: number) => [`P${v}`, '']}
                  itemStyle={{ fontSize: 11, color: 'rgba(255,255,255,0.8)' }}
                />
                <Legend wrapperStyle={{ fontSize: 11, color: '#6b7280' }} />
                <Line
                  type="monotone"
                  dataKey={`${driver1Id}_pos`}
                  stroke={d1Color}
                  strokeWidth={2}
                  dot={{ r: 3, fill: d1Color }}
                  name={`${driver1Id} pos`}
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey={`${driver2Id}_pos`}
                  stroke={d2Color}
                  strokeWidth={2}
                  dot={{ r: 3, fill: d2Color }}
                  name={`${driver2Id} pos`}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  )
}
