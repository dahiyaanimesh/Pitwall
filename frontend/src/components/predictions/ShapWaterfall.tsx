import type { ShapFeature } from '../../types/predictions'

interface Props {
  driverName: string
  predictedFinish: number
  baseValue: number
  features: ShapFeature[]
}

// ─── Layout constants ─────────────────────────────────────────────────────────
const BAR_H      = 26
const ROW_GAP    = 10
const PAD_V      = 16

// Fixed columns (left → right):
//  [SHAP_COL] [gap] [LABEL_COL] [gap] [BAR_AREA] [gap] [RAW_COL]
const SHAP_COL   = 54
const SHAP_GAP   = 10
const LABEL_COL  = 160
const LABEL_GAP  = 14
const BAR_AREA   = 260
const RAW_GAP    = 12
const RAW_COL    = 48

const BAR_START  = SHAP_COL + SHAP_GAP + LABEL_COL + LABEL_GAP
const MID        = BAR_START + BAR_AREA / 2
const RAW_X      = BAR_START + BAR_AREA + RAW_GAP + RAW_COL
const TOTAL_W    = RAW_X + 4

// ─── Colours ──────────────────────────────────────────────────────────────────
const BETTER  = '#22D3A5'
const WORSE   = '#E10600'
const NEUTRAL = '#4B5563'

function fmt(v: number | null) {
  if (v === null) return 'N/A'
  return Number.isInteger(v) ? String(v) : v.toFixed(2)
}

