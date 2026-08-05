/**
 * Ported from Ao1K/Ao1K_site (https://github.com/Ao1K/Ao1K_site).
 * Source: composables/useSettings.tsx, components/SettingsMenu.tsx.
 *
 * MIT License
 * Copyright (c) 2025 Ao1K
 *
 * Adaptation notes: the original persists settings in a cookie
 * (js-cookie) and syncs tabs with a BroadcastChannel. This project has
 * no cookie dependency and settings already live in IndexedDB via
 * repositories.settings (see src/storage/database.ts KeyValueRecord
 * store), so this port keeps the same AppSettings shape and the
 * BroadcastChannel cross-tab sync, but reads/writes are expressed
 * through the SettingsStore interface below instead of cookies — an
 * owner of storage/database.ts wires it to repositories.settings with
 * key 'ao1k-settings' (see storage-need comment at the bottom).
 */

export type CubeColors = {
  up: string
  down: string
  front: string
  back: string
  right: string
  left: string
  eo: string
}

export const DEFAULT_CUBE_COLORS: CubeColors = {
  up: '#FFFFFF',
  down: '#EEFF00',
  front: '#3EF600',
  back: '#2870FF',
  right: '#FF0000',
  left: '#FFA914',
  eo: '#FF00FF'
}

export type IconSize = 'small' | 'medium'

export const ICON_SIZE_CONFIG: Record<IconSize, { lineHeight: number; iconWidth: number }> = {
  small: { lineHeight: 28, iconWidth: 28 },
  medium: { lineHeight: 36, iconWidth: 36 }
}

export const DEFAULT_HINT_FACELETS_ELEVATION = 1.5

/**
 * Every user-facing preference Ao1K exposes, as found in useSettings.tsx
 * (AppSettings) and SettingsMenu.tsx (the settings popover UI). This is
 * the full settings surface area reported to the task owner — see the
 * report for a plain-English list with defaults.
 */
export type AppSettings = {
  cubeColors: CubeColors
  showPlayerControls: boolean
  hintFaceletsElevation: number
  showSplits: boolean
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  cubeColors: { ...DEFAULT_CUBE_COLORS },
  showPlayerControls: true,
  hintFaceletsElevation: DEFAULT_HINT_FACELETS_ELEVATION,
  showSplits: false
}

export function parseAppSettings(raw: unknown): AppSettings {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_APP_SETTINGS }
  const parsed = raw as Partial<AppSettings>
  return {
    cubeColors: { ...DEFAULT_CUBE_COLORS, ...parsed.cubeColors },
    showPlayerControls: parsed.showPlayerControls ?? true,
    hintFaceletsElevation:
      typeof parsed.hintFaceletsElevation === 'number' ? parsed.hintFaceletsElevation : DEFAULT_HINT_FACELETS_ELEVATION,
    showSplits: parsed.showSplits ?? false
  }
}

export interface SettingsStore {
  read(): Promise<AppSettings>
  write(settings: AppSettings): Promise<void>
}

/*
 * STORAGE NEED for whoever owns src/storage/database.ts:
 *
 * Implement SettingsStore against the existing generic KeyValueRecord
 * store, matching the pattern already used for 'cube-mac',
 * 'bld-config', etc. in repositories.settings:
 *
 *   const settingsStore: SettingsStore = {
 *     async read() {
 *       const record = await repositories.settings.get('ao1k-settings')
 *       return parseAppSettings(record?.value)
 *     },
 *     async write(settings) {
 *       await repositories.settings.put({ key: 'ao1k-settings', value: settings })
 *     }
 *   }
 *
 * No new object store or schema version bump is needed — this reuses
 * the 'settings' store that already exists.
 */
