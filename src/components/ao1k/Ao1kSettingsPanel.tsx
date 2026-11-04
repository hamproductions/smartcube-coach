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
import { css, cx } from 'styled-system/css'
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

const row = css({ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4', minH: '44px' })
const smallButton = css({
  minH: '44px', px: '3', borderRadius: 'control', borderWidth: '1px', borderColor: 'floating', bg: 'transparent', color: 'ink',
  fontSize: 'sm', cursor: 'pointer', _hover: { bg: 'floating' },
  _focusVisible: { outline: '2px solid', outlineColor: 'green', outlineOffset: '2px' },
  _disabled: { opacity: '0.45', cursor: 'not-allowed', _hover: { bg: 'transparent' } }
})
const checkbox = css({ w: '5', h: '5', accentColor: 'green', cursor: 'pointer', _focusVisible: { outline: '2px solid', outlineColor: 'green', outlineOffset: '2px' } })

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
    <div className={css({ display: 'flex', flexDirection: 'column', gap: '3' })}>
      <label className={cx(row, css({ cursor: 'pointer' }))}>
        <span>Show player controls</span>
        <input type="checkbox" className={checkbox} checked={settings.showPlayerControls} onChange={() => setShowPlayerControls(!settings.showPlayerControls)} />
      </label>

      <label className={cx(row, css({ cursor: 'pointer' }))}>
        <span>Show splits</span>
        <input type="checkbox" className={checkbox} checked={settings.showSplits} onChange={() => setShowSplits(!settings.showSplits)} />
      </label>

      <div className={css({ display: 'flex', flexDirection: 'column', gap: '1' })}>
        <div className={row}>
          <label htmlFor="ao1k-hint-distance">Hint facelet distance <span className={css({ fontFamily: 'mono', color: 'inkVariant', fontSize: 'sm' })}>{settings.hintFaceletsElevation.toFixed(1)}</span></label>
          <button
            type="button"
            className={smallButton}
            aria-label="Reset hint facelet distance"
            onClick={() => setHintFaceletsElevation(DEFAULT_HINT_FACELETS_ELEVATION)}
            disabled={settings.hintFaceletsElevation === DEFAULT_HINT_FACELETS_ELEVATION}
          >
            Reset
          </button>
        </div>
        <input
          id="ao1k-hint-distance"
          type="range"
          min={0}
          max={6}
          step={0.1}
          value={settings.hintFaceletsElevation}
          onChange={(event) => setHintFaceletsElevation(Number.parseFloat(event.target.value))}
          className={css({ w: 'full', minH: '44px', accentColor: 'green', cursor: 'pointer' })}
        />
      </div>

      <div className={row}>
        <span>Cube colours</span>
        <button type="button" className={smallButton} aria-label="Reset cube colours" onClick={() => { resetCubeColors(); setActivePicker(null) }} disabled={isDefault}>
          Reset
        </button>
      </div>

      <div className={css({ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(4.5rem, 1fr))', gap: '2' })}>
        {FACE_LABELS.map(({ key, label }) => (
          <label key={key} className={css({ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1', fontSize: 'xs', color: 'inkVariant', cursor: 'pointer' })}>
            <input
              type="color"
              aria-label={`${label} colour`}
              value={settings.cubeColors[key]}
              onFocus={() => setActivePicker(key)}
              onChange={(event) => setCubeColors({ [key]: event.target.value })}
              className={css({
                w: '44px', h: '44px', p: '0', borderRadius: 'control', borderWidth: '1px', borderColor: 'floating', bg: 'transparent', cursor: 'pointer',
                _focusVisible: { outline: '2px solid', outlineColor: 'green', outlineOffset: '2px' }
              })}
            />
            <span>{label}</span>
          </label>
        ))}
      </div>

      {activePicker && (
        <label className={css({ display: 'flex', flexDirection: 'column', gap: '1.5', fontSize: 'sm', color: 'inkVariant', maxW: '16rem' })}>
          {FACE_LABELS.find((face) => face.key === activePicker)?.label} colour, hex
          <input
            type="text"
            value={settings.cubeColors[activePicker]}
            onChange={(event) => {
              const value = event.target.value
              if (/^#[0-9A-Fa-f]{0,6}$/.test(value)) setCubeColors({ [activePicker]: value })
            }}
            placeholder="#FFFFFF"
            className={css({
              minH: '44px', px: '3', borderRadius: 'control', bg: 'surface', color: 'ink', borderWidth: '1px', borderColor: 'floating', fontFamily: 'mono', fontSize: 'sm',
              _focusVisible: { outline: '2px solid', outlineColor: 'green', outlineOffset: '1px' }
            })}
          />
        </label>
      )}
    </div>
  )
}
