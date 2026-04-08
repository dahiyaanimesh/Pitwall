import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'

interface SeasonContextType {
  season: number
  setSeason: (s: number) => void
}

const SeasonContext = createContext<SeasonContextType>({
  season: 2021,
  setSeason: () => {},
})

export function SeasonProvider({ children }: { children: ReactNode }) {
  const [season, setSeason] = useState(2021)
  return (
    <SeasonContext.Provider value={{ season, setSeason }}>
      {children}
    </SeasonContext.Provider>
  )
}

export function useSeason() {
  return useContext(SeasonContext)
}

export const SEASONS = [2021, 2022, 2023, 2024]
