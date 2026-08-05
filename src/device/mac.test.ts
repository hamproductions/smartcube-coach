import { describe, expect, it } from 'vitest'
import { cubeMacCandidatesFromName, normalizeCubeMac } from './mac'

describe('cube MAC handling', () => {
  it('normalizes accepted separator styles to canonical upper-case bytes', () => {
    expect(normalizeCubeMac('cc:a3:00:00:23:c0')).toBe('CC:A3:00:00:23:C0')
    expect(normalizeCubeMac('CC-A3-00-00-23-C0')).toBe('CC:A3:00:00:23:C0')
    expect(normalizeCubeMac(' cca3000023c0 ')).toBe('CC:A3:00:00:23:C0')
  })

  it('rejects anything that is not six hex bytes', () => {
    expect(() => normalizeCubeMac('CC:A3:00:00:23')).toThrow('six hex bytes')
    expect(() => normalizeCubeMac('CC:A3:00:00:23:CG')).toThrow('six hex bytes')
    expect(() => normalizeCubeMac('')).toThrow('six hex bytes')
  })

  it('derives the documented QiYi and Tornado candidates from an advertised name', () => {
    expect(cubeMacCandidatesFromName('QY-QYSC-S-23C0')).toEqual(['CC:A3:00:00:23:C0', 'CC:A3:00:01:23:C0'])
    expect(cubeMacCandidatesFromName('QY-QYSC-A-23C0')).toEqual(['CC:A2:00:00:23:C0'])
    expect(cubeMacCandidatesFromName('XMD-TornadoV4-i-23c0')).toEqual(['CC:A6:00:00:23:C0'])
  })

  it('falls back to prefix plus trailing hex for padded or unusual QiYi names', () => {
    expect(cubeMacCandidatesFromName('QY-QYSC-S-A0E6       ')).toEqual(['CC:A3:00:00:A0:E6', 'CC:A3:00:01:A0:E6'])
    expect(cubeMacCandidatesFromName('QY-QYSC-S_23c0')).toEqual(['CC:A3:00:00:23:C0', 'CC:A3:00:01:23:C0'])
    expect(cubeMacCandidatesFromName('QY-QYSC-X-23C0')).toEqual(['CC:A3:00:00:23:C0', 'CC:A3:00:01:23:C0', 'CC:A2:00:00:23:C0'])
    expect(cubeMacCandidatesFromName('XMD-TornadoV5-i-23C0')).toEqual(['CC:A6:00:00:23:C0'])
  })

  it('returns no candidate for a device that is not a QiYi-family cube', () => {
    expect(cubeMacCandidatesFromName('GAN-1234')).toEqual([])
    expect(cubeMacCandidatesFromName('')).toEqual([])
  })
})
