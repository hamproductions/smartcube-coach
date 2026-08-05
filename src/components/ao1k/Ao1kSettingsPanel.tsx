/**
 * Ported from Ao1K/Ao1K_site (https://github.com/Ao1K/Ao1K_site).
 * Source: components/SettingsMenu.tsx.
 *
 * MIT License
 * Copyright (c) 2025 Ao1K
 *
 * Adaptation notes: `react-colorful`'s <HexColorPicker> is not a
 * dependency of this project, so each swatch opens a native
 * <input type="color"> instead of a custom picker; the color model
 * (seven named faces incl. an EO indicator color), reset-to-default
 * behaviour, and the three toggle/slider settings are otherwise ported
 * unchanged. This panel takes a SettingsStore from an owning component
 * (see src/domain/ao1k/settings.ts); it defaults to localStorage via
 * useAo1kSettings when none is supplied.
 */
import { useState } from 'react'
import { DEFAULT_CUBE_COLORS, DEFAULT_HINT_FACELETS_ELEVATION, type CubeColors, type SettingsStore } from '../../domain/ao1k/settings'
import { useAo1kSettings } from './useAo1kSettings'

const FACE_LABELS: { key: keyof CubeColors; label: string }[] = [
  { key: 'up', label: 'Up' },
  { key: 'down', label: 'Down' },
  { key: 'front', label: 'Front' },
  { key: 'back', label: 'Back' },
  { key: 'left', label: 'Left' },
  { key: 'right', label: 'Right' },
  { key: 'eo', label: 'EO' }
]

export type Ao1kSettingsPanelProps = {
  store?: SettingsStore
}

export function Ao1kSettingsPanel({ store }: Ao1kSettingsPanelProps) {
  const { settings, setCubeColors, resetCubeColors, setShowPlayerControls, setShowSplits, setHintFaceletsElevation } =
    useAo1kSettings(store)
  const [activePicker, setActivePicker] = useState<keyof CubeColors | null>(null)

  const isDefault = Object.entries(settings.cubeColors).every(
    ([key, value]) => value === DEFAULT_CUBE_COLORS[key as keyof CubeColors]
  )

  return (
    <div className="ao1k-settings-panel">
      <div className="ao1k-settings-panel__row">
        <span>Show Player Controls</span>
        <input
          type="checkbox"
          checked={settings.showPlayerControls}
          onChange={() => setShowPlayerControls(!settings.showPlayerControls)}
        />
      </div>

      <div className="ao1k-settings-panel__row">
        <span>Show Splits</span>
        <input type="checkbox" checked={settings.showSplits} onChange={() => setShowSplits(!settings.showSplits)} />
      </div>

      <div className="ao1k-settings-panel__row ao1k-settings-panel__row--column">
        <div className="ao1k-settings-panel__row">
          <span>Hint Facelet Distance</span>
          <button
            type="button"
            onClick={() => setHintFaceletsElevation(DEFAULT_HINT_FACELETS_ELEVATION)}
            disabled={settings.hintFaceletsElevation === DEFAULT_HINT_FACELETS_ELEVATION}
          >
            Reset
          </button>
        </div>
        <input
          type="range"
          min={0}
          max={6}
          step={0.1}
          value={settings.hintFaceletsElevation}
          onChange={(event) => setHintFaceletsElevation(Number.parseFloat(event.target.value))}
        />
      </div>

      <div className="ao1k-settings-panel__row">
        <span>Cube Colors</span>
        <button type="button" onClick={() => { resetCubeColors(); setActivePicker(null) }} disabled={isDefault}>
          Reset
        </button>
      </div>

      <div className="ao1k-settings-panel__swatches">
        {FACE_LABELS.map(({ key, label }) => (
          <label key={key} className="ao1k-settings-panel__swatch">
            <input
              type="color"
              value={settings.cubeColors[key]}
              onFocus={() => setActivePicker(key)}
              onChange={(event) => setCubeColors({ [key]: event.target.value })}
            />
            <span>{label}</span>
          </label>
        ))}
      </div>

      {activePicker && (
        <div className="ao1k-settings-panel__hex">
          <span>{FACE_LABELS.find((face) => face.key === activePicker)?.label} Color</span>
          <input
            type="text"
            value={settings.cubeColors[activePicker]}
            onChange={(event) => {
              const value = event.target.value
              if (/^#[0-9A-Fa-f]{0,6}$/.test(value)) setCubeColors({ [activePicker]: value })
            }}
            placeholder="#FFFFFF"
          />
        </div>
      )}
    </div>
  )
}
