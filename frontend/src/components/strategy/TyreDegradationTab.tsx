import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts'
import { useTyreDegradation } from '../../hooks/useStrategy'
import LoadingSpinner from '../LoadingSpinner'
import ErrorMessage from '../ErrorMessage'
import { COMPOUND_COLORS } from './TyreChip'
import TrackMap from '../TrackMap'
import { getCircuitKey } from '../../utils/circuitKeys'

interface Props { raceId: number | null; circuitId?: string; season?: number }

function fmtLap(s: number) {
  const m = Math.floor(s / 60)
  const sec = (s - m * 60).toFixed(3)
  return `${m}:${sec.padStart(6, '0')}`
}

function buildChartData(compounds: { compound: string; curve: { tyre_life: number; avg_lap_time: number; fitted_lap_time: number | null }[] }[]) {
  const map: Record<number, Record<string, number | null>> = {}
  for (const c of compounds) {
    for (const pt of c.curve) {
      if (!map[pt.tyre_life]) map[pt.tyre_life] = {}
      map[pt.tyre_life][`${c.compound.toLowerCase()}_avg`] = pt.avg_lap_time
      map[pt.tyre_life][`${c.compound.toLowerCase()}_fit`] = pt.fitted_lap_time
    }
  }
  return Object.entries(map)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([tyre_life, vals]) => ({ tyre_life: Number(tyre_life), ...vals }))
}

const COMPOUND_STROKE: Record<string, string> = {
  SOFT:   COMPOUND_COLORS.SOFT,
  MEDIUM: '#d4c800',
  HARD:   '#aaaaaa',
  INTER:  COMPOUND_COLORS.INTER,
  WET:    COMPOUND_COLORS.WET,
}

const COMPOUND_LABEL_COLOR: Record<string, string> = {
  SOFT:   '#FF3333',
  MEDIUM: '#FFF200',
  HARD:   '#eeeeee',
  INTER:  '#39B54A',
  WET:    '#0067FF',
}

