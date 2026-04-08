import { useEffect } from 'react'
import { X } from 'lucide-react'
import { TEAM_COLORS } from '../DriverAvatar'
import type { DriverPrediction } from '../../types/predictions'

const NAVBAR_H = 56
const DRAWER_W = 420

const BETTER = '#22D3A5'
const WORSE  = '#e10600'

function predColor(pred: number, actual: number | null) {
  if (actual === null) return '#6b7280'
  const err = Math.abs(pred - actual)
  if (err <= 2) return BETTER
  if (err <= 5) return '#f59e0b'
  return WORSE
}

function fmt(v: number | null) {
  if (v === null) return 'N/A'
  return Number.isInteger(v) ? String(v) : v.toFixed(2)
}

function teamColor(teamId: string | null | undefined) {
  if (!teamId) return '#374151'
  return TEAM_COLORS[teamId.toLowerCase()] ?? '#374151'
}

interface Props {
  pred: DriverPrediction
  baseValue: number
  onClose: () => void
}

export default function ShapDrawer({ pred, baseValue, onClose }: Props) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  // Fix 3: scale bars relative to largest |value| in this set → 180px
  const features = [...pred.shap_features].sort(
    (a, b) => Math.abs(b.shap_value) - Math.abs(a.shap_value),
  )
  const maxAbs = Math.max(...features.map((f) => Math.abs(f.shap_value)), 0.01)

  const color = predColor(pred.predicted_finish, pred.actual_finish)
  const err   = pred.actual_finish !== null ? Math.abs(pred.predicted_finish - pred.actual_finish) : null

  const tc = teamColor(pred.team_id)

  return (
    <>
      <div
        style={{
          position: 'fixed',
          top: NAVBAR_H,
          right: 0,
          bottom: 0,
          width: DRAWER_W,
          background: '#0f0f0f',
          borderLeft: '3px solid #e10600',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.6)',
          zIndex: 50,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',          // Fix 4: prevent horizontal overflow
          animation: 'drawerSlideIn 250ms ease-out both',
        }}
      >
        {/* ── Header (fixed, non-scrolling) ──────────────────── */}
        <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid #1f1f1f', flexShrink: 0, position: 'relative' }}>

          {/* Fix 1: Close button — absolute top-right */}
          <button
            onClick={onClose}
            style={{
              position: 'absolute', top: 16, right: 16,
              width: 28, height: 28, padding: 6,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#6b7280', background: 'none', border: 'none',
              borderRadius: 4, cursor: 'pointer',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#ffffff')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#6b7280')}
          >
            <X size={16} />
          </button>

          {/* Fix 1: Avatar + name, gap 10px */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, paddingRight: 36 }}>
            <div
              style={{
                width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: `${tc}22`, border: `1.5px solid ${tc}66`,
                color: tc, fontFamily: '"JetBrains Mono", monospace',
                fontSize: 12, fontWeight: 700,
              }}
            >
              {pred.driver_id}
            </div>
            <div>
              {/* Fix 1: 15px #fff weight 600 */}
              <p style={{ fontSize: 15, fontWeight: 600, color: '#ffffff', lineHeight: 1.2 }}>
                {pred.full_name ?? pred.driver_id}
              </p>
              {/* Fix 1: 12px #6b7280 below */}
              <p style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                {pred.team_name ?? ''}
              </p>
            </div>
          </div>

          {/* Fix 2: Prediction summary row with dividers */}
          <div style={{ display: 'flex', alignItems: 'stretch', gap: 0, marginBottom: 14 }}>
            {/* Predicted finish */}
            <div style={{ paddingRight: 16 }}>
              <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.15em', color: '#6b7280', marginBottom: 4 }}>
                Predicted Finish
              </p>
              <span style={{ fontFamily: '"JetBrains Mono", monospace', fontWeight: 700, fontSize: 29, color, lineHeight: 1 }}>
                P{pred.predicted_finish.toFixed(1)}
              </span>
            </div>

            {pred.actual_finish !== null && (
              <>
                {/* Vertical divider */}
                <div style={{ width: 1, background: '#1f1f1f', marginRight: 16, alignSelf: 'stretch' }} />
                <div style={{ paddingRight: 16 }}>
                  <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.15em', color: '#6b7280', marginBottom: 4 }}>
                    Actual
                  </p>
                  <span style={{ fontFamily: '"JetBrains Mono", monospace', fontWeight: 600, fontSize: 20, color: '#ffffff', lineHeight: 1 }}>
                    P{pred.actual_finish}
                  </span>
                </div>
              </>
            )}

            {err !== null && (
              <>
                <div style={{ width: 1, background: '#1f1f1f', marginRight: 16, alignSelf: 'stretch' }} />
                <div>
                  <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.15em', color: '#6b7280', marginBottom: 4 }}>
                    Error
                  </p>
                  <span style={{ fontFamily: '"JetBrains Mono", monospace', fontWeight: 700, fontSize: 20, color, lineHeight: 1 }}>
                    ±{err.toFixed(1)}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Fix 5: SHAP subheader + separator */}
          <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.15em', color: '#6b7280', marginBottom: 10 }}>
            SHAP Feature Attribution
          </p>
          <div style={{ height: 1, background: '#1f1f1f' }} />
        </div>

        {/* ── Feature rows (Fix 7: flex-1, overflow-y auto) ──── */}
        <div style={{ flex: 1, overflowY: 'auto', paddingRight: 20 }}>
          {features.map((f) => {
            const isBetter = f.shap_value < 0
            const barColor = isBetter ? BETTER : WORSE
            // Fix 1: scale relative to largest |value| in this set → 160px max
            const barWidth = Math.max(8, (Math.abs(f.shap_value) / maxAbs) * 160)

            return (
              <div
                key={f.feature}
                style={{ padding: '12px 20px', borderBottom: '1px solid #1a1a1a' }}
              >
                {/* Fix 4: name + value on same row, space-between */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 7 }}>
                  <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#6b7280', flexShrink: 0, width: '60%' }}>
                    {f.label}
                  </p>
                  {/* Fix 4: right-aligned value, never clipped */}
                  <span style={{ fontFamily: '"JetBrains Mono", monospace', fontWeight: 700, fontSize: 13, color: barColor, flexShrink: 0, minWidth: 56, textAlign: 'right' }}>
                    {f.shap_value > 0 ? '+' : ''}{f.shap_value.toFixed(3)}
                  </span>
                </div>
                {/* Bar row: bar left, raw value right */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ height: 6, borderRadius: 3, width: barWidth, background: barColor, flexShrink: 0 }} />
                  <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, color: '#4b5563', flexShrink: 0, paddingRight: 4 }}>
                    {fmt(f.feature_value)}
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        {/* ── Footer (Fix 6+7: sticky, non-scrolling) ────────── */}
        <div style={{ borderTop: '1px solid #1f1f1f', padding: '16px 20px', flexShrink: 0 }}>
          {/* Base value */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#6b7280' }}>
              Base Value (avg finish)
            </p>
            <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 14, color: '#6b7280' }}>
              P{baseValue.toFixed(1)}
            </span>
          </div>

          <div style={{ height: 1, background: '#1a1a1a', marginBottom: 10 }} />

          {/* Final prediction */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#6b7280' }}>
              Final Prediction
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, color }}>
                {pred.predicted_finish < baseValue ? '↑' : '↓'}
              </span>
              {/* Fix 6: 1.4rem bold, color matches error level */}
              <span style={{ fontFamily: '"JetBrains Mono", monospace', fontWeight: 700, fontSize: 26, color, lineHeight: 1 }}>
                P{pred.predicted_finish.toFixed(1)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes drawerSlideIn {
          from { transform: translateX(${DRAWER_W}px); }
          to   { transform: translateX(0); }
        }
      `}</style>
    </>
  )
}
