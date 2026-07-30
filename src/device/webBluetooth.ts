import type { SmartCubeConnection, SmartCubeEvent } from '../../node_modules/smartcube-web-bluetooth/src/index'

export type ConnectedCube = {
  name: string
  mac: string
  protocol: string
  capabilities: SmartCubeConnection['capabilities']
  disconnect(): Promise<void>
}

export function supportsWebBluetooth() {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator
}

export async function connectWebCube(
  onEvent: (event: SmartCubeEvent) => void | Promise<void>,
  onStatus: (status: string) => void
): Promise<ConnectedCube> {
  if (!supportsWebBluetooth()) throw new Error('Web Bluetooth requires Chromium on desktop or Android')
  const { connectSmartCube } = await import('../../node_modules/smartcube-web-bluetooth/src/index')
  const connection = await connectSmartCube({ onStatus })
  const subscription = connection.events$.subscribe((event) => void onEvent(event))

  if (connection.capabilities.battery) await connection.sendCommand({ type: 'REQUEST_BATTERY' })
  if (connection.capabilities.hardware) await connection.sendCommand({ type: 'REQUEST_HARDWARE' })
  if (connection.capabilities.facelets) await connection.sendCommand({ type: 'REQUEST_FACELETS' })

  return {
    name: connection.deviceName,
    mac: connection.deviceMAC,
    protocol: connection.protocol.name,
    capabilities: connection.capabilities,
    async disconnect() {
      subscription.unsubscribe()
      await connection.disconnect()
    }
  }
}
