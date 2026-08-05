import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseDeviceSession } from './deviceRecorder'
import type { CubeEvent } from './inputSource'
import { CubedexMoveTracker } from './cubedex/moveTracker'
import { CubedexSolveTracker } from './cubedex/solveTracker'

// Ground truth for the owner's own QiYi recordings, derived from the fixture files
// themselves rather than from anything the app produces, so the pipeline can never be
// graded against its own output. Each expectation below was established by replaying
// the file's MOVE events onto a solved pattern and recording where it reaches the WCA
// scramble state and where it returns to solved.
//
// Five of the eight contain no solve at all: the cube was not physically solved when
// recording began, so the move stream never reaches the scramble target. Those must
// produce nothing rather than a fabricated result — a saved "solve" whose playback
// ends on a scrambled cube is the exact defect this file exists to prevent.
const FIXTURES = 'fixtures/user-sessions'

// The two 06-59-* recordings carry no scramble field at all, so there is no target
// to verify a scramble against and the tracker is `ready` from the first move. That
// is the "Start from this state" path, which in the app is only reachable by explicit
// user calibration and is seeded with the cube's live pattern — a different contract
// from the one under test here. They are covered by the app-level replay instead.
const EXPECTED: Array<{ file: string; solveMoves: number | null; durationMs?: number }> = [
  { file: 'cube-session-QY-QYSC-S-23C0-2026-08-03T08-23-59.json', solveMoves: null },
  { file: 'cube-session-QY-QYSC-S-23C0-2026-08-03T08-31-36.json', solveMoves: 84, durationMs: 25_605 },
  { file: 'cube-session-QY-QYSC-S-23C0-2026-08-03T08-43-11.json', solveMoves: null },
  { file: 'cube-session-QY-QYSC-S-23C0-2026-08-03T08-56-22.json', solveMoves: 65, durationMs: 22_999 },
  { file: 'cube-session-QY-QYSC-S-23C0-2026-08-03T09-56-18.json', solveMoves: 80, durationMs: 20_217 },
  { file: 'cube-session-QY-QYSC-S-23C0-2026-08-03T16-06-14.json', solveMoves: null }
]

async function replay(file: string) {
  const raw = readFileSync(join(__dirname, FIXTURES, file), 'utf8')
  const session = parseDeviceSession(raw)
  const solveTracker = new CubedexSolveTracker(session.scramble ?? '')
  const moveTracker = new CubedexMoveTracker(async (resolved) => { await solveTracker.onResolvedMove(resolved) })
  await moveTracker.reset()
  for (const entry of session.events) {
    await moveTracker.handleEvent(entry.event as CubeEvent)
  }
  await moveTracker.finish()
  return solveTracker
}

describe('user session fixtures reproduce their ground truth', () => {
  for (const expected of EXPECTED) {
    const label = expected.file.slice(-18, -5)

    it(`${label} ${expected.solveMoves === null ? 'contains no solve' : `times a ${expected.solveMoves}-move solve`}`, async () => {
      const tracker = await replay(expected.file)
      const snapshot = tracker.snapshot()

      if (expected.solveMoves === null) {
        expect(snapshot.status).not.toBe('stopped')
        expect(snapshot.durationMs).toBeNull()
        return
      }

      expect(snapshot.status).toBe('stopped')
      expect(tracker.solutionTimeline(0)).toHaveLength(expected.solveMoves)
      expect(snapshot.durationMs).toBe(expected.durationMs)
    }, 60_000)
  }
})
