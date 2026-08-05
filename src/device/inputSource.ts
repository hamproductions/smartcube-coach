
export type CubeMoveEvent = {
  type: 'MOVE'
  move: string
  face: number
  direction: number
  timestamp: number
  cubeTimestamp: number | null
  localTimestamp: number | null
}

export type CubeFaceletsEvent = { type: 'FACELETS'; facelets: string; timestamp: number }
export type CubeGyroEvent = { type: 'GYRO'; quaternion: { x: number; y: number; z: number; w: number }; velocity?: { x: number; y: number; z: number }; timestamp: number }
export type CubeBatteryEvent = { type: 'BATTERY'; batteryLevel: number; timestamp: number }
export type CubeHardwareEvent = { type: 'HARDWARE'; timestamp: number; [key: string]: unknown }
export type CubeDisconnectEvent = { type: 'DISCONNECT'; timestamp: number }

export type CubeEvent =
  | CubeMoveEvent
  | CubeFaceletsEvent
  | CubeGyroEvent
  | CubeBatteryEvent
  | CubeHardwareEvent
  | CubeDisconnectEvent

export type CubeCapabilities = {
  facelets?: boolean
  battery?: boolean
  hardware?: boolean
  gyro?: boolean
  gyroscope?: boolean
  reset?: boolean
}

export type CubeProvenance = 'cube' | 'replay' | 'simulator'

export type CubeInputHandle = {
  name: string
  protocol: string
  mac: string
  capabilities: CubeCapabilities
  provenance: CubeProvenance
  done?: Promise<void>
  requestState(): Promise<void>
  resetToSolved?(): Promise<boolean>
  stop(): Promise<void>
}

export type CubeInputSource = {
  id: string
  label: string
  start(
    onEvent: (event: CubeEvent) => void | Promise<void>,
    onStatus: (message: string) => void
  ): Promise<CubeInputHandle>
}

export function describeHandle(handle: CubeInputHandle) {
  const capabilities = Object.entries(handle.capabilities)
    .filter(([, value]) => typeof value === 'boolean')
    .map(([key, value]) => `${key}=${value ? 'yes' : 'no'}`)
    .join(' ')
  return `${handle.name || 'unnamed'} · ${handle.protocol} · ${handle.provenance}${capabilities ? ` · ${capabilities}` : ''}`
}
