import { useState, useEffect } from 'react'
import axios from 'axios'
import { API_BASE } from '../config'
import type { TyreDegradationResponse, PitWindowResponse, RaceReplayResponse } from '../types/strategy'

export function useTyreDegradation(raceId: number | null) {
  const [data, setData]       = useState<TyreDegradationResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    if (!raceId) return
    setLoading(true)
    setError(null)
    axios.get<TyreDegradationResponse>(`${API_BASE}/strategy/tyre-degradation`, { params: { race_id: raceId } })
      .then((r) => setData(r.data))
      .catch((e) => setError(e.response?.data?.detail ?? e.message))
      .finally(() => setLoading(false))
  }, [raceId])

  return { data, loading, error }
}

export function usePitWindow(raceId: number | null, driverId: string, lap: number) {
  const [data, setData]       = useState<PitWindowResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    if (!raceId || !driverId || !lap) return
    setLoading(true)
    setError(null)
    axios.get<PitWindowResponse>(`${API_BASE}/strategy/pit-window`, {
      params: { race_id: raceId, driver_id: driverId, lap },
    })
      .then((r) => setData(r.data))
      .catch((e) => setError(e.response?.data?.detail ?? e.message))
      .finally(() => setLoading(false))
  }, [raceId, driverId, lap])

  return { data, loading, error }
}

export function useRaceReplay(raceId: number | null, driverId: string) {
  const [data, setData]       = useState<RaceReplayResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    if (!raceId || !driverId) return
    setLoading(true)
    setError(null)
    axios.get<RaceReplayResponse>(`${API_BASE}/strategy/race-replay`, {
      params: { race_id: raceId, driver_id: driverId },
    })
      .then((r) => setData(r.data))
      .catch((e) => setError(e.response?.data?.detail ?? e.message))
      .finally(() => setLoading(false))
  }, [raceId, driverId])

  return { data, loading, error }
}
