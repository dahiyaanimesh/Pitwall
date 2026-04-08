// Official F1 tyre compound colors
export const COMPOUND_COLORS: Record<string, string> = {
  SOFT:   '#FF3333',
  MEDIUM: '#FFF200',
  HARD:   '#EEEEEE',
  INTER:  '#39B54A',
  WET:    '#0067FF',
}

export const COMPOUND_TEXT: Record<string, string> = {
  SOFT:   '#1a0000',
  MEDIUM: '#1a1800',
  HARD:   '#1a1a1a',
  INTER:  '#001a00',
  WET:    '#001a4d',
}

interface TyreChipProps {
  compound: string
  age?: number
  size?: 'xs' | 'sm' | 'md'
}

const sizeMap = {
  xs: { chip: 'w-5 h-5 text-[9px]', label: 'text-xs' },
  sm: { chip: 'w-7 h-7 text-xs',    label: 'text-xs' },
  md: { chip: 'w-9 h-9 text-sm',    label: 'text-sm' },
}

export default function TyreChip({ compound, age, size = 'sm' }: TyreChipProps) {
  const color = COMPOUND_COLORS[compound] ?? '#555'
  const text  = COMPOUND_TEXT[compound]  ?? '#fff'
  const s = sizeMap[size]
  const letter = compound[0] ?? '?'

  return (
    <span className="inline-flex items-center gap-1">
      <span
        className={`${s.chip} rounded-full flex items-center justify-center font-bold flex-shrink-0`}
        style={{ backgroundColor: color, color: text }}
      >
        {letter}
      </span>
      {age !== undefined && (
        <span className={`${s.label} text-white/50 font-mono`}>{age}L</span>
      )}
    </span>
  )
}
