import {
  ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts'
import { useModelAccuracy } from '../../hooks/usePredictions'
import LoadingSpinner from '../LoadingSpinner'
import ErrorMessage from '../ErrorMessage'
import type { DriverSeriesPoint } from '../../types/predictions'

interface MetricCardProps {
  label: string
  value: string
  sub?: string
  color: string
}

function MetricCard({ label, value, sub, color }: MetricCardProps) {
  return (
    <div className="rounded-lg p-5" style={{ background: '#141414', border: '1px solid #1f1f1f' }}>
      <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#6b7280', marginBottom: 8 }}>
        {label}
      </p>
      <p className="font-mono font-bold leading-none" style={{ fontSize: 32, color }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: '#6b7280', marginTop: 6 }}>{sub}</p>}
    </div>
  )
}

function shortName(name: string) {
  return name.replace('FORMULA 1 ', '').replace(/\d{4}$/, '').replace(/GRAND PRIX/i, 'GP').trim().split(' ').slice(0, 2).join(' ')
}

function mergeSeriesForChart(ver: DriverSeriesPoint[], ham: DriverSeriesPoint[]) {
  const map: Record<number, Record<string, unknown>> = {}
  for (const pt of ver) {
    map[pt.round_number] = {
      round: pt.round_number,
      label: `R${String(pt.round_number).padStart(2, '0')}`,
      in_test: pt.in_test_set,
      ver_actual: pt.actual_finish,
      ver_pred: pt.pred_finish,
    }
  }
  for (const pt of ham) {
    if (!map[pt.round_number]) map[pt.round_number] = { round: pt.round_number, label: `R${String(pt.round_number).padStart(2, '0')}` }
    map[pt.round_number].ham_actual = pt.actual_finish
    map[pt.round_number].ham_pred   = pt.pred_finish
    map[pt.round_number].in_test    = map[pt.round_number].in_test ?? pt.in_test_set
  }
  return Object.values(map).sort((a, b) => (a.round as number) - (b.round as number))
}

interface Props { season: number }

const CARD_STYLE = { background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8 }

