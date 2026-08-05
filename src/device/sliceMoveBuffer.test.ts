import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { SliceMoveBuffer } from './sliceMoveBuffer'
import type { CubeMoveEvent } from './inputSource'

type FixtureRecord = { scramble?: string; events: Array<{ event: { type: string; timestamp: number; [key: string]: unknown } }> }

function loadFixtureMoves(filename: string): CubeMoveEvent[] {
  const path = join(__dirname, 'fixtures', 'user-sessions', filename)
  const record = JSON.parse(readFileSync(path, 'utf8')) as FixtureRecord
  return record.events
    .map((entry) => entry.event)
    .filter((event): event is CubeMoveEvent => event.type === 'MOVE') as unknown as CubeMoveEvent[]
}

function makeMove(move: string, timestamp = 0): CubeMoveEvent {
  const faces = 'URFDLB'
  return {
    type: 'MOVE',
    move,
    face: Math.max(0, faces.indexOf(move.charAt(0))),
    direction: move.includes("'") ? 1 : 0,
    timestamp,
    cubeTimestamp: timestamp,
    localTimestamp: timestamp,
  }
}

// A manual clock so the 100ms pairing window can be driven deterministically without real timers.
function manualClock() {
  let nextHandle = 1
  const pending = new Map<number, () => void>()
  return {
    setTimeoutFn: (handler: () => void) => {
      const handle = nextHandle
      nextHandle += 1
      pending.set(handle, handler)
      return handle
    },
    clearTimeoutFn: (handle: number) => {
      pending.delete(handle)
    },
    flushAll: () => {
      const handlers = [...pending.values()]
      pending.clear()
      for (const handler of handlers) handler()
    },
    pendingCount: () => pending.size,
  }
}

describe('SliceMoveBuffer (ported from cubedex useSmartcubeConnection.ts slice pairing)', () => {
  it("collapses R' then L within the window into M'", () => {
    const resolved: string[] = []
    const clock = manualClock()
    const buffer = new SliceMoveBuffer((r) => resolved.push(r.visualMove), clock)

    buffer.feed(makeMove("R'"))
    expect(clock.pendingCount()).toBe(1)
    buffer.feed(makeMove('L'))

    expect(resolved).toEqual(["M'"])
  })

  it('flushes the buffered move as itself when the window expires with no pair', () => {
    const resolved: string[] = []
    const clock = manualClock()
    const buffer = new SliceMoveBuffer((r) => resolved.push(r.visualMove), clock)

    buffer.feed(makeMove('R'))
    clock.flushAll()

    expect(resolved).toEqual(['R'])
  })

  it('flushes the buffered move then re-buffers when the next move is not its opposite face', () => {
    const resolved: string[] = []
    const clock = manualClock()
    const buffer = new SliceMoveBuffer((r) => resolved.push(r.visualMove), clock)

    buffer.feed(makeMove('R'))
    buffer.feed(makeMove('U'))
    clock.flushAll()

    expect(resolved).toEqual(['R', 'U'])
  })

  it('passes a non-slice-candidate move straight through', () => {
    const resolved: string[] = []
    const clock = manualClock()
    const buffer = new SliceMoveBuffer((r) => resolved.push(r.visualMove), clock)
    buffer.feed(makeMove("M'"))
    expect(resolved).toEqual(["M'"])
  })

  it('replays every real capture session without throwing and resolves one move per raw event or fewer (slices merge two into one)', () => {
    const files = [
      'cube-session-QY-QYSC-S-23C0-2026-08-03T06-59-08.json',
      'cube-session-QY-QYSC-S-23C0-2026-08-03T08-23-59.json',
      'cube-session-QY-QYSC-S-23C0-2026-08-03T08-31-36.json',
      'cube-session-QY-QYSC-S-23C0-2026-08-03T08-43-11.json',
      'cube-session-QY-QYSC-S-23C0-2026-08-03T08-56-22.json',
      'cube-session-QY-QYSC-S-23C0-2026-08-03T09-56-18.json',
      'cube-session-QY-QYSC-S-23C0-2026-08-03T06-59-11.json',
    ]

    for (const file of files) {
      const rawMoves = loadFixtureMoves(file)
      const resolved: string[] = []
      const clock = manualClock()
      const buffer = new SliceMoveBuffer((r) => resolved.push(r.visualMove), clock)

      for (const event of rawMoves) buffer.feed(event)
      clock.flushAll()

      expect(resolved.length).toBeGreaterThan(0)
      expect(resolved.length).toBeLessThanOrEqual(rawMoves.length)
      expect(resolved.length).toBeGreaterThanOrEqual(rawMoves.length - Math.ceil(rawMoves.length / 2))
    }
  })
})
