import { describe, expect, it } from 'vitest'
import { isLastLayerSet, stickeringFor } from './CasePreview'

// Which visualization and stickering a set gets decides whether a card shows the right
// diagram at all — an OLL card rendered as a 3D F2L view is the defect this pins.
describe('case preview set classification', () => {
  it('treats last-layer sets as last layer and others as not', () => {
    for (const set of ['OLL', 'PLL', 'ZBLL', 'COLL', 'EPLL', '2-Look PLL', 'CMLL']) {
      expect(isLastLayerSet(set), set).toBe(true)
    }
    for (const set of ['F2L', 'VHLS', 'ZBLS', 'WVLS', 'L6E-EO']) {
      expect(isLastLayerSet(set), set).toBe(false)
    }
  })

  it('maps a set to the cubing.js stickering that masks the right pieces', () => {
    expect(stickeringFor('OLL')).toBe('OLL')
    expect(stickeringFor('PLL')).toBe('PLL')
    expect(stickeringFor('F2L')).toBe('F2L')
    expect(stickeringFor('CMLL')).toBe('CMLL')
    expect(stickeringFor('2-Look OLL')).toBe('OLL')
  })

  it('falls back to the full cube rather than an invalid stickering for an unknown set', () => {
    expect(stickeringFor('Roux blocks')).toBe('full')
  })
})
