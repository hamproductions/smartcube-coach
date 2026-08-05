import { describe, expect, it } from 'vitest'
import { DeviceRecorder, deviceSessionFilename, parseDeviceSession } from './deviceRecorder'

const move = (name: string, timestamp: number) => ({ type: 'MOVE', move: name, timestamp, face: 0, direction: 1 } as never)

describe('device session recorder', () => {
  it('captures identity, capabilities, diagnostics and relative timings', () => {
    const recorder = new DeviceRecorder()
    recorder.identify({ name: 'QY-QYSC-S-A0E6', mac: 'CC:A3:00:00:A0:E6', protocol: 'QiYi' }, { facelets: true, gyro: false })
    recorder.note('Unable to determine QiYi cube MAC address')
    recorder.record(move('R', 10), 1_000)
    recorder.record(move("U'", 20), 1_250)

    const record = recorder.toJSON('2026-08-03T12:00:00.000Z')

    expect(record.format).toBe('smartcube-coach-session')
    expect(record.device).toEqual({ name: 'QY-QYSC-S-A0E6', mac: 'CC:A3:00:00:A0:E6', protocol: 'QiYi' })
    expect(record.capabilities.facelets).toBe(true)
    expect(record.diagnostics).toEqual(['Unable to determine QiYi cube MAC address'])
    expect(record.events.map((entry) => entry.t)).toEqual([0, 250])
    expect(recorder.size).toBe(2)
  })

  it('carries the scramble target so a replay reproduces the whole capture', () => {
    const recorder = new DeviceRecorder()
    recorder.identify({ name: 'QY', mac: '', protocol: 'QiYi' })
    recorder.target("R U R' U'")
    recorder.record(move('R', 1), 0)

    const parsed = parseDeviceSession(JSON.stringify(recorder.toJSON()))

    expect(parsed.scramble).toBe("R U R' U'")
  })

  it('omits the scramble when the session never had a target', () => {
    const recorder = new DeviceRecorder()
    recorder.identify({ name: 'QY', mac: '', protocol: 'QiYi' })
    recorder.record(move('R', 1), 0)

    expect(recorder.toJSON().scramble).toBeUndefined()
  })

  it('round-trips through the replay parser', () => {
    const recorder = new DeviceRecorder()
    recorder.identify({ name: 'QY', mac: '', protocol: 'QiYi' })
    recorder.record(move('R', 1), 0)

    const parsed = parseDeviceSession(JSON.stringify(recorder.toJSON()))

    expect(parsed.events).toHaveLength(1)
  })

  it('rejects files that are not device sessions', () => {
    expect(() => parseDeviceSession('{"format":"other"}')).toThrow('Not a Smart Cube Coach device session file')
    expect(() => parseDeviceSession(JSON.stringify({ format: 'smartcube-coach-session', version: 1, events: [] }))).toThrow('no events')
  })

  it('names the download after the device and capture time', () => {
    const recorder = new DeviceRecorder()
    recorder.identify({ name: 'QY-QYSC-S-A0E6   ', mac: '', protocol: 'QiYi' })
    recorder.record(move('R', 1), 0)

    expect(deviceSessionFilename(recorder.toJSON('2026-08-03T12:34:56.000Z'))).toBe('cube-session-QY-QYSC-S-A0E6-2026-08-03T12-34-56.json')
  })
})