export default function ModelAccuracyTab({ season }: Props) {
  const { data, loading, error } = useModelAccuracy(season)

  if (loading) return <LoadingSpinner message="Loading model accuracy…" />
  if (error)   return <ErrorMessage message={error} />
  if (!data)   return null

  const chartData   = mergeSeriesForChart(data.driver_series.VER, data.driver_series.HAM)
  const splitLabel  = chartData.find((d) => (d.round as number) === 17)?.label as string

  const ChartTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null
    const row = payload[0]?.payload
    return (
      <div className="rounded-lg px-3 py-2 text-xs" style={CARD_STYLE}>
        <p className="font-semibold text-white mb-1">{row.label}</p>
        {row.in_test && <p style={{ fontSize: 10, color: '#e10600', fontWeight: 600, letterSpacing: '0.08em' }}>TEST SET</p>}
        <p style={{ color: '#6b7280' }}>VER actual: <span className="text-white font-mono">P{row.ver_actual}</span>{' '}pred: <span className="font-mono" style={{ color: '#0600EF' }}>P{row.ver_pred?.toFixed(1)}</span></p>
        <p style={{ color: '#6b7280' }}>HAM actual: <span className="text-white font-mono">P{row.ham_actual}</span>{' '}pred: <span className="font-mono" style={{ color: '#00D2BE' }}>P{row.ham_pred?.toFixed(1)}</span></p>
      </div>
    )
  }

  const MaeTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null
    const d = payload[0]?.payload
    return (
      <div className="rounded-lg px-3 py-2 text-xs" style={CARD_STYLE}>
        <p className="text-white font-semibold mb-0.5">{shortName(d.race_name)}</p>
        <p className="font-mono" style={{ color: d.in_test_set ? '#e10600' : '#6b7280' }}>MAE: {d.mae.toFixed(2)} pos</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">

      {/* Metric cards — full width */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard label="Regressor MAE"      value={`${data.metrics.best_mae}`}                   sub={`positions · ${data.metrics.model}`}          color="#f59e0b" />
        <MetricCard label="R² Score"           value={String(data.metrics.best_r2)}                  sub="Variance explained"                            color="#3b82f6" />
        <MetricCard label="Podium Accuracy"    value={`${Math.round(data.classifier_metrics.best_acc * 100)}%`} sub={`F1 = ${data.classifier_metrics.best_f1}`}  color="#22D3A5" />
        <MetricCard label="Full Season MAE"    value={`${data.full_season_mae}`}                     sub="Train + test combined"                         color="#f59e0b" />
      </div>

      {/* Train/test split legend */}
      <div className="flex items-center gap-5">
        <div className="flex items-center gap-2">
          <div className="rounded-sm" style={{ width: 28, height: 3, background: '#374151' }} />
          <span style={{ fontSize: 11, color: '#6b7280' }}>Train: {data.train_rounds}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="rounded-sm" style={{ width: 28, height: 3, background: '#7f1d1d' }} />
          <span style={{ fontSize: 11, color: 'rgba(225,6,0,0.65)' }}>Test: {data.test_rounds}</span>
        </div>
        <div className="flex items-center gap-2">
          <div style={{ width: 28, height: 0, borderTop: '2px dashed #e10600' }} />
          <span style={{ fontSize: 11, color: '#e10600' }}>Train/Test split</span>
        </div>
      </div>

      {/* Predicted vs Actual chart */}
      <div className="rounded-lg p-5" style={{ background: '#111111', border: '1px solid #1f1f1f' }}>
        <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#6b7280', marginBottom: 4 }}>
          Predicted vs Actual — VER & HAM
        </p>
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 16 }}>
          Solid = actual finish · Dashed = model prediction · Vertical line = train/test split
        </p>
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={chartData} margin={{ top: 5, right: 12, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: '#4b5563', fontSize: 9, fontFamily: '"JetBrains Mono"' }}
              axisLine={{ stroke: '#1f1f1f' }}
              tickLine={false}
              height={20}
            />
            <YAxis
              reversed
              domain={[1, 20]}
              ticks={[1, 5, 10, 15, 20]}
              tickFormatter={(v) => `P${v}`}
              tick={{ fill: '#4b5563', fontSize: 10, fontFamily: '"JetBrains Mono"' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<ChartTooltip />} />
            <ReferenceLine
              x={splitLabel}
              stroke="#e10600"
              strokeDasharray="4 2"
              strokeWidth={1.5}
              label={{ value: 'Test →', fill: '#e10600', fontSize: 9, position: 'insideTopRight' }}
            />
            <Line type="monotone" dataKey="ver_actual" stroke="#0600EF" strokeWidth={2.5}
              dot={{ r: 3, fill: '#0600EF' }} name="VER actual" connectNulls />
            <Line type="monotone" dataKey="ver_pred" stroke="#0600EF" strokeWidth={1.5}
              strokeDasharray="5 3" dot={false} name="VER predicted" connectNulls strokeOpacity={0.6} />
            <Line type="monotone" dataKey="ham_actual" stroke="#00D2BE" strokeWidth={2.5}
              dot={{ r: 3, fill: '#00D2BE' }} name="HAM actual" connectNulls />
            <Line type="monotone" dataKey="ham_pred" stroke="#00D2BE" strokeWidth={1.5}
              strokeDasharray="5 3" dot={false} name="HAM predicted" connectNulls strokeOpacity={0.6} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Per-round MAE bar chart */}
      <div className="rounded-lg p-5" style={{ background: '#111111', border: '1px solid #1f1f1f' }}>
        <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#6b7280', marginBottom: 16 }}>
          Per-Race MAE (all drivers)
        </p>
        <ResponsiveContainer width="100%" height={240}>
          <ComposedChart data={data.per_round_mae} margin={{ top: 5, right: 12, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" vertical={false} />
            <XAxis
              dataKey="race_name"
              tickFormatter={(v) => `R${String(data.per_round_mae.findIndex((d: any) => d.race_name === v) + 1).padStart(2, '0')}`}
              tick={{ fill: '#4b5563', fontSize: 9, fontFamily: '"JetBrains Mono"' }}
              axisLine={{ stroke: '#1f1f1f' }}
              tickLine={false}
              height={20}
            />
            <YAxis
              tick={{ fill: '#4b5563', fontSize: 10, fontFamily: '"JetBrains Mono"' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<MaeTooltip />} />
            <Bar dataKey="mae" name="MAE" radius={[2, 2, 0, 0]}>
              {data.per_round_mae.map((entry: any, i: number) => (
                <Cell key={i} fill={entry.in_test_set ? '#7f1d1d' : '#374151'} />
              ))}
            </Bar>
            <ReferenceLine
              y={data.metrics.best_mae}
              stroke="#f59e0b"
              strokeDasharray="4 2"
              label={{ value: `Avg MAE`, fill: '#f59e0b', fontSize: 10, position: 'insideTopRight' }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Most surprising prediction callout */}
      {data.worst_prediction && (
        <div className="rounded-lg p-5" style={{ background: 'rgba(225,6,0,0.06)', border: '1px solid rgba(225,6,0,0.25)', borderLeft: '3px solid #E10600' }}>
          <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#e10600', marginBottom: 8 }}>
            Most Surprising Prediction (test set)
          </p>
          <p style={{ fontSize: 14, color: '#ffffff' }}>
            <span className="font-mono font-bold">{data.worst_prediction.driver_id}</span>
            {' '}at R{data.worst_prediction.round_number}: model predicted{' '}
            <span className="font-mono" style={{ color: '#f59e0b' }}>P{data.worst_prediction.predicted}</span>,
            actual was{' '}
            <span className="font-mono text-white">P{data.worst_prediction.actual}</span>
            {' '}— error of{' '}
            <span className="font-mono font-bold" style={{ color: '#e10600' }}>{data.worst_prediction.error} positions</span>.
          </p>
          <p style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>
            With only {17 * 20} training rows the model struggles when driver form departs sharply from recent trend.
          </p>
        </div>
      )}
    </div>
  )
}
