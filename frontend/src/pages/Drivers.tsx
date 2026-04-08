import { useState } from 'react'
import { useDrivers } from '../hooks/useDrivers'
import { useSeason } from '../context/SeasonContext'
import LoadingSpinner from '../components/LoadingSpinner'
import ErrorMessage from '../components/ErrorMessage'
import SeasonArcTab from '../components/drivers/SeasonArcTab'
import PaceProfileTab from '../components/drivers/PaceProfileTab'
import TeammateBattleTab from '../components/drivers/TeammateBattleTab'
import OverperformersTab from '../components/drivers/OverperformersTab'

const TABS = [
  { id: 'arc', label: 'Season Arc' },
  { id: 'pace', label: 'Pace Profile' },
  { id: 'teammate', label: 'Teammate Battle' },
  { id: 'overperformers', label: 'Overperformers' },
] as const

type TabId = typeof TABS[number]['id']

export default function Drivers() {
  const { season } = useSeason()
  const [activeTab, setActiveTab] = useState<TabId>('arc')

  const { data: drivers, loading: driversLoading, error: driversError } = useDrivers(season)

  return (
    <div className="space-y-5 pb-10 animate-fade-in">
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-[28px] uppercase tracking-[0.06em] text-white">Drivers</h1>
          <p className="text-[11px] text-f1muted mt-1 uppercase tracking-widest font-semibold">Performance analytics across the season</p>
        </div>
      </div>

      {/* Underline tab bar — Stitch style */}
      <div style={{ borderBottom: '1px solid #1f1f1f' }}>
        <div className="flex gap-0">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="relative px-5 py-3 text-[12px] font-semibold uppercase tracking-[0.1em] transition-colors duration-150"
                style={{ color: isActive ? '#E10600' : '#6b7280' }}
              >
                {tab.label}
                {isActive && <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-f1red" />}
              </button>
            )
          })}
        </div>
      </div>

      {/* Tab content */}
      <div className="min-h-[400px]">
        {driversLoading ? (
          <LoadingSpinner message="Loading driver list…" />
        ) : driversError ? (
          <ErrorMessage message={driversError} />
        ) : (
          <>
            {activeTab === 'arc'            && <SeasonArcTab      season={season} drivers={drivers} />}
            {activeTab === 'pace'           && <PaceProfileTab    season={season} drivers={drivers} />}
            {activeTab === 'teammate'       && <TeammateBattleTab season={season} />}
            {activeTab === 'overperformers' && <OverperformersTab season={season} />}
          </>
        )}
      </div>
    </div>
  )
}
