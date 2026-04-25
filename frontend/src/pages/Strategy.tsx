import { useState, useEffect } from 'react'
import RaceSwiper from '../components/RaceSwiper'
import axios from 'axios'
import { API_BASE } from '../config'
import { useSeason } from '../context/SeasonContext'
import LoadingSpinner from '../components/LoadingSpinner'
import ErrorMessage from '../components/ErrorMessage'
import TyreDegradationTab from '../components/strategy/TyreDegradationTab'
import PitWindowTab from '../components/strategy/PitWindowTab'
import RaceReplayTab from '../components/strategy/RaceReplayTab'
import type { Race, RaceResult } from '../types/f1'

interface DriverOption {
  driver_id: string
  full_name: string
  team_id: string | null
}

const TABS = [
  { id: 'degradation', label: 'Tyre Degradation' },
  { id: 'pitwindow',   label: 'Pit Window' },
  { id: 'replay',      label: 'Race Replay' },
] as const
type TabId = typeof TABS[number]['id']

// Abu Dhabi 2021 is the key race for the SC controversy story
const ABU_DHABI_2021_ROUND = 22

export default function Strategy() {
  const { season }                = useSeason()
  const [activeTab, setActiveTab] = useState<TabId>('degradation')
  const [races, setRaces]         = useState<Race[]>([])
  const [selectedRaceId, setSelectedRaceId] = useState<number | null>(null)
  const [racesLoading, setRacesLoading]     = useState(true)
  const [racesError, setRacesError]         = useState<string | null>(null)
  const [selectedDriverId, setSelectedDriverId] = useState('')
  const [availableDrivers, setAvailableDrivers] = useState<DriverOption[]>([])

  useEffect(() => {
    setRacesLoading(true)
    setRacesError(null)
    axios.get<Race[]>(`${API_BASE}/races`, { params: { season } })
      .then((r) => {
        setRaces(r.data)
        // Default to Abu Dhabi R22 for 2021, otherwise last race
        const abuDhabi = r.data.find((race) => race.round_number === ABU_DHABI_2021_ROUND)
        const defaultRace = abuDhabi ?? r.data[r.data.length - 1]
        if (defaultRace) setSelectedRaceId(defaultRace.race_id)
      })
      .catch((e) => setRacesError(e.message))
      .finally(() => setRacesLoading(false))
  }, [season])

  useEffect(() => {
    if (!selectedRaceId) return
    axios.get<RaceResult[]>(`${API_BASE}/races/${selectedRaceId}/results`)
      .then((r) => {
        const drivers: DriverOption[] = r.data
          .sort((a, b) => (a.finish_position ?? 99) - (b.finish_position ?? 99))
          .map((d) => ({ driver_id: d.driver_id, full_name: d.full_name, team_id: d.team_id }))
        setAvailableDrivers(drivers)
        // Default to HAM if present, otherwise first driver
        const ham = drivers.find((d) => d.driver_id === 'HAM')
        setSelectedDriverId(ham ? ham.driver_id : drivers[0]?.driver_id ?? '')
      })
      .catch(() => {})
  }, [selectedRaceId])

  const selectedRace = races.find((r) => r.race_id === selectedRaceId)
  const isAbuDhabi2021 = season === 2021 && selectedRace?.round_number === ABU_DHABI_2021_ROUND

  return (
    <div className="space-y-5 pb-10 animate-fade-in">
      {/* Header */}
      <div style={{ borderBottom: '1px solid #1a1a1a', paddingBottom: 16 }}>
        <div className="flex items-center gap-2 mb-1">
          <span style={{ color: '#E10600', fontSize: 10 }}>◆</span>
          <span className="font-mono uppercase" style={{ fontSize: 10, letterSpacing: '0.2em', color: '#d1d5db' }}>STRATEGY</span>
        </div>
        <div style={{ height: 1, background: '#1a1a1a', marginBottom: 8, maxWidth: 40 }} />
        <p className="font-mono uppercase" style={{ fontSize: 10, letterSpacing: '0.18em', color: '#d1d5db', marginBottom: 4 }}>
          {selectedRace ? `SESSION · R${selectedRace.round_number} — ${selectedRace.country?.toUpperCase()}` : 'PIT WINDOW · DEGRADATION · REPLAY'}
        </p>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)' }}>
          {selectedRace
            ? `Session: R${selectedRace.round_number} — ${selectedRace.country}`
            : 'Tyre degradation · Pit window · Race replay'}
        </p>
      </div>

      {/* Race selector */}
      {racesLoading ? <LoadingSpinner message="Loading races…" /> : racesError ? <ErrorMessage message={racesError} /> : (
        <div>
          {selectedRace && (
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-f1muted">Race</span>
              <span className="px-3 py-1 rounded text-[12px] font-semibold text-white" style={{ background: '#1f1f1f', border: '1px solid #2a2a2a' }}>
                {selectedRace.race_name.replace(/FORMULA 1\s*/i, '').replace(/GRAND PRIX/i, 'Grand Prix').trim().split(' ').slice(0, 4).join(' ')}
              </span>
              {isAbuDhabi2021 && <span className="badge-red">SC Controversy</span>}
            </div>
          )}
          <RaceSwiper
            races={races}
            selectedId={selectedRaceId}
            onSelect={setSelectedRaceId}
            badge={(race) => season === 2021 && race.round_number === ABU_DHABI_2021_ROUND
              ? <span style={{ color: '#E10600', fontSize: 9 }}>★</span>
              : null
            }
          />
        </div>
      )}

      {/* Underline tabs */}
      <div style={{ borderBottom: '1px solid #1f1f1f' }}>
        <div className="flex">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="relative px-5 py-3 text-[12px] font-semibold uppercase tracking-[0.1em] transition-colors"
                style={{ color: isActive ? '#E10600' : '#9ca3af' }}
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
        {activeTab === 'degradation' && (
          <TyreDegradationTab raceId={selectedRaceId} circuitId={selectedRace?.circuit_id ?? undefined} season={season} />
        )}
        {activeTab === 'pitwindow' && (
          <PitWindowTab
            raceId={selectedRaceId}
            races={races}
            driverId={selectedDriverId}
            setDriverId={setSelectedDriverId}
            availableDrivers={availableDrivers}
          />
        )}
        {activeTab === 'replay' && (
          <RaceReplayTab
            raceId={selectedRaceId}
            driverId={selectedDriverId}
            setDriverId={setSelectedDriverId}
            availableDrivers={availableDrivers}
          />
        )}
      </div>
    </div>
  )
}
