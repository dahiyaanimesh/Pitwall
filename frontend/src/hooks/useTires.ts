import { useState, useEffect } from 'react'
import axios from 'axios'
import { API_BASE } from '../config'
import type {
  StintSummaryResponse,
  CompoundUsageResponse,
  StrategyClustersResponse,
  CompoundPerformance,
  DriverRaceStrategy,
} from '../types/tires'

export function useStintSummary(raceId: number | null) {
  const [data, setData]       = useState<StintSummaryResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    if (!raceId) return
    setLoading(true)
    setError(null)
    axios
      .get<StintSummaryResponse>(`${API_BASE}/tires/stint-summary`, { params: { race_id: raceId } })
      .then((r) => setData(r.data))
      .catch((e) => setError(e.response?.data?.detail ?? e.message))
      .finally(() => setLoading(false))
  }, [raceId])

  return { data, loading, error }
}

export function useCompoundUsage(season: number) {
  const [data, setData]       = useState<CompoundUsageResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    axios
      .get<CompoundUsageResponse>(`${API_BASE}/tires/compound-usage`, { params: { season } })
      .then((r) => setData(r.data))
      .catch((e) => setError(e.response?.data?.detail ?? e.message))
      .finally(() => setLoading(false))
  }, [season])

  return { data, loading, error }
}

export function useStrategyClusters(season: number) {
  const [data, setData]       = useState<StrategyClustersResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    axios
      .get<StrategyClustersResponse>(`${API_BASE}/tires/strategy-clusters`, { params: { season } })
      .then((r) => setData(r.data))
      .catch((e) => setError(e.response?.data?.detail ?? e.message))
      .finally(() => setLoading(false))
  }, [season])

  return { data, loading, error }
}

export function useCompoundPerformance(season: number) {
  const [data, setData]       = useState<CompoundPerformance[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    axios
      .get<CompoundPerformance[]>(`${API_BASE}/tires/compound-performance`, { params: { season } })
      .then((r) => setData(r.data))
      .catch((e) => setError(e.response?.data?.detail ?? e.message))
      .finally(() => setLoading(false))
  }, [season])

  return { data, loading, error }
}

export function useDriverStrategy(season: number, driverId: string | null) {
  const [data, setData]       = useState<DriverRaceStrategy[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    if (!driverId) return
    setLoading(true)
    setError(null)
    axios
      .get<DriverRaceStrategy[]>(`${API_BASE}/tires/driver-strategy`, {
        params: { season, driver_id: driverId },
      })
      .then((r) => setData(r.data))
      .catch((e) => setError(e.response?.data?.detail ?? e.message))
      .finally(() => setLoading(false))
  }, [season, driverId])

  return { data, loading, error }
}
