import { describe, expect, it } from 'vitest'
import { CaptureSession, fitCubeTimestamp } from './capture'

describe('capture pipeline', () => {
  it('fits cube timestamps to host time despite delayed delivery', () => {
    const fit = fitCubeTimestamp([
      { cube: 0, host: 1000 },
      { cube: 100, host: 1102 },
      { cube: 200, host: 1201 }
    ])

    expect(fit(150)).toBeGreaterThanOrEqual(1149)
    expect(fit(150)).toBeLessThanOrEqual(1152)
  })

  it('verifies scramble and automatically captures first-move to solved-state', async () => {
    const completed: string[][] = []
    const session = new CaptureSession((solve) => { completed.push(solve.moves) })
    await session.setScramble('R U')

    await session.handleMove('R', 10, 100)
    await session.handleMove('U', 20, 200)
    expect(session.snapshot.status).toBe('ready')

    session.beginInspection(250)
    await session.handleMove("U'", 30, 400)
    expect(session.snapshot.status).toBe('solving')
    await session.handleMove("R'", 40, 550)

    expect(session.snapshot.status).toBe('complete')
    expect(completed).toEqual([["U'", "R'"]])
  })
})
