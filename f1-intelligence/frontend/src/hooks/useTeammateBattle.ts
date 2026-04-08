import { useState, useEffect } from 'react'
import axios from 'axios'
import type { TeammateStats } from '../types/f1'

import { API_BASE } from '../config'
const API = API_BASE

export function useTeammateBattle(season: number) {
  const [data, setData] = useState<TeammateStats[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    axios
      .get<TeammateStats[]>(`${API}/drivers/teammate-battle`, { params: { season } })
      .then((res) => setData(res.data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [season])

  return { data, loading, error }
}
