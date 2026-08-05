import type { CubeEvent } from './inputSource'

export type DeviceSessionRecord = {
  format: 'smartcube-coach-session'
  version: 1
  recordedAt: string
  device: { name: string; mac: string; protocol: string }
  scramble?: string
  capabilities: Record<string, boolean>
  diagnostics: string[]
  events: Array<{ t: number; event: CubeEvent }>
}

export class DeviceRecorder {
  private events: Array<{ t: number; event: CubeEvent }> = []
  private diagnostics: string[] = []
  private device = { name: '', mac: '', protocol: '' }
  private scramble = ''
  private capabilities: Record<string, boolean> = {}
  private startedAt?: number

  identify(device: { name: string; mac: string; protocol: string }, capabilities: Record<string, boolean> = {}) {
    this.device = device
    this.capabilities = capabilities
  }

  target(scramble: string) {
    this.scramble = scramble
  }

  note(message: string) {
    this.diagnostics = [...this.diagnostics.slice(-49), message]
  }

  record(event: CubeEvent, at = Date.now()) {
    this.startedAt ??= at
    this.events.push({ t: at - this.startedAt, event })
  }

  get size() {
    return this.events.length
  }

  reset() {
    this.events = []
    this.diagnostics = []
    this.startedAt = undefined
  }

  toJSON(recordedAt = new Date().toISOString()): DeviceSessionRecord {
    return {
      format: 'smartcube-coach-session',
      version: 1,
      recordedAt,
      device: this.device,
      scramble: this.scramble || undefined,
      capabilities: this.capabilities,
      diagnostics: this.diagnostics,
      events: this.events
    }
  }
}

export function parseDeviceSession(text: string): DeviceSessionRecord {
  const parsed = JSON.parse(text) as Partial<DeviceSessionRecord>
  if (parsed.format !== 'smartcube-coach-session' || parsed.version !== 1) throw new Error('Not a Smart Cube Coach device session file')
  if (!Array.isArray(parsed.events) || !parsed.events.length) throw new Error('Device session contains no events')
  return parsed as DeviceSessionRecord
}

export function deviceSessionFilename(record: DeviceSessionRecord) {
  const name = (record.device.name || 'unknown-device').trim().replaceAll(/[^\w.-]+/g, '-')
  return `cube-session-${name}-${record.recordedAt.slice(0, 19).replaceAll(':', '-')}.json`
}
