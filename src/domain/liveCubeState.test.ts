import { describe, expect, it } from 'vitest'
import { applyFaceletMoves, solvedFacelets } from './faceletReconciliation'
import { LiveCubeState } from './liveCubeState'

describe('live cube state', () => {
  it('knows nothing until the cube or the user tells it something', () => {
    const state = new LiveCubeState()
    expect(state.snapshot.known).toBe(false)
    expect(state.snapshot.solved).toBe(false)
  })

  it('advances on every turn without waiting for a sticker frame', () => {
    const state = new LiveCubeState()
    state.markSolved()
    state.applyMove('R')
    state.applyMove('U')
    const snapshot = state.snapshot
    expect(snapshot.setupAlg).toBe('R U')
    expect(snapshot.facelets).toBe(applyFaceletMoves(solvedFacelets, ['R', 'U']))
    expect(snapshot.solved).toBe(false)
    expect(snapshot.origin).toBe('move')
  })

  it('returns to solved when the turns undo themselves', () => {
    const state = new LiveCubeState()
    state.markSolved()
    for (const move of ['R', 'U', "U'", "R'"]) state.applyMove(move)
    expect(state.snapshot.solved).toBe(true)
  })

  it('takes the user at their word when they say the cube is solved', () => {
    const state = new LiveCubeState()
    state.adopt(applyFaceletMoves(solvedFacelets, ['R', 'U', "F'"]))
    expect(state.snapshot.solved).toBe(false)
    state.markSolved()
    expect(state.snapshot.solved).toBe(true)
    expect(state.snapshot.facelets).toBe(solvedFacelets)
    expect(state.snapshot.origin).toBe('user')
  })

  it('treats the first cube frame after calibration as the offset reference, then flags real disagreements', () => {
    const state = new LiveCubeState()
    state.markSolved()
    state.applyMove('R')

    const cubeThinks = applyFaceletMoves(solvedFacelets, ['B2', 'R'])
    state.adopt(cubeThinks)
    expect(state.snapshot.lastDisagreement).toBeUndefined()
    expect(state.snapshot.facelets).toBe(applyFaceletMoves(solvedFacelets, ['R']))

    state.applyMove('U')
    state.adopt(applyFaceletMoves(solvedFacelets, ['B2', 'R', 'L']))
    expect(state.snapshot.lastDisagreement).toBeDefined()
    expect(state.snapshot.facelets).toBe(applyFaceletMoves(solvedFacelets, ['R', 'U']))
  })

  it('queues turns taken before the cube state is known and stays honest about it', () => {
    const state = new LiveCubeState()
    state.applyMove('R')
    state.applyMove('U')
    expect(state.snapshot.known).toBe(false)
    expect(state.snapshot.pendingMoves).toEqual(['R', 'U'])
    state.adopt(solvedFacelets)
    expect(state.snapshot.known).toBe(true)
    expect(state.snapshot.pendingMoves).toEqual([])
  })
})

describe('cube whose own state model has drifted from reality', () => {
  it('tracks reality after the user calibrates, ignoring the cube absolute state', () => {
    const state = new LiveCubeState()
    const cubeThinks = applyFaceletMoves(solvedFacelets, ['R', 'U', "F'", 'L2'])
    state.adopt(cubeThinks)
    expect(state.snapshot.solved).toBe(false)

    state.markSolved(cubeThinks)
    expect(state.snapshot.solved).toBe(true)

    state.applyMove('R')
    expect(state.snapshot.facelets).toBe(applyFaceletMoves(solvedFacelets, ['R']))

    state.adopt(applyFaceletMoves(cubeThinks, ['R']))
    expect(state.snapshot.facelets).toBe(applyFaceletMoves(solvedFacelets, ['R']))
    expect(state.snapshot.solved).toBe(false)
    expect(state.snapshot.lastDisagreement).toBeUndefined()

    state.applyMove("R'")
    state.adopt(applyFaceletMoves(cubeThinks, ['R', "R'"]))
    expect(state.snapshot.solved).toBe(true)
  })

  it('flags a genuine disagreement even while calibrated', () => {
    const state = new LiveCubeState()
    const cubeThinks = applyFaceletMoves(solvedFacelets, ['B2'])
    state.markSolved(cubeThinks)
    state.applyMove('R')
    state.adopt(applyFaceletMoves(cubeThinks, ['L']))
    expect(state.snapshot.lastDisagreement).toBeDefined()
    expect(state.snapshot.facelets).toBe(applyFaceletMoves(solvedFacelets, ['R']))
  })
})

describe('explicit resync (the "Read cube" action)', () => {
  it('leaves the model exactly equal to the reported state, discarding accumulated moves', () => {
    const state = new LiveCubeState()
    const cubeThinks = applyFaceletMoves(solvedFacelets, ['B2'])
    state.markSolved(cubeThinks)
    state.applyMove('R')
    state.adopt(applyFaceletMoves(cubeThinks, ['L']))
    expect(state.snapshot.lastDisagreement).toBeDefined()

    const reported = applyFaceletMoves(solvedFacelets, ['F', 'U2'])
    const resynced = state.resync(reported)

    expect(resynced.facelets).toBe(reported)
    expect(resynced.known).toBe(true)
    expect(resynced.pendingMoves).toEqual([])
    expect(resynced.lastDisagreement).toBeUndefined()
  })

  it('cannot make divergence worse: a later disagreement is measured against the resynced state, not the old one', () => {
    const state = new LiveCubeState()
    const cubeThinks = applyFaceletMoves(solvedFacelets, ['B2'])
    state.markSolved(cubeThinks)
    state.applyMove('R')
    state.adopt(applyFaceletMoves(cubeThinks, ['L']))

    const reported = applyFaceletMoves(solvedFacelets, ['F'])
    state.resync(reported)
    state.applyMove('U')
    state.adopt(applyFaceletMoves(reported, ['U']))

    expect(state.snapshot.lastDisagreement).toBeUndefined()
    expect(state.snapshot.facelets).toBe(applyFaceletMoves(reported, ['U']))
  })
})
