import { useState, useEffect } from 'react'
import axios from 'axios'
import { API_BASE } from '../config'
import { useSeason } from '../context/SeasonContext'
import LoadingSpinner from '../components/LoadingSpinner'
import ErrorMessage from '../components/ErrorMessage'
import RacePredictionTab from '../components/predictions/RacePredictionTab'
import ModelAccuracyTab from '../components/predictions/ModelAccuracyTab'

const TABS = [
  { id: 'race',     label: 'Race Prediction' },
  { id: 'accuracy', label: 'Model Accuracy' },
] as const
type TabId = typeof TABS[number]['id']

interface RaceMeta {
  round_number: number
  race_name: string
  race_date: string | null
}

export default function Predictions() {
  const { season }                = useSeason()
  const [activeTab, setActiveTab] = useState<TabId>('race')
  const [races, setRaces]         = useState<RaceMeta[]>([])
  const [racesLoading, setRacesLoading] = useState(true)
  const [racesError, setRacesError]     = useState<string | null>(null)
  const [modelsReady, setModelsReady]   = useState<boolean | null>(null)

  // Load race list + check model status
  useEffect(() => {
    setRacesLoading(true)
    Promise.all([
      axios.get<RaceMeta[]>(`${API_BASE}/races`, { params: { season } }),
      axios.get(`${API_BASE}/predictions`),
    ])
      .then(([racesRes, statusRes]) => {
        setRaces(racesRes.data)
        setModelsReady(statusRes.data.status === 'ready')
      })
      .catch((e) => setRacesError(e.message))
      .finally(() => setRacesLoading(false))
  }, [season])

  return (
    <div className="space-y-5 pb-10 animate-fade-in">
      {/* Header */}
      <div style={{ borderBottom: '1px solid #1a1a1a', paddingBottom: 16 }}>
        <div className="flex items-center gap-2 mb-1">
          <span style={{ color: '#E10600', fontSize: 10 }}>◆</span>
          <span className="font-mono uppercase" style={{ fontSize: 10, letterSpacing: '0.2em', color: '#d1d5db' }}>PREDICTIONS</span>
        </div>
        <div style={{ height: 1, background: '#1a1a1a', marginBottom: 8, maxWidth: 40 }} />
        <p className="font-mono uppercase" style={{ fontSize: 10, letterSpacing: '0.18em', color: '#d1d5db', marginBottom: 4 }}>
          RACE PREDICTIONS · XGBoost MODEL
        </p>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)' }}>What the model sees before lights out.</p>
      </div>

      {/* Model status */}
      {modelsReady === false && (
        <div className="rounded px-4 py-3 text-sm flex items-start gap-2.5"
          style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
          <span className="text-telemetry-amber font-bold">⚠</span>
          <span className="text-white/60 text-[12px]">
            Models not trained — run: <code className="font-mono text-telemetry-amber/80">python backend/ml/train.py --season {season}</code>
          </span>
        </div>
      )}
      {modelsReady === true && (
        <div className="rounded px-4 py-2.5 flex items-center gap-2.5"
          style={{ background: 'rgba(34,211,165,0.06)', border: '1px solid rgba(34,211,165,0.18)' }}>
          <span className="w-2 h-2 rounded-full bg-telemetry-green flex-shrink-0 animate-pulse-soft" />
          <span className="text-telemetry-green text-[12px] font-semibold">Models ready</span>
          <span className="text-f1muted text-[11px]">— RandomForest regressor + classifier · trained on R1–R17</span>
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
                style={{ color: isActive ? '#E10600' : '#6b7280' }}
              >
                {tab.label}
                {isActive && <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-f1red" />}
              </button>
            )
          })}
        </div>
      </div>

      {/* Content */}
      <div className="min-h-[400px]">
        {racesLoading ? (
          <LoadingSpinner />
        ) : racesError ? (
          <ErrorMessage message={racesError} />
        ) : modelsReady === false ? (
          <div className="text-center py-16 text-f1muted text-sm">Train the models first to see predictions.</div>
        ) : (
          <>
            {activeTab === 'race'     && <RacePredictionTab season={season} races={races} />}
            {activeTab === 'accuracy' && <ModelAccuracyTab  season={season} />}
          </>
        )}
      </div>
    </div>
  )
}
