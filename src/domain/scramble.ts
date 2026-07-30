import { Alg } from 'cubing/alg'
import { puzzles } from 'cubing/puzzles'

const axes = [
  ['U', 'D'],
  ['L', 'R'],
  ['F', 'B']
] as const
const suffixes = ['', "'", '2'] as const

function randomIndex(length: number) {
  const values = new Uint32Array(1)
  crypto.getRandomValues(values)
  return values[0] % length
}

export async function generateScramble(): Promise<string> {
  const moves: string[] = []
  let previousAxis = -1
  for (let index = 0; index < 25; index += 1) {
    const availableAxes = [0, 1, 2].filter((axis) => axis !== previousAxis)
    const axis = availableAxes[randomIndex(availableAxes.length)]
    const face = axes[axis][randomIndex(2)]
    moves.push(`${face}${suffixes[randomIndex(suffixes.length)]}`)
    previousAxis = axis
  }
  return moves.join(' ')
}

export async function evaluateScramble(target: string, actual: string): Promise<boolean> {
  const puzzle = await puzzles['3x3x3'].kpuzzle()
  const solved = puzzle.defaultPattern()
  return solved.applyAlg(target).isIdentical(solved.applyAlg(actual))
}

export function generateCorrection(target: string, actual: string): string {
  return `${new Alg(actual).invert()} ${target}`.trim()
}

export function nextExpectedMove(targetMoves: string[], actualMoves: string[]) {
  const mismatch = actualMoves.findIndex((move, index) => move !== targetMoves[index])
  const index = mismatch === -1 ? actualMoves.length : mismatch
  return {
    index,
    expected: targetMoves[index],
    actual: mismatch === -1 ? undefined : actualMoves[mismatch],
    complete: index >= targetMoves.length && mismatch === -1
  }
}
