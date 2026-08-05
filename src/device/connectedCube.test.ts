import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it } from 'vitest'
import { installMockBluetoothFromFixture } from '../../node_modules/smartcube-web-bluetooth/src/test/bluetooth-mock/index'
import type { FixtureSession } from '../../node_modules/smartcube-web-bluetooth/src/test/fixtures/types'
import type { CubeEvent } from './inputSource'
import { FaceletReconciler } from '../domain/faceletReconciliation'
import { segmentCfop } from '../domain/reconstruction'
import { CaptureSession } from './capture'
import { connectWebCube } from './webBluetooth'

const capturesDir = `${process.cwd()}/node_modules/smartcube-web-bluetooth/captures/`
const loadFixture = (name: string) => JSON.parse(readFileSync(capturesDir + name, 'utf8')) as FixtureSession

const qiyi = loadFixture('fixture_QY-QYSC-S-A0E6________qiyi_2026-04-14T11-37-22.json')
const qiyiMac = qiyi.device.mac ?? ''

describe('connecting a recorded smart cube through the application path', () => {
  beforeEach(() => {
    delete (globalThis as { navigator?: { bluetooth?: unknown } }).navigator?.bluetooth
  })

  it('pairs a recorded QiYi cube, negotiates capabilities and streams real packets', async () => {
    const { replayer } = installMockBluetoothFromFixture(qiyi)
    const events: CubeEvent[] = []
    const statuses: string[] = []

    const cube = await connectWebCube((event) => { events.push(event) }, (status) => { statuses.push(status) }, { manualMac: qiyiMac, requestInitialState: false })
    await replayer.drainNotificationsAsync()

    expect(cube.protocol).toBe('QiYi')
    expect(cube.name.trim()).toBe('QY-QYSC-S-A0E6')
    expect(cube.mac.toUpperCase()).toBe(qiyiMac.toUpperCase())
    expect(cube.capabilities.facelets).toBe(true)
    expect(statuses.some((status) => status.includes('CC:A3:00:00:A0:E6'))).toBe(true)
    expect(events.some((event) => event.type === 'FACELETS')).toBe(true)

    await cube.disconnect()
  }, 60_000)

  it('drives capture, reconciliation and CFOP analysis from the connected cube stream', async () => {
    const { replayer } = installMockBluetoothFromFixture(qiyi)
    const reconciler = new FaceletReconciler()
    const reconciliations: string[] = []
    const moves: Array<{ move: string; cube: number | null; host: number }> = []

    const cube = await connectWebCube((event) => {
      if (event.type === 'MOVE') {
        reconciler.recordMove(event.move)
        moves.push({ move: event.move, cube: event.cubeTimestamp ?? null, host: event.timestamp })
      }
      if (event.type === 'FACELETS') reconciliations.push(reconciler.reconcile(event.facelets).status)
    }, () => {}, { manualMac: qiyiMac, requestInitialState: false })

    await replayer.drainNotificationsAsync()
    await cube.disconnect()

    expect(moves.length).toBeGreaterThan(0)
    expect(reconciliations.length).toBeGreaterThan(0)
    expect(reconciliations.filter((status) => status !== 'baseline' && status !== 'verified')).toEqual([])

    const completed: string[][] = []
    const session = new CaptureSession((capture) => { completed.push(capture.moves) })
    const scramble = moves.map((entry) => entry.move).join(' ')
    await session.setScramble(scramble)
    for (const entry of moves) await session.handleMove(entry.move, entry.cube, entry.host)
    expect(session.snapshot.status).toBe('ready')

    session.beginInspection(moves.at(-1)!.host + 500)
    const inverse = [...moves].reverse().map(({ move }) => move.endsWith("'") ? move.slice(0, -1) : move.endsWith('2') ? move : `${move}'`)
    let host = moves.at(-1)!.host + 1_000
    for (const move of inverse) {
      host += 150
      await session.handleMove(move, null, host)
    }

    expect(session.snapshot.status).toBe('complete')
    expect(completed).toHaveLength(1)

    const stages = await segmentCfop(scramble, inverse.map((move, index) => ({ move, timestamp: index * 150 })), 'recorded-cube')
    expect(stages.length).toBeGreaterThan(0)
    expect(stages.at(-1)!.endEvent).toBe(inverse.length - 1)
  }, 60_000)
})
