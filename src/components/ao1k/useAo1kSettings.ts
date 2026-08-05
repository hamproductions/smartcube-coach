/**
 * Ported from Ao1K/Ao1K_site (https://github.com/Ao1K/Ao1K_site).
 * Source: composables/useSettings.tsx (useSyncedSettings, useCubeColors,
 * useShowControls, useShowSplits, useHintFaceletsElevation).
 *
 * MIT License
 * Copyright (c) 2025 Ao1K
 *
 * Adaptation notes: cookie persistence (js-cookie) is replaced with
 * localStorage by default so this hook works standalone without a new
 * dependency or wiring into src/storage/database.ts, which this module
 * does not own. Pass a `store` implementing SettingsStore (see
 * src/domain/ao1k/settings.ts) to persist through repositories.settings
 * instead — that is the storage shape an owner of that file should wire
 * up (key 'ao1k-settings' in the existing KeyValueRecord 'settings' store).
 * Cross-tab sync via BroadcastChannel is preserved as in the original.
 */
import { useCallback, useEffect, useState } from 'react'
import { DEFAULT_APP_SETTINGS, parseAppSettings, type AppSettings, type CubeColors, type SettingsStore } from '../../domain/ao1k/settings'

const LOCAL_STORAGE_KEY = 'ao1kSettings'
const BROADCAST_CHANNEL_NAME = 'ao1k-settings-sync'

const localStorageStore: SettingsStore = {
  async read() {
    try {
      const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY)
      return parseAppSettings(raw ? JSON.parse(raw) : undefined)
    } catch {
      return { ...DEFAULT_APP_SETTINGS }
    }
  },
  async write(settings) {
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(settings))
  }
}

export function useAo1kSettings(store: SettingsStore = localStorageStore) {
  const [settings, setSettings] = useState<AppSettings>({ ...DEFAULT_APP_SETTINGS })

  useEffect(() => {
    let cancelled = false
    store.read().then((loaded) => {
      if (!cancelled) setSettings(loaded)
    })

    const channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME)
    channel.onmessage = () => {
      store.read().then((loaded) => {
        if (!cancelled) setSettings(loaded)
      })
    }

    return () => {
      cancelled = true
      channel.close()
    }
  }, [store])

  const updateSettings = useCallback(
    (next: AppSettings) => {
      setSettings(next)
      void store.write(next)
      const channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME)
      channel.postMessage('updated')
      channel.close()
    },
    [store]
  )

  const setCubeColors = useCallback(
    (colors: Partial<CubeColors>) => updateSettings({ ...settings, cubeColors: { ...settings.cubeColors, ...colors } }),
    [settings, updateSettings]
  )

  const resetCubeColors = useCallback(
    () => updateSettings({ ...settings, cubeColors: { ...DEFAULT_APP_SETTINGS.cubeColors } }),
    [settings, updateSettings]
  )

  const setShowPlayerControls = useCallback(
    (value: boolean) => updateSettings({ ...settings, showPlayerControls: value }),
    [settings, updateSettings]
  )

  const setShowSplits = useCallback(
    (value: boolean) => updateSettings({ ...settings, showSplits: value }),
    [settings, updateSettings]
  )

  const setHintFaceletsElevation = useCallback(
    (value: number) => updateSettings({ ...settings, hintFaceletsElevation: value }),
    [settings, updateSettings]
  )

  return {
    settings,
    setCubeColors,
    resetCubeColors,
    setShowPlayerControls,
    setShowSplits,
    setHintFaceletsElevation
  }
}
