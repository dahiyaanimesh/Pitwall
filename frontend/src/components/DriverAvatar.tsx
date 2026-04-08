// 2021 F1 team colors (official hex values)
export const TEAM_COLORS: Record<string, string> = {
  mercedes: '#00D2BE',
  red_bull_racing: '#0600EF',
  ferrari: '#DC0000',
  mclaren: '#FF8700',
  alpine: '#0090FF',
  alphatauri: '#2B4562',
  aston_martin: '#006F62',
  williams: '#005AFF',
  alfa_romeo: '#900000',
  haas: '#FFFFFF',
}

// Fallback for partial matches (team names can vary slightly)
function resolveTeamColor(teamId: string | null | undefined): string {
  if (!teamId) return '#6b7280'
  const lower = teamId.toLowerCase()
  for (const [key, color] of Object.entries(TEAM_COLORS)) {
    if (lower.includes(key) || key.includes(lower)) return color
  }
  return '#6b7280'
}

interface DriverAvatarProps {
  driverId: string
  teamId: string | null | undefined
  size?: 'sm' | 'md' | 'lg'
  showName?: boolean
  fullName?: string
}

const sizeMap = {
  sm: { outer: 'w-8 h-8 text-[11px]', bar: 'w-0.5', text: 'text-[13px]' },
  md: { outer: 'w-10 h-10 text-sm',   bar: 'w-1',   text: 'text-sm' },
  lg: { outer: 'w-14 h-14 text-base', bar: 'w-1.5', text: 'text-base' },
}

export default function DriverAvatar({
  driverId,
  teamId,
  size = 'md',
  showName = false,
  fullName,
}: DriverAvatarProps) {
  const color = resolveTeamColor(teamId)
  const s = sizeMap[size]
  const isLight = color === '#FFFFFF' || color === '#FF8700'

  return (
    <div className="flex items-center gap-2">
      <div
        className={`${s.outer} rounded-lg flex items-center justify-center font-bold relative overflow-hidden flex-shrink-0`}
        style={{ backgroundColor: color + '18', border: `1px solid ${color}30` }}
      >
        {/* Colored left bar */}
        <div
          className={`absolute left-0 top-0 h-full ${s.bar}`}
          style={{ backgroundColor: color }}
        />
        <span
          className="font-mono font-bold tracking-tight pl-1"
          style={{ color: isLight ? '#d1d5db' : color, fontSize: 'inherit' }}
        >
          {driverId}
        </span>
      </div>
      {showName && fullName && (
        <span className={`${s.text} font-medium`} style={{ color: 'rgba(255,255,255,0.88)' }}>{fullName}</span>
      )}
      {showName && !fullName && (
        <span className={`${s.text} font-mono`} style={{ color: 'rgba(255,255,255,0.55)' }}>{driverId}</span>
      )}
    </div>
  )
}
