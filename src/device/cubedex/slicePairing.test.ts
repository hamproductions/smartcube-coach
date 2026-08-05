import { describe, expect, it } from 'vitest'
import { CubedexMoveTracker } from './moveTracker'
import type { CubeEvent } from '../inputSource'

// A solver following a printed scramble turns literal faces. Merging two quick opposite-face
// turns into one slice move loses both, and the next scramble check calls a correct turn
// wrong — which is what happened with "B2" partway through a scramble.
const feed = async (tracker: CubedexMoveTracker, moves: string[]) => {
  const seen: string[] = []
  for (const [index, move] of moves.entries()) {
    await tracker.handleEvent({
      type: 'MOVE', move, face: 0, direction: 1,
      timestamp: index, localTimestamp: index, cubeTimestamp: index
    } as unknown as CubeEvent)
  }
  await tracker.finish()
  return seen
}

describe('slice pairing', () => {
  it('reports both face turns when pairing is off, as it is while scrambling', async () => {
    const resolved: string[] = []
    const tracker = new CubedexMoveTracker((move) => { resolved.push(move.move) })
    tracker.slicePairing = false
    await tracker.reset()
    await feed(tracker, ['B', 'F'])
    expect(resolved).toEqual(['B', 'F'])
  })

  it('still pairs them into a slice when pairing is on, as it is during a solve', async () => {
    const resolved: string[] = []
    const tracker = new CubedexMoveTracker((move) => { resolved.push(move.visualMove) })
    tracker.slicePairing = true
    await tracker.reset()
    await feed(tracker, ["R", "L'"])
    expect(resolved.length).toBeLessThan(2)
  })
})
