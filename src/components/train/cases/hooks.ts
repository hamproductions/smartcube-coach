import { useCallback, useEffect, useRef, useState } from 'react'
import type { KPuzzle } from 'cubing/kpuzzle'
import { puzzles } from 'cubing/puzzles'
import type { AlgorithmRecord, TrainerAttempt } from '../../../domain/models'
import { buildF2lCases } from '../../../domain/f2lCases'
import { cmllCases, collCases, eollCases, toAlgorithmRecord } from '../../../domain/algorithmCatalogue'
import { f2lCatalogueRecords, orderByCatalogue, planDefaultAlgorithmSync } from '../../../domain/training'
import { viewRotationForHold } from '../../../domain/cubeHold'
import { repositories } from '../../../storage/database'
import { defaultPreferences, readPreferences } from '../../../storage/preferences'
import { cubedexIdPrefix, cubedexRecords, isCubedexExtraSet, type CaseSet } from './catalogue'

async function seedMissing(prefix: string, build: () => AlgorithmRecord[] | Promise<AlgorithmRecord[]>) {
  const existing = await repositories.algorithms.all()
  if (existing.some((record) => record.id.startsWith(prefix))) return false
  const generated = await build()
  await Promise.all(generated.map((record) => repositories.algorithms.put(record)))
  return true
}

export function useCaseLibrary(set: CaseSet | undefined) {
  const [algorithms, setAlgorithms] = useState<AlgorithmRecord[]>([])
  const [attempts, setAttempts] = useState<TrainerAttempt[]>([])
  const [loaded, setLoaded] = useState(false)
  const [building, setBuilding] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const existing = await repositories.algorithms.all()
      const { missing, superseded } = planDefaultAlgorithmSync(existing)
      await Promise.all(missing.map(repositories.algorithms.put))
      await Promise.all(superseded.map(repositories.algorithms.remove))
      await seedMissing('eoll-', () => eollCases.map((entry) => toAlgorithmRecord(entry)))
      await seedMissing('coll-', () => collCases.map((entry) => toAlgorithmRecord(entry)))
      await seedMissing('cmll-', () => cmllCases.map((entry) => toAlgorithmRecord(entry)))
      const [stored, storedAttempts] = await Promise.all([repositories.algorithms.all(), repositories.attempts.all()])
      if (cancelled) return
      setAlgorithms(orderByCatalogue(stored))
      setAttempts(storedAttempts)
      setLoaded(true)
    })().catch((reason: unknown) => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : 'Local storage could not be opened')
    })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!loaded || !set) return
    const job = set === 'F2L'
      ? { prefix: 'f2l-fr-', build: async () => f2lCatalogueRecords(await buildF2lCases(['FR', 'FL', 'BL', 'BR'])) }
      : isCubedexExtraSet(set) ? { prefix: cubedexIdPrefix(set), build: () => cubedexRecords(set) } : undefined
    if (!job) return
    let cancelled = false
    setBuilding(set)
    void (async () => {
      const added = await seedMissing(job.prefix, job.build)
      if (added && !cancelled) setAlgorithms(orderByCatalogue(await repositories.algorithms.all()))
    })()
      .catch(() => { if (!cancelled) setError(`The ${set} cases could not be built`) })
      .finally(() => { if (!cancelled) setBuilding('') })
    return () => { cancelled = true }
  }, [loaded, set])

  const saveAlgorithms = useCallback(async (updated: AlgorithmRecord[]) => {
    await Promise.all(updated.map((record) => repositories.algorithms.put(record)))
    const byId = new Map(updated.map((record) => [record.id, record]))
    setAlgorithms((current) => {
      const known = new Set(current.map((record) => record.id))
      return [...current.map((record) => byId.get(record.id) ?? record), ...updated.filter((record) => !known.has(record.id))]
    })
  }, [])

  const saveAttempt = useCallback(async (attempt: TrainerAttempt) => {
    await repositories.attempts.put(attempt)
    setAttempts((current) => [...current, attempt])
  }, [])

  return { algorithms, attempts, loaded, building, error, saveAlgorithms, saveAttempt }
}

export function useRemembered<T extends object>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(fallback)
  const [ready, setReady] = useState(false)
  const latest = useRef(value)

  useEffect(() => {
    let cancelled = false
    void repositories.settings.get(key)
      .then((record) => {
        if (cancelled) return
        if (record && typeof record.value === 'object' && record.value) {
          const next = { ...fallback, ...(record.value as Partial<T>) }
          latest.current = next
          setValue(next)
        }
      })
      .catch(() => undefined)
      .finally(() => { if (!cancelled) setReady(true) })
    return () => { cancelled = true }
  }, [key])

  const update = useCallback((patch: Partial<T> | ((current: T) => Partial<T>)) => {
    const next = { ...latest.current, ...(typeof patch === 'function' ? patch(latest.current) : patch) }
    latest.current = next
    setValue(next)
    void repositories.settings.put({ key, value: next }).catch(() => undefined)
  }, [key])

  return [value, update, ready] as const
}

export function usePuzzle() {
  const [puzzle, setPuzzle] = useState<KPuzzle>()
  useEffect(() => {
    let cancelled = false
    void puzzles['3x3x3'].kpuzzle().then((loaded) => { if (!cancelled) setPuzzle(loaded) })
    return () => { cancelled = true }
  }, [])
  return puzzle
}

export function useHoldRotation() {
  const [rotation, setRotation] = useState(() => viewRotationForHold(defaultPreferences.diagramTopColor, defaultPreferences.diagramFrontColor))
  useEffect(() => {
    let cancelled = false
    void readPreferences()
      .then((prefs) => { if (!cancelled) setRotation(viewRotationForHold(prefs.diagramTopColor, prefs.diagramFrontColor)) })
      .catch(() => undefined)
    return () => { cancelled = true }
  }, [])
  return rotation
}

export function useNow(running: boolean) {
  const [now, setNow] = useState(() => performance.now())
  useEffect(() => {
    if (!running) return
    let frame = 0
    const tick = () => {
      setNow(performance.now())
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [running])
  return now
}

export function useWide(query = '(min-width: 768px)') {
  const read = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(query).matches
  const [wide, setWide] = useState(read)
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const list = window.matchMedia(query)
    const onChange = () => setWide(list.matches)
    list.addEventListener('change', onChange)
    return () => list.removeEventListener('change', onChange)
  }, [query])
  return wide
}

const typingTarget = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))

export function useKeys(handler: (key: string) => boolean | void, active = true) {
  const latest = useRef(handler)
  latest.current = handler
  useEffect(() => {
    if (!active) return
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || event.metaKey || event.ctrlKey || event.altKey) return
      if (typingTarget(event.target)) return
      if (document.querySelector('[role=dialog]')) return
      const key = event.key === ' ' ? 'Space' : event.key
      if (latest.current(key) === true) event.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active])
}

export const seconds = (ms: number | undefined) => ms === undefined ? '' : (ms / 1000).toFixed(2)
