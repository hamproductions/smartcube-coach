import { repositories } from '../../storage/database'
import { parseAppSettings } from '../../domain/ao1k/settings'
import type { CubeColours } from './CubeRenderer'

export async function readCubeColours(): Promise<CubeColours> {
  const record = await repositories.settings.get('ao1k-settings')
  const colours = parseAppSettings(record?.value).cubeColors
  return { U: colours.up, D: colours.down, F: colours.front, B: colours.back, R: colours.right, L: colours.left }
}

export function onCubeColoursChange(listener: () => void) {
  if (typeof BroadcastChannel === 'undefined') return () => undefined
  const channel = new BroadcastChannel('ao1k-settings-sync')
  channel.onmessage = listener
  return () => channel.close()
}
