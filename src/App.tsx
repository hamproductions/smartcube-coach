import { useState } from 'react'
import { HistoryProgress } from './components/HistoryProgress'
import { LiveSolve } from './components/LiveSolve'
import { PwaStatus } from './components/PwaStatus'
import { ReconstructEditor } from './components/ReconstructEditor'
import { RecoStudy } from './components/RecoStudy'
import { TodayDashboard } from './components/TodayDashboard'
import { TrainerHub } from './components/TrainerHub'
import './styles.css'

const navItems = [
  ['01', 'Today'],
  ['02', 'Live Solve'],
  ['03', 'Solves'],
  ['04', 'Train'],
  ['05', 'Library'],
  ['06', 'Progress']
]

function App() {
  const [activeNav, setActiveNav] = useState('Today')

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#top" aria-label="Smart Cube Coach home" onClick={() => setActiveNav('Today')}>
          <span className="brand-mark">SC</span>
          <span>SMART CUBE COACH</span>
        </a>
        <nav aria-label="Primary navigation">
          {navItems.map(([index, label]) => (
            <button
              className={activeNav === label ? 'nav-item active' : 'nav-item'}
              key={label}
              onClick={() => setActiveNav(label)}
            >
              <span>{index}</span>
              {label}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <PwaStatus />
        </div>
      </aside>

      <main id="top">
        <header className="topbar">
          <div>
            <span className="eyebrow">{activeNav.toUpperCase()} / LOCAL-FIRST COACH</span>
            <h1>{activeNav === 'Today' ? 'Your actual data.' : activeNav}</h1>
          </div>
          <div className="device-cluster">
            <div className="device-copy">
              <span className="connection-pulse" />
              <div>
                <strong>Local storage</strong>
                <small>No account · no seeded solves</small>
              </div>
            </div>
            <button className="button primary" onClick={() => setActiveNav('Live Solve')}>Start solve</button>
          </div>
        </header>

        {activeNav === 'Today' && <TodayDashboard onNavigate={setActiveNav} />}
        {activeNav === 'Live Solve' && <LiveSolve />}
        {activeNav === 'Solves' && <HistoryProgress />}
        {activeNav === 'Train' && <TrainerHub />}
        {activeNav === 'Library' && <><ReconstructEditor /><RecoStudy /></>}
        {activeNav === 'Progress' && <HistoryProgress />}
      </main>
    </div>
  )
}

export default App
