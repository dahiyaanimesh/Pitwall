import { TEAM_COLORS } from '../components/DriverAvatar'

/**
 * Strips "FORMULA 1", year numbers, and shortens "GRAND PRIX" → "GP".
 * @param words Max words to keep (default 3). Pass 5 for the calendar sidebar.
 */
export function shortName(name: string, words = 3): string {
  return name
    .replace(/FORMULA 1\s*/i, '')
    .replace(/\d{4}/g, '')
    .replace(/GRAND PRIX/i, 'GP')
    .trim()
    .split(' ')
    .filter(Boolean)
    .slice(0, words)
    .join(' ')
}

/** Resolves a team_id string to its official hex color, with fuzzy matching. */
export function teamColor(teamId: string | null | undefined): string {
  if (!teamId) return '#6b7280'
  const lower = teamId.toLowerCase()
  for (const [key, color] of Object.entries(TEAM_COLORS)) {
    if (lower.includes(key) || key.includes(lower)) return color
  }
  return '#6b7280'
}

/** Returns a 3-letter team abbreviation from a full team name. */
export function teamShort(name: string | null | undefined): string {
  if (!name) return '—'
  return name
    .replace(/ Racing$/i, '')
    .replace(/Formula One/i, '')
    .replace(/BWT/i, '')
    .trim()
    .toUpperCase()
    .slice(0, 3)
}

/** Normalises a value to [0, 1] within [min, max]. Returns 0.5 if range is zero. */
export function normalize(val: number, min: number, max: number): number {
  if (max === min) return 0.5
  return Math.max(0, Math.min(1, (val - min) / (max - min)))
}
