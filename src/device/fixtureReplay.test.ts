import { readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { FaceletReconciler, isSolvedFacelets } from '../domain/faceletReconciliation'
import { CaptureSession } from './capture'

type FixtureEvent = {
  t: number
  event: {
    type: string
    timestamp: number
    move?: string
    facelets?: string
    cubeTimestamp?: number
    localTimestamp?: number
  }
}

type Fixture = {
  device: { name: string; mac: string }
  protocol: { id: string; name: string }
  events: FixtureEvent[]
}

const capturesDir = `${process.cwd()}/node_modules/smartcube-web-bluetooth/captures/`
const fixtures = readdirSync(capturesDir)
  .filter((name) => name.endsWith('.json'))
  .map((name) => ({ name, fixture: JSON.parse(readFileSync(capturesDir + name, 'utf8')) as Fixture }))

describe('recorded smart-cube traffic', () => {
  it('ships captures for every supported protocol', () => {
    expect(fixtures.length).toBeGreaterThan(0)
    expect(new Set(fixtures.map(({ fixture }) => fixture.protocol.id))).toEqual(new Set(['qiyi', 'gan-gen2', 'gan-gen4', 'giiker', 'gocube', 'moyu32']))
  })

  it.each(fixtures.map(({ name, fixture }) => [fixture.protocol.id, name, fixture] as const))(
    '%s: reconciles every recorded facelet packet against the recorded move stream (%s)',
    (_protocol, _name, fixture) => {
      const reconciler = new FaceletReconciler()
      const statuses: string[] = []
      let moves = 0
      let facelets = 0

      for (const { event } of fixture.events) {
        if (event.type === 'MOVE' && event.move) {
          reconciler.recordMove(event.move)
          moves += 1
        }
        if (event.type === 'FACELETS' && event.facelets) {
          facelets += 1
          statuses.push(reconciler.reconcile(event.facelets).status)
        }
      }

      expect(moves, 'fixture contains moves').toBeGreaterThan(0)
      expect(facelets, 'fixture contains facelet packets').toBeGreaterThan(0)
      expect(statuses.filter((status) => status !== 'baseline' && status !== 'verified')).toEqual([])
    }
  )

  it('captures a solve driven entirely by recorded QiYi packets', async () => {
    const fixture = fixtures.find(({ fixture }) => fixture.protocol.id === 'qiyi')!.fixture
    const moves = fixture.events.filter(({ event }) => event.type === 'MOVE' && event.move)
    const scrambleMoves = fixture.events
      .filter(({ event }) => event.type === 'MOVE' && event.move)
      .map(({ event }) => ({ move: event.move as string, cube: event.cubeTimestamp ?? null, host: event.timestamp }))

    expect(moves.length).toBeGreaterThan(0)

    const completed: Array<{ moves: string[]; startedAt: number; endedAt: number }> = []
    const session = new CaptureSession((capture) => { completed.push(capture) })

    const scramble = scrambleMoves.map((entry) => entry.move).join(' ')
    await session.setScramble(scramble)
    for (const entry of scrambleMoves) await session.handleMove(entry.move, entry.cube, entry.host)
    expect(session.snapshot.status, 'recorded turns verify the scramble they define').toBe('ready')

    session.beginInspection(scrambleMoves.at(-1)!.host + 1_000)
    const inverse = [...scrambleMoves].reverse().map((entry) => (entry.move.endsWith("'") ? entry.move.slice(0, -1) : entry.move.endsWith('2') ? entry.move : `${entry.move}'`))
    let host = scrambleMoves.at(-1)!.host + 2_000
    for (const move of inverse) {
      host += 120
      await session.handleMove(move, null, host)
    }

    expect(session.snapshot.status).toBe('complete')
    expect(completed).toHaveLength(1)
    expect(completed[0].moves).toEqual(inverse)
    expect(completed[0].endedAt).toBeGreaterThan(completed[0].startedAt)
  }, 60_000)

  it('recognises the solved state recorded before the first turn', () => {
    const fixture = fixtures.find(({ fixture }) => fixture.protocol.id === 'qiyi')!.fixture
    const first = fixture.events.find(({ event }) => event.type === 'FACELETS')!.event.facelets!

    expect(isSolvedFacelets(first)).toBe(true)
  })
})
