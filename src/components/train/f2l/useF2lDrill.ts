import { useCallback, useEffect, useRef, useState } from 'react'
import { Alg } from 'cubing/alg'
import type { KPattern, KPuzzle } from 'cubing/kpuzzle'
import { cube3x3x3, puzzles } from 'cubing/puzzles'
import { resetTrackedCubeToSolved, subscribeResolvedMoves, subscribeTrackerReset, trackedPattern } from '../../../device/CubeConnection'
import { advanceQueueIndex, createHintManager, isUMove, type DrillQueueState, type HintManager } from '../../../domain/drillEngine'
import { buildF2lCases } from '../../../domain/f2lCases'
import type { AlgorithmRecord, TrainerAttempt } from '../../../domain/models'
import { followScrambleWithPrefixes } from '../../../domain/scramble'
import { defaultAlgorithms, f2lCatalogueRecords, orderByCatalogue, updateMastery } from '../../../domain/training'
import { setCriticalActivity } from '../../../pwa/register'
import { repositories } from '../../../storage/database'
import { drillAttempt, type DrillResult } from './attempts'
import { f2lSolved, faceMoves, invertMove, solverPattern, toSolverMove, type Hold } from './frame'
import { buildPass, requeueFailed, type F2lOrder } from './queue'

export type DrillPhase = 'idle' | 'ready' | 'setup' | 'recognition' | 'execution' | 'gaveUp'

type Entry = { record: AlgorithmRecord; solved: boolean }

type Machine = {
  phase: DrillPhase
  record?: AlgorithmRecord
  pattern?: KPattern
  setup: string[]
  prefixes: KPattern[]
  progress: number
  offTrack?: string
  stray: string[]
  performed: string[]
  recognitionStartedAt: number
  executionStartedAt: number
  recognitionMs?: number
  hints: HintManager
  verdict?: DrillResult
  verdictVisible: boolean
  queue: DrillQueueState<Entry>
  session: DrillResult[]
}

const freshMachine = (): Machine => ({
  phase: 'idle',
  setup: [],
  prefixes: [],
  progress: 0,
  stray: [],
  performed: [],
  recognitionStartedAt: 0,
  executionStartedAt: 0,
  hints: createHintManager(),
  verdictVisible: false,
  queue: { queue: [], index: -1 },
  session: []
})

