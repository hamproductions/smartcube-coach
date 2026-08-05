import type { CubeEvent } from './inputSource'
import type { FixtureSession } from './vendor'

const recordings: Record<string, string> = {
  qiyi: 'fixture_QY-QYSC-S-A0E6________qiyi_2026-04-14T11-37-22.json',
  tornado: 'fixture_XMD-TornadoV4-i-034C__qiyi_2026-04-14T11-46-25.json',
  giiker: 'fixture_Giiker_i3SE_giiker_2026-04-14T11-42-39.json',
  gocube: 'fixture_GoCube_gocube_2026-04-14T11-43-52.json',
  rubiks: 'fixture_Rubiks_Connected_gocube_2026-04-14T11-50-17.json',
  moyu32: 'fixture_WCU_MY32_A388_moyu32_2026-04-15T06-43-44.json',
  moyu33: 'fixture_WCU_MY33_AF9E_moyu32_2026-04-14T11-53-23.json',
  gan2: 'fixture_GAN12ui--B3C_gan-gen2_2026-04-14T11-40-51.json',
  gan4: 'fixture_GANi4_A26E_gan-gen4_2026-04-14T11-38-02.json'
}

export type RecordedCube = {
  name: string
  mac: string
  protocol: string
  events: CubeEvent[]
}

export function requestedRecording(search = globalThis.location?.search ?? '') {
  const value = new URLSearchParams(search).get('replayCube')
  return value && recordings[value] ? value : undefined
}

export async function installRecordedCube(key: string): Promise<RecordedCube> {
  if (!import.meta.env.DEV) throw new Error('Recorded cubes are a development-only harness')
  const file = recordings[key]
  if (!file) throw new Error(`Unknown recorded cube: ${key}`)

  const response = await fetch(`/node_modules/smartcube-web-bluetooth/captures/${file}`)
  if (!response.ok) throw new Error(`Recorded capture unavailable: ${file}`)
  const fixture = await response.json() as FixtureSession
  const { installMockBluetoothFromFixture } = await import('../../node_modules/smartcube-web-bluetooth/src/test/bluetooth-mock/index')
  Object.defineProperty(globalThis.navigator, 'bluetooth', { value: undefined, writable: true, configurable: true })
  Object.defineProperty(globalThis, 'navigator', { value: globalThis.navigator, writable: true, configurable: true })
  installMockBluetoothFromFixture(fixture)

  return {
    name: fixture.device.name.trim(),
    mac: fixture.device.mac ?? '',
    protocol: fixture.protocol.name,
    events: fixture.events.map((entry) => entry.event as CubeEvent)
  }
}

export async function replayRecordedEvents(cube: RecordedCube, onEvent: (event: CubeEvent) => void | Promise<void>, delayMs = 10) {
  for (const event of cube.events) {
    await onEvent(event)
    if (delayMs) await new Promise((resolve) => { setTimeout(resolve, delayMs) })
  }
  if (new URLSearchParams(globalThis.location?.search ?? '').get('replayDrop') === '1') {
    await onEvent({ type: 'DISCONNECT', timestamp: Date.now() } as CubeEvent)
  }
}
