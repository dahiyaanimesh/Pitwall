import { useState, useEffect } from 'react'
import axios from 'axios'
import type { PaceProfileResponse } from '../types/f1'

import { API_BASE } from '../config'
const API = API_BASE

export function usePaceProfile(driverId: string | null, season: number) {
  const [data, setData] = useState<PaceProfileResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!driverId) return
    setLoading(true)
    setError(null)
    axios
      .get<PaceProfileResponse>(`${API}/drivers/${driverId}/pace-profile`, {
        params: { season },
      })
      .then((res) => setData(res.data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [driverId, season])

  return { data, loading, error }
}
