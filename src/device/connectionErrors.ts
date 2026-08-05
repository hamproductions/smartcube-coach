import { cubeMacCandidatesFromName } from './mac'

export function describeConnectionFailure(error: unknown, deviceName: string): Error {
  const message = error instanceof Error ? error.message : String(error)
  const name = error instanceof Error ? error.name : ''
  const selected = deviceName.trim() || 'unnamed device'

  if (name === 'NotFoundError' && /user cancel|chooser/i.test(message)) {
    return new Error('Device picker closed without choosing a cube. Press Connect cube again and pick your cube from the list.')
  }
  if (name === 'NotFoundError') {
    return new Error('No matching cube appeared in the picker. Tick "Show all devices" so every Bluetooth device is offered, then select your cube.')
  }
  if (name === 'SecurityError' || /permission/i.test(message)) {
    return new Error('The browser blocked Bluetooth access. Open the app over https or localhost in Chrome, then allow Bluetooth for this site.')
  }
  if (name === 'NetworkError' || /gatt/i.test(message)) {
    return new Error(`Lost the GATT connection to ${selected} during setup. Wake the cube with a turn and press Connect cube again.`)
  }
  if (message === 'Unable to determine QiYi cube MAC address') {
    const candidates = cubeMacCandidatesFromName(deviceName)
    const hint = candidates.length
      ? `Try ${candidates.join(' or ')} in the cube MAC field, then reconnect.`
      : 'Enter the cube MAC address shown by the vendor app in the cube MAC field, then reconnect.'
    return new Error(`${message}. Selected advertisement: ${selected}. ${hint}`)
  }
  if (/timed out/i.test(message)) {
    return new Error(`${selected} connected but sent no data. Turn a face to wake it and press Connect cube again; if it repeats, check the entered MAC.`)
  }

  return error instanceof Error ? error : new Error(message)
}
