import { describe, expect, it } from 'vitest'

type Connection = { capabilities: { facelets: boolean } } | undefined

function scrambleBlocked(connection: Connection, liveStateReady: boolean, physicalSolved: boolean) {
  return Boolean(connection?.capabilities.facelets) && (!liveStateReady || !physicalSolved)
}

describe('scramble gate for a connected cube', () => {
  it('blocks a facelet cube until its stickers are known and solved', () => {
    expect(scrambleBlocked({ capabilities: { facelets: true } }, false, false)).toBe(true)
    expect(scrambleBlocked({ capabilities: { facelets: true } }, true, false)).toBe(true)
    expect(scrambleBlocked({ capabilities: { facelets: true } }, true, true)).toBe(false)
  })

  it('never blocks a cube that cannot report stickers', () => {
    expect(scrambleBlocked({ capabilities: { facelets: false } }, false, false)).toBe(false)
  })

  it('never blocks the simulator', () => {
    expect(scrambleBlocked(undefined, false, false)).toBe(false)
  })
})
