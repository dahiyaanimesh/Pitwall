import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import { useSeason, SEASONS } from '../context/SeasonContext'

const NAV_LINKS = [
  { path: '/',            label: 'Dashboard' },
  { path: '/drivers',     label: 'Drivers' },
  { path: '/races',       label: 'Races' },
  { path: '/predictions', label: 'Predictions' },
  { path: '/strategy',    label: 'Strategy' },
]

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const { season, setSeason } = useSeason()

  return (
    <>
      <header
        className="flex-shrink-0 z-50 relative"
        style={{ background: '#0a0a0a', borderBottom: '1px solid #1f1f1f', height: 52 }}
      >
        <div className="flex items-center h-full px-5 gap-6">
          {/* Logo */}
          <NavLink to="/" className="flex items-center flex-shrink-0 mr-2">
            <span style={{ fontWeight: 700, fontSize: 18, color: '#ffffff', letterSpacing: '0.04em', lineHeight: 1 }}>PIT</span>
            <span style={{ fontWeight: 700, fontSize: 18, color: '#E10600', letterSpacing: '0.04em', lineHeight: 1 }}>WALL</span>
          </NavLink>

          {/* Center nav */}
          <nav className="hidden md:flex items-center flex-1">
            {NAV_LINKS.map(({ path, label }) => (
              <NavLink key={path} to={path} end={path === '/'} className="relative">
                {({ isActive }) => (
                  <span
                    className="relative flex items-center px-4 transition-colors duration-150"
                    style={{
                      height: 52,
                      fontSize: 12,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
                      color: isActive ? '#E10600' : 'rgba(255,255,255,0.45)',
                    }}
                  >
                    {label}
                    {isActive && (
                      <span style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, background: '#E10600' }} />
                    )}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>

          {/* Season pills */}
          <div className="ml-auto hidden sm:flex items-center gap-1">
            {SEASONS.map((yr) => {
              const isActive = yr === season
              return (
                <button
                  key={yr}
                  onClick={() => setSeason(yr)}
                  style={{
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: 13,
                    fontWeight: 600,
                    color:      isActive ? '#ffffff' : '#6b7280',
                    background: isActive ? '#e10600' : '#1f1f1f',
                    border:     `1px solid ${isActive ? '#e10600' : '#2a2a2a'}`,
                    borderRadius: 4,
                    padding:    '4px 10px',
                    cursor:     'pointer',
                    transition: 'all 120ms',
                    lineHeight: 1.4,
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = '#2a2a2a'
                      e.currentTarget.style.color = '#ffffff'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = '#1f1f1f'
                      e.currentTarget.style.color = '#6b7280'
                    }
                  }}
                >
                  {yr}
                </button>
              )
            })}
          </div>

          {/* Mobile menu toggle */}
          <button className="md:hidden ml-auto" onClick={() => setMobileOpen(v => !v)}>
            {mobileOpen ? <X size={18} className="text-white" /> : <Menu size={18} style={{ color: 'rgba(255,255,255,0.45)' }} />}
          </button>
        </div>
      </header>

      {/* Mobile nav */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 pt-14" style={{ background: 'rgba(0,0,0,0.85)' }} onClick={() => setMobileOpen(false)}>
          <nav className="w-64 h-full flex flex-col py-4" style={{ background: '#141414', borderRight: '1px solid #1f1f1f' }} onClick={e => e.stopPropagation()}>
            {NAV_LINKS.map(({ path, label }) => (
              <NavLink key={path} to={path} end={path === '/'} onClick={() => setMobileOpen(false)}
                className={({ isActive }) => `px-6 py-3 text-[13px] font-semibold uppercase tracking-widest border-l-2 transition-colors ${isActive ? 'text-f1red border-f1red' : 'text-f1muted border-transparent hover:text-white'}`}>
                {label}
              </NavLink>
            ))}
            <div className="flex gap-2 px-6 pt-4">
              {SEASONS.map((yr) => (
                <button
                  key={yr}
                  onClick={() => setSeason(yr)}
                  style={{
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: 12,
                    fontWeight: 600,
                    color:      yr === season ? '#ffffff' : '#6b7280',
                    background: yr === season ? '#e10600' : '#1f1f1f',
                    border:     '1px solid #2a2a2a',
                    borderRadius: 4,
                    padding:    '3px 8px',
                    cursor:     'pointer',
                  }}
                >
                  {yr}
                </button>
              ))}
            </div>
          </nav>
        </div>
      )}
    </>
  )
}
