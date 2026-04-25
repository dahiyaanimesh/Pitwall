import { useEffect, useRef } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import Lenis from 'lenis'
import { SeasonProvider } from './context/SeasonContext'
import Navbar from './components/Navbar'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import Drivers from './pages/Drivers'
import Races from './pages/Races'
import Predictions from './pages/Predictions'
import Strategy from './pages/Strategy'
import Weather from './pages/Weather'
import Tires from './pages/Tires'

const PAGE_TITLES: Record<string, string> = {
  '/':            'Dashboard',
  '/drivers':     'Drivers',
  '/races':       'Races',
  '/predictions': 'Predictions',
  '/strategy':    'Strategy',
  '/weather':     'Weather',
  '/tires':       'Tires',
}

const pageVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.22, ease: 'easeOut' as const } },
  exit:    { opacity: 0, y: -8,  transition: { duration: 0.15, ease: 'easeIn' as const } },
}

function AnimatedRoutes() {
  const location = useLocation()

  useEffect(() => {
    const label = PAGE_TITLES[location.pathname] ?? 'Pitwall'
    document.title = `${label} · Pitwall`
  }, [location.pathname])

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        style={{ height: '100%' }}
      >
        <Routes location={location}>
          <Route path="/"            element={<Dashboard />} />
          <Route path="/drivers"     element={<Drivers />} />
          <Route path="/races"       element={<Races />} />
          <Route path="/predictions" element={<Predictions />} />
          <Route path="/strategy"    element={<Strategy />} />
          <Route path="/weather"     element={<Weather />} />
          <Route path="/tires"       element={<Tires />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  )
}

export default function App() {
  const mainRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!mainRef.current) return
    const lenis = new Lenis({
      wrapper: mainRef.current,
      content: mainRef.current,
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    })

    let raf: number
    function loop(time: number) {
      lenis.raf(time)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      lenis.destroy()
    }
  }, [])

  return (
    <SeasonProvider>
      <div className="h-screen flex flex-col bg-f1dark text-white font-sans overflow-hidden">
        <Navbar />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <main
            ref={mainRef}
            className="flex-1 min-w-0 overflow-y-auto dot-grid p-6"
            style={{ background: '#0a0a0a' }}
          >
            <AnimatedRoutes />
          </main>
        </div>
      </div>
    </SeasonProvider>
  )
}
