import { Routes, Route } from 'react-router-dom'
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

export default function App() {
  return (
    <SeasonProvider>
      <div className="h-screen flex flex-col bg-f1dark text-white font-sans overflow-hidden">
        <Navbar />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <main
            className="flex-1 min-w-0 overflow-y-auto dot-grid p-6"
            style={{ background: '#0a0a0a' }}
          >
            <Routes>
              <Route path="/"            element={<Dashboard />} />
              <Route path="/drivers"     element={<Drivers />} />
              <Route path="/races"       element={<Races />} />
              <Route path="/predictions" element={<Predictions />} />
              <Route path="/strategy"    element={<Strategy />} />
              <Route path="/weather"     element={<Weather />} />
              <Route path="/tires"       element={<Tires />} />
            </Routes>
          </main>
        </div>
      </div>
    </SeasonProvider>
  )
}
