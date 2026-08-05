import { describe, expect, it } from 'vitest'
import { DEFAULT_APP_SETTINGS, DEFAULT_CUBE_COLORS, DEFAULT_HINT_FACELETS_ELEVATION, parseAppSettings } from './settings'

describe('parseAppSettings', () => {
  it('returns defaults for undefined input', () => {
    expect(parseAppSettings(undefined)).toEqual(DEFAULT_APP_SETTINGS)
  })

  it('merges partial cube colors over the defaults', () => {
    const parsed = parseAppSettings({ cubeColors: { up: '#000000' } })
    expect(parsed.cubeColors).toEqual({ ...DEFAULT_CUBE_COLORS, up: '#000000' })
  })

  it('falls back to defaults for a malformed hintFaceletsElevation', () => {
    expect(parseAppSettings({ hintFaceletsElevation: 'not-a-number' }).hintFaceletsElevation).toBe(
      DEFAULT_HINT_FACELETS_ELEVATION
    )
    expect(parseAppSettings({ hintFaceletsElevation: 3.2 }).hintFaceletsElevation).toBe(3.2)
  })

  it('preserves explicit false booleans instead of coercing to defaults', () => {
    expect(parseAppSettings({ showPlayerControls: false, showSplits: true })).toMatchObject({
      showPlayerControls: false,
      showSplits: true
    })
  })
})
