import { repositories } from './database'

import type { StickerColor } from '../components/ui/LastLayerDiagram'

export type Preferences = {
  playbackSpeed: number
  recordSessions: boolean
  /** WCA 15s inspection before the timer starts (export: settings_device_hub). */
  wcaInspection: boolean
  /** Which colour you hold on top, and which faces you, in case diagrams. */
  diagramTopColor: StickerColor
  diagramFrontColor: StickerColor
}

const KEY = 'preferences'

export const defaultPreferences: Preferences = {
  playbackSpeed: 1,
  recordSessions: false,
  wcaInspection: false,
  diagramTopColor: 'yellow',
  diagramFrontColor: 'green'
}

export async function readPreferences(): Promise<Preferences> {
  const record = await repositories.settings.get(KEY)
  return { ...defaultPreferences, ...(record?.value as Partial<Preferences> | undefined) }
}

export async function writePreference<K extends keyof Preferences>(key: K, value: Preferences[K]) {
  const current = await readPreferences()
  const next = { ...current, [key]: value }
  await repositories.settings.put({ key: KEY, value: next })
  return next
}
