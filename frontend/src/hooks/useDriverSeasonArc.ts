import { useState, useEffect } from 'react'
import axios from 'axios'
import type { SeasonArcResponse } from '../types/f1'

import { API_BASE } from '../config'
const API = API_BASE

export function useDriverSeasonArc(driverId: string | null, season: number) {
  const [data, setData] = useState<SeasonArcResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!driverId) return
    setLoading(true)
    setError(null)
    axios
      .get<SeasonArcResponse>(`${API}/drivers/${driverId}/season-arc`, {
        params: { season },
      })
      .then((res) => setData(res.data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [driverId, season])

  return { data, loading, error }
}
