import { useCallback, useEffect, useState } from 'react'
import { css } from 'styled-system/css'
import { Cube3D } from '../solve/Cube3D'
import { Button } from '../ui/Button'
import { viewRotationForHold } from '../../domain/cubeHold'
import { defaultPreferences, readPreferences } from '../../storage/preferences'
import { generateScramble } from '../../domain/scramble'
import {
  loadOrDeriveChecklist,
  persistChecklist,
  type ChecklistItem,
  type NotimerChecklistStore,
  type NotimerSolveModifier,
  type NotimerSolveRecord
} from '../../domain/ao1k/notimerChecklist'
import { NoTimeChecklist } from './NoTimeChecklist'

export type NotimerPracticeProps = {
  store: NotimerChecklistStore
}

async function createFreshSolve(store: NotimerChecklistStore, previousSequence: number): Promise<NotimerSolveRecord> {
  return {
    id: store.nextId(),
    sequence: previousSequence + 1,
    scramble: await generateScramble(),
    puzzleType: '3x3x3',
    solveDateTime: Date.now(),
    solveResult: 0,
    solveModifier: 'OK',
    comment: null
  }
}

export function NotimerPractice({ store }: NotimerPracticeProps) {
  const [solve, setSolve] = useState<NotimerSolveRecord>()
  const [checklist, setChecklist] = useState<ChecklistItem[]>([])
  const [modifier, setModifier] = useState<NotimerSolveModifier>('OK')
  const [isLoaded, setIsLoaded] = useState(false)
  const [rotation, setRotation] = useState(viewRotationForHold(defaultPreferences.diagramTopColor, defaultPreferences.diagramFrontColor))

  useEffect(() => {
    void readPreferences().then((prefs) => setRotation(viewRotationForHold(prefs.diagramTopColor, prefs.diagramFrontColor))).catch(() => undefined)
  }, [])

  useEffect(() => {
    let cancelled = false
    const mount = async () => {
      const lastSolve = await store.getLastSolve()
      const active = lastSolve ?? (await createFreshSolve(store, -1))
      const items = await loadOrDeriveChecklist(store, active.id)
      if (!lastSolve) await store.putSolve(active)
      if (cancelled) return
      setSolve(active)
      setModifier(active.solveModifier)
      setChecklist(items)
      setIsLoaded(true)
    }
    void mount()
    return () => {
      cancelled = true
    }
  }, [store])

  const commitCurrent = async (nextChecklist: ChecklistItem[]) => {
    if (!solve) return
    setChecklist(nextChecklist)
    await persistChecklist(store, solve.id, nextChecklist)
  }

  const goToNext = useCallback(async () => {
    if (!solve) return
    const existingNext = await store.getNextSolve(solve.sequence)
    const nextSolve = existingNext ?? (await createFreshSolve(store, solve.sequence))
    const items = await loadOrDeriveChecklist(store, nextSolve.id)
    if (!existingNext) await store.putSolve(nextSolve)
    setSolve(nextSolve)
    setModifier(nextSolve.solveModifier)
    setChecklist(items)
  }, [solve, store])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null
      if (target && /^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(target.tagName)) return
      if (event.code !== 'Space' && event.key !== 'Enter') return
      event.preventDefault()
      void goToNext()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goToNext])

  const goToPrevious = async () => {
    if (!solve) return
    const previous = await store.getPreviousSolve(solve.sequence)
    if (!previous) return
    const items = await loadOrDeriveChecklist(store, previous.id)
    setSolve(previous)
    setModifier(previous.solveModifier)
    setChecklist(items)
  }

  const updateModifier = async (next: NotimerSolveModifier) => {
    if (!solve) return
    const updated = { ...solve, solveModifier: next }
    setModifier(next)
    setSolve(updated)
    await store.putSolve(updated)
  }

  if (!isLoaded || !solve) return <p className={css({ color: 'inkVariant', fontSize: 'sm' })}>Loading your checklist…</p>

  return (
    <div className={css({ display: 'grid', gap: '8', gridTemplateColumns: { base: '1fr', lg: 'minmax(0, 1fr) minmax(0, 1.2fr) minmax(0, 1fr)' }, alignItems: 'start' })}>
      <NoTimeChecklist items={checklist} location="pre" onChange={commitCurrent} makeId={store.nextId} />

      <section aria-label="Solve" className={css({ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4', order: { base: '-1', lg: '0' } })}>
        <span className={css({ fontFamily: 'mono', fontSize: 'sm', color: 'inkVariant' })}>Solve {solve.sequence + 1}</span>
        <p aria-label="Scramble" className={css({ fontFamily: 'mono', fontSize: { base: '18px', md: '22px' }, lineHeight: '1.5', textAlign: 'center' })}>{solve.scramble}</p>
        <div className={css({ w: '14rem', h: '14rem' })}><Cube3D setupAlg={solve.scramble} viewRotation={rotation} /></div>
        <p className={css({ fontSize: 'sm', color: 'inkVariant', textAlign: 'center', maxW: '28rem' })}>Solve slowly with no timer. Tick the list before you start and after you finish.</p>
        <div role="group" aria-label="Result" className={css({ display: 'flex', gap: '2' })}>
          {(['OK', '+2', 'DNF'] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={modifier === option}
              onClick={() => updateModifier(option)}
              className={css({ px: '4', minH: '11', borderRadius: 'control', borderWidth: '1px', borderColor: 'floating', fontFamily: 'mono', fontSize: 'sm', color: 'inkVariant', cursor: 'pointer', _hover: { color: 'ink' }, '&[aria-pressed=true]': { bg: 'floating', color: 'ink', borderColor: 'green' }, _focusVisible: { outline: '2px solid', outlineColor: 'green' } })}
            >{option}</button>
          ))}
        </div>
        <div className={css({ display: 'flex', gap: '2' })}>
          <Button variant="outline" disabled={solve.sequence === 0} onClick={() => void goToPrevious()}>Previous solve</Button>
          <Button variant="solid" onClick={() => void goToNext()}>Next solve <kbd className={css({ fontFamily: 'mono', fontSize: 'xs', opacity: '0.7' })}>Space</kbd></Button>
        </div>
      </section>

      <NoTimeChecklist items={checklist} location="post" onChange={commitCurrent} makeId={store.nextId} />
    </div>
  )
}
