import { useCallback, useRef, useState } from 'react'
import { Alg } from 'cubing/alg'
import type { KPattern } from 'cubing/kpuzzle'
import { puzzles } from 'cubing/puzzles'
import { trackedPattern } from '../../device/CubeConnection'
import { followScrambleWithPrefixes, generateScramble, isSolvedPattern, scramblePrefixStates } from '../../domain/scramble'
import { getScrambleToSolution } from '../../domain/cubedex/scramble'

export type RoutedScramble = { moves: string[]; done: number; offTrack: boolean; complete: boolean }

const tokens = (alg: string) => alg.trim().split(/\s+/).filter(Boolean)

export function useRoutedScramble() {
  const [scramble, setScramble] = useState<RoutedScramble | null>(null)
  const plan = useRef<{ moves: string[]; prefixes: KPattern[]; done: number } | null>(null)
  const request = useRef(0)

  const generate = useCallback(async () => {
    const id = ++request.current
    setScramble(null)
    plan.current = null
    const start = trackedPattern() ?? (await puzzles['3x3x3'].kpuzzle()).defaultPattern()
    const target = await generateScramble()
    const route = (await isSolvedPattern(start)) ? target : await getScrambleToSolution(new Alg(target).invert().toString(), start)
    const moves = tokens(route)
    const prefixes = await scramblePrefixStates(moves, start)
    if (id !== request.current) return
    plan.current = { moves, prefixes, done: 0 }
    setScramble({ moves, done: 0, offTrack: false, complete: moves.length === 0 })
  }, [])

  const follow = useCallback((pattern: KPattern) => {
    const current = plan.current
    if (!current) return undefined
    const result = followScrambleWithPrefixes(pattern, current.prefixes, current.moves)
    if (result.matched !== undefined) current.done = result.matched
    const next: RoutedScramble = {
      moves: current.moves,
      done: current.done,
      offTrack: !result.onTrack,
      complete: result.matched === current.moves.length
    }
    setScramble(next)
    return next
  }, [])

  const clear = useCallback(() => {
    request.current += 1
    plan.current = null
    setScramble(null)
  }, [])

  return { scramble, generate, follow, clear }
}
