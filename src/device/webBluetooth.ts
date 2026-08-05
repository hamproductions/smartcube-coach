import { loadSmartCubeApi, type SmartCubeConnection, type SmartCubeEvent } from './vendor'
import { describeConnectionFailure } from './connectionErrors'
import { normalizeCubeMac } from './mac'

export type ConnectedCube = {
  name: string
  mac: string
  protocol: string
  capabilities: SmartCubeConnection['capabilities']
  requestFacelets(): Promise<void>
  resetToSolved(): Promise<boolean>
  disconnect(): Promise<void>
}

export function supportsWebBluetooth() {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator
}

export async function connectWebCube(
  onEvent: (event: SmartCubeEvent) => void | Promise<void>,
  onStatus: (status: string) => void,
  options: { manualMac?: string; requestInitialState?: boolean; anyDevice?: boolean } = {}
): Promise<ConnectedCube> {
  if (!supportsWebBluetooth()) throw new Error('Web Bluetooth requires Chromium on desktop or Android')
  const manualMac = options.manualMac?.trim() ? normalizeCubeMac(options.manualMac) : undefined
  const { connectSmartCube } = await loadSmartCubeApi()
  let selectedDeviceName = ''
  let connection: SmartCubeConnection
  try {
    connection = await connectSmartCube({
      onStatus,
      deviceSelection: options.anyDevice ? 'any' : 'filtered',
      enableAddressSearch: !manualMac,
      macAddressProvider: async (device) => {
        selectedDeviceName = device.name ?? ''
        if (manualMac) {
          onStatus(`Using entered MAC ${manualMac} for ${selectedDeviceName || 'the selected device'}`)
          return manualMac
        }
        return null
      }
    })
  } catch (error) {
    throw describeConnectionFailure(error, selectedDeviceName)
  }
  const subscription = connection.events$.subscribe((event) => void onEvent(event))

  if (options.requestInitialState !== false) {
    if (connection.capabilities.facelets) await connection.sendCommand({ type: 'REQUEST_FACELETS' })
    if (connection.capabilities.battery) await connection.sendCommand({ type: 'REQUEST_BATTERY' })
    if (connection.capabilities.hardware) await connection.sendCommand({ type: 'REQUEST_HARDWARE' })
  }

  return {
    name: connection.deviceName,
    mac: connection.deviceMAC,
    protocol: connection.protocol.name,
    capabilities: connection.capabilities,
    async requestFacelets() {
      if (connection.capabilities.facelets) await connection.sendCommand({ type: 'REQUEST_FACELETS' })
    },
    async resetToSolved() {
      if (!connection.capabilities.reset) return false
      await connection.sendCommand({ type: 'REQUEST_RESET' })
      return true
    },
    async disconnect() {
      subscription.unsubscribe()
      await connection.disconnect()
    }
  }
}
