import { useEffect, useState } from 'react'
import { repairSolveTimestamps } from './storage/repairTimestamps'
import { reanalyseStoredSolves } from './storage/reanalyseSolves'
import { announceSolveUpdated } from './device/recordCapture'
import { HistoryRoute } from './components/history/HistoryRoute'
import { SettingsHub } from './components/settings/SettingsHub'
import { StudyLibrary } from './components/study/StudyLibrary'
import { SolveRoute } from './components/solve/SolveRoute'
import { LibraryPage } from './components/library/LibraryPage'
import { TrainerHub } from './components/TrainerHub'
import { CrossF2lPractice } from './components/practice/CrossF2lPractice'
import { createNotimerChecklistStore } from './storage/notimerStore'
import { ErrorBoundary } from './components/ui/ErrorBoundary'
import { IC } from './components/ui/Icon'
import { AppShell } from './components/shell/AppShell'
import { CubeConnectionIndicator, CubeConnectionProvider } from './device/CubeConnection'
// panda.css owns the cascade order and pulls in the legacy sheet as a layer.
import './panda.css'

// 'Library' exists because LibraryPage was imported and never rendered, which left
// Reconstruct, Study, Pace, Checklist and the cube-colour settings unreachable in the
// shipped app — built, tested, and invisible to the user.
const navItems: Array<{ label: string; icon: string | readonly string[] }> = [
  { label: 'Playground', icon: IC.live },
  { label: 'Practice', icon: IC.play },
  { label: 'Training', icon: IC.train },
  { label: 'Statistics', icon: IC.solves },
  { label: 'Library', icon: IC.solves },
  { label: 'Study', icon: IC.solves },
  { label: 'Settings', icon: IC.solves },
]

const notimerStore = createNotimerChecklistStore()

function Shell() {
  const [activeNav, setActiveNav] = useState('Playground')

  // Solves recorded before the wall-clock fix are dated to 1970; rebase them once on load so
  // the history stops showing an epoch date.
  useEffect(() => { void repairSolveTimestamps().catch(() => undefined) }, [])

  // Stages were analysed once, when the solve was recorded, so every solve older than the
  // current analyser is missing what it has learned since — the shorter insert's moves, the
  // better pair, the F2L case. Re-run the analysis on those; recorded timings are kept.
  useEffect(() => {
    void reanalyseStoredSolves()
      .then((updated) => { for (const solve of updated) announceSolveUpdated(solve) })
      .catch(() => undefined)
  }, [])
  const [drillFocus, setDrillFocus] = useState<string>()

  return (
    <AppShell
      navItems={navItems}
      activeNav={activeNav}
      onNavigate={(label) => setActiveNav(label as typeof activeNav)}
      // The status slot was never passed, so PwaStatus and the connection indicator were
      // imported but never rendered — a user could never apply a service-worker update.
      // Only cube state belongs in the header. Storage quota and the persistent-storage
      // request are Settings concerns, not something to carry on every screen.
      status={<CubeConnectionIndicator />}
    >
      <ErrorBoundary surface={activeNav} key={activeNav}>
        {activeNav === 'Playground' && <SolveRoute onOpenStatistics={() => setActiveNav('Statistics')} />}
        {activeNav === 'Statistics' && <HistoryRoute onDrill={() => { setDrillFocus('pair-tracking'); setActiveNav('Training') }} />}
        {activeNav === 'Practice' && <CrossF2lPractice />}
        {activeNav === 'Training' && <TrainerHub focusPanel={drillFocus} />}
        {activeNav === 'Library' && <LibraryPage notimerStore={notimerStore} />}
        {activeNav === 'Study' && <StudyLibrary />}
        {activeNav === 'Settings' && <SettingsHub />}
      </ErrorBoundary>
    </AppShell>
  )
}

function App() {
  return (
    <CubeConnectionProvider>
      <Shell />
    </CubeConnectionProvider>
  )
}

export default App
