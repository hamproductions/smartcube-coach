import { describe, expect, it } from 'vitest'
import { CaptureSession } from './capture'

const scramble = "F B R' F R L' B R F2 U B2 R2 D F2 B2 R2 D' R2 U' L2"
const target = scramble.split(/\s+/)

async function session(scrambleText = scramble) {
  const captured = new CaptureSession(() => undefined)
  await captured.setScramble(scrambleText)
  return captured
}

const turn = async (captured: CaptureSession, moves: string[]) => {
  for (const [index, move] of moves.entries()) {
    await captured.handleMove(move, null, 1_000 + index * 100)
  }
}

describe('following a scramble', () => {
  it('a cube that has been turned nowhere is at the start, not off the scramble', async () => {
    const captured = await session()
    expect(captured.snapshot.offTrack).toBe(false)
    expect(captured.snapshot.matchedIndex ?? 0).toBe(0)
    expect(captured.snapshot.recovery ?? []).toEqual([])
  })

  it('counts correct turns and stays on track', async () => {
    const captured = await session()
    await turn(captured, target.slice(0, 4))
    expect(captured.snapshot.offTrack).toBe(false)
    expect(captured.snapshot.matchedIndex).toBe(4)
  }, 30_000)

  it('flags a wrong turn and gives a SHORT way back, never the whole scramble', async () => {
    const captured = await session()
    await turn(captured, [...target.slice(0, 3), 'D'])
    const snapshot = captured.snapshot
    expect(snapshot.offTrack).toBe(true)
    expect(snapshot.matchedIndex).toBe(3)
    expect(snapshot.recovery).toEqual(["D'"])
    expect(snapshot.recovery!.length).toBeLessThan(target.length)
  }, 30_000)

  it('clears the moment the solver undoes their own mistake', async () => {
    const captured = await session()
    await turn(captured, [...target.slice(0, 3), 'D', "D'"])
    const snapshot = captured.snapshot
    // The walk this replaced returned at the first wrong face and never looked again, so
    // every correct turn after one stray move kept reading as a mistake.
    expect(snapshot.offTrack).toBe(false)
    expect(snapshot.matchedIndex).toBe(3)
  }, 30_000)

  it('keeps following after a mistake is fixed, instead of staying stuck', async () => {
    const captured = await session()
    await turn(captured, [...target.slice(0, 3), 'D', "D'", ...target.slice(3, 6)])
    const snapshot = captured.snapshot
    expect(snapshot.offTrack).toBe(false)
    expect(snapshot.matchedIndex).toBe(6)
  }, 30_000)

  it('never reports the cube as off the scramble once the scramble is complete', async () => {
    const captured = await session()
    await turn(captured, target)
    const snapshot = captured.snapshot
    expect(snapshot.status).toBe('ready')
    expect(snapshot.offTrack).toBe(false)
  }, 60_000)
})
