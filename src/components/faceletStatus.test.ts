import { describe, expect, it } from 'vitest'

type Status = 'baseline' | 'verified' | 'mismatch' | 'invalid' | 'unsupported' | undefined

function faceletStatus(connected: boolean, replayed: boolean, supportsFacelets: boolean, status: Status) {
  if (!connected && !replayed) return 'Facelet reconciliation unavailable'
  if (connected && !supportsFacelets) return 'Facelet reconciliation unsupported by cube'
  if (!status) return 'Facelet reconciliation awaiting snapshot'
  if (status === 'unsupported') return 'Facelet reconciliation paused · the cube sent a turn this app cannot model, so sticker checking is on hold'
  if (status === 'mismatch') return 'Facelet reconciliation mismatch · stickers disagree with the captured turns'
  if (status === 'invalid') return 'Facelet reconciliation rejected an impossible sticker snapshot'
  return `Facelet reconciliation ${status}`
}

describe('facelet status wording', () => {
  it('separates a cube that cannot report stickers from a turn the app cannot model', () => {
    const cannotReport = faceletStatus(true, false, false, undefined)
    const cannotModel = faceletStatus(true, false, true, 'unsupported')

    expect(cannotReport).toContain('unsupported by cube')
    expect(cannotModel).toContain('cannot model')
    expect(cannotReport).not.toBe(cannotModel)
  })

  it('says what a mismatch and an invalid snapshot actually mean', () => {
    expect(faceletStatus(true, false, true, 'mismatch')).toContain('disagree with the captured turns')
    expect(faceletStatus(true, false, true, 'invalid')).toContain('impossible sticker snapshot')
  })

  it('keeps the plain wording for healthy states', () => {
    expect(faceletStatus(true, false, true, 'verified')).toBe('Facelet reconciliation verified')
    expect(faceletStatus(true, false, true, 'baseline')).toBe('Facelet reconciliation baseline')
  })
})
