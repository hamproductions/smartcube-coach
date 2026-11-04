import { useEffect, useState } from 'react'
import { css } from 'styled-system/css'
import { CoachingHistory } from './CoachingHistory'
import { SolveAnalysis } from '../solve/SolveAnalysis'
import { repositories } from '../../storage/database'
import { subscribeSolveSaved } from '../../device/recordCapture'
import { navigate, routeHref, useRoute } from '../../app/route'
import { Icon, IC } from '../ui/Icon'
import { pageFrameRaw } from '../ui/Page'
import type { SolveRecord, StageRecord } from '../../domain/models'

export function HistoryRoute() {
  const route = useRoute()
  const openId = route.section === 'stats' ? route.detail : undefined
  const [solves, setSolves] = useState<SolveRecord[]>()
  const [stages, setStages] = useState<StageRecord[]>([])
  const [reload, setReload] = useState(0)
  const [storageError, setStorageError] = useState<string>()

  useEffect(() => subscribeSolveSaved(() => setReload((count) => count + 1)), [])
  useEffect(() => {
    void Promise.all([repositories.solves.all(), repositories.stages.all()])
      .then(([allSolves, allStages]) => {
        setSolves(allSolves)
        setStages(allStages)
        setStorageError(undefined)
      })
      .catch((reason: unknown) => {
        setStorageError(reason instanceof Error ? reason.message : 'storage could not be opened')
        setSolves([])
      })
  }, [reload])

  if (!solves) return null

  if (storageError) {
    return (
      <div className={css(pageFrameRaw, { gap: '4' })}>
        <h1 className={css({ fontSize: { base: 'xl', md: '2xl' }, fontWeight: 'semibold' })}>Stats</h1>
        <p role="alert" className={css({ color: 'error' })}>Local storage is unavailable ({storageError}), so your solves could not be read. Nothing shown here is a real record. Close other tabs of this app and reload.</p>
      </div>
    )
  }

  const open = openId ? solves.find((record) => record.id === openId) : undefined

  if (openId) {
    return (
      <div className={css(pageFrameRaw, { position: 'relative', gap: { base: '4', md: '6' } })}>
        <h1 className={css({ srOnly: true })}>Solve breakdown</h1>
        <a href={routeHref({ section: 'stats' })} className={css({ display: 'inline-flex', alignItems: 'center', gap: '1', alignSelf: 'flex-start', minH: '44px', color: 'inkVariant', fontSize: 'sm', textDecoration: 'none', _hover: { color: 'ink' }, _focusVisible: { outline: '2px solid', outlineColor: 'green' } })}>
          <Icon d={IC.back} size={14} /> Stats
        </a>
        {open ? (
          <SolveAnalysis
            solve={open}
            stages={stages.filter((stage) => stage.solveId === open.id).sort((left, right) => left.startEvent - right.startEvent)}
            history={stages}
            onDeleted={() => { setReload((count) => count + 1); navigate({ section: 'stats' }) }}
            penalty={open.penalty === '+2' ? 'plus_two' : open.penalty === 'dnf' ? 'dnf' : 'none'}
            onPenalty={(next) => {
              const penalty = next === 'plus_two' ? '+2' : next === 'dnf' ? 'dnf' : 'none'
              void repositories.solves.put({ ...open, penalty } as SolveRecord).then(() => {
                setSolves((current) => current?.map((record) => record.id === open.id ? { ...record, penalty } as SolveRecord : record))
              })
            }}
          />
        ) : (
          <p className={css({ color: 'inkVariant' })}>That solve is not in your history. It may have been removed.</p>
        )}
      </div>
    )
  }

  return <CoachingHistory solves={solves} stages={stages} onOpenSolve={(id) => navigate({ section: 'stats', detail: id })} />
}