const simplified = (moves: string[]) => moves.length
  ? new Alg(moves.join(' ')).experimentalSimplify({ cancel: true, puzzleLoader: cube3x3x3 }).toString().replace(/2'/g, '2').split(/\s+/).filter(Boolean)
  : []

function divergence(performed: string[], algorithm: string) {
  const turned = simplified(performed).filter((move) => !isUMove(move))
  const expected = faceMoves(algorithm).filter((move) => !isUMove(move))
  let wrong = 0
  for (let index = 0; index < Math.max(turned.length, expected.length); index += 1) if (turned[index] !== expected[index]) wrong += 1
  return wrong
}

export function useF2lDrill({ selection, order, failedFirst, hold }: { selection: string[] | 'all'; order: F2lOrder; failedFirst: boolean; hold: Hold }) {
  const [records, setRecords] = useState<AlgorithmRecord[]>([])
  const [attempts, setAttempts] = useState<TrainerAttempt[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [, setVersion] = useState(0)
  const machine = useRef<Machine>(freshMachine())
  const puzzle = useRef<KPuzzle | undefined>(undefined)
  const pool = selection === 'all' ? records : records.filter((record) => selection.includes(record.id))
  const settings = useRef({ pool, order, failedFirst, hold, attempts })
  settings.current = { pool, order, failedFirst, hold, attempts }
  const refresh = useCallback(() => setVersion((version) => version + 1), [])

  useEffect(() => {
    let cancelled = false
    void puzzles['3x3x3'].kpuzzle().then((loaded) => { puzzle.current = loaded })
    void (async () => {
      const existing = await repositories.algorithms.all()
      const stored = new Set(existing.map((record) => record.id))
      const missing = defaultAlgorithms.filter((record) => record.set === 'F2L' && !stored.has(record.id)).map((record) => ({ ...record, dueAt: Date.now() }))
      await Promise.all(missing.map((record) => repositories.algorithms.put(record)))
      if (!existing.some((record) => record.id.startsWith('f2l-fr-'))) {
        const generated = f2lCatalogueRecords(await buildF2lCases(['FR', 'FL', 'BL', 'BR']))
        if (cancelled) return
        await Promise.all(generated.map((record) => repositories.algorithms.put(record)))
      }
      const all = orderByCatalogue(await repositories.algorithms.all()).filter((record) => record.set === 'F2L')
      const history = await repositories.attempts.all()
      if (cancelled) return
      setRecords(all)
      setAttempts(history)
    })()
      .catch(() => { if (!cancelled) setError('Could not build the F2L case library') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const persist = useCallback(async (result: DrillResult) => {
    const attempt = drillAttempt(result)
    const updated = updateMastery(result.record, result.outcome === 'success', result.totalMs)
    await repositories.attempts.put(attempt)
    await repositories.algorithms.put(updated)
    setAttempts((current) => [...current, attempt])
    setRecords((current) => current.map((record) => record.id === updated.id ? updated : record))
  }, [])

  const arm = (start: KPattern) => {
    const m = machine.current
    m.prefixes = [start]
    for (const move of m.setup) m.prefixes.push(m.prefixes[m.prefixes.length - 1].applyMove(move))
    m.phase = 'setup'
    m.progress = 0
    m.offTrack = undefined
    m.stray = []
  }

  const beginRecognition = () => {
    const m = machine.current
    m.phase = 'recognition'
    m.progress = m.setup.length
    m.offTrack = undefined
    m.stray = []
    m.performed = []
    m.recognitionStartedAt = performance.now()
    m.recognitionMs = undefined
  }

  const beginCase = (record: AlgorithmRecord | undefined, keepVerdict: boolean) => {
    const m = machine.current
    if (!record) {
      m.phase = 'idle'
      return
    }
    m.record = record
    m.setup = faceMoves(record.setup)
    m.performed = []
    m.recognitionMs = undefined
    m.hints = createHintManager()
    m.hints.initialize('step', false)
    m.verdictVisible = keepVerdict
    if (m.pattern && f2lSolved(m.pattern)) arm(m.pattern)
    else {
      m.phase = 'ready'
      m.prefixes = []
    }
  }

  const advance = () => {
    const m = machine.current
    m.queue = advanceQueueIndex(m.queue, () => {
      const { pool: currentPool, attempts: history, order: currentOrder } = settings.current
      return buildPass(currentPool, history, currentOrder).map((record) => ({ record, solved: false }))
    })
    return m.queue.queue[m.queue.index]?.record
  }

  const solve = () => {
    const m = machine.current
    if (!m.record) return
    const now = performance.now()
    const executionMs = m.phase === 'execution' ? now - m.executionStartedAt : 0
    const recognitionMs = m.recognitionMs ?? now - m.recognitionStartedAt
    const result: DrillResult = {
      record: m.record,
      outcome: 'success',
      recognitionMs,
      executionMs,
      totalMs: recognitionMs + executionMs,
      wrongMoves: divergence(m.performed, m.record.algorithm),
      hints: Math.max(0, m.hints.counter),
      startedAt: m.recognitionStartedAt,
      endedAt: now
    }
    const entry = m.queue.queue[m.queue.index]
    if (entry) entry.solved = true
    m.verdict = result
    m.session = [...m.session, result]
    void persist(result)
    beginCase(advance(), true)
  }

  const handle = (pattern: KPattern, moves: string[]) => {
    const m = machine.current
    m.pattern = pattern
    if (m.phase === 'ready') {
      const casePattern = m.prefixes[m.prefixes.length - 1]
      if (casePattern && m.prefixes.length > 1 && pattern.isIdentical(casePattern)) beginRecognition()
      else if (f2lSolved(pattern)) arm(pattern)
      return
    }
    if (m.phase === 'setup') {
      m.verdictVisible = false
      const followed = followScrambleWithPrefixes(pattern, m.prefixes, m.setup)
      if (followed.matched === m.setup.length) beginRecognition()
      else if (followed.onTrack) {
        m.progress = followed.matched ?? 0
        m.offTrack = undefined
        m.stray = []
      } else if (f2lSolved(pattern)) arm(pattern)
      else {
        m.stray = [...m.stray, ...moves]
        m.offTrack = invertMove(moves[moves.length - 1] ?? '')
      }
      return
    }
    if (m.phase === 'gaveUp') {
      m.performed = [...m.performed, ...moves]
      return
    }
    if (m.phase !== 'recognition' && m.phase !== 'execution') return
    for (const move of moves) {
      m.performed = [...m.performed, move]
      if (m.phase === 'recognition' && !isUMove(move)) {
        const now = performance.now()
        m.recognitionMs = now - m.recognitionStartedAt
        m.executionStartedAt = now
        m.phase = 'execution'
      }
    }
    if (f2lSolved(pattern)) solve()
  }

  const handleRef = useRef(handle)
  handleRef.current = handle

  useEffect(() => subscribeResolvedMoves((resolved) => {
    const loaded = puzzle.current
    if (!loaded || machine.current.phase === 'idle') return
    const { rotation } = settings.current.hold
    handleRef.current(solverPattern(loaded, resolved.pattern, rotation), resolved.rawMoves.map((raw) => toSolverMove(raw.move, rotation)))
    refresh()
  }), [refresh])

  const armRef = useRef(arm)
  armRef.current = arm

  useEffect(() => subscribeTrackerReset(() => {
    const m = machine.current
    const solved = puzzle.current?.defaultPattern()
    if (!solved) return
    m.pattern = solved
    if (m.phase === 'ready' || m.phase === 'setup') armRef.current(solved)
    refresh()
  }), [refresh])

  const active = machine.current.phase !== 'idle'
  useEffect(() => {
    if (!active) return
    setCriticalActivity(true)
    return () => setCriticalActivity(false)
  }, [active])

  const start = () => {
    const loaded = puzzle.current
    const m = machine.current
    const { pool: currentPool, attempts: history, order: currentOrder, hold: currentHold } = settings.current
    if (!loaded || !currentPool.length) return
    const tracked = trackedPattern()
    m.pattern = tracked ? solverPattern(loaded, tracked, currentHold.rotation) : loaded.defaultPattern()
    m.queue = { queue: buildPass(currentPool, history, currentOrder).map((record) => ({ record, solved: false })), index: 0 }
    m.session = []
    m.verdict = undefined
    beginCase(m.queue.queue[0]?.record, false)
    refresh()
  }

  const stop = () => {
    machine.current.phase = 'idle'
    refresh()
  }

  const next = () => {
    beginCase(advance(), false)
    refresh()
  }

  const giveUp = () => {
    const m = machine.current
    if (!m.record || (m.phase !== 'recognition' && m.phase !== 'execution')) return
    const now = performance.now()
    const result: DrillResult = {
      record: m.record,
      outcome: 'give-up',
      recognitionMs: m.recognitionMs,
      totalMs: now - m.recognitionStartedAt,
      wrongMoves: 0,
      hints: Math.max(0, m.hints.counter),
      startedAt: m.recognitionStartedAt,
      endedAt: now
    }
    m.session = [...m.session, result]
    void persist(result)
    if (settings.current.failedFirst) m.queue = { ...m.queue, queue: requeueFailed(m.queue.queue, m.queue.index, { record: m.record, solved: false }) }
    m.phase = 'gaveUp'
    m.performed = []
    refresh()
  }

  const retry = () => {
    const m = machine.current
    const record = m.record
    if (!record) return
    const previous = m.prefixes
    beginCase(record, false)
    if (m.phase === 'ready' && previous.length > 1) {
      m.prefixes = previous
      if (m.pattern?.isIdentical(previous[previous.length - 1])) beginRecognition()
    }
    refresh()
  }

  const revealHint = () => {
    const m = machine.current
    if (!m.record) return
    m.hints.revealHint('step', m.record.algorithm, false)
    refresh()
  }

  const dismissVerdict = () => {
    machine.current.verdictVisible = false
    refresh()
  }

  const resetTracking = () => {
    void resetTrackedCubeToSolved()
  }

  const m = machine.current
  return {
    records,
    pool,
    attempts,
    loading,
    error,
    phase: m.phase,
    record: m.record,
    setup: m.setup,
    progress: m.progress,
    offTrack: m.offTrack,
    stray: m.stray,
    performed: m.performed,
    recognitionStartedAt: m.recognitionStartedAt,
    executionStartedAt: m.executionStartedAt,
    recognitionMs: m.recognitionMs,
    hint: m.record ? m.hints.getDisplayedAlgorithm('step', m.record.algorithm) : '',
    hintsLeft: m.record ? m.hints.counter < m.record.algorithm.split(' ').filter(Boolean).length : false,
    verdict: m.verdict,
    verdictVisible: m.verdictVisible && Boolean(m.verdict),
    session: m.session,
    start,
    stop,
    next,
    giveUp,
    retry,
    revealHint,
    dismissVerdict,
    resetTracking
  }
}

export type F2lDrill = ReturnType<typeof useF2lDrill>
