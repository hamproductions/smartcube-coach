import { Alg } from 'cubing/alg'
import { puzzles } from 'cubing/puzzles'
import { randomScrambleForEvent } from 'cubing/scramble'

export async function generateScramble(): Promise<string> {
  return (await randomScrambleForEvent('333')).toString()
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
