import { describe, expect, it } from 'vitest'
import { ensureSharedCapture, ensureSharedTrackers, injectCubeEvent, setSharedScramble, suspendSolveCapture } from './CubeConnection'

const turn = (move: string) => {
  const now = performance.now()
  injectCubeEvent({ type: 'MOVE', move, face: 'URFDLB'.indexOf(move[0]), direction: move.endsWith("'") ? 1 : 0, timestamp: now, cubeTimestamp: now, localTimestamp: now })
}
const settle = () => new Promise((resolve) => setTimeout(resolve, 250))

describe('turns made inside a trainer', () => {
  it('never move the solve capture, and the capture follows again once the trainer closes', async () => {
    ensureSharedTrackers('')
    await setSharedScramble('R U')
    suspendSolveCapture(true)
    turn('R')
    turn('U')
    await settle()
    expect(ensureSharedCapture().snapshot.status).toBe('scrambling')
    expect(ensureSharedCapture().snapshot.scrambleMoves).toEqual([])

    suspendSolveCapture(false)
    await settle()
    await setSharedScramble('F')
    turn('F')
    await settle()
    expect(ensureSharedCapture().snapshot.status).toBe('ready')
  })
})
