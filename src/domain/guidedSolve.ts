import { Alg } from 'cubing/alg'
import { puzzles } from 'cubing/puzzles'
import { experimentalSolve3x3x3IgnoringCenters, setSearchDebug } from 'cubing/search'

setSearchDebug({ prioritizeEsbuildWorkaroundForWorkerInstantiation: true, logPerf: false })

export function normalizeSolutionMoves(solution: string) {
  const normalized = new Alg(solution).toString().trim()
  return normalized ? normalized.split(/\s+/) : []
}

export function guidedMove(moves: string[], index: number) {
  const move = moves[index]
  return { move, remaining: Math.max(0, moves.length - index), complete: move === undefined }
}

export async function solveGuidedPosition(scramble: string, observedMoves: string[]) {
  const puzzle = await puzzles['3x3x3'].kpuzzle()
  const pattern = puzzle.defaultPattern().applyAlg(scramble).applyAlg(observedMoves.join(' '))
  return normalizeSolutionMoves((await experimentalSolve3x3x3IgnoringCenters(pattern)).toString())
}

export function warmGuidanceSolver() {
  return solveGuidedPosition('', [])
}

export async function areAlgsEquivalent(left: string, right: string) {
  const puzzle = await puzzles['3x3x3'].kpuzzle()
  const leftTransformation = puzzle.defaultPattern().applyAlg(left).experimentalToTransformation()
  const rightTransformation = puzzle.defaultPattern().applyAlg(right).experimentalToTransformation()
  return leftTransformation !== null && rightTransformation !== null && leftTransformation.isIdentical(rightTransformation)
}
