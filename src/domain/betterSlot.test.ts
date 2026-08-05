import { describe, expect, it } from 'vitest'
import { betterSlotThan, type SlotChoice } from './betterSlot'

const choice = (slot: SlotChoice['slot'], length: number): SlotChoice =>
  ({ slot, length, moves: new Array(length).fill('R') })

describe('betterSlotThan', () => {
  it('names the cheaper pair when the solver took a much worse one', () => {
    const scored = [choice('BR', 6), choice('FL', 14)]
    const better = betterSlotThan('FL', scored)
    expect(better?.best.slot).toBe('BR')
    expect(better?.saved).toBe(8)
  })

  it('says nothing when the solver already took the cheapest pair', () => {
    expect(betterSlotThan('BR', [choice('BR', 6), choice('FL', 14)])).toBeUndefined()
  })

  it('does not nag over a difference of one or two moves', () => {
    expect(betterSlotThan('FL', [choice('BR', 6), choice('FL', 8)])).toBeUndefined()
  })
})
