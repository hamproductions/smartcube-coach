import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { FaceletReconciler } from '../domain/faceletReconciliation'
import { CaptureSession, fitCubeTimestamp } from './capture'

type FixtureEvent = { event: { type: string; timestamp: number; move?: string; facelets?: string; cubeTimestamp?: number } }
type Fixture = { device: { name: string; mac: string }; events: FixtureEvent[] }

const fixture = JSON.parse(readFileSync(`${process.cwd()}/node_modules/smartcube-web-bluetooth/captures/fixture_QY-QYSC-S-A0E6________qiyi_2026-04-14T11-37-22.json`, 'utf8')) as Fixture
const recorded = fixture.events.map(({ event }) => event)
const moves = recorded.filter((event) => event.type === 'MOVE' && event.move)

describe('connected-cube resilience on recorded traffic', () => {
  it('keeps corrected timing stable when host delivery jitters', () => {
    const points = moves.slice(0, 20).map((event, index) => ({ cube: event.cubeTimestamp!, host: event.timestamp + (index % 2 ? 45 : -45) }))
    const fit = fitCubeTimestamp(points)
    const drift = points.map((point) => Math.abs(fit(point.cube) - point.host))

    expect(Math.max(...drift)).toBeLessThanOrEqual(110)
    expect(fit(points[0].cube)).toBeLessThan(fit(points.at(-1)!.cube))
  })

  it('still verifies facelets when a facelet packet is dropped', () => {
    const reconciler = new FaceletReconciler()
    const statuses: string[] = []
    let faceletSeen = 0

    for (const event of recorded) {
      if (event.type === 'MOVE' && event.move) reconciler.recordMove(event.move)
      if (event.type === 'FACELETS' && event.facelets) {
        faceletSeen += 1
        if (faceletSeen % 3 === 0) continue
        statuses.push(reconciler.reconcile(event.facelets).status)
      }
    }

    expect(statuses.length).toBeGreaterThan(5)
    expect(statuses.filter((status) => status !== 'baseline' && status !== 'verified')).toEqual([])
  })

  it('reports a mismatch instead of silently accepting a lost move', () => {
    const reconciler = new FaceletReconciler()
    const first = recorded.find((event) => event.type === 'FACELETS')!.facelets!
    reconciler.reconcile(first)

    const stream = recorded.filter((event) => event.type === 'MOVE' || event.type === 'FACELETS')
    let dropped = false
    let result = 'baseline'

    for (const event of stream) {
      if (event.type === 'MOVE' && event.move) {
        if (!dropped) { dropped = true; continue }
        reconciler.recordMove(event.move)
      }
      if (event.type === 'FACELETS' && event.facelets) {
        result = reconciler.reconcile(event.facelets).status
        if (result === 'mismatch') break
      }
    }

    expect(result).toBe('mismatch')
  })

  it('discards a disconnected session instead of publishing a stale solve', async () => {
    const completed: string[][] = []
    const session = new CaptureSession((capture) => { completed.push(capture.moves) })
    const scramble = moves.slice(0, 10).map((event) => event.move as string)

    await session.setScramble(scramble.join(' '))
    for (const move of scramble) await session.handleMove(move, null, Date.now())
    expect(session.snapshot.status).toBe('ready')

    session.beginInspection(Date.now())
    session.reset()

    const inverse = [...scramble].reverse().map((move) => move.endsWith("'") ? move.slice(0, -1) : `${move}'`)
    for (const move of inverse) await session.handleMove(move, null, Date.now())

    expect(completed).toEqual([])
    expect(session.snapshot.status).toBe('idle')
  }, 30_000)

  it('accepts the same cube again after a drop', async () => {
    const session = new CaptureSession(() => {})
    const scramble = moves.slice(0, 6).map((event) => event.move as string)

    await session.setScramble(scramble.join(' '))
    for (const move of scramble) await session.handleMove(move, null, Date.now())
    session.reset()
    await session.setScramble(scramble.join(' '))
    for (const move of scramble) await session.handleMove(move, null, Date.now())

    expect(session.snapshot.status).toBe('ready')
    expect(session.snapshot.scrambleMoves).toEqual(scramble)
  }, 30_000)
})
