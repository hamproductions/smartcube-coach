import { useCallback, useEffect, useRef, useState } from 'react'
import type { KPattern, KPuzzle } from 'cubing/kpuzzle'
import { Alg } from 'cubing/alg'
import type { AlgorithmRecord } from '../../../domain/models'
import { subscribeResolvedMoves, subscribeTrackerReset, trackedPattern } from '../../../device/CubeConnection'
import type { AttemptInput, FinishedAttempt } from './attempts'
import { matchesCase, reachesGoal, routeToCase, solverMove, toHoldFrame } from './caseState'

export type AttemptPhase = 'setup' | 'recognize' | 'execute' | 'done'

export type AttemptState = {
  record: AlgorithmRecord
  round: number
  phase: AttemptPhase
  input: AttemptInput
  startedAt: number
  recognizedAt?: number
  endedAt?: number
  success?: boolean
  setupMoves: string[]
  /** Turns still needed to reach the case from where the cube is now; undefined while it is being worked out. */
  setupRoute?: string[]
  /** When the case became ready to solve; recognition runs from here to the first turn. */
  readyAt?: number
  moves: string[]
  hintLevel: number
}

type Options = {
  puzzle: KPuzzle | undefined
  rotation: string
  split: boolean
  onDone: (state: AttemptState, result: FinishedAttempt) => void
}

export function useCaseAttempt({ puzzle, rotation, split, onDone }: Options) {
  const [state, setState] = useState<AttemptState>()
  const stateRef = useRef<AttemptState | undefined>(undefined)
  const context = useRef({ puzzle, rotation, split, onDone })
  context.current = { puzzle, rotation, split, onDone }
  const live = useRef<KPattern | undefined>(undefined)
  const routing = useRef(0)

  const readLive = useCallback(() => {
    const { puzzle: activePuzzle, rotation: activeRotation } = context.current
    const physical = trackedPattern()
    if (!activePuzzle || !physical) return undefined
    try { return toHoldFrame(activePuzzle, physical, activeRotation) } catch { return undefined }
  }, [])

  const commit = useCallback((next: AttemptState | undefined) => {
    stateRef.current = next
    setState(next)
  }, [])

  const complete = useCallback((current: AttemptState, success: boolean, endedAt: number, input: AttemptInput) => {
    const next: AttemptState = { ...current, phase: 'done', success, endedAt, input }
    commit(next)
    context.current.onDone(next, {
      input,
      startedAt: next.startedAt,
      recognizedAt: next.recognizedAt,
      endedAt,
      success,
      moves: next.moves,
      hintLevel: next.hintLevel
    })
  }, [commit])

  const reroute = useCallback((current: AttemptState) => {
    const { puzzle: activePuzzle } = context.current
    const from = live.current
    if (!activePuzzle || !from) return
    const ticket = ++routing.current
    void routeToCase(activePuzzle, current.record, from).then((route) => {
      const latest = stateRef.current
      if (ticket !== routing.current || !latest || latest.round !== current.round || latest.phase !== 'setup') return
      if (route.length === 0) commit({ ...latest, setupRoute: [], phase: 'recognize', startedAt: performance.now(), readyAt: performance.now() })
      else commit({ ...latest, setupRoute: route })
    }).catch(() => undefined)
  }, [commit])

  const begin = useCallback((record: AlgorithmRecord, options: { cube: boolean; hintLevel?: number }) => {
    const previous = stateRef.current
    if (options.cube) live.current = readLive() ?? live.current
    const now = performance.now()
    const next: AttemptState = {
      record,
      round: (previous?.round ?? 0) + 1,
      phase: options.cube ? 'setup' : context.current.split ? 'recognize' : 'execute',
      input: options.cube ? 'smart-cube' : 'keyboard',
      startedAt: now,
      readyAt: options.cube ? undefined : now,
      setupMoves: [],
      moves: [],
      hintLevel: options.hintLevel ?? 0
    }
    commit(next)
    if (options.cube) reroute(next)
  }, [commit, readLive, reroute])

  const skipSetup = useCallback(() => {
    const current = stateRef.current
    if (!current || current.phase !== 'setup') return
    commit({ ...current, phase: context.current.split ? 'recognize' : 'execute', startedAt: performance.now(), readyAt: performance.now() })
  }, [commit])

  const restartSetup = useCallback(() => {
    const current = stateRef.current
    if (!current || current.phase !== 'setup') return
    live.current = readLive() ?? live.current
    const next = { ...current, setupMoves: [], setupRoute: undefined }
    commit(next)
    reroute(next)
  }, [commit, readLive, reroute])

  const recognize = useCallback(() => {
    const current = stateRef.current
    if (!current || current.phase !== 'recognize') return
    commit({ ...current, phase: 'execute', recognizedAt: performance.now() })
  }, [commit])

  const finish = useCallback((success: boolean) => {
    const current = stateRef.current
    if (!current || current.phase === 'done' || current.phase === 'setup') return
    const endedAt = performance.now()
    const withRecognition = success && current.phase === 'recognize' && context.current.split ? { ...current, recognizedAt: endedAt } : current
    complete(withRecognition, success, endedAt, current.moves.length ? 'smart-cube' : 'keyboard')
  }, [complete])

  const hint = useCallback(() => {
    const current = stateRef.current
    if (!current || current.phase === 'done') return
    commit({ ...current, hintLevel: Math.min(3, current.hintLevel + 1) })
  }, [commit])

  const stop = useCallback(() => commit(undefined), [commit])

  useEffect(() => subscribeTrackerReset(() => { live.current = readLive() }), [readLive])

  useEffect(() => subscribeResolvedMoves((resolved) => {
    const current = stateRef.current
    const { puzzle: activePuzzle, rotation: activeRotation, split: timed } = context.current
    const turned = resolved.rawMoves.map((raw) => solverMove(raw.move, activeRotation))
    if (live.current && turned.length) {
      try { live.current = live.current.applyAlg(new Alg(turned.join(' '))) } catch { live.current = readLive() }
    }
    if (!current || !activePuzzle || current.phase === 'done') return
    const at = performance.now()
    if (current.phase === 'setup') {
      const setupMoves = [...current.setupMoves, ...turned]
      const from = live.current
      if (from && matchesCase(activePuzzle, current.record, [], from)) {
        routing.current += 1
        commit({ ...current, setupMoves, setupRoute: [], phase: timed ? 'recognize' : 'execute', startedAt: at, readyAt: at })
        return
      }
      const route = current.setupRoute
      const single = turned.length === 1 ? turned[0] : undefined
      if (route?.length && single && route[0] === single) {
        commit({ ...current, setupMoves, setupRoute: route.slice(1) })
        return
      }
      if (route?.length && single && /2$/.test(route[0]) && route[0][0] === single[0]) {
        commit({ ...current, setupMoves, setupRoute: [route[0][0] + (single.endsWith("'") ? "'" : ''), ...route.slice(1)] })
        return
      }
      const next = { ...current, setupMoves, setupRoute: undefined }
      commit(next)
      reroute(next)
      return
    }
    const moves = [...current.moves, ...turned]
    const next: AttemptState = {
      ...current,
      moves,
      phase: 'execute',
      input: 'smart-cube',
      recognizedAt: current.recognizedAt ?? at,
      readyAt: current.readyAt ?? current.startedAt
    }
    if (reachesGoal(activePuzzle, current.record, moves)) complete(next, true, at, 'smart-cube')
    else commit(next)
  }), [commit, complete, readLive, reroute])

  return { state, begin, skipSetup, restartSetup, recognize, finish, hint, stop }
}
