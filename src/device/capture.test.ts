import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

const deferredEvaluation = vi.hoisted(() => ({ result: undefined as Promise<boolean> | undefined }))

vi.mock('../domain/scramble', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../domain/scramble')>()
  return { ...actual, evaluateScramble: (...args: Parameters<typeof actual.evaluateScramble>) => deferredEvaluation.result ?? actual.evaluateScramble(...args) }
})
import { CaptureSession, fitCubeTimestamp, inspectionPenalty, type CompletedCapture } from './capture'

type FixtureMoveEvent = { type: 'MOVE'; move: string; cubeTimestamp: number | null; localTimestamp: number | null; timestamp: number }
type FixtureRecord = { scramble?: string; events: Array<{ event: { type: string; timestamp: number; [key: string]: unknown } }> }

function loadFixtureMoves(filename: string) {
  const path = join(__dirname, 'fixtures', 'user-sessions', filename)
  const record = JSON.parse(readFileSync(path, 'utf8')) as FixtureRecord
  const moves = record.events.map((entry) => entry.event).filter((event): event is FixtureMoveEvent => event.type === 'MOVE')
  return { scramble: record.scramble, moves }
}

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

  it('accepts a state-equivalent alternate scramble sequence', async () => {
    const session = new CaptureSession(() => undefined)
    await session.setScramble("R L'")

    await session.handleMove('x', 10, 100)
    await session.handleMove('M', 20, 200)

    expect(session.snapshot.status).toBe('ready')
  })

  it('does not accept the wrong slice sign as an equivalent scramble', async () => {
    const session = new CaptureSession(() => undefined)
    await session.setScramble("R L'")

    await session.handleMove("M'", 10, 100)

    expect(session.snapshot.status).toBe('scrambling')
  })

  it('drops a scramble evaluation that resolves after reset', async () => {
    let resolveEvaluation: (value: boolean) => void = () => undefined
    deferredEvaluation.result = new Promise<boolean>((resolve) => { resolveEvaluation = resolve })
    const changes: string[] = []
    const session = new CaptureSession(() => undefined, (snapshot) => changes.push(snapshot.status))
    await session.setScramble('R')

    const move = session.handleMove('R', 10, 100)
    session.reset()
    resolveEvaluation(true)
    await move
    deferredEvaluation.result = undefined

    expect(session.snapshot.status).toBe('idle')
    expect(changes).toEqual(['scrambling', 'idle'])
  })

  it('drops a completed solve that resolves after reset', async () => {
    const completed: string[][] = []
    const session = new CaptureSession((capture) => { completed.push(capture.moves) })
    await session.setScramble('R')
    await session.handleMove('R', 10, 100)
    session.beginInspection(200)
    let resolveEvaluation: (value: boolean) => void = () => undefined
    deferredEvaluation.result = new Promise<boolean>((resolve) => { resolveEvaluation = resolve })

    const move = session.handleMove("R'", 20, 300)
    session.reset()
    resolveEvaluation(true)
    await move
    deferredEvaluation.result = undefined

    expect(session.snapshot.status).toBe('idle')
    expect(completed).toEqual([])
  })
})

describe('auto timing', () => {
  it('starts the timer on the first solve turn without asking the user to press anything', async () => {
    const completed: CompletedCapture[] = []
    const session = new CaptureSession(async (capture) => { completed.push(capture) })
    await session.setScramble('R U')
    await session.handleMove('R', null, 1_000)
    await session.handleMove('U', null, 1_100)
    expect(session.snapshot.status).toBe('ready')

    await session.handleMove("U'", null, 5_000)
    expect(session.snapshot.status).toBe('solving')
    expect(session.snapshot.startedAt).toBe(5_000)

    await session.handleMove("R'", null, 6_000)
    expect(session.snapshot.status).toBe('complete')
    expect(session.snapshot.endedAt).toBe(6_000)
    expect(completed).toHaveLength(1)
    expect(completed[0].moves).toEqual(["U'", "R'"])
  })
})

describe('WCA inspection penalties', () => {
  it('applies +2 past 15s and DNF past 17s of inspection, like a real timer', async () => {
    expect(inspectionPenalty(14_999)).toBe('none')
    expect(inspectionPenalty(15_001)).toBe('+2')
    expect(inspectionPenalty(17_001)).toBe('dnf')
  })

  it('carries the derived penalty onto the completed capture', async () => {
    const completed: CompletedCapture[] = []
    const session = new CaptureSession(async (capture) => { completed.push(capture) })
    await session.setScramble('R U')
    await session.handleMove('R', null, 1_000)
    await session.handleMove('U', null, 1_100)
    session.beginInspection(2_000)
    await session.handleMove("U'", null, 20_000)
    await session.handleMove("R'", null, 21_000)

    expect(completed).toHaveLength(1)
    expect(completed[0].penalty).toBe('dnf')
  })
})

