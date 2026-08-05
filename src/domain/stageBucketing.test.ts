import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { bucketMovesByStageMidpoints } from './reconstruction'
import { parseDeviceSession } from '../device/deviceRecorder'
import type { TimestampedMove } from './reconstruction'

// rebuild-spec §1.3. The reference buckets moves into stages by the midpoint between
// adjacent stage timestamps because its stage timings come from a separate simulation.
// Here both come from one recorded stream, so the midpoint boundary always lands in the
// same gap as the index cut. These lock that equivalence against the owner's own
// captures, so a future change that decouples the two clocks fails loudly instead of
// silently reshaping stages.

// Relative to the repo root, like every other fixture path here. This was an absolute path
// into one machine's home directory, so the suite passed there and died everywhere else —
// the CI build failed on `ENOENT … scandir` naming a directory no runner could have.
const FIXTURES = `${process.cwd()}/src/device/fixtures/user-sessions`

function movesFromFixture(file: string): TimestampedMove[] {
  const session = parseDeviceSession(readFileSync(`${FIXTURES}/${file}`, 'utf8'))
  return session.events
    .filter((entry) => entry.event.type === 'MOVE')
    .map((entry) => {
      const event = entry.event as { move: string; timestamp: number }
      return { move: event.move, timestamp: event.timestamp }
    })
}

const stageFromCuts = (events: TimestampedMove[], cuts: number[]) =>
  events.map((_, index) => cuts.filter((cut) => index > cut).length)

describe('stage bucketing by timestamp midpoint', () => {
  const files = readdirSync(FIXTURES).filter((name) => name.endsWith('.json'))

  it('has captures to check', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  for (const file of files) {
    it(`matches index cuts on ${file}`, () => {
      const events = movesFromFixture(file)
      if (events.length < 12) return
      // Cuts spread across the capture, standing in for real stage boundaries.
      const cuts = [1, 2, 3, 4, 5, 6].map((part) => Math.floor((events.length * part) / 7))
      expect(bucketMovesByStageMidpoints(events, cuts)).toEqual(stageFromCuts(events, cuts))
    })
  }

  it('puts a move landing exactly on a boundary in the earlier stage', () => {
    const events: TimestampedMove[] = [
      { move: 'R', timestamp: 0 },
      { move: 'U', timestamp: 100 },
      { move: 'F', timestamp: 900 }
    ]
    // Boundary sits at 500; the move at 100 is before it, the move at 900 after.
    expect(bucketMovesByStageMidpoints(events, [1])).toEqual([0, 0, 1])
  })
})
