import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installMockBluetoothFromFixture } from '../../node_modules/smartcube-web-bluetooth/src/test/bluetooth-mock/index'
import type { FixtureSession } from '../../node_modules/smartcube-web-bluetooth/src/test/fixtures/types'
import { bluetoothSource } from './sources'

const fixture = JSON.parse(readFileSync(`${process.cwd()}/node_modules/smartcube-web-bluetooth/captures/fixture_GANi4_A26E_gan-gen4_2026-04-14T11-38-02.json`, 'utf8')) as FixtureSession
const name = fixture.device.name ?? ''
const mac = fixture.device.mac ?? ''
const key = `smartcube-coach:cube-mac:${name}`

describe('GAN i4 without a broadcast MAC', () => {
  beforeEach(() => {
    delete (globalThis as { navigator?: { bluetooth?: unknown } }).navigator?.bluetooth
    localStorage.clear()
  })
  afterEach(() => vi.restoreAllMocks())

  it('connects with the MAC remembered for that cube, without asking', async () => {
    localStorage.setItem(key, mac)
    const prompt = vi.spyOn(window, 'prompt')
    installMockBluetoothFromFixture(fixture, { deviceId: 'gan4-remembered' })
    const handle = await bluetoothSource({ requestInitialState: false }).start(() => {}, () => {})
    expect(handle.protocol).toBe('GAN Gen4')
    expect(prompt).not.toHaveBeenCalled()
    await handle.stop()
  }, 60_000)

  it('asks once when nothing is remembered, then remembers the verified MAC', async () => {
    const prompt = vi.spyOn(window, 'prompt').mockReturnValue(mac)
    installMockBluetoothFromFixture(fixture, { deviceId: 'gan4-asked' })
    const handle = await bluetoothSource({ requestInitialState: false }).start(() => {}, () => {})
    expect(handle.protocol).toBe('GAN Gen4')
    expect(prompt).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem(key)?.toLowerCase()).toBe(mac.toLowerCase())
    await handle.stop()
  }, 60_000)
})
