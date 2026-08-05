import { Alg } from 'cubing/alg'
import { puzzles } from 'cubing/puzzles'
import { framePattern } from './crossSolver'
import { optimalCrossPlusPairSolution, type PairSlot } from './pairSolver'
import type { SolveRecord, StageRecord } from './models'

export type PairRedo = {
  slot: PairSlot
  setup: string
  yours: string
  optimal: string
  yourMoves: number
  optimalMoves: number
  saved: number
}

export async function buildPairRedo(solve: Pick<SolveRecord, 'scramble' | 'moves'>, stage: StageRecord): Promise<PairRedo | undefined> {
  if (!stage.slot) return undefined
  const puzzle = await puzzles['3x3x3'].kpuzzle()
  const before = solve.moves.slice(0, stage.startEvent)
  const yours = solve.moves.slice(stage.startEvent, stage.endEvent + 1)
  const setup = [solve.scramble, ...before].filter(Boolean).join(' ')
  const entry = puzzle.defaultPattern().applyAlg(new Alg(setup))
  const rotations = yours.filter((move) => /^[xyz]/i.test(move))
  const solution = await optimalCrossPlusPairSolution(await framePattern(entry, stage.frame ?? '', rotations), stage.slot)
  if (!solution || solution.length === 0) return undefined

  const yourTurns = yours.filter((move) => !/^[xyz]/i.test(move)).length
  return {
    slot: stage.slot,
    setup,
    yours: yours.join(' '),
    optimal: solution.moves.join(' '),
    yourMoves: yourTurns,
    optimalMoves: solution.length,
    saved: Math.max(0, yourTurns - solution.length)
  }
}
