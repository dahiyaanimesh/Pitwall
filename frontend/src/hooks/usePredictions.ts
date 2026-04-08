import { useState, useEffect } from 'react'
import axios from 'axios'
import { API_BASE } from '../config'
import type { RacePredictionResponse, AccuracyResponse } from '../types/predictions'

export function useRacePrediction(season: number, round: number | null) {
  const [data, setData] = useState<RacePredictionResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!round) return
    setLoading(true)
    setError(null)
    axios
      .get<RacePredictionResponse>(`${API_BASE}/predictions/race`, {
        params: { season, round },
      })
      .then((r) => setData(r.data))
      .catch((e) => setError(e.response?.data?.detail ?? e.message))
      .finally(() => setLoading(false))
  }, [season, round])

  return { data, loading, error }
}

export function useModelAccuracy(season: number) {
  const [data, setData] = useState<AccuracyResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    axios
      .get<AccuracyResponse>(`${API_BASE}/predictions/accuracy`, {
        params: { season },
      })
      .then((r) => setData(r.data))
      .catch((e) => setError(e.response?.data?.detail ?? e.message))
      .finally(() => setLoading(false))
  }, [season])

  return { data, loading, error }
}