export default function TyreDegradationTab({ raceId, circuitId, season = 2021 }: Props) {
  const { data, loading, error } = useTyreDegradation(raceId)

  if (!raceId) return (
    <div className="py-16 text-center" style={{ color: 'rgba(255,255,255,0.4)' }}>
      Select a race to view tyre degradation curves.
    </div>
  )
  if (loading) return <LoadingSpinner message="Fitting degradation models…" />
  if (error)   return <ErrorMessage message={error} />
  if (!data)   return null

  const chartData = buildChartData(data.compounds)

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    return (
      <div className="rounded-lg px-3 py-2 text-xs space-y-1" style={{ background: '#1a1a1a', border: '1px solid #2a2a2a' }}>
        <p className="font-semibold text-white mb-1">Tyre life: {label} laps</p>
        {payload.map((p: any) => (
          <p key={p.dataKey} style={{ color: p.color }}>{p.name}: {fmtLap(p.value)}</p>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-5">

      {/* Compound stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {data.compounds.map((c) => {
          const color  = COMPOUND_LABEL_COLOR[c.compound] ?? '#888'
          const rate   = c.degradation_rate_per_lap
          const rateMs = rate != null ? rate * 1000 : null
          const isGraining = rateMs != null && rateMs < -10
          const isStable   = rateMs != null && Math.abs(rateMs) <= 10
          const rateColor  = rateMs == null ? '#6b7280' : isGraining ? '#f59e0b' : isStable ? '#6b7280' : '#e10600'
          const headline   = rateMs == null ? '—' : isGraining ? 'Graining' : isStable ? 'Stable' : `+${rateMs.toFixed(1)}`
          const headlineUnit = rateMs == null || isGraining || isStable ? '' : 'ms/lap'
          const tooltip = rateMs == null
            ? 'Insufficient clean laps for a valid regression.'
            : isGraining
              ? 'Negative degradation indicates tyre graining — the compound initially improves as the surface wears in, before true degradation begins. Common on abrasive circuits like Bahrain.'
              : isStable
                ? 'Near-zero degradation — this compound is holding its pace well across the stint.'
                : 'Positive degradation indicates the tyre is losing performance over time. Higher values mean faster wear.'
          const subtext = rateMs == null
            ? 'Insufficient clean data'
            : isGraining
              ? `${rateMs.toFixed(0)}ms/lap (improving — graining phase)`
              : `${c.data_points} clean laps`
          return (
            <div key={c.compound} className="rounded-lg p-5" style={{ background: '#141414', border: '1px solid #1f1f1f' }}>
              <div className="flex items-center gap-2 mb-3">
                <span className="rounded-full" style={{ width: 10, height: 10, background: COMPOUND_STROKE[c.compound] ?? '#888', display: 'inline-block' }} />
                <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color }}>
                  {c.compound}
                </p>
                <span
                  title={tooltip}
                  style={{ fontSize: 11, color: '#4b5563', cursor: 'help', marginLeft: 'auto', userSelect: 'none' }}
                >
                  ⓘ
                </span>
              </div>
              <p className="font-mono font-bold leading-none" style={{ fontSize: 28, color: rateColor }}>
                {headline}
                {headlineUnit && <span style={{ fontSize: 13, fontWeight: 400, color: '#6b7280' }}>{headlineUnit}</span>}
              </p>
              <p style={{ fontSize: 11, color: '#6b7280', marginTop: 6 }}>{subtext}</p>
            </div>
          )
        })}
      </div>

      {/* Track map + Compound summary — side by side */}
      <div className="rounded-lg overflow-hidden" style={{ background: '#111111', border: '1px solid #1f1f1f' }}>
        <div className="grid grid-cols-2" style={{ minHeight: 340 }}>

          {/* Left — Circuit Tyre Stress */}
          <div className="p-5 flex flex-col items-center justify-center" style={{ borderRight: '1px solid #1f1f1f' }}>
            <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#6b7280', marginBottom: 16 }}>
              Circuit Tyre Stress
            </p>
            {circuitId ? (() => {
              const rates = data.compounds.map((c) => c.degradation_rate_per_lap ?? 0)
              // Use absolute value so graining (high negative) correctly maps to high stress
              function degradColor(rate: number) {
                const absMs = Math.abs(rate) * 1000
                if (absMs < 20)  return '#22D3A5'
                if (absMs < 50)  return '#f59e0b'
                return '#e10600'
              }
              const sectorColors = {
                1: degradColor(rates[0] ?? 0),
                2: degradColor(rates[1] ?? rates[0] ?? 0),
                3: degradColor(rates[2] ?? rates[0] ?? 0),
              } as { 1?: string; 2?: string; 3?: string }
              return (
                <>
                  <TrackMap
                    circuitKey={getCircuitKey(circuitId)}
                    year={season}
                    width={320}
                    height={240}
                    sectorColors={sectorColors}
                    outlineStrokeWidth={12}
                    lineStrokeWidth={3}
                  />
                  <div style={{ display: 'flex', gap: 24, marginTop: 14 }}>
                    {[
                      { label: 'Low',    color: '#22D3A5' },
                      { label: 'Medium', color: '#f59e0b' },
                      { label: 'High',   color: '#e10600' },
                    ].map(({ label, color }) => (
                      <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                        <span style={{ fontSize: 11, color: '#6b7280' }}>{label}</span>
                      </div>
                    ))}
                  </div>
                </>
              )
            })() : (
              <TrackMap circuitKey={null} year={season} width={320} height={240} />
            )}
          </div>

          {/* Right — Compound Summary */}
          <div className="flex flex-col">
            <div className="px-5 py-3" style={{ borderBottom: '1px solid #1f1f1f', background: '#0d0d0d' }}>
              <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#6b7280' }}>
                Compound Summary
              </p>
            </div>
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid #1a1a1a', background: '#0d0d0d' }}>
                  {['Compound', 'Base Lap', 'Degrad Rate', '+5 Lap Loss', '+20 Lap Loss'].map((h) => (
                    <th key={h} className="px-5 py-3 text-left" style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#4b5563' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.compounds.map((c) => {
                  const color   = COMPOUND_LABEL_COLOR[c.compound] ?? '#888'
                  const rate    = c.degradation_rate_per_lap
                  const rateMs  = rate != null ? rate * 1000 : null
                  const isGraining = rateMs != null && rateMs < -10
                  const isStable   = rateMs != null && Math.abs(rateMs) <= 10
                  const rateColor  = rateMs == null ? '#6b7280' : isGraining ? '#f59e0b' : isStable ? '#6b7280' : '#e10600'
                  const rateText   = rateMs == null ? '—' : isGraining ? 'Graining' : isStable ? 'Stable' : `+${rateMs.toFixed(1)}ms/lap`
                  return (
                    <tr key={c.compound} style={{ borderBottom: '1px solid #161616' }}>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <span className="rounded-full" style={{ width: 8, height: 8, background: COMPOUND_STROKE[c.compound] ?? '#888', display: 'inline-block' }} />
                          <span className="font-semibold uppercase" style={{ fontSize: 12, color }}>{c.compound}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 font-mono" style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
                        {c.base_lap_time ? fmtLap(c.base_lap_time) : '—'}
                      </td>
                      <td className="px-5 py-3 font-semibold" style={{ fontSize: 12, color: rateColor }}>
                        {rateText}
                      </td>
                      <td className="px-5 py-3 font-mono" style={{ fontSize: 12, color: rate != null ? '#f59e0b' : '#6b7280' }}>
                        {rate != null ? `${(rate * 5).toFixed(3)}s` : '—'}
                      </td>
                      <td className="px-5 py-3 font-mono" style={{ fontSize: 12, color: rate != null ? '#f59e0b' : '#6b7280' }}>
                        {rate != null ? `${(rate * 20).toFixed(3)}s` : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

        </div>
      </div>

      {/* Main chart */}
      <div className="rounded-lg p-5" style={{ background: '#111111', border: '1px solid #1f1f1f' }}>
        <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#6b7280', marginBottom: 4 }}>
          Avg Lap Time vs Tyre Age
        </p>
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 16 }}>
          Dots = binned average · Dashed = linear regression fit · Higher = slower
        </p>
        <ResponsiveContainer width="100%" height={340}>
          <LineChart data={chartData} margin={{ top: 5, right: 12, left: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" vertical={false} />
            <XAxis
              dataKey="tyre_life"
              label={{ value: 'Tyre Age (laps)', position: 'insideBottom', offset: -2, fill: '#6b7280', fontSize: 10 }}
              tick={{ fill: '#4b5563', fontSize: 10, fontFamily: '"JetBrains Mono"' }}
              axisLine={{ stroke: '#1f1f1f' }}
              tickLine={false}
              height={32}
            />
            <YAxis
              tickFormatter={fmtLap}
              tick={{ fill: '#4b5563', fontSize: 10, fontFamily: '"JetBrains Mono"' }}
              axisLine={false}
              tickLine={false}
              width={64}
              domain={['auto', 'auto']}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 10, color: '#6b7280', paddingTop: 8 }} />
            {data.compounds.map((c) => {
              const stroke = COMPOUND_STROKE[c.compound] ?? '#888'
              const key = c.compound.toLowerCase()
              return [
                <Line key={`${key}_avg`} type="monotone" dataKey={`${key}_avg`} stroke={stroke}
                  strokeWidth={2} dot={{ r: 3, fill: stroke }} name={`${c.compound} avg`} connectNulls />,
                <Line key={`${key}_fit`} type="monotone" dataKey={`${key}_fit`} stroke={stroke}
                  strokeWidth={1.5} strokeDasharray="5 3" dot={false} name={`${c.compound} fit`} connectNulls />,
              ]
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>

    </div>
  )
}
