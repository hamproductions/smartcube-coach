import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { clearDatabase, repositories } from './database'
import { repairSolveTimestamps } from './repairTimestamps'
import type { SolveRecord } from '../domain/models'

const solve = (id: string, startedAt: number, endedAt: number): SolveRecord => ({
  id, sessionId: 'default', puzzle: '3x3x3', scramble: 'R U', scrambleGenerator: 'x',
  startedAt, endedAt, penalty: 'none', analysisVersion: '1', rawEventIds: [], moves: [],
  source: 'cube', stateVerified: true
})

describe('repairSolveTimestamps', () => {
  beforeEach(clearDatabase)
  afterEach(clearDatabase)

  it('rebases epoch-dated solves onto the wall clock, keeping their durations', async () => {
    await repositories.solves.put(solve('a', 1_000, 3_400))
    const repaired = await repairSolveTimestamps()

    expect(repaired).toBe(1)
    const stored = (await repositories.solves.all())[0]
    expect(stored.endedAt - stored.startedAt).toBe(2_400)
    expect(new Date(stored.endedAt).getFullYear()).toBeGreaterThan(2000)
  })

  it('leaves solves that already carry real dates alone', async () => {
    const endedAt = Date.now()
    await repositories.solves.put(solve('b', endedAt - 5_000, endedAt))
    expect(await repairSolveTimestamps()).toBe(0)
    expect((await repositories.solves.all())[0].endedAt).toBe(endedAt)
  })


  it('keeps repaired solves behind solves that already have real dates', async () => {
    const recent = Date.now() - 60 * 60 * 1000
    await repositories.solves.put(solve('old-1', 1_000, 3_000))
    await repositories.solves.put(solve('old-2', 4_000, 7_000))
    await repositories.solves.put(solve('real', recent - 10_000, recent))

    await repairSolveTimestamps()
    const all = await repositories.solves.all()
    const byId = Object.fromEntries(all.map((record) => [record.id, record]))

    // The genuinely newer solve must still be the newest.
    expect(byId.real.endedAt).toBe(recent)
    expect(byId['old-1'].endedAt).toBeLessThan(byId['old-2'].endedAt)
    expect(byId['old-2'].endedAt).toBeLessThan(byId.real.startedAt)
  })
})

describe('repairSolveTimestamps keeps history physically possible', () => {
  beforeEach(clearDatabase)
  afterEach(clearDatabase)

  it('never lets one repaired solve start before the previous one ended', async () => {
    await repositories.solves.put(solve('short', 1_000, 11_000))
    await repositories.solves.put(solve('long', 200_000, 290_000))

    await repairSolveTimestamps()
    const all = (await repositories.solves.all()).sort((left, right) => left.endedAt - right.endedAt)

    expect(all[1].startedAt).toBeGreaterThanOrEqual(all[0].endedAt)
    for (const record of all) expect(record.endedAt).toBeGreaterThan(record.startedAt)
  })

  it('does not treat a record with a corrupt start as a good anchor', async () => {
    const realEnd = Date.now()
    await repositories.solves.put(solve('half-corrupt', 500, realEnd))
    await repositories.solves.put(solve('broken', 100, 200))

    await repairSolveTimestamps()
    const all = await repositories.solves.all()

    // Nothing may come out dated before 1970, and no record keeps a nonsense duration.
    for (const record of all) {
      expect(record.startedAt).toBeGreaterThan(0)
      expect(new Date(record.endedAt).getFullYear()).toBeGreaterThan(2000)
    }
  })

  it('is a no-op on a second run', async () => {
    await repositories.solves.put(solve('a', 1_000, 3_000))
    await repositories.solves.put(solve('b', 5_000, 9_000))

    expect(await repairSolveTimestamps()).toBe(2)
    const afterFirst = (await repositories.solves.all()).map((record) => record.endedAt).sort()

    expect(await repairSolveTimestamps()).toBe(0)
    expect((await repositories.solves.all()).map((record) => record.endedAt).sort()).toEqual(afterFirst)
  })

  it('survives a record whose end precedes its start', async () => {
    await repositories.solves.put(solve('backwards', 9_000, 1_000))
    await repairSolveTimestamps()

    const record = (await repositories.solves.all())[0]
    expect(record.endedAt).toBeGreaterThanOrEqual(record.startedAt)
    expect(new Date(record.endedAt).getFullYear()).toBeGreaterThan(2000)
  })

  it('never walks back past the plausible epoch, however many solves are broken', async () => {
    // A cluster far larger than the room available before 1970: the slots compress rather
    // than overrunning, because a record dated before the epoch would be "repaired" again on
    // the next load, rewriting history on every mount.
    const many = Array.from({ length: 400 }, (_, index) => solve(`b${index}`, index, index + 3_600_000))
    await Promise.all(many.map((record) => repositories.solves.put(record)))

    expect(await repairSolveTimestamps()).toBe(many.length)
    const all = await repositories.solves.all()
    for (const record of all) {
      expect(record.startedAt).toBeGreaterThanOrEqual(1_000_000_000_000)
      expect(record.endedAt).toBeGreaterThanOrEqual(record.startedAt)
    }

    // And having repaired them, a second run must find nothing to do.
    expect(await repairSolveTimestamps()).toBe(0)
  }, 30_000)
})
