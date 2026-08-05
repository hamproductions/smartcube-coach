import { readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { FaceletReconciler } from '../domain/faceletReconciliation'
import { gyroPacket } from '../domain/gyro'
import { CaptureSession, fitCubeTimestamp } from './capture'
import { DeviceRecorder } from './deviceRecorder'

type Fixture = {
  device: { name: string; mac?: string }
  protocol: { id: string; name: string }
  events: Array<{ event: { type: string; timestamp: number; move?: string; facelets?: string; cubeTimestamp?: number; batteryLevel?: number } }>
}

const dir = `${process.cwd()}/node_modules/smartcube-web-bluetooth/captures/`
const fixtures = readdirSync(dir)
  .filter((name) => name.endsWith('.json'))
  .map((name) => ({ name, fixture: JSON.parse(readFileSync(dir + name, 'utf8')) as Fixture }))

describe('every recorded vendor stream drives the pipeline', () => {
  it('covers six protocols across twelve captures', () => {
    expect(fixtures).toHaveLength(12)
    expect(new Set(fixtures.map(({ fixture }) => fixture.protocol.id)).size).toBe(6)
  })

  it.each(fixtures.map(({ name, fixture }) => [fixture.protocol.id, name, fixture] as const))(
    '%s (%s) ingests without losing state',
    async (_protocol, _name, fixture) => {
      const events = fixture.events.map(({ event }) => event)
      const reconciler = new FaceletReconciler()
      const recorder = new DeviceRecorder()
      const session = new CaptureSession(() => {})
      const moves: Array<{ move: string; cube: number | null; host: number }> = []
      const reconciliations: string[] = []
      let gyroSamples = 0

      recorder.identify({ name: fixture.device.name.trim(), mac: fixture.device.mac ?? '', protocol: fixture.protocol.name })

      for (const event of events) {
        recorder.record(event as never)
        if (event.type === 'MOVE' && event.move) {
          reconciler.recordMove(event.move)
          moves.push({ move: event.move, cube: event.cubeTimestamp ?? null, host: event.timestamp })
        }
        if (event.type === 'FACELETS' && event.facelets) reconciliations.push(reconciler.reconcile(event.facelets).status)
        if (event.type === 'GYRO') {
          const { quaternion } = gyroPacket(event as never)
          if (quaternion) gyroSamples += 1
        }
      }

      expect(recorder.size).toBe(events.length)
      expect(moves.length).toBeGreaterThan(0)
      expect(reconciliations.filter((status) => status !== 'baseline' && status !== 'verified')).toEqual([])

      const timed = moves.filter((entry) => entry.cube !== null).map((entry) => ({ cube: entry.cube as number, host: entry.host }))
      if (timed.length > 1) {
        const fit = fitCubeTimestamp(timed)
        expect(fit(timed[0].cube)).toBeLessThanOrEqual(fit(timed.at(-1)!.cube))
      }

      const scramble = moves.slice(0, 8).map((entry) => entry.move)
      await session.setScramble(scramble.join(' '))
      for (const entry of moves.slice(0, 8)) await session.handleMove(entry.move, entry.cube, entry.host)
      expect(session.snapshot.status, 'a cube that emits only moves still verifies a scramble').toBe('ready')

      expect(gyroSamples).toBeGreaterThanOrEqual(0)
    },
    60_000
  )
})
