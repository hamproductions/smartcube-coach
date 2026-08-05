import { describe, expect, it } from 'vitest'
import { CaptureSession } from './capture'

/**
 * A solver does not wait for the app. They finish a solve and immediately start turning the
 * next scramble, while the app is still recording — and recording used to hold the session in
 * 'complete' for as long as the analysis took, discarding every turn that arrived. From that
 * point the app's idea of the cube and the cube itself disagreed for the rest of the session.
 */
describe('turns made while the last solve is still being recorded', () => {
  it('are kept and applied to the next scramble instead of being dropped', async () => {
    let completed = 0
    const session = new CaptureSession(async () => { completed += 1 })
    await session.setScramble('R')

    await session.handleMove('R', null, 100)
    expect(session.snapshot.status).toBe('ready')

    // The solve: one turn that returns the cube to solved.
    await session.handleMove("R'", null, 200)
    expect(completed).toBe(1)
    expect(session.snapshot.status).toBe('complete')

    // The solver is already turning the next scramble while the app records.
    await session.handleMove('U', null, 300)
    await session.handleMove('F', null, 400)

    await session.setScramble('U F')

    expect(session.snapshot.scrambleMoves).toEqual(['U', 'F'])
    expect(session.snapshot.status).toBe('ready')
    expect(session.snapshot.offTrack).toBe(false)
  }, 30_000)

  it('does not carry turns across a reset', async () => {
    const session = new CaptureSession(async () => undefined)
    await session.setScramble('R')
    await session.handleMove('R', null, 100)
    await session.handleMove("R'", null, 200)
    await session.handleMove('U', null, 300)

    session.reset()
    await session.setScramble('U')

    expect(session.snapshot.scrambleMoves).toEqual([])
  }, 30_000)
})
