import { describe, expect, it } from 'vitest'
import { puzzles } from 'cubing/puzzles'
import {
  bestCross,
  crossFaceSpecs,
  crossProgress,
  faces,
  goalReached,
  initialPracticeState,
  practiceReducer,
  type Face,
  type PracticeState
} from './crossF2lPractice'

const opposite: Record<Face, Face> = { U: 'D', D: 'U', F: 'B', B: 'F', L: 'R', R: 'L' }
const patternAfter = async (alg: string) => (await puzzles['3x3x3'].kpuzzle()).defaultPattern().applyAlg(alg)

describe('cross face specs', () => {
  it('match the D-face slots the segmenter already uses', () => {
    expect(crossFaceSpecs.D.crossEdges).toEqual([4, 5, 6, 7])
    expect(crossFaceSpecs.D.slots).toEqual([
      { name: 'FR', corner: 4, edge: 8 },
      { name: 'FL', corner: 5, edge: 9 },
      { name: 'BL', corner: 6, edge: 11 },
      { name: 'BR', corner: 7, edge: 10 }
    ])
  })

  it('give every face four cross edges and four slots', () => {
    for (const face of faces) {
      expect(crossFaceSpecs[face].crossEdges).toHaveLength(4)
      expect(crossFaceSpecs[face].slots).toHaveLength(4)
    }
  })
})

describe('crossProgress', () => {
  it('reads a solved cube as cross and four pairs on every face', async () => {
    const progress = crossProgress(await patternAfter(''))!
    expect(progress.every((entry) => entry.cross && entry.slots.length === 4)).toBe(true)
  })

  it('leaves the cross only on the face opposite the one turned', async () => {
    for (const turned of faces) {
      const progress = crossProgress(await patternAfter(turned))!
      expect(progress.filter((entry) => entry.cross).map((entry) => entry.face), turned).toEqual([opposite[turned]])
    }
  })

  it('counts pairs on the cross face only', async () => {
    const afterInsert = await patternAfter("R U R'")
    const down = crossProgress(afterInsert)!.find((entry) => entry.face === 'D')!
    expect(down.cross).toBe(true)
    expect(down.slots).toEqual(['FL', 'BL', 'BR'])
  })

  it('is unaffected by slice turns that move the centres', async () => {
    const progress = crossProgress(await patternAfter("M M'"))!
    expect(progress.every((entry) => entry.cross)).toBe(true)
    const shifted = crossProgress(await patternAfter('M2 U2 M2 U M2 U2 M2'))!
    expect(shifted.find((entry) => entry.face === 'D')!.cross).toBe(true)
  })
})

describe('goalReached', () => {
  it('needs the requested number of pairs on one cross face', async () => {
    const pattern = await patternAfter("R U R'")
    expect(goalReached(pattern, { pairs: 3, face: 'D' })?.face).toBe('D')
    expect(goalReached(pattern, { pairs: 4, face: 'D' })).toBeUndefined()
  })

  it('honours a fixed cross face', async () => {
    const pattern = await patternAfter('R')
    expect(goalReached(pattern, { pairs: 0, face: 'L' })?.face).toBe('L')
    expect(goalReached(pattern, { pairs: 0, face: 'D' })).toBeUndefined()
    expect(goalReached(pattern, { pairs: 0, face: 'any' })?.face).toBe('L')
  })
})

describe('bestCross', () => {
  it('finds the shortest cross on the right face for every face', async () => {
    for (const turned of faces) {
      const pattern = await patternAfter(turned)
      expect((await bestCross(pattern, opposite[turned]))?.turns, `${turned} leaves ${opposite[turned]} done`).toBe(0)
      expect((await bestCross(pattern, turned))?.turns, `${turned} itself needs one turn back`).toBe(1)
    }
  })
})

describe('practiceReducer', () => {
  const move = (name: string, at: number) => ({ move: name, cube: at, wall: at })
  const solving = (state: PracticeState, name: string, at: number, reached?: Parameters<typeof practiceReducer>[1] extends infer E ? E extends { type: 'move'; reached: infer R } ? R : never : never) =>
    practiceReducer(state, { type: 'move', move: move(name, at), goal: { pairs: 1, face: 'any' }, reached })

  it('counts scramble turns, arms only after one, and refuses a goal that is already met', () => {
    expect(practiceReducer(initialPracticeState, { type: 'ready', wall: 1, alreadyMet: false }).phase).toBe('scrambling')
    const scrambled = solving(initialPracticeState, 'R', 10)
    expect(scrambled.scrambleTurns).toBe(1)
    expect(practiceReducer(scrambled, { type: 'ready', wall: 20, alreadyMet: true }).phase).toBe('scrambling')
    expect(practiceReducer(scrambled, { type: 'ready', wall: 20, alreadyMet: false }).phase).toBe('ready')
  })

  it('does not count a whole-cube rotation as a scramble turn', () => {
    expect(solving(initialPracticeState, 'y', 10).scrambleTurns).toBe(0)
  })

  it('starts the clock on the first move after ready and stops on the move that meets the goal', () => {
    let state = solving(initialPracticeState, 'R', 10)
    state = practiceReducer(state, { type: 'ready', wall: 1_000, alreadyMet: false })
    state = solving(state, 'U', 1_400)
    expect(state.phase).toBe('solving')
    state = solving(state, "R'", 2_100)
    expect(state.phase).toBe('solving')
    state = solving(state, 'F', 3_900, { face: 'D', cross: true, slots: ['FR'] })
    expect(state.phase).toBe('done')
    expect(state.result).toMatchObject({ durationMs: 2_500, recognitionMs: 400, turns: 3, face: 'D', slots: ['FR'], scrambleTurns: 1 })
  })

  it('finishes on the very first move when that move meets the goal', () => {
    let state = solving(initialPracticeState, 'R', 10)
    state = practiceReducer(state, { type: 'ready', wall: 100, alreadyMet: false })
    state = solving(state, "R'", 700, { face: 'D', cross: true, slots: [] })
    expect(state.phase).toBe('done')
    expect(state.result?.durationMs).toBe(0)
  })

  it('treats the next turn after a finished attempt as the start of the next scramble', () => {
    let state = solving(initialPracticeState, 'R', 10)
    state = practiceReducer(state, { type: 'ready', wall: 100, alreadyMet: false })
    state = solving(state, "R'", 700, { face: 'D', cross: true, slots: [] })
    state = solving(state, 'U', 5_000)
    expect(state).toMatchObject({ phase: 'scrambling', scrambleTurns: 1, solveMoves: [] })
  })

  it('returns from ready to scrambling without losing the scramble count', () => {
    let state = solving(initialPracticeState, 'R', 10)
    state = practiceReducer(state, { type: 'ready', wall: 100, alreadyMet: false })
    state = practiceReducer(state, { type: 'unready' })
    expect(state).toMatchObject({ phase: 'scrambling', scrambleTurns: 1 })
  })
})
