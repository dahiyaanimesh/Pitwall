import { useState, useEffect } from 'react'
import axios from 'axios'
import { API_BASE } from '../config'
import type {
  LapStatus,
  SafetyCarEvent,
  StatusSummary,
  RaceSeasonOverview,
} from '../types/weather'

export function useTrackStatus(raceId: number | null) {
  const [data, setData] = useState<LapStatus[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!raceId) return
    setLoading(true)
    setError(null)
    axios
      .get<LapStatus[]>(`${API_BASE}/weather/track-status`, { params: { race_id: raceId } })
      .then((r) => setData(r.data))
      .catch((e) => setError(e.response?.data?.detail ?? e.message))
      .finally(() => setLoading(false))
  }, [raceId])

  return { data, loading, error }
}

export function useSafetyCars(season: number) {
  const [data, setData] = useState<SafetyCarEvent[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    axios
      .get<SafetyCarEvent[]>(`${API_BASE}/weather/safety-cars`, { params: { season } })
      .then((r) => setData(r.data))
      .catch((e) => setError(e.response?.data?.detail ?? e.message))
      .finally(() => setLoading(false))
  }, [season])

  return { data, loading, error }
}

export function useStatusSummary(raceId: number | null) {
  const [data, setData] = useState<StatusSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!raceId) return
    setLoading(true)
    setError(null)
    axios
      .get<StatusSummary>(`${API_BASE}/weather/status-summary`, { params: { race_id: raceId } })
      .then((r) => setData(r.data))
      .catch((e) => setError(e.response?.data?.detail ?? e.message))
      .finally(() => setLoading(false))
  }, [raceId])

  return { data, loading, error }
}

export function useSeasonOverview(season: number) {
  const [data, setData] = useState<RaceSeasonOverview[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    axios
      .get<RaceSeasonOverview[]>(`${API_BASE}/weather/season-overview`, { params: { season } })
      .then((r) => setData(r.data))
      .catch((e) => setError(e.response?.data?.detail ?? e.message))
      .finally(() => setLoading(false))
  }, [season])

  return { data, loading, error }
}
