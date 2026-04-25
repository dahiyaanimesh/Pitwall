import { useLocation, Link } from 'react-router-dom'
import { Activity, GitBranch, Cloud, CircleDot, Clock } from 'lucide-react'
import { useSeason } from '../context/SeasonContext'

const ITEMS = [
  { Icon: Activity,   label: 'Telemetry',    path: '/' },
  { Icon: GitBranch,  label: 'Pit Strategy', path: '/strategy' },
  { Icon: Cloud,      label: 'Weather',      path: '/weather' },
  { Icon: CircleDot,  label: 'Tires',        path: '/tires' },
  { Icon: Clock,      label: 'History',      path: '/races' },
]

export default function Sidebar() {
  const { pathname } = useLocation()
  const { season } = useSeason()

  const activeLabel =
    pathname === '/'            ? 'Telemetry' :
    pathname === '/strategy'    ? 'Pit Strategy' :
    pathname === '/races'       ? 'History' :
    pathname === '/weather'     ? 'Weather' :
    pathname === '/tires'       ? 'Tires' :
    pathname === '/drivers'     ? 'Telemetry' :
    pathname === '/predictions' ? 'Telemetry' : 'Telemetry'

  return (
    <aside
      className="hidden lg:flex flex-col flex-shrink-0 w-[200px] h-full"
      style={{ background: '#0a0a0a', borderRight: '1px solid #1f1f1f' }}
    >
      {/* Race Control header */}
      <div className="px-5 pt-5 pb-4" style={{ borderBottom: '1px solid #1f1f1f' }}>
        <div className="flex items-center gap-2 mb-0.5">
          <div className="w-1.5 h-1.5 rounded-full bg-f1red animate-pulse-soft" />
          <span
            className="font-semibold uppercase"
            style={{ fontSize: 11, letterSpacing: '0.15em', color: 'rgba(255,255,255,0.7)' }}
          >
            Race Control
          </span>
        </div>
        <p
          className="uppercase font-medium pl-3.5"
          style={{ fontSize: 10, letterSpacing: '0.2em', color: '#9ca3af' }}
        >
          {season} Season
        </p>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {ITEMS.map(({ Icon, label, path }) => {
          const isActive = label === activeLabel
          const isDisabled = path === '#'

          const content = (
            <>
              <Icon
                size={15}
                style={{ color: isActive ? '#E10600' : '#9ca3af', flexShrink: 0 }}
              />
              <span
                className="text-[12px] font-medium"
                style={{ color: isActive ? '#ffffff' : '#d1d5db' }}
              >
                {label}
              </span>
              {isActive && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-f1red flex-shrink-0" />
              )}
            </>
          )

          const sharedClass = `flex items-center gap-3 px-3 py-2.5 rounded-r-lg transition-all duration-150 ${isDisabled ? 'cursor-default' : 'cursor-pointer'}`
          const sharedStyle = {
            background: isActive ? '#1a1a1a' : 'transparent',
            borderLeft: isActive ? '2px solid #E10600' : '2px solid transparent',
          }

          return isDisabled ? (
            <div key={label} className={sharedClass} style={sharedStyle}>
              {content}
            </div>
          ) : (
            <Link key={label} to={path} className={sharedClass} style={sharedStyle}>
              {content}
            </Link>
          )
        })}
      </nav>

      {/* Version */}
      <div className="px-5 py-4" style={{ borderTop: '1px solid #1f1f1f' }}>
        <p className="font-mono" style={{ fontSize: 10, color: 'rgba(107,114,128,0.5)' }}>
          PITWALL v1.0
        </p>
      </div>
    </aside>
  )
}
