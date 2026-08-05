import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { CubeEvent } from './inputSource'
import type { DeviceSessionRecord } from './deviceRecorder'
import { describeHandle, type CubeInputSource } from './inputSource'
import { sessionSource, simulatorSource } from './sources'
import { FaceletReconciler } from '../domain/faceletReconciliation'
import { CaptureSession } from './capture'
import { segmentCfop } from '../domain/reconstruction'

const fixture = JSON.parse(readFileSync(`${process.cwd()}/node_modules/smartcube-web-bluetooth/captures/fixture_QY-QYSC-S-A0E6________qiyi_2026-04-14T11-37-22.json`, 'utf8')) as { device: { name: string; mac: string }; protocol: { name: string }; events: Array<{ event: CubeEvent }> }

const record: DeviceSessionRecord = {
  format: 'smartcube-coach-session',
  version: 1,
  recordedAt: '2026-08-03T12:00:00.000Z',
  device: { name: fixture.device.name.trim(), mac: fixture.device.mac, protocol: fixture.protocol.name },
  capabilities: { facelets: true, battery: true },
  diagnostics: [],
  events: fixture.events.map((entry, index) => ({ t: index * 10, event: entry.event }))
}

const drain = async (source: CubeInputSource) => {
  const events: CubeEvent[] = []
  const statuses: string[] = []
  const handle = await source.start((event) => { events.push(event) }, (status) => { statuses.push(status) })
  await new Promise((resolve) => { setTimeout(resolve, 50) })
  await handle.stop()
  return { handle, events, statuses }
}

describe('every input source honours the same contract', () => {
  const sources: Array<[string, CubeInputSource]> = [
    ['recorded session', sessionSource(record)],
    ['simulator', simulatorSource({ seed: 'contract' })]
  ]

  it.each(sources)('%s exposes identity, capabilities, provenance and a working stop', async (_label, source) => {
    const { handle, events, statuses } = await drain(source)

    expect(handle.name.length + handle.protocol.length).toBeGreaterThan(0)
    expect(['cube', 'replay', 'simulator']).toContain(handle.provenance)
    expect(typeof handle.capabilities).toBe('object')
    expect(statuses.length, 'a source reports status').toBeGreaterThan(0)
    expect(events.length, 'a source emits packets').toBeGreaterThan(0)
    expect(describeHandle(handle)).toContain(handle.provenance)

    const before = events.length
    await new Promise((resolve) => { setTimeout(resolve, 30) })
    expect(events.length, 'stop() actually stops the stream').toBe(before)
  }, 30_000)

  it('feeds the identical downstream pipeline regardless of source', async () => {
    for (const [label, source] of sources) {
      const moves: Array<{ move: string; timestamp: number }> = []
      const reconciler = new FaceletReconciler()
      const statuses: string[] = []
      const handle = await source.start((event) => {
        if (event.type === 'MOVE') { moves.push({ move: event.move, timestamp: event.timestamp }); reconciler.recordMove(event.move) }
        if (event.type === 'FACELETS') statuses.push(reconciler.reconcile(event.facelets).status)
      }, () => {})
      await new Promise((resolve) => { setTimeout(resolve, 200) })
      await handle.stop()

      expect(moves.length, `${label} produced turns`).toBeGreaterThan(0)
      expect(statuses.filter((status) => status !== 'baseline' && status !== 'verified'), `${label} reconciles`).toEqual([])

      const session = new CaptureSession(() => {})
      const scramble = moves.slice(0, 6).map((entry) => entry.move)
      await session.setScramble(scramble.join(' '))
      for (const move of scramble) await session.handleMove(move, null, Date.now())
      expect(session.snapshot.status, `${label} drives capture`).toBe('ready')

      const stages = await segmentCfop(scramble.join(' '), moves.slice(0, 6).map((entry, index) => ({ move: entry.move, timestamp: index * 100 })), `src-${label}`)
      expect(Array.isArray(stages), `${label} drives analysis`).toBe(true)
    }
  }, 60_000)
})
