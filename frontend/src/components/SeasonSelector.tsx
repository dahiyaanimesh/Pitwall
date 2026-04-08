interface SeasonSelectorProps {
  value: number
  onChange: (season: number) => void
  className?: string
}

const SEASONS = [2021, 2022, 2023, 2024]

export default function SeasonSelector({ value, onChange, className = '' }: SeasonSelectorProps) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <span className="section-label hidden sm:block">Season</span>
      <div
        className="flex items-center gap-0.5 p-0.5 rounded-xl"
        style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.07)',
        }}
      >
        {SEASONS.map((s) => (
          <button
            key={s}
            onClick={() => onChange(s)}
            className={`px-3 py-1.5 rounded-[10px] text-sm font-display font-600 tracking-wide transition-all duration-200 ${
              value === s
                ? 'text-white'
                : 'text-white/35 hover:text-white/70'
            }`}
            style={
              value === s
                ? {
                    background: 'rgba(225,6,0,0.15)',
                    boxShadow: '0 0 0 1px rgba(225,6,0,0.3), inset 0 1px 0 rgba(255,255,255,0.08)',
                    color: '#fff',
                  }
                : {}
            }
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}
