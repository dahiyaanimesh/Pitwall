import { useState, useEffect } from 'react'
import axios from 'axios'
import type { Driver } from '../types/f1'

import { API_BASE } from '../config'
const API = API_BASE

export function useDrivers(season: number) {
  const [data, setData] = useState<Driver[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    axios
      .get<Driver[]>(`${API}/drivers`, { params: { season } })
      .then((res) => setData(res.data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [season])

  return { data, loading, error }
}