export default function ShapWaterfall({ driverName, predictedFinish, baseValue, features }: Props) {
  const maxAbs = Math.max(
    ...features.map((f) => Math.abs(f.shap_value)),
    Math.abs(predictedFinish - baseValue),
    0.01,
  )
  const scale = (v: number) => (Math.abs(v) / maxAbs) * (BAR_AREA * 0.46)

  // Build waterfall running totals
  let running = baseValue
  const bars = features.map((f) => {
    const from = running
    running += f.shap_value
    return { ...f, from, to: running }
  })

  const rows = features.length + 2
  const svgH = PAD_V + rows * (BAR_H + ROW_GAP) + 36

  const rowY = (i: number) => PAD_V + i * (BAR_H + ROW_GAP)
  const cy   = (y: number) => y + BAR_H / 2 + 4.5

  const runToX = (v: number) => MID + ((v - baseValue) / maxAbs) * (BAR_AREA * 0.46)

  // Gradient IDs (unique per instance via driverName)
  const uid = driverName.replace(/\s/g, '')

  return (
    <div
      className="rounded-lg p-5"
      style={{ background: '#111111', border: '1px solid #1f1f1f' }}
    >
      {/* Header */}
      <div className="mb-5 flex items-start justify-between">
        <div>
          <p className="section-label mb-1">SHAP Explanation</p>
          <p className="text-sm font-semibold text-white">
            {driverName}
            <span className="text-white/40 font-normal ml-2">
              — predicted finish:{' '}
              <span className="text-white font-bold font-mono">P{predictedFinish.toFixed(1)}</span>
            </span>
          </p>
        </div>
        <div className="text-right">
          <p className="section-label mb-1">Base</p>
          <p className="text-sm font-mono font-bold text-white/60">P{baseValue.toFixed(1)}</p>
        </div>
      </div>

      <svg
        width="100%"
        viewBox={`0 0 ${TOTAL_W} ${svgH}`}
        style={{ fontFamily: "'Outfit', system-ui, sans-serif", overflow: 'visible' }}
      >
        <defs>
          {/* Gradient for "better" bars — fades from tip toward center */}
          <linearGradient id={`grad-better-${uid}`} x1="1" y1="0" x2="0" y2="0">
            <stop offset="0%" stopColor={BETTER} stopOpacity={0.95} />
            <stop offset="100%" stopColor={BETTER} stopOpacity={0.25} />
          </linearGradient>
          {/* Gradient for "worse" bars */}
          <linearGradient id={`grad-worse-${uid}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={WORSE} stopOpacity={0.25} />
            <stop offset="100%" stopColor={WORSE} stopOpacity={0.95} />
          </linearGradient>
          {/* Predicted-finish better gradient (tip is on the left) */}
          <linearGradient id={`grad-pred-better-${uid}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={BETTER} stopOpacity={1} />
            <stop offset="100%" stopColor={BETTER} stopOpacity={0.45} />
          </linearGradient>
          {/* Predicted-finish worse gradient */}
          <linearGradient id={`grad-pred-worse-${uid}`} x1="1" y1="0" x2="0" y2="0">
            <stop offset="0%" stopColor={WORSE} stopOpacity={1} />
            <stop offset="100%" stopColor={WORSE} stopOpacity={0.45} />
          </linearGradient>
          {/* Glow filters */}
          <filter id={`glow-better-${uid}`} x="-30%" y="-60%" width="160%" height="220%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id={`glow-worse-${uid}`} x="-30%" y="-60%" width="160%" height="220%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* ── Scale tick lines at ±25% and ±50% ──────────────────────────── */}
        {[-0.46, -0.23, 0.23, 0.46].map((frac) => (
          <line
            key={frac}
            x1={MID + frac * BAR_AREA}
            y1={PAD_V - 6}
            x2={MID + frac * BAR_AREA}
            y2={rowY(rows - 1) + BAR_H + 4}
            stroke="rgba(255,255,255,0.04)"
            strokeWidth={1}
          />
        ))}

        {/* ── Centre reference line ──────────────────────────────────────── */}
        <line
          x1={MID} y1={PAD_V - 6}
          x2={MID} y2={rowY(rows - 1) + BAR_H + 4}
          stroke="rgba(255,255,255,0.12)"
          strokeWidth={1}
        />

        {/* ── Column header labels ───────────────────────────────────────── */}
        <text x={SHAP_COL} y={PAD_V - 7} textAnchor="end" fill="rgba(255,255,255,0.30)" fontSize={9} letterSpacing="0.08em">
          SHAP
        </text>
        <text x={RAW_X} y={PAD_V - 7} textAnchor="end" fill="rgba(255,255,255,0.30)" fontSize={9} letterSpacing="0.08em">
          RAW
        </text>

        {/* ── Base value row (row 0) ─────────────────────────────────────── */}
        {(() => {
          const y  = rowY(0)
          const bw = scale(maxAbs * 0.18)
          return (
            <g>
              {/* Alternating row bg */}
              <rect x={0} y={y - 3} width={TOTAL_W} height={BAR_H + 6} fill="rgba(255,255,255,0.015)" rx={4} />
              {/* Label */}
              <text x={SHAP_COL + SHAP_GAP + LABEL_COL} y={cy(y)} textAnchor="end" fill="rgba(255,255,255,0.30)" fontSize={11}>
                Base (avg finish)
              </text>
              {/* Dashed-outline bar centred on MID — visually "neutral starting point" */}
              <rect x={MID - bw / 2} y={y + 4} width={bw} height={BAR_H - 8}
                fill="none" stroke={NEUTRAL} strokeWidth={1.5} strokeDasharray="4 3" rx={3} opacity={0.7} />
              {/* Raw value */}
              <text x={RAW_X} y={cy(y)} textAnchor="end" fill="rgba(255,255,255,0.30)" fontSize={11} fontFamily="'JetBrains Mono', monospace">
                {baseValue.toFixed(1)}
              </text>
            </g>
          )
        })()}

        {/* ── Feature rows ──────────────────────────────────────────────── */}
        {bars.map((bar, i) => {
          const y        = rowY(i + 1)
          const w        = Math.max(scale(Math.abs(bar.shap_value)), 2)
          const isBetter = bar.shap_value < 0
          const color    = isBetter ? BETTER : WORSE
          const barX     = isBetter ? MID - w : MID
          const gradId   = isBetter ? `grad-better-${uid}` : `grad-worse-${uid}`
          const glowId   = isBetter ? `glow-better-${uid}` : `glow-worse-${uid}`
          const isLarge  = w > BAR_AREA * 0.15   // apply glow only on significant bars

          const prevX = runToX(bar.from)
          const prevY = rowY(i) + BAR_H

          return (
            <g key={bar.feature}>
              {/* Alternating row bg */}
              {i % 2 === 1 && (
                <rect x={0} y={y - 3} width={TOTAL_W} height={BAR_H + 6} fill="rgba(255,255,255,0.015)" rx={4} />
              )}

              {/* Dashed drop connector */}
              <line
                x1={prevX} y1={prevY}
                x2={prevX} y2={y}
                stroke="rgba(255,255,255,0.08)" strokeDasharray="3 2" strokeWidth={1}
              />

              {/* ── SHAP badge (pill tint + value) ── */}
              <rect
                x={2} y={y + 4}
                width={SHAP_COL - 2} height={BAR_H - 8}
                fill={`${color}18`} rx={4}
              />
              <text
                x={SHAP_COL - 4}
                y={cy(y)}
                textAnchor="end"
                fill={color}
                fontSize={10}
                fontWeight="700"
                fontFamily="'JetBrains Mono', monospace"
              >
                {bar.shap_value > 0 ? '+' : ''}{bar.shap_value.toFixed(2)}
              </text>

              {/* ── Feature label ── */}
              <text
                x={SHAP_COL + SHAP_GAP + LABEL_COL}
                y={cy(y)}
                textAnchor="end"
                fill="rgba(255,255,255,0.70)"
                fontSize={11}
              >
                {bar.label}
              </text>

              {/* ── Gradient bar with optional glow ── */}
              <rect
                x={barX} y={y + 2} width={w} height={BAR_H - 4}
                fill={`url(#${gradId})`}
                rx={3}
                filter={isLarge ? `url(#${glowId})` : undefined}
              />
              {/* Bright leading edge */}
              {w > 4 && (
                <rect
                  x={isBetter ? barX : barX + w - 2}
                  y={y + 2} width={2} height={BAR_H - 4}
                  fill={color} rx={1} opacity={0.9}
                />
              )}

              {/* ── Raw feature value ── */}
              <text
                x={RAW_X}
                y={cy(y)}
                textAnchor="end"
                fill="rgba(255,255,255,0.38)"
                fontSize={10}
                fontFamily="'JetBrains Mono', monospace"
              >
                {fmt(bar.feature_value)}
              </text>
            </g>
          )
        })}

        {/* ── Separator before Predicted Finish ─────────────────────────── */}
        <line
          x1={0} y1={rowY(features.length + 1) - 5}
          x2={TOTAL_W} y2={rowY(features.length + 1) - 5}
          stroke="rgba(255,255,255,0.07)" strokeWidth={1}
        />

        {/* ── Predicted finish row ──────────────────────────────────────── */}
        {(() => {
          const y        = rowY(features.length + 1)
          const offset   = predictedFinish - baseValue
          const w        = Math.max(scale(Math.abs(offset)), 3)
          const isBetter = offset < 0
          const color    = isBetter ? BETTER : WORSE
          const barX     = isBetter ? MID - w : MID
          const gradId   = isBetter ? `grad-pred-better-${uid}` : `grad-pred-worse-${uid}`

          return (
            <g>
              {/* Highlight background for this row */}
              <rect x={0} y={y - 3} width={TOTAL_W} height={BAR_H + 6}
                fill={`${color}0A`} rx={4} />

              {/* Dashed connector from last feature */}
              <line
                x1={runToX(bars[bars.length - 1]?.to ?? baseValue)}
                y1={rowY(features.length) + BAR_H}
                x2={runToX(bars[bars.length - 1]?.to ?? baseValue)}
                y2={y}
                stroke="rgba(255,255,255,0.08)" strokeDasharray="3 2" strokeWidth={1}
              />

              {/* Label */}
              <text
                x={SHAP_COL + SHAP_GAP + LABEL_COL}
                y={cy(y)}
                textAnchor="end"
                fill="rgba(255,255,255,0.95)"
                fontSize={11}
                fontWeight="700"
                letterSpacing="0.02em"
              >
                Predicted Finish
              </text>

              {/* Gradient bar */}
              <rect
                x={barX} y={y + 1} width={w} height={BAR_H - 2}
                fill={`url(#${gradId})`} rx={3}
                filter={`url(#glow-${isBetter ? 'better' : 'worse'}-${uid})`}
              />
              {/* Leading edge */}
              <rect
                x={isBetter ? barX : barX + w - 2}
                y={y + 1} width={2} height={BAR_H - 2}
                fill={color} rx={1}
              />

              {/* Value badge */}
              <rect
                x={RAW_X - RAW_COL} y={y + 4}
                width={RAW_COL} height={BAR_H - 8}
                fill={`${color}20`} rx={4}
              />
              <text
                x={RAW_X - 4}
                y={cy(y)}
                textAnchor="end"
                fill={color}
                fontSize={11}
                fontWeight="700"
                fontFamily="'JetBrains Mono', monospace"
              >
                P{predictedFinish.toFixed(1)}
              </text>
            </g>
          )
        })()}

        {/* ── Legend ────────────────────────────────────────────────────── */}
        <g transform={`translate(${SHAP_COL + SHAP_GAP}, ${svgH - 16})`}>
          <rect width={8} height={8} y={0} fill={BETTER} rx={2} opacity={0.8} />
          <text x={13} y={8} fill="rgba(255,255,255,0.38)" fontSize={9.5} letterSpacing="0.03em">Better finish</text>
          <rect x={92} width={8} height={8} y={0} fill={WORSE} rx={2} opacity={0.8} />
          <text x={105} y={8} fill="rgba(255,255,255,0.38)" fontSize={9.5} letterSpacing="0.03em">Worse finish</text>
          <text x={TOTAL_W - SHAP_COL - SHAP_GAP - 4} y={8} textAnchor="end" fill="rgba(255,255,255,0.28)" fontSize={9.5}>
            Raw feature value →
          </text>
        </g>
      </svg>
    </div>
  )
}
