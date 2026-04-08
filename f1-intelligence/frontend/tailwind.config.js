/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Core surfaces — Stitch design tokens
        f1dark:    '#0a0a0a',
        f1surface: '#141414',
        f1card:    '#181818',
        f1border:  '#1f1f1f',
        f1hover:   '#2a2a2a',
        f1muted:   '#6b7280',
        // Legacy aliases kept for backwards compat
        f1gray:    '#141414',
        f1faint:   '#1f1f1f',
        // Accent
        f1red:     '#E10600',
        // Semantic
        'green-pos': '#22c55e',
        'red-neg':   '#ef4444',
        // Telemetry
        'telemetry-green':  '#22D3A5',
        'telemetry-amber':  '#F59E0B',
        'telemetry-orange': '#FF6B35',
        // Team colors
        'team-mercedes':   '#00D2BE',
        'team-redbull':    '#0600EF',
        'team-ferrari':    '#DC0000',
        'team-mclaren':    '#FF8700',
        'team-alpine':     '#0090FF',
        'team-alphatauri': '#2B4562',
        'team-aston':      '#006F62',
        'team-williams':   '#005AFF',
        'team-alfa':       '#900000',
        'team-haas':       '#FFFFFF',
        // Tyre compounds
        'tyre-soft':   '#FF3333',
        'tyre-medium': '#FFF200',
        'tyre-hard':   '#EEEEEE',
        'tyre-inter':  '#39B54A',
        'tyre-wet':    '#0067FF',
      },
      fontFamily: {
        display: ['Rajdhani', 'system-ui', 'sans-serif'],
        sans:    ['Inter', 'Outfit', 'system-ui', 'sans-serif'],
        mono:    ['"JetBrains Mono"', 'monospace'],
      },
      boxShadow: {
        card:        '0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.6)',
        'card-md':   '0 4px 16px rgba(0,0,0,0.5)',
        'glow-red':  '0 0 40px rgba(225,6,0,0.15)',
        'glow-sm':   '0 0 16px rgba(225,6,0,0.10)',
        // Legacy
        glass:       '0 4px 24px rgba(0,0,0,0.5)',
        'glass-md':  '0 8px 40px rgba(0,0,0,0.6)',
        'glass-red': '0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(225,6,0,0.3)',
      },
      animation: {
        'fade-up':    'fadeUp 0.4s ease both',
        'fade-in':    'fadeIn 0.3s ease both',
        'spin-slow':  'spin 2.5s linear infinite',
        'pulse-soft': 'pulseSoft 3s ease-in-out infinite',
        'bar-fill':   'barFill 0.9s cubic-bezier(0.22,1,0.36,1) both',
        shimmer:      'shimmer 2s linear infinite',
      },
      keyframes: {
        fadeUp:    { '0%': { opacity: '0', transform: 'translateY(12px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        fadeIn:    { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        pulseSoft: { '0%, 100%': { opacity: '0.5' }, '50%': { opacity: '1' } },
        barFill:   { '0%': { transform: 'scaleX(0)', transformOrigin: 'left' }, '100%': { transform: 'scaleX(1)', transformOrigin: 'left' } },
        shimmer:   { '0%': { backgroundPosition: '-200% center' }, '100%': { backgroundPosition: '200% center' } },
      },
    },
  },
  plugins: [],
}
