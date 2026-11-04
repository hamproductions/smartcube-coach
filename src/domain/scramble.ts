import { Alg } from 'cubing/alg'
import type { KPattern } from 'cubing/kpuzzle'
import { faceletsOf, solvedCube, turnAll } from './cubeMath'
import { puzzles } from 'cubing/puzzles'
import { reorientToSolvedCenters } from './lastLayer'

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
  const { randomScrambleForEvent } = await import('cubing/scramble')
  const scramble = await randomScrambleForEvent('333')
  return scramble.toString()
}

export async function evaluateScramble(target: string, actual: string): Promise<boolean> {
  const puzzle = await puzzles['3x3x3'].kpuzzle()
  const solved = puzzle.defaultPattern()
  return solved.applyAlg(target).isIdentical(solved.applyAlg(actual))
}


/**
 * How far along the scramble the CUBE is, judged from the state it reports rather than from
 * the moves the app believes were made.
 *
 * This is the honest answer to "am I on the scramble": the cube is at scramble position k if
 * its state is the state after the first k moves. Nothing about history matters — a solver
 * who turned three wrong moves and undid them is back at the same k, and a dropped Bluetooth
 * packet cannot make the app disagree with the cube in their hands.
 *
 * Whole-cube rotation is ignored: the solver may be holding the cube any way up. The longest
 * matching prefix wins, so a scramble that revisits an earlier state still reads forwards.
 * `undefined` means the cube is at no point of the scramble at all.
 */
export async function scramblePositionOfPattern(pattern: KPattern, targetMoves: string[]): Promise<number | undefined> {
  const puzzle = await puzzles['3x3x3'].kpuzzle()
  const upright = reorientToSolvedCenters(pattern) ?? pattern
  let walked = puzzle.defaultPattern()
  let matched = upright.isIdentical(walked) ? 0 : undefined

  for (const [index, move] of targetMoves.entries()) {
    walked = walked.applyAlg(new Alg(move))
    if (upright.isIdentical(walked)) matched = index + 1
  }

  return matched
}

/**
 * Where the cube sits relative to the scramble, and whether the solver is still following it.
 *
 * A half turn arrives as two quarter turns, so between them the cube is at no position of the
 * scramble at all — and calling that "off the scramble" would flash a mistake at a solver in
 * the middle of turning `R2` correctly. A cube part-way through the next move's own face is
 * following it. Anything else genuinely is off.
 */
export async function scramblePrefixStates(targetMoves: string[], start?: KPattern): Promise<KPattern[]> {
  const puzzle = await puzzles['3x3x3'].kpuzzle()
  const prefixes: KPattern[] = [start ?? puzzle.defaultPattern()]
  for (const move of targetMoves) {
    prefixes.push(prefixes[prefixes.length - 1].applyAlg(new Alg(move)))
  }
  return prefixes
}

export async function scrambleFollowState(pattern: KPattern, targetMoves: string[]): Promise<{ matched?: number; onTrack: boolean }> {
  return followScrambleWithPrefixes(pattern, await scramblePrefixStates(targetMoves), targetMoves)
}

/**
 * The same judgement with the scramble's states supplied. The prefixes depend only on the
 * scramble, so the caller builds them once per scramble rather than on every turn: the extra
 * await this removes from the per-move path was wide enough for a scramble arriving in
 * parallel to invalidate the move that would have verified the scramble.
 */
export function followScrambleWithPrefixes(pattern: KPattern, prefixes: KPattern[], targetMoves: string[]): { matched?: number; onTrack: boolean } {
  const upright = reorientToSolvedCenters(pattern) ?? pattern

  let matched: number | undefined
  for (const [index, prefix] of prefixes.entries()) {
    if (upright.isIdentical(prefix)) matched = index
  }
  if (matched !== undefined) return { matched, onTrack: true }

  // Part-way through the move that comes next: same face, fewer quarter turns than the
  // scramble asks for.
  for (const [index, move] of targetMoves.entries()) {
    const face = move[0]
    for (const suffix of ['', "'", '2']) {
      if (`${face}${suffix}` === move) continue
      if (upright.isIdentical(prefixes[index].applyAlg(new Alg(`${face}${suffix}`)))) {
        return { matched: index, onTrack: true }
      }
    }
  }

  return { matched: undefined, onTrack: false }
}

const quarterTurns = (move: string) => move.endsWith("2'") ? 2 : move.endsWith('2') ? 2 : move.endsWith("'") ? 3 : 1

/**
 * Progress toward the current target move as a running quarter-turn count on that move's
 * face, so a partial or over-turned double is progress rather than a mistake. A different
 * face is recorded as the latest deviation and cleared as soon as a later move matches the
 * still-current target face — this drives the "which move is next" HINT, and is deliberately
 * forgiving. It must never be used for progress or divergence: those come from
 * scramblePositionOfPattern, which asks where the cube IS, because forgiving a stray turn
 * here made the marker march through a scramble the solver was not performing.
 */
function faceProgress(targetMoves: string[], actualMoves: string[]) {
  let index = 0
  let accumulated = 0
  let mistake: string | undefined
  for (const move of actualMoves) {
    if (/^[xyz]/i.test(move)) continue
    const target = targetMoves[index]
    if (!target) break
    if (move[0] !== target[0]) {
      mistake = move
      continue
    }
    mistake = undefined
    accumulated += quarterTurns(move)
    if (accumulated % 4 === quarterTurns(target) % 4) {
      index += 1
      accumulated = 0
    }
  }
  return { index, mistake }
}

export function nextExpectedMove(targetMoves: string[], actualMoves: string[]) {
  const turns = actualMoves.filter((move) => !/^[xyz]/i.test(move))

  let complete = false
  try {
    const actualState = faceletsOf(turnAll(solvedCube(), turns))
    complete = faceletsOf(turnAll(solvedCube(), targetMoves)) === actualState
  } catch {
    complete = false
  }
  if (complete) return { index: targetMoves.length, expected: undefined, actual: undefined, complete: true }

  const { index, mistake } = faceProgress(targetMoves, actualMoves)
  return { index, expected: targetMoves[index], actual: mistake, complete: false }
}


export async function isSolvedPattern(pattern: KPattern) {
  const solved = (await puzzles['3x3x3'].kpuzzle()).defaultPattern()
  return (reorientToSolvedCenters(pattern) ?? pattern).isIdentical(solved)
}