describe('real fixture replay: corrupted timing (R9)', () => {
  it('derives sane, monotonic solve timing from a fixture with duplicate-host-timestamp batches', async () => {
    const { scramble, moves } = loadFixtureMoves('cube-session-QY-QYSC-S-23C0-2026-08-03T08-31-36.json')
    expect(scramble).toBeTruthy()

    const duplicateHostBatches = moves.filter((move, index) => move.localTimestamp === null && moves[index + 1]?.timestamp === move.timestamp)
    expect(duplicateHostBatches.length).toBeGreaterThan(0)

    const completed: CompletedCapture[] = []
    const session = new CaptureSession(async (capture) => { completed.push(capture) })
    await session.setScramble(scramble!)
    for (const move of moves) await session.handleMove(move.move, move.cubeTimestamp, move.timestamp)

    expect(completed.length).toBeGreaterThan(0)
    for (const capture of completed) {
      expect(capture.endedAt).toBeGreaterThan(capture.startedAt)
      expect(capture.endedAt - capture.startedAt).toBeLessThan(120_000)
      let previous = capture.startedAt
      for (const event of capture.events) {
        expect(event.timestamp).toBeGreaterThanOrEqual(previous)
        previous = event.timestamp
      }
      expect(previous).toBeLessThanOrEqual(capture.endedAt)
    }
  }, 30_000)
})

describe('unparseable move tokens do not stall the pipeline (R8)', () => {
  it('surfaces an unsupported state instead of vanishing when a scramble move cannot be parsed', async () => {
    const session = new CaptureSession(() => undefined)
    await session.setScramble('R U')

    await session.handleMove('Q', null, 100)
    expect(session.snapshot.status).toBe('scrambling')
    expect(session.snapshot.evaluationUnsupported).toBe(true)

    await session.handleMove('R', null, 200)
    expect(session.snapshot.scrambleMoves).toEqual(['Q', 'R'])

    session.reset()
    await session.setScramble('R U')
    await session.handleMove('R', null, 300)
    await session.handleMove('U', null, 400)

    expect(session.snapshot.status).toBe('ready')
    expect(session.snapshot.evaluationUnsupported).toBe(false)
  })

  it('surfaces an unsupported state instead of vanishing when a solve move cannot be parsed', async () => {
    const session = new CaptureSession(() => undefined)
    await session.setScramble('R')
    await session.handleMove('R', null, 100)
    expect(session.snapshot.status).toBe('ready')

    await session.handleMove('Q', null, 200)
    expect(session.snapshot.status).toBe('solving')
    expect(session.snapshot.evaluationUnsupported).toBe(true)

    await session.handleMove("R'", null, 300)
    expect(session.snapshot.solveMoves).toEqual(['Q', "R'"])
  })
})

describe('out-of-order scramble input is not treated as an error (R10)', () => {
  it('reaches ready from an out-of-order but state-equivalent scramble without an error-class flag', async () => {
    const session = new CaptureSession(() => undefined)
    await session.setScramble("R L'")

    await session.handleMove('x', 10, 100)
    // A whole-cube rotation changes notation, not the cube, so it is not a wrong move —
    // flagging it was what made "off the scramble" flash at a solver who had done nothing.
    expect(session.snapshot.wrongMove).toBeUndefined()
    expect(session.snapshot.offTrack).toBe(false)
    expect(session.snapshot.evaluationUnsupported).toBeFalsy()
    expect(session.snapshot.status).toBe('scrambling')

    await session.handleMove('M', 20, 200)
    expect(session.snapshot.status).toBe('ready')
    expect(session.snapshot.evaluationUnsupported).toBeFalsy()
  })
})

describe('accepting the state the cube is actually in', () => {
  it('treats the accepted moves as the scramble and the NEXT move as the first solve move', async () => {
    const session = new CaptureSession(async () => undefined, () => undefined)
    await session.setScramble("R U R' U'")

    // The solver scrambled by hand; these are the turns they actually made, including the
    // one that triggered the hands-free accept.
    session.acceptCurrentState('F F F F')
    expect(session.snapshot.status).toBe('ready')
    expect(session.snapshot.scrambleMoves).toEqual(['F', 'F', 'F', 'F'])
    expect(session.snapshot.solveMoves).toEqual([])

    await session.handleMove('R', null, 1_000)
    expect(session.snapshot.status).toBe('solving')
    expect(session.snapshot.solveMoves).toEqual(['R'])
  })

  it('ignores a scramble evaluation that was already in flight when the state was accepted', async () => {
    const session = new CaptureSession(async () => undefined, () => undefined)
    await session.setScramble("R U R' U'")

    // Start a move, then accept before its evaluation resolves.
    const pending = session.handleMove('L', null, 500)
    session.acceptCurrentState('F F F F')
    await pending

    expect(session.snapshot.status).toBe('ready')
    expect(session.snapshot.scrambleMoves).toEqual(['F', 'F', 'F', 'F'])
  })
})

