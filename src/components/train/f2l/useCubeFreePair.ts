import { useEffect, useRef, useState } from 'react'
import { Alg } from 'cubing/alg'
import type { KPattern, KPuzzle } from 'cubing/kpuzzle'
import { puzzles } from 'cubing/puzzles'
import { subscribeResolvedMoves, trackedPattern } from '../../../device/CubeConnection'
import type { FreePairPrompt } from '../../../domain/freePair'
import { reorientToSolvedCenters } from '../../../domain/lastLayer'
import { getScrambleToSolution } from '../../../domain/cubedex/scramble'
import { faceTurns, solverMove, toHoldFrame } from '../cases/caseState'

const HOLD = 'z2'

export type CubeFreePairState = { phase: 'routing' | 'setup' | 'answer'; route?: string[]; turned: number; offOptions: boolean }

const upright = (pattern: KPattern) => reorientToSolvedCenters(pattern) ?? pattern

export function useCubeFreePair(prompt: FreePairPrompt | undefined, enabled: boolean, answered: boolean, onPick: (index: number) => void) {
  const [state, setState] = useState<CubeFreePairState>({ phase: 'routing', turned: 0, offOptions: false })
  const puzzle = useRef<KPuzzle | undefined>(undefined)
  const live = useRef<KPattern | undefined>(undefined)
  const target = useRef<KPattern | undefined>(undefined)
  const finals = useRef<KPattern[]>([])
  const phase = useRef<CubeFreePairState['phase']>('routing')
  const turned = useRef(0)
  const pick = useRef(onPick)
  pick.current = onPick

  useEffect(() => {
    if (!enabled || !prompt) return
    let cancelled = false
    phase.current = 'routing'
    turned.current = 0
    setState({ phase: 'routing', turned: 0, offOptions: false })
    void (async () => {
      const loaded = puzzle.current ?? await puzzles['3x3x3'].kpuzzle()
      puzzle.current = loaded
      const physical = trackedPattern()
      if (!physical || cancelled) return
      live.current = toHoldFrame(loaded, physical, HOLD)
      target.current = upright(loaded.defaultPattern().applyAlg(new Alg(prompt.setup.replace(/[()]/g, ' '))))
      finals.current = prompt.options.map((option) => upright(target.current!.applyAlg(new Alg(option.replace(/[()]/g, ' ')))))
      if (upright(live.current).isIdentical(target.current)) {
        phase.current = 'answer'
        setState({ phase: 'answer', route: [], turned: 0, offOptions: false })
        return
      }
      const route = faceTurns((await getScrambleToSolution(new Alg(prompt.setup.replace(/[()]/g, ' ')).invert().toString(), live.current)).toString())
      if (cancelled) return
      phase.current = 'setup'
      setState({ phase: 'setup', route, turned: 0, offOptions: false })
    })().catch(() => undefined)
    return () => { cancelled = true }
  }, [prompt, enabled])

  const answeredRef = useRef(answered)
  answeredRef.current = answered

  useEffect(() => {
    if (!enabled) return
    return subscribeResolvedMoves((resolved) => {
      if (!live.current || !target.current) return
      const moves = resolved.rawMoves.map((raw) => solverMove(raw.move, HOLD))
      try { live.current = live.current.applyAlg(new Alg(moves.join(' '))) } catch { return }
      const now = upright(live.current)
      if (phase.current === 'setup') {
        if (now.isIdentical(target.current)) {
          phase.current = 'answer'
          turned.current = 0
          setState({ phase: 'answer', route: [], turned: 0, offOptions: false })
        } else {
          setState((current) => {
            const route = current.route ?? []
            const single = moves.length === 1 ? moves[0] : undefined
            if (single && route[0] === single) return { ...current, route: route.slice(1) }
            if (single && route[0] && /2$/.test(route[0]) && route[0][0] === single[0]) return { ...current, route: [route[0][0] + (single.endsWith("'") ? "'" : ''), ...route.slice(1)] }
            return { ...current, route: [...moves.map((move) => new Alg(move).invert().toString()).reverse(), ...route] }
          })
        }
        return
      }
      if (phase.current !== 'answer' || answeredRef.current) return
      turned.current += moves.length
      const index = finals.current.findIndex((final) => final.isIdentical(now))
      if (index >= 0) pick.current(index)
      else setState((current) => ({ ...current, turned: turned.current, offOptions: turned.current > 14 }))
    })
  }, [enabled])

  return state
}
