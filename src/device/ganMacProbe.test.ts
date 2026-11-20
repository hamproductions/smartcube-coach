import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import type { FixtureSession } from '../../node_modules/smartcube-web-bluetooth/src/test/fixtures/types'
import { ganMacCandidatesFromName, matchGanGen4Mac, probeGanMacFromName } from './ganMacProbe'

const fixture = JSON.parse(readFileSync(`${process.cwd()}/node_modules/smartcube-web-bluetooth/captures/fixture_GANi4_A26E_gan-gen4_2026-04-14T11-38-02.json`, 'utf8')) as FixtureSession
const name = fixture.device.name ?? ''
const mac = fixture.device.mac ?? ''
const packets = fixture.traffic
  .filter((entry) => entry.op === 'notify' && entry.data)
  .map((entry) => Uint8Array.from((entry.data ?? '').match(/../g) ?? [], (byte) => parseInt(byte, 16)))

function fakeDevice(deviceName: string, emitted: Uint8Array[]) {
  const listeners = new Set<() => void>()
  const characteristic = {
    value: null as DataView | null,
    addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
    startNotifications: async () => {
      queueMicrotask(() => {
        for (const packet of emitted) {
          characteristic.value = new DataView(packet.buffer)
          for (const listener of [...listeners]) listener()
        }
      })
    },
    stopNotifications: vi.fn(async () => undefined)
  }
  const device = {
    name: deviceName,
    gatt: { connected: true, getPrimaryService: async () => ({ getCharacteristic: async () => characteristic }) }
  }
  return { device: device as unknown as BluetoothDevice, characteristic }
}

describe('GAN i4 MAC from the device name', () => {
  it('lists every address that ends with the name suffix', () => {
    const candidates = ganMacCandidatesFromName('GANi4_9072')
    expect(candidates).toHaveLength(256)
    expect(candidates.every((candidate) => /^0C:3D:5E:[0-9A-F]{2}:90:72$/.test(candidate))).toBe(true)
    expect(new Set(candidates).size).toBe(256)
    expect(ganMacCandidatesFromName(name)).toContain(mac)
  })

  it('offers nothing for names that do not carry the address suffix', () => {
    expect(ganMacCandidatesFromName('GAN12uiFp-753')).toEqual([])
    expect(ganMacCandidatesFromName('QY-QYSC-S-23C0')).toEqual([])
  })

  it('picks the recorded cube address from its own encrypted packets', () => {
    expect(packets.length).toBeGreaterThan(24)
    for (const count of [6, 12, 24]) expect(matchGanGen4Mac(ganMacCandidatesFromName(name), packets.slice(0, count))).toBe(mac)
  })

  it('waits for enough packets and rejects a suffix that is not this cube', () => {
    expect(matchGanGen4Mac(ganMacCandidatesFromName(name), packets.slice(0, 5))).toBeNull()
    expect(matchGanGen4Mac(ganMacCandidatesFromName('GANi4_9072'), packets.slice(0, 24))).toBeNull()
  })

  it('probes a connected cube without a prompt and releases the characteristic', async () => {
    const { device, characteristic } = fakeDevice(name, packets.slice(0, 12))
    expect(await probeGanMacFromName(device)).toBe(mac)
    expect(characteristic.stopNotifications).toHaveBeenCalledTimes(1)
  })

  it('gives up quietly when the cube sends nothing', async () => {
    const status = vi.fn()
    const { device } = fakeDevice(name, [])
    expect(await probeGanMacFromName(device, status, 50)).toBeNull()
    expect(await probeGanMacFromName(fakeDevice('GAN12uiFp-753', packets).device)).toBeNull()
  })
})
