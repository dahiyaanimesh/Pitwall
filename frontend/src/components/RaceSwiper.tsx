import { useRef } from 'react'
import { shortName } from '../utils/formatters'
import { Swiper, SwiperSlide } from 'swiper/react'
import { Navigation } from 'swiper/modules'
import type { Swiper as SwiperType } from 'swiper'

interface Race {
  race_id: number
  round_number: number
  race_name: string
  [key: string]: any
}

interface Props {
  races: Race[]
  selectedId: number | null
  onSelect: (id: number) => void
  /** Optional extra badge per race (e.g. SC/VSC indicator) */
  badge?: (race: Race) => React.ReactNode
}


export default function RaceSwiper({ races, selectedId, onSelect, badge }: Props) {
  const swiperRef = useRef<SwiperType | null>(null)

  return (
    <div className="relative" style={{ marginBottom: 4 }}>
      {/* Prev arrow */}
      <button
        className="swiper-prev-btn absolute left-0 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center"
        style={{
          width: 24, height: 24, background: '#111111',
          border: '1px solid #2a2a2a', borderRadius: 4,
          color: '#9ca3af', fontSize: 12, cursor: 'pointer',
        }}
        onClick={() => swiperRef.current?.slidePrev()}
      >
        ‹
      </button>

      <div style={{ padding: '0 30px' }}>
        <Swiper
          modules={[Navigation]}
          slidesPerView="auto"
          spaceBetween={5}
          onSwiper={(s) => { swiperRef.current = s }}
          style={{ padding: '2px 0' }}
        >
          {races.map((race) => {
            const isActive = race.race_id === selectedId
            return (
              <SwiperSlide key={race.race_id} style={{ width: 'auto' }}>
                <button
                  onClick={() => onSelect(race.race_id)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '5px 10px',
                    borderRadius: 4,
                    border: `1px solid ${isActive ? '#E10600' : '#1f1f1f'}`,
                    background: isActive ? 'rgba(225,6,0,0.08)' : '#111111',
                    color: isActive ? '#ffffff' : '#9ca3af',
                    fontSize: 11,
                    fontFamily: '"JetBrains Mono", monospace',
                    fontWeight: isActive ? 700 : 400,
                    letterSpacing: '0.06em',
                    whiteSpace: 'nowrap',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span style={{ color: isActive ? '#E10600' : '#6b7280', fontSize: 10 }}>
                    R{String(race.round_number).padStart(2, '0')}
                  </span>
                  {shortName(race.race_name)}
                  {badge?.(race)}
                </button>
              </SwiperSlide>
            )
          })}
        </Swiper>
      </div>

      {/* Next arrow */}
      <button
        style={{
          position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)',
          zIndex: 10, width: 24, height: 24, background: '#111111',
          border: '1px solid #2a2a2a', borderRadius: 4,
          color: '#9ca3af', fontSize: 12, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
        onClick={() => swiperRef.current?.slideNext()}
      >
        ›
      </button>
    </div>
  )
}
