import { GanGen4CubeEncrypter } from '../../node_modules/smartcube-web-bluetooth/src/gan-cube-encrypter'
import { GAN_ENCRYPTION_KEYS, GAN_GEN4_SERVICE, GAN_GEN4_STATE_CHARACTERISTIC } from '../../node_modules/smartcube-web-bluetooth/src/gan-cube-definitions'
import { isValidGanGen4Packet } from '../../node_modules/smartcube-web-bluetooth/src/gan-gen234-packet-validate'
import { macStringToSaltOrThrow } from '../../node_modules/smartcube-web-bluetooth/src/gan-mac-salt'

const GAN_I4_PREFIX = '0C:3D:5E'
const PACKETS_NEEDED = 6
const PACKETS_MAX = 24

export function ganMacCandidatesFromName(deviceName: string): string[] {
  const match = /^GANi\w*_([0-9A-Fa-f]{2})([0-9A-Fa-f]{2})\s*$/.exec(deviceName.trim())
  if (!match) return []
  const tail = `${match[1]}:${match[2]}`.toUpperCase()
  return Array.from({ length: 256 }, (_, byte) => `${GAN_I4_PREFIX}:${byte.toString(16).toUpperCase().padStart(2, '0')}:${tail}`)
}

export function matchGanGen4Mac(candidates: string[], packets: Uint8Array[]): string | null {
  if (packets.length < PACKETS_NEEDED) return null
  const key = GAN_ENCRYPTION_KEYS[0]
  const matching = candidates.filter((mac) => {
    const encrypter = new GanGen4CubeEncrypter(new Uint8Array(key.key), new Uint8Array(key.iv), macStringToSaltOrThrow(mac))
    return packets.every((packet) => packet.length >= 16 && isValidGanGen4Packet(encrypter.decrypt(packet)))
  })
  return matching.length === 1 ? matching[0] : null
}

export async function probeGanMacFromName(
  device: BluetoothDevice,
  onStatus: (status: string) => void = () => {},
  timeoutMs = 4000
): Promise<string | null> {
  const candidates = ganMacCandidatesFromName(device.name ?? '')
  if (!candidates.length || !device.gatt?.connected) return null
  let characteristic: BluetoothRemoteGATTCharacteristic
  try {
    const service = await device.gatt.getPrimaryService(GAN_GEN4_SERVICE)
    characteristic = await service.getCharacteristic(GAN_GEN4_STATE_CHARACTERISTIC)
  } catch {
    return null
  }
  const packets: Uint8Array[] = []
  return new Promise<string | null>((resolve) => {
    let settled = false
    const finish = (mac: string | null) => {
      if (settled) return
      settled = true
      clearTimeout(nudge)
      clearTimeout(deadline)
      characteristic.removeEventListener('characteristicvaluechanged', onPacket)
      void characteristic.stopNotifications().catch(() => undefined).then(() => resolve(mac))
    }
    const onPacket = () => {
      const value = characteristic.value
      if (!value) return
      packets.push(new Uint8Array(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength)))
      const mac = matchGanGen4Mac(candidates, packets)
      if (mac) finish(mac)
      else if (packets.length >= PACKETS_MAX) finish(null)
    }
    const nudge = setTimeout(() => onStatus('Turn any face or move the cube to finish connecting…'), 1200)
    const deadline = setTimeout(() => finish(null), timeoutMs)
    characteristic.addEventListener('characteristicvaluechanged', onPacket)
    characteristic.startNotifications().catch(() => finish(null))
  })
}
