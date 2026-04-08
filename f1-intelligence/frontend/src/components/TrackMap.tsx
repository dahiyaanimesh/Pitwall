import { useState, useEffect, useRef } from 'react'
import { API_BASE } from '../config'

interface TrackData { x: number[]; y: number[] }

const dataCache = new Map<string, TrackData | null>()

async function fetchTrackData(circuitKey: number, year: number): Promise<TrackData | null> {
  const yearsToTry = [year, year - 1, year + 1, 2024, 2023]
  for (const y of yearsToTry) {
    const cacheKey = `${circuitKey}-${y}`
    if (dataCache.has(cacheKey)) {
      const cached = dataCache.get(cacheKey)!
      if (cached) return cached
      continue  // was null, try next year
    }
    try {
      // Use backend proxy to avoid CORS issues
      const res = await fetch(`${API_BASE}/circuits/track-map/${circuitKey}/${y}`)
      if (!res.ok) { dataCache.set(cacheKey, null); continue }
      const data = await res.json()
      if (data?.error || !data?.x?.length) { dataCache.set(cacheKey, null); continue }
      const track: TrackData = { x: data.x, y: data.y }
      dataCache.set(cacheKey, track)
      return track
    } catch {
      dataCache.set(cacheKey, null)
    }
  }
  return null
}

interface TrackMapProps {
  circuitKey: number | null
  year: number
  width?: number
  height?: number
  style?: React.CSSProperties
  sectorColors?: { 1?: string; 2?: string; 3?: string }
  outlineStrokeWidth?: number
  lineStrokeWidth?: number
}

export default function TrackMap({
  circuitKey,
  year,
  width = 160,
  height = 120,
  style,
  sectorColors,
  outlineStrokeWidth = 7,
  lineStrokeWidth = sectorColors ? 2.5 : 1.5,
}: TrackMapProps) {
  const [points, setPoints] = useState<Array<{ x: number; y: number }> | null>(null)
  const [loading, setLoading] = useState(true)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    if (!circuitKey) { setLoading(false); setPoints(null); return }
    setLoading(true)
    setPoints(null)
    fetchTrackData(circuitKey, year).then((data) => {
      if (!mounted.current) return
      if (data?.x?.length) {
        setPoints(data.x.map((x, i) => ({ x, y: data.y[i] })))
      }
      setLoading(false)
    })
    return () => { mounted.current = false }
  }, [circuitKey, year])

  // Placeholder (no circuit key or failed fetch)
  if (!circuitKey || (!loading && !points)) {
    return (
      <div style={{ width, height, display: 'flex', alignItems: 'center', justifyContent: 'center', ...style }}>
        <svg width={width * 0.55} height={height * 0.55} viewBox="0 0 60 45">
          <ellipse cx="30" cy="22" rx="26" ry="18" fill="none" stroke="#1f1f1f" strokeWidth="2" strokeDasharray="4 3" />
        </svg>
      </div>
    )
  }

  // Loading skeleton
  if (loading) {
    return (
      <div style={{ width, height, background: '#141414', borderRadius: 6, ...style }} />
    )
  }

  // Normalize to SVG viewport
  const pad = 8
  const xs = points!.map((p) => p.x)
  const ys = points!.map((p) => p.y)
  const minX = Math.min(...xs), maxX = Math.max(...xs)
  const minY = Math.min(...ys), maxY = Math.max(...ys)
  const rangeX = maxX - minX || 1
  const rangeY = maxY - minY || 1

  const drawW = width - pad * 2
  const drawH = height - pad * 2
  const scale = Math.min(drawW / rangeX, drawH / rangeY) * 0.92

  const offX = pad + (drawW - rangeX * scale) / 2
  const offY = pad + (drawH - rangeY * scale) / 2

  const norm = (p: { x: number; y: number }) => ({
    x: offX + (p.x - minX) * scale,
    y: offY + (p.y - minY) * scale,
  })

  const normed = points!.map(norm)
  const polyStr = (pts: typeof normed) => pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const allPts = polyStr(normed)

  // Sector splits
  const total = normed.length
  const s1end = Math.floor(total / 3)
  const s2end = Math.floor((total * 2) / 3)

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block', ...style }}>
      {sectorColors ? (
        <>
          <polyline points={allPts} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={outlineStrokeWidth} strokeLinejoin="round" strokeLinecap="round" />
          <polyline points={polyStr(normed.slice(0, s1end + 1))} fill="none" stroke={sectorColors[1] ?? '#22c55e'} strokeWidth={lineStrokeWidth} strokeLinejoin="round" strokeLinecap="round" />
          <polyline points={polyStr(normed.slice(s1end, s2end + 1))} fill="none" stroke={sectorColors[2] ?? '#f59e0b'} strokeWidth={lineStrokeWidth} strokeLinejoin="round" strokeLinecap="round" />
          <polyline points={polyStr(normed.slice(s2end))} fill="none" stroke={sectorColors[3] ?? '#e10600'} strokeWidth={lineStrokeWidth} strokeLinejoin="round" strokeLinecap="round" />
        </>
      ) : (
        <>
          <polyline points={allPts} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={outlineStrokeWidth} strokeLinejoin="round" strokeLinecap="round" />
          <polyline points={allPts} fill="none" stroke="#e10600" strokeWidth={lineStrokeWidth} strokeLinejoin="round" strokeLinecap="round" />
        </>
      )}
      {normed[0] && <circle cx={normed[0].x} cy={normed[0].y} r={3} fill="#ffffff" opacity={0.5} />}
    </svg>
  )
}
