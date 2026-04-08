import { useState, useEffect } from 'react'
import axios from 'axios'
import { API_BASE } from '../config'
import type { DashboardSummary } from '../types/dashboard'

export function useDashboard(season: number) {
  const [data, setData]       = useState<DashboardSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    axios.get<DashboardSummary>(`${API_BASE}/dashboard/summary`, { params: { season } })
      .then((r) => setData(r.data))
      .catch((e) => setError(e.response?.data?.detail ?? e.message))
      .finally(() => setLoading(false))
  }, [season])

  return { data, loading, error }
}
