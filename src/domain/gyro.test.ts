import { describe, expect, it } from 'vitest'
import { gyroPacket, gyroRotationDegrees, gyroRelativeEulerDegrees, gyroVelocityMagnitude, normalizeQuaternion } from './gyro'

describe('gyro orientation', () => {
  it('normalizes a valid device quaternion', () => {
    expect(normalizeQuaternion({ x: 0, y: 0, z: 0, w: 2 })).toEqual({ x: 0, y: 0, z: 0, w: 1 })
  })

  it('rejects invalid gyro packets and measures calibration-relative rotation', () => {
    expect(normalizeQuaternion({ x: 0, y: 0, z: 0, w: 0 })).toBeUndefined()
    expect(gyroRotationDegrees({ x: 0, y: 0, z: 0, w: 1 }, { x: 0, y: 0, z: 1, w: 0 })).toBe(180)
  })

  it('reports calibration-relative pitch, roll, and yaw', () => {
    expect(gyroRelativeEulerDegrees({ x: 0, y: 0, z: 0, w: 1 }, { x: 0, y: 0, z: Math.SQRT1_2, w: Math.SQRT1_2 })).toEqual({ pitch: 0, roll: 0, yaw: 90 })
    expect(gyroRelativeEulerDegrees({ x: 0, y: 0, z: 0, w: 4 }, { x: 0, y: 0, z: 2 * Math.SQRT1_2, w: 2 * Math.SQRT1_2 })).toEqual({ pitch: 0, roll: 0, yaw: 90 })
  })

  it('rejects invalid orientation inputs instead of inventing an angle', () => {
    expect(gyroRotationDegrees({ x: 0, y: 0, z: 0, w: 0 }, { x: 0, y: 0, z: 0, w: 1 })).toBeUndefined()
    expect(gyroRelativeEulerDegrees({ x: 0, y: 0, z: 0, w: 0 }, { x: 0, y: 0, z: 0, w: 1 })).toBeUndefined()
  })

  it('reports a finite raw angular-velocity magnitude only', () => {
    expect(gyroVelocityMagnitude({ x: 3, y: 4, z: 0 })).toBe(5)
    expect(gyroVelocityMagnitude({ x: Infinity, y: 0, z: 0 })).toBeUndefined()
  })

  it('normalizes each gyro packet at one boundary', () => {
    expect(gyroPacket({ quaternion: { x: 0, y: 0, z: 0, w: 2 }, velocity: { x: 3, y: 4, z: 0 } })).toEqual({ quaternion: { x: 0, y: 0, z: 0, w: 1 }, velocity: 5 })
    expect(gyroPacket({ quaternion: { x: 0, y: 0, z: 0, w: 0 } })).toEqual({ quaternion: undefined, velocity: undefined })
  })
})
