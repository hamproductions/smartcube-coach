import { describe, expect, it } from 'vitest'
import type { SolveRecord } from './models'

const label = (solve: Pick<SolveRecord, 'source' | 'stateVerified'>) =>
  solve.source === 'cube'
    ? solve.stateVerified ? 'cube, state-verified' : 'cube, UNVERIFIED move stream'
    : solve.source === 'replay' ? 'replayed session' : 'simulator'

describe('solve provenance', () => {
  it('distinguishes a verified hardware capture from an unverified one', () => {
    expect(label({ source: 'cube', stateVerified: true })).toBe('cube, state-verified')
    expect(label({ source: 'cube', stateVerified: false })).toContain('UNVERIFIED')
  })

  it('never lets a simulated or replayed solve read as hardware', () => {
    expect(label({ source: 'simulator', stateVerified: true })).toBe('simulator')
    expect(label({ source: 'replay', stateVerified: true })).toBe('replayed session')
    expect(label({ source: undefined, stateVerified: undefined })).toBe('simulator')
  })
})
