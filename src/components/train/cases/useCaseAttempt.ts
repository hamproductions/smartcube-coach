import { useCallback, useEffect, useRef, useState } from 'react'
import type { KPuzzle } from 'cubing/kpuzzle'
import type { AlgorithmRecord } from '../../../domain/models'
import { subscribeResolvedMoves } from '../../../device/CubeConnection'
import type { AttemptInput, FinishedAttempt } from './attempts'
import { matchesCase, reachesGoal, solverMove } from './caseState'

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

  const begin = useCallback((record: AlgorithmRecord, options: { cube: boolean; hintLevel?: number }) => {
    const previous = stateRef.current
    commit({
      record,
      round: (previous?.round ?? 0) + 1,
      phase: options.cube ? 'setup' : context.current.split ? 'recognize' : 'execute',
      input: options.cube ? 'smart-cube' : 'keyboard',
      startedAt: performance.now(),
      setupMoves: [],
      moves: [],
      hintLevel: options.hintLevel ?? 0
    })
  }, [commit])

  const skipSetup = useCallback(() => {
    const current = stateRef.current
    if (!current || current.phase !== 'setup') return
    commit({ ...current, phase: context.current.split ? 'recognize' : 'execute', startedAt: performance.now() })
  }, [commit])

  const restartSetup = useCallback(() => {
    const current = stateRef.current
    if (!current || current.phase !== 'setup') return
    commit({ ...current, setupMoves: [] })
  }, [commit])

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

  useEffect(() => subscribeResolvedMoves((resolved) => {
    const current = stateRef.current
    const { puzzle: activePuzzle, rotation: activeRotation, split: timed } = context.current
    if (!current || !activePuzzle || current.phase === 'done') return
    const at = performance.now()
    const turned = resolved.rawMoves.map((raw) => solverMove(raw.move, activeRotation))
    if (current.phase === 'setup') {
      const setupMoves = [...current.setupMoves, ...turned]
      if (matchesCase(activePuzzle, current.record, setupMoves)) commit({ ...current, setupMoves, phase: timed ? 'recognize' : 'execute', startedAt: at })
      else commit({ ...current, setupMoves })
      return
    }
    const moves = [...current.moves, ...turned]
    const next: AttemptState = {
      ...current,
      moves,
      phase: 'execute',
      input: 'smart-cube',
      recognizedAt: current.recognizedAt ?? (timed ? at : undefined)
    }
    if (reachesGoal(activePuzzle, current.record, moves)) complete(next, true, at, 'smart-cube')
    else commit(next)
  }), [commit, complete])

  return { state, begin, skipSetup, restartSetup, recognize, finish, hint, stop }
}
