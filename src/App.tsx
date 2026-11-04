import { useEffect } from 'react'
import { repairSolveTimestamps } from './storage/repairTimestamps'
import { reanalyseStoredSolves } from './storage/reanalyseSolves'
import { announceSolveUpdated } from './device/recordCapture'
import { HistoryRoute } from './components/history/HistoryRoute'
import { SettingsHub } from './components/settings/SettingsHub'
import { StudyPage } from './components/study/StudyPage'
import { SolveRoute } from './components/solve/SolveRoute'
import { TRAINER_VIEWS } from './components/train/views'
import { ErrorBoundary } from './components/ui/ErrorBoundary'
import { AppShell } from './components/shell/AppShell'
import { TrainHub } from './components/train/TrainHub'
import { TrainerPage } from './components/train/TrainerPage'
import { trainerById } from './components/train/trainers'
import { navigate, useRoute } from './app/route'
import { CubeConnectionIndicator, CubeConnectionProvider } from './device/CubeConnection'
import './panda.css'

function Trainer({ id }: { id: string }) {
  const View = TRAINER_VIEWS[id]
  return View ? <View /> : null
}

function Shell() {
  const route = useRoute()

  useEffect(() => { void repairSolveTimestamps().catch(() => undefined) }, [])
  useEffect(() => {
    void reanalyseStoredSolves()
      .then((updated) => { for (const solve of updated) announceSolveUpdated(solve) })
      .catch(() => undefined)
  }, [])

  const trainer = route.section === 'train' ? trainerById(route.detail) : undefined

  return (
    <AppShell active={route.section} status={<CubeConnectionIndicator />}>
      <ErrorBoundary surface={`${route.section}/${route.detail ?? ''}`} key={`${route.section}/${route.detail ?? ''}`}>
        {route.section === 'solve' && <SolveRoute onOpenStatistics={() => navigate({ section: 'stats' })} />}
        {route.section === 'stats' && <HistoryRoute onDrill={() => navigate({ section: 'train', detail: 'pair-tracking' })} />}
        {route.section === 'train' && (trainer ? <TrainerPage trainer={trainer}><Trainer id={trainer.id} /></TrainerPage> : <TrainHub />)}
        {route.section === 'study' && <StudyPage tab={route.detail} />}
        {route.section === 'settings' && <SettingsHub />}
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
