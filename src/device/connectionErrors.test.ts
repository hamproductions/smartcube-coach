import { describe, expect, it } from 'vitest'
import { describeConnectionFailure } from './connectionErrors'

const domError = (name: string, message: string) => Object.assign(new Error(message), { name })

describe('connection failure messages', () => {
  it('explains a closed device picker without sounding like a fault', () => {
    const error = describeConnectionFailure(domError('NotFoundError', 'User cancelled the requestDevice() chooser.'), '')

    expect(error.message).toContain('Press Connect cube again')
    expect(error.message).not.toContain('requestDevice')
  })

  it('points at the show-all-devices switch when nothing matched the filters', () => {
    const error = describeConnectionFailure(domError('NotFoundError', 'No devices found'), '')

    expect(error.message).toContain('Show all devices')
  })

  it('explains a blocked permission as a browser setting, not a cube fault', () => {
    expect(describeConnectionFailure(domError('SecurityError', 'Bluetooth permission denied'), '').message).toContain('allow Bluetooth for this site')
  })

  it('names the device when the GATT link dies during setup', () => {
    expect(describeConnectionFailure(domError('NetworkError', 'GATT operation failed'), 'QY-QYSC-S-A0E6').message).toContain('QY-QYSC-S-A0E6')
  })

  it('offers the derived MAC candidates when QiYi cannot resolve its address', () => {
    const error = describeConnectionFailure(new Error('Unable to determine QiYi cube MAC address'), 'QY-QYSC-S-A0E6   ')

    expect(error.message).toContain('CC:A3:00:00:A0:E6')
    expect(error.message).toContain('QY-QYSC-S-A0E6')
  })

  it('tells the user to wake a silent cube', () => {
    expect(describeConnectionFailure(new Error('Timed out waiting for cube data.'), 'GAN i4').message).toContain('Turn a face to wake it')
  })

  it('passes an unknown failure through untouched', () => {
    const original = new Error('something else entirely')

    expect(describeConnectionFailure(original, '')).toBe(original)
  })
})
