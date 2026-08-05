/**
 * Ported from Ao1K/Ao1K_site (https://github.com/Ao1K/Ao1K_site).
 * Source: app/notimer/page.tsx (mountCards, addOrUpdateSolve, createCardData,
 * handleScrollDown/Up, saveLatestChecks, addLatestSolve, getOriginalSolveID).
 *
 * MIT License
 * Copyright (c) 2025 Ao1K
 *
 * Adaptation notes: the original is an infinite-scroll stack of solve
 * "cards" the user snaps between (app/notimer/page.tsx: solveCards,
 * handleScroll, shiftActiveCardToLower/Upper). This project has no
 * equivalent scroll-carousel primitive and the task asked specifically
 * for the checklist model and its persistence shape, not the scroll
 * shell, so this port keeps the same one-active-solve state machine
 * (current solve inherits the previous solve's checklist unchecked,
 * checklist commits persist per solve, a new solve gets a fresh
 * scramble) behind plain Prev/Next controls instead of scroll snapping.
 * `randomScrambleForEvent` (Ao1K's scramble source) is replaced with
 * this project's own `generateScramble()` (src/domain/scramble.ts),
 * which already wraps the same `cubing/scramble` call.
 *
 * This component takes a NotimerChecklistStore (see
 * src/domain/ao1k/notimerChecklist.ts) from its caller — it has no
 * default because persisting practice solves needs new IndexedDB
 * object stores this module does not own (see the storage-need comment
 * in notimerChecklist.ts).
 */
import { useEffect, useState } from 'react'
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

  useEffect(() => {
    let cancelled = false
    const mount = async () => {
      const lastSolve = await store.getLastSolve()
      const active = lastSolve ?? (await createFreshSolve(store, -1))
      // derive before persisting a freshly-created solve, so getLastSolve()
      // inside loadOrDeriveChecklist still resolves to the true previous solve
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

  const goToNext = async () => {
    if (!solve) return
    const existingNext = await store.getNextSolve(solve.sequence)
    const nextSolve = existingNext ?? (await createFreshSolve(store, solve.sequence))
    // derive before persisting a freshly-created solve, so getLastSolve()
    // inside loadOrDeriveChecklist still resolves to the true previous solve
    const items = await loadOrDeriveChecklist(store, nextSolve.id)
    if (!existingNext) await store.putSolve(nextSolve)
    setSolve(nextSolve)
    setModifier(nextSolve.solveModifier)
    setChecklist(items)
  }

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

  if (!isLoaded || !solve) return <div className="ao1k-notimer-practice">Loading practice session…</div>

  return (
    <div className="ao1k-notimer-practice">
      <NoTimeChecklist items={checklist} location="pre" onChange={commitCurrent} makeId={store.nextId} />

      <div className="ao1k-notimer-practice__scramble">{solve.scramble}</div>

      <NoTimeChecklist items={checklist} location="post" onChange={commitCurrent} makeId={store.nextId} />

      <div className="ao1k-notimer-practice__modifier">
        {(['OK', '+2', 'DNF'] as const).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={modifier === option}
            onClick={() => updateModifier(option)}
          >
            {option}
          </button>
        ))}
      </div>

      <div className="ao1k-notimer-practice__nav">
        <button type="button" onClick={() => void goToPrevious()}>
          ← Previous solve
        </button>
        <button type="button" onClick={() => void goToNext()}>
          Next solve →
        </button>
      </div>
    </div>
  )
}
