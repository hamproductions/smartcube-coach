import { describe, expect, it } from 'vitest'
import { GYRO_HOME_ORIENTATION, gyroDisplayQuaternion, gyroPacket, gyroRotationDegrees, gyroRelativeEulerDegrees, gyroVelocityMagnitude, holdQuaternion, normalizeQuaternion } from './gyro'

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

describe('gyro in the solver hold', () => {
  const turn = (axis: 'x' | 'y' | 'z', degrees: number) => {
    const half = (degrees * Math.PI) / 360
    return { x: axis === 'x' ? Math.sin(half) : 0, y: axis === 'y' ? Math.sin(half) : 0, z: axis === 'z' ? Math.sin(half) : 0, w: Math.cos(half) }
  }
  const strip = (q: { x: number; y: number; z: number; w: number }) => {
    const home = GYRO_HOME_ORIENTATION
    const inverse = { x: -home.x, y: -home.y, z: -home.z, w: home.w }
    const m = (a: typeof q, b: typeof q) => ({
      x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
      y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
      z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
      w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z
    })
    return m(inverse, q)
  }
  const close = (a: { x: number; y: number; z: number; w: number }, b: typeof a) => {
    const dot = Math.abs(a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w)
    expect(dot).toBeGreaterThan(0.9999)
  }

  it('turns the shown cube about the world axis the held cube actually turned about', () => {
    const identity = { x: 0, y: 0, z: 0, w: 1 }
    const turned = turn('y', 90)
    close(strip(gyroDisplayQuaternion(identity, turned, holdQuaternion(''))), turned)
    close(strip(gyroDisplayQuaternion(identity, turned, holdQuaternion('z2'))), turn('y', -90))
    close(strip(gyroDisplayQuaternion(identity, turn('x', 90), holdQuaternion('z2'))), turn('x', -90))
    close(strip(gyroDisplayQuaternion(identity, turn('z', 90), holdQuaternion('z2'))), turn('z', 90))
  })
})
