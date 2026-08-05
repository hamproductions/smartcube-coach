import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { MovesetMatcher, getInverseMove, trailingWholeCubeRotationMoveCount } from './movesetMatcher'
import { faceletsOf, solvedCube, turn } from './cubeMath'

type FixtureRecord = { scramble?: string; events: Array<{ event: { type: string; timestamp: number; [key: string]: unknown } }> }

function loadFixture(filename: string) {
  const path = join(__dirname, '..', 'device', 'fixtures', 'user-sessions', filename)
  const record = JSON.parse(readFileSync(path, 'utf8')) as FixtureRecord
  const moves = record.events
    .map((entry) => entry.event)
    .filter((event) => event.type === 'MOVE')
    .map((event) => event.move as string)
  return { scramble: record.scramble, moves }
}

const SCRAMBLE_FIXTURES = [
  'cube-session-QY-QYSC-S-23C0-2026-08-03T08-31-36.json',
  'cube-session-QY-QYSC-S-23C0-2026-08-03T08-43-11.json',
  'cube-session-QY-QYSC-S-23C0-2026-08-03T08-56-22.json',
  'cube-session-QY-QYSC-S-23C0-2026-08-03T09-56-18.json',
]

describe('trailingWholeCubeRotationMoveCount (ported from cubedex move-helpers.ts)', () => {
  it('counts trailing whole-cube rotations only', () => {
    expect(trailingWholeCubeRotationMoveCount(['R', 'U', 'y', "y'"])).toBe(2)
    expect(trailingWholeCubeRotationMoveCount(['R', 'U'])).toBe(0)
    expect(trailingWholeCubeRotationMoveCount(['y2', 'R'])).toBe(0)
  })
})

describe('getInverseMove (ported from cubedex move-helpers.ts)', () => {
  it('inverts quarter turns and slices', () => {
    expect(getInverseMove('R')).toBe("R'")
    expect(getInverseMove("U'")).toBe('U')
    expect(getInverseMove('M')).toBe("M'")
  })
})

describe('MovesetMatcher (ported from cubedex useTrainingState.ts handleSmartcubeMove)', () => {
  it('matches a clean synthetic move-for-move replay of the target and reports completion at the end', () => {
    const target = ['R', 'U', "R'", "U'"]
    const matcher = new MovesetMatcher(target)
    let cube = solvedCube()
    let lastResult
    for (const move of target) {
      cube = turn(cube, move)
      lastResult = matcher.advance(faceletsOf(cube), move)
    }
    expect(lastResult?.complete).toBe(true)
    expect(matcher.matchedIndex).toBe(target.length - 1)
  })

  it('tolerates a wrong move immediately undone (backing out of a mis-turn)', () => {
    const target = ['R', 'U']
    const matcher = new MovesetMatcher(target)
    let cube = solvedCube()

    cube = turn(cube, 'R')
    let result = matcher.advance(faceletsOf(cube), 'R')
    expect(result.matchedIndex).toBe(0)

    // Wrong move: turn R' (undoing the first move) instead of U.
    cube = turn(cube, "R'")
    result = matcher.advance(faceletsOf(cube), "R'")
    expect(result.matchedIndex).toBeNull()
    expect(result.badMoves).toEqual([])
    expect(matcher.matchedIndex).toBe(-1)

    // Recover: redo R then U.
    cube = turn(cube, 'R')
    result = matcher.advance(faceletsOf(cube), 'R')
    expect(result.matchedIndex).toBe(0)
    cube = turn(cube, 'U')
    result = matcher.advance(faceletsOf(cube), 'U')
    expect(result.complete).toBe(true)
  })

  it('tolerates a double turn played as two quarter turns (ETM split)', () => {
    const target = ['R2', 'U']
    const matcher = new MovesetMatcher(target)
    let cube = solvedCube()

    // Physical cube reports R2 as two quarter turns of R.
    cube = turn(cube, 'R')
    let result = matcher.advance(faceletsOf(cube), 'R')
    // Halfway through R2: no checkpoint matches yet (this is expected — a real UI would show
    // this as "in progress", not diverged, exactly as cubedex's badMoves-until-checkpoint model does).
    expect(result.matchedIndex).toBeNull()

    cube = turn(cube, 'R')
    result = matcher.advance(faceletsOf(cube), 'R')
    expect(result.matchedIndex).toBe(0)

    cube = turn(cube, 'U')
    result = matcher.advance(faceletsOf(cube), 'U')
    expect(result.complete).toBe(true)
  })

  it('recovers from a run of 4 identical stuck/bugged repeats instead of accumulating them forever', () => {
    const target = ['R', 'U']
    const matcher = new MovesetMatcher(target)
    // Feed 4 identical wrong moves (F) that never match any checkpoint.
    let cube = solvedCube()
    let lastResult
    for (let i = 0; i < 4; i += 1) {
      cube = turn(cube, 'F')
      lastResult = matcher.advance(faceletsOf(cube), 'F')
    }
    expect(lastResult?.matchedIndex).toBeNull()
    expect(matcher.pendingBadMoves.length).toBe(0)
  })

  for (const file of SCRAMBLE_FIXTURES) {
    it(`tracks progress against the real target scramble in ${file} without crashing`, () => {
      const { scramble, moves } = loadFixture(file)
      expect(scramble).toBeTruthy()
      const target = scramble!.split(/\s+/).filter(Boolean)
      const matcher = new MovesetMatcher(target)

      let cube = solvedCube()
      let reachedComplete = false
      let maxMatchedIndex = -1
      for (const move of moves) {
        cube = turn(cube, move)
        const result = matcher.advance(faceletsOf(cube), move)
        if (result.matchedIndex !== null) maxMatchedIndex = Math.max(maxMatchedIndex, result.matchedIndex)
        if (result.complete) reachedComplete = true
      }

      // The bar: it handles a real, noisy capture without throwing, and makes forward
      // progress against the target (never stuck permanently at -1).
      expect(maxMatchedIndex).toBeGreaterThanOrEqual(0)
      // eslint-disable-next-line no-console
      console.log(`[${file}] target length=${target.length} maxMatchedIndex=${maxMatchedIndex} reachedComplete=${reachedComplete}`)
    })
  }
})
