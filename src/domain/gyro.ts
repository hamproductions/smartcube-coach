export type Quaternion = { x: number; y: number; z: number; w: number }

export function normalizeQuaternion(quaternion: Quaternion): Quaternion | undefined {
  const values = [quaternion.x, quaternion.y, quaternion.z, quaternion.w]
  if (!values.every(Number.isFinite)) return undefined
  const magnitude = Math.hypot(...values)
  if (!magnitude) return undefined
  return { x: quaternion.x / magnitude, y: quaternion.y / magnitude, z: quaternion.z / magnitude, w: quaternion.w / magnitude }
}

export function gyroRotationDegrees(reference: Quaternion, current: Quaternion) {
  const normalizedReference = normalizeQuaternion(reference)
  const normalizedCurrent = normalizeQuaternion(current)
  if (!normalizedReference || !normalizedCurrent) return undefined
  const dot = Math.min(1, Math.max(-1, Math.abs(normalizedReference.x * normalizedCurrent.x + normalizedReference.y * normalizedCurrent.y + normalizedReference.z * normalizedCurrent.z + normalizedReference.w * normalizedCurrent.w)))
  return Math.round(2 * Math.acos(dot) * 180 / Math.PI)
}

const axisAngle = (axis: 'x' | 'y', degrees: number): Quaternion => {
  const half = degrees * Math.PI / 360
  return { x: axis === 'x' ? Math.sin(half) : 0, y: axis === 'y' ? Math.sin(half) : 0, z: 0, w: Math.cos(half) }
}

export const GYRO_HOME_ORIENTATION = multiply(axisAngle('x', 15), axisAngle('y', -5))

export function gyroSensorQuaternion(quaternion: Quaternion) {
  return normalizeQuaternion({ x: quaternion.x, y: quaternion.z, z: -quaternion.y, w: quaternion.w })
}

export function gyroDisplayQuaternion(basis: Quaternion, sensor: Quaternion) {
  return multiply(GYRO_HOME_ORIENTATION, multiply(basis, sensor))
}

export function conjugateQuaternion(quaternion: Quaternion): Quaternion {
  return { x: -quaternion.x, y: -quaternion.y, z: -quaternion.z, w: quaternion.w }
}

function multiply(left: Quaternion, right: Quaternion): Quaternion {
  return {
    x: left.w * right.x + left.x * right.w + left.y * right.z - left.z * right.y,
    y: left.w * right.y - left.x * right.z + left.y * right.w + left.z * right.x,
    z: left.w * right.z + left.x * right.y - left.y * right.x + left.z * right.w,
    w: left.w * right.w - left.x * right.x - left.y * right.y - left.z * right.z
  }
}

export function gyroRelativeEulerDegrees(reference: Quaternion, current: Quaternion) {
  const normalizedReference = normalizeQuaternion(reference)
  const normalizedCurrent = normalizeQuaternion(current)
  if (!normalizedReference || !normalizedCurrent) return undefined
  const relative = normalizeQuaternion(multiply({ x: -normalizedReference.x, y: -normalizedReference.y, z: -normalizedReference.z, w: normalizedReference.w }, normalizedCurrent))
  if (!relative) return undefined
  const pitch = Math.asin(Math.max(-1, Math.min(1, 2 * (relative.w * relative.y - relative.z * relative.x))))
  const roll = Math.atan2(2 * (relative.w * relative.x + relative.y * relative.z), 1 - 2 * (relative.x ** 2 + relative.y ** 2))
  const yaw = Math.atan2(2 * (relative.w * relative.z + relative.x * relative.y), 1 - 2 * (relative.y ** 2 + relative.z ** 2))
  return { pitch: Math.round(pitch * 180 / Math.PI), roll: Math.round(roll * 180 / Math.PI), yaw: Math.round(yaw * 180 / Math.PI) }
}

export function gyroVelocityMagnitude(velocity: { x: number; y: number; z: number } | undefined) {
  if (!velocity || ![velocity.x, velocity.y, velocity.z].every(Number.isFinite)) return undefined
  return Math.round(Math.hypot(velocity.x, velocity.y, velocity.z))
}

export function gyroPacket(packet: { quaternion: Quaternion; velocity?: { x: number; y: number; z: number } }) {
  return { quaternion: normalizeQuaternion(packet.quaternion), velocity: gyroVelocityMagnitude(packet.velocity) }
}
