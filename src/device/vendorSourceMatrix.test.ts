import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it } from 'vitest'
import { installMockBluetoothFromFixture } from '../../node_modules/smartcube-web-bluetooth/src/test/bluetooth-mock/index'
import type { FixtureSession } from '../../node_modules/smartcube-web-bluetooth/src/test/fixtures/types'
import type { CubeEvent } from './inputSource'
import { FaceletReconciler } from '../domain/faceletReconciliation'
import { bluetoothSource } from './sources'

const capturesDir = `${process.cwd()}/node_modules/smartcube-web-bluetooth/captures/`
const loadFixture = (name: string) => JSON.parse(readFileSync(capturesDir + name, 'utf8')) as FixtureSession

type Vendor = { key: string; file: string; protocol: string; streams: boolean }

const vendors: Vendor[] = [
  { key: 'qiyi', file: 'fixture_QY-QYSC-S-A0E6________qiyi_2026-04-14T11-37-22.json', protocol: 'QiYi', streams: true },
  { key: 'tornado', file: 'fixture_XMD-TornadoV4-i-034C__qiyi_2026-04-14T11-46-25.json', protocol: 'QiYi', streams: true },
  { key: 'giiker', file: 'fixture_Giiker_i3SE_giiker_2026-04-14T11-42-39.json', protocol: 'Giiker', streams: true },
  { key: 'gocube', file: 'fixture_GoCube_gocube_2026-04-14T11-43-52.json', protocol: 'GoCube', streams: true },
  { key: 'rubiks', file: 'fixture_Rubiks_Connected_gocube_2026-04-14T11-50-17.json', protocol: 'GoCube', streams: true },
  { key: 'moyu32', file: 'fixture_WCU_MY32_A388_moyu32_2026-04-15T06-43-44.json', protocol: 'MoYu32', streams: false },
  { key: 'gan2', file: 'fixture_GAN12ui--B3C_gan-gen2_2026-04-14T11-40-51.json', protocol: 'GAN Gen2', streams: false },
  { key: 'gan4', file: 'fixture_GANi4_A26E_gan-gen4_2026-04-14T11-38-02.json', protocol: 'GAN Gen4', streams: false }
]

type VendorResult = {
  key: string
  connected: boolean
  protocol?: string
  provenance?: string
  moves: number
  facelets: number
  reconciliationFailures: number
  stateRequestError?: string
}

async function driveVendor(vendor: Vendor): Promise<VendorResult> {
  const fixture = loadFixture(vendor.file)
  const result: VendorResult = { key: vendor.key, connected: false, moves: 0, facelets: 0, reconciliationFailures: 0 }
  const { replayer } = installMockBluetoothFromFixture(fixture, { deviceId: vendor.key })
  const reconciler = new FaceletReconciler()
  const handle = await bluetoothSource({ manualMac: fixture.device.mac ?? '', requestInitialState: false }).start((event: CubeEvent) => {
    if (event.type === 'MOVE') {
      reconciler.recordMove(event.move)
      result.moves += 1
    }
    if (event.type === 'FACELETS') {
      result.facelets += 1
      const status = reconciler.reconcile(event.facelets).status
      if (status !== 'baseline' && status !== 'verified') result.reconciliationFailures += 1
    }
  }, () => {})
  result.connected = true
  result.protocol = handle.protocol
  result.provenance = handle.provenance
  try {
    await handle.requestState()
  } catch (error) {
    result.stateRequestError = error instanceof Error ? error.message : String(error)
  }
  await replayer.drainNotificationsAsync()
  await handle.stop()
  return result
}

describe('every vendor capture through the Bluetooth input source', () => {
  beforeEach(() => {
    delete (globalThis as { navigator?: { bluetooth?: unknown } }).navigator?.bluetooth
  })

  for (const vendor of vendors) {
    it(`connects ${vendor.key} through the adapter and reports it as a cube`, async () => {
      const result = await driveVendor(vendor)
      expect(result.connected).toBe(true)
      expect(result.protocol).toBe(vendor.protocol)
      expect(result.provenance).toBe('cube')
    }, 60_000)
  }

  for (const vendor of vendors.filter((entry) => entry.streams)) {
    it(`decodes ${vendor.key} packets into a self-consistent cube state`, async () => {
      const result = await driveVendor(vendor)
      expect(result.moves + result.facelets).toBeGreaterThan(0)
      expect(result.reconciliationFailures).toBe(0)
    }, 60_000)
  }

  it('reports the MoYu MY33 capture as a no-data connection instead of pretending it worked', async () => {
    const fixture = loadFixture('fixture_WCU_MY33_AF9E_moyu32_2026-04-14T11-53-23.json')
    installMockBluetoothFromFixture(fixture, { deviceId: 'moyu33' })
    await expect(bluetoothSource({ manualMac: fixture.device.mac ?? '', requestInitialState: false }).start(() => {}, () => {}))
      .rejects.toThrow(/connected but sent no data/)
  }, 60_000)

  it('keeps decoding after the mock rejects a mid-stream state request', async () => {
    const rejected = await driveVendor(vendors.find((entry) => entry.key === 'qiyi')!)
    expect(rejected.stateRequestError).toMatch(/Write payload mismatch/)
    expect(rejected.moves).toBeGreaterThan(0)
    expect(rejected.facelets).toBeGreaterThan(0)
    expect(rejected.reconciliationFailures).toBe(0)
  }, 60_000)
})