describe('a stray turn that a later correct turn appears to fix', () => {
  it('stays off track, with the turns to undo, instead of soft-locking the scramble', async () => {
    const session = new CaptureSession(async () => undefined, () => undefined)
    await session.setScramble('R2')

    // The solver turns L by accident, then turns R2 correctly. The scramble can never
    // verify while that L is still in the cube, so the app must keep saying so.
    await session.handleMove('L', null, 100)
    await session.handleMove('R2', null, 200)

    expect(session.snapshot.status).toBe('scrambling')
    expect(session.snapshot.offTrack).toBe(true)
    // R2 is its own inverse, so the way back is R2 then L'.
  })

  it('accepts a double turn performed as two quarter turns', async () => {
    const session = new CaptureSession(async () => undefined, () => undefined)
    await session.setScramble('R2')

    await session.handleMove('R', null, 100)
    expect(session.snapshot.status).toBe('scrambling')
    expect(session.snapshot.offTrack).toBe(false)

    await session.handleMove('R', null, 200)
    expect(session.snapshot.status).toBe('ready')
  })
})

describe('rotations and slices are not divergences', () => {
  it('does not report off track for a cube rotation mid-scramble', async () => {
    const session = new CaptureSession(async () => undefined, () => undefined)
    await session.setScramble("R L'")

    await session.handleMove('x', 10, 100)
    expect(session.snapshot.offTrack).toBe(false)

    // The very next turn completes the scramble, which is why the rotation must not be
    // treated as a mistake in between.
    await session.handleMove('M', 20, 200)
    expect(session.snapshot.status).toBe('ready')
  })
})

describe('progress reflects what matched, not how many turns were made', () => {
  it('does not advance past a wrong turn', async () => {
    const session = new CaptureSession(async () => undefined, () => undefined)
    await session.setScramble("R U F' L2")

    await session.handleMove('R', null, 100)
    expect(session.snapshot.matchedIndex).toBe(1)

    // A wrong turn: three moves have been made but only one of them matched.
    await session.handleMove('B', null, 200)
    expect(session.snapshot.scrambleMoves).toHaveLength(2)
    expect(session.snapshot.matchedIndex).toBe(1)
    expect(session.snapshot.offTrack).toBe(true)
  })

  it('never reports more matched moves than the scramble has', async () => {
    const session = new CaptureSession(async () => undefined, () => undefined)
    await session.setScramble('R')
    await session.handleMove('R', null, 100)
    await session.handleMove('R', null, 200)
    expect(session.snapshot.matchedIndex).toBeLessThanOrEqual(1)
  })
})

describe('the way back onto the scramble', () => {
  it('is a single turn after a single wrong turn', async () => {
    const session = new CaptureSession(async () => undefined, () => undefined)
    await session.setScramble("R U F' L2")

    await session.handleMove('R', null, 100)
    await session.handleMove('U', null, 200)
    await session.handleMove('B', null, 300)

    expect(session.snapshot.offTrack).toBe(true)
    expect(session.snapshot.recovery).toEqual(["B'"])
  })

  it('cancels turns that undo each other instead of listing them all', async () => {
    const session = new CaptureSession(async () => undefined, () => undefined)
    await session.setScramble('R U')

    // Fiddling on one face: four quarter turns that come back to where they started.
    for (const move of ['F', "F'", 'F', "F'"]) await session.handleMove(move, null, 100)

    // The cube is back exactly where the scramble starts, so there is nothing to undo and
    // nothing to warn about. This used to report "off the scramble" with an empty way back —
    // the state the owner screenshotted, where a cube at the start of the scramble was told
    // it was off it and handed the whole scramble as the way "back".
    expect(session.snapshot.offTrack).toBe(false)
    expect(session.snapshot.matchedIndex).toBe(0)
    expect(session.snapshot.recovery).toEqual([])
  })
})

describe('the way back is stateless', () => {
  const recoveryAfter = async (moves: string[]) => {
    const session = new CaptureSession(async () => undefined, () => undefined)
    await session.setScramble("R U F' L2")
    for (const move of moves) await session.handleMove(move, null, 100)
    return session.snapshot.recovery
  }

  it('gives the same instruction for the same cube however it was reached', async () => {
    // Both reach the same position: two correct moves plus a stray B.
    const direct = await recoveryAfter(['R', 'U', 'B'])
    const roundabout = await recoveryAfter(['R', 'U', 'B', 'F', "F'", 'D', "D'"])
    expect(direct).toEqual(["B'"])
    expect(roundabout).toEqual(["B'"])
  })

  it('does not grow with the number of turns taken', async () => {
    const many = await recoveryAfter(['R', 'U', 'B', ...Array.from({ length: 20 }, () => 'F')])
    expect((many ?? []).length).toBeLessThanOrEqual(3)
  })
})

describe('the live readout uses the wall clock', () => {
  it('records a wall-clock start alongside the cube-clock one', async () => {
    const session = new CaptureSession(async () => undefined, () => undefined)
    await session.setScramble('R')
    await session.handleMove('R', null, 5_000)
    await session.handleMove('U', null, 5_200)

    const snapshot = session.snapshot
    expect(snapshot.status).toBe('solving')
    // The cube clock is monotonic; subtracting it from Date.now() printed a raw epoch.
    expect(snapshot.startedAt).toBe(5_200)
    expect(snapshot.startedAtWall).toBeDefined()
    expect(Math.abs(Date.now() - (snapshot.startedAtWall ?? 0))).toBeLessThan(10_000)
  })
})
