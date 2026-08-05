import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { CubeEvent } from './inputSource'
import { runConnectionSelfTest, selfTestVerdict } from './selfTest'

const fixture = JSON.parse(readFileSync(`${process.cwd()}/node_modules/smartcube-web-bluetooth/captures/fixture_QY-QYSC-S-A0E6________qiyi_2026-04-14T11-37-22.json`, 'utf8')) as { events: Array<{ event: CubeEvent }> }
const recorded = fixture.events.map(({ event }) => event)

const check = (checks: ReturnType<typeof runConnectionSelfTest>, id: string) => checks.find((entry) => entry.id === id)!

describe('connection self-test', () => {
  it('passes on a healthy recorded QiYi session', () => {
    const checks = runConnectionSelfTest({
      supportsWebBluetooth: true,
      secureContext: true,
      capabilities: { facelets: true, battery: true, gyro: false },
      events: recorded
    })

    expect(check(checks, 'browser').status).toBe('pass')
    expect(check(checks, 'moves').status).toBe('pass')
    expect(check(checks, 'facelets').status).toBe('pass')
    expect(check(checks, 'gyro').status).toBe('unsupported')
    expect(check(checks, 'latency').status).toBe('pass')
  })

  it('fails the sticker check when the move stream disagrees with the packets', () => {
    const corrupted = recorded.map((event) => event.type === 'MOVE' ? { ...event, move: 'U' } as CubeEvent : event)
    const checks = runConnectionSelfTest({ supportsWebBluetooth: true, secureContext: true, capabilities: { facelets: true }, events: corrupted })

    expect(check(checks, 'facelets').status).toBe('fail')
    expect(selfTestVerdict(checks)).toBe('fail')
  })

  it('blames the insecure origin, not the browser, when the page is plain http', () => {
    const checks = runConnectionSelfTest({ supportsWebBluetooth: false, secureContext: false, origin: 'http://192.168.3.42:5173', events: [] })

    expect(check(checks, 'browser').detail).toContain('not a secure origin')
    expect(check(checks, 'secure').detail).toContain('http://192.168.3.42:5173')
    expect(check(checks, 'secure').detail).toContain('unsafely-treat-insecure-origin-as-secure')
    expect(selfTestVerdict(checks)).toBe('fail')
  })

  it('blames the browser when the origin is secure but Bluetooth is missing', () => {
    const checks = runConnectionSelfTest({ supportsWebBluetooth: false, secureContext: true, events: [] })

    expect(check(checks, 'browser').detail).toContain('Chromium')
    expect(check(checks, 'secure').status).toBe('pass')
  })

  it('asks for more turns instead of claiming success on an idle cube', () => {
    const checks = runConnectionSelfTest({ supportsWebBluetooth: true, secureContext: true, capabilities: { facelets: true, battery: true }, events: [] })

    expect(check(checks, 'moves').status).toBe('pending')
    expect(check(checks, 'latency').detail).toContain('Turn a few faces')
    expect(selfTestVerdict(checks)).toBe('pending')
  })

  it('reports a cube without facelets as unsupported rather than broken', () => {
    const checks = runConnectionSelfTest({ supportsWebBluetooth: true, secureContext: true, capabilities: { facelets: false }, events: recorded })

    expect(check(checks, 'facelets').status).toBe('unsupported')
    expect(selfTestVerdict(checks)).not.toBe('fail')
  })
})

describe('verification record', () => {
  it('marks a recorded device as not hardware and a real one as hardware', () => {
    const checks = runConnectionSelfTest({ supportsWebBluetooth: true, secureContext: true, adapterAvailable: true, capabilities: { facelets: true, battery: true }, events: recorded })
    const recordedRun = { ranAt: 1, device: 'QY', protocol: 'QiYi', verdict: selfTestVerdict(checks), simulated: true, checks }
    const hardwareRun = { ...recordedRun, simulated: false }

    expect(recordedRun.simulated, 'a replayed device is never presented as hardware').toBe(true)
    expect(hardwareRun.simulated).toBe(false)
    expect(recordedRun.verdict).toBe('pass')
  })
})

describe('adapter availability', () => {
  it('fails when the browser reports no usable adapter', () => {
    const checks = runConnectionSelfTest({ supportsWebBluetooth: true, secureContext: true, adapterAvailable: false, events: [] })
    const adapter = checks.find((entry) => entry.id === 'adapter')!

    expect(adapter.status).toBe('fail')
    expect(adapter.detail).toContain('switch Bluetooth on')
    expect(selfTestVerdict(checks)).toBe('fail')
  })

  it('passes when an adapter is available', () => {
    const checks = runConnectionSelfTest({ supportsWebBluetooth: true, secureContext: true, adapterAvailable: true, events: [] })

    expect(checks.find((entry) => entry.id === 'adapter')!.status).toBe('pass')
  })

  it('omits the adapter check when the browser has no Web Bluetooth at all', () => {
    const checks = runConnectionSelfTest({ supportsWebBluetooth: false, secureContext: true, events: [] })

    expect(checks.some((entry) => entry.id === 'adapter')).toBe(false)
  })
})

describe('pasteable diagnostics', () => {
  it('summarises device, capabilities, packets and every check', async () => {
    const { diagnosticsText } = await import('./selfTest')
    const checks = runConnectionSelfTest({ supportsWebBluetooth: true, secureContext: true, adapterAvailable: true, capabilities: { facelets: true, battery: true }, events: recorded })
    const text = diagnosticsText({
      device: { name: 'QY-QYSC-S-A0E6 ', mac: 'CC:A3:00:00:A0:E6', protocol: 'QiYi' },
      capabilities: { facelets: true, gyro: false },
      checks,
      packets: { total: 65, moves: 30, facelets: 33 },
      diagnostics: ['Unable to determine QiYi cube MAC address'],
      origin: 'http://127.0.0.1:5173'
    })

    expect(text).toContain('QY-QYSC-S-A0E6 · QiYi · MAC CC:A3:00:00:A0:E6')
    expect(text).toContain('facelets=yes gyro=no')
    expect(text).toContain('65 total, 30 moves, 33 facelets')
    expect(text).toContain('Unable to determine QiYi cube MAC address')
    expect(text.split('\n').length).toBeGreaterThan(checks.length)
  })

  it('marks a recorded device so pasted diagnostics cannot be mistaken for hardware', async () => {
    const { diagnosticsText } = await import('./selfTest')
    const text = diagnosticsText({ checks: [], origin: 'http://127.0.0.1:5173', simulated: true })

    expect(text).toContain('recorded device, not hardware')
    expect(text).toContain('device: none connected')
  })
})
