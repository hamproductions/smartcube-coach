import { describe, expect, it } from 'vitest'
import { moveOffsets } from './recordCapture'

describe('moveOffsets', () => {
  it('stores the rhythm relative to the first move, so a monotonic cube clock still replays', () => {
    expect(moveOffsets([
      { timestamp: 1_785_851_560_000 },
      { timestamp: 1_785_851_560_420 },
      { timestamp: 1_785_851_561_800 }
    ])).toEqual([0, 420, 1_800])
  })

  it('has nothing to say about an empty stream', () => {
    expect(moveOffsets([])).toBeUndefined()
  })

  it('refuses a stream whose clock goes backwards rather than replaying an instant jump', () => {
    expect(moveOffsets([{ timestamp: 1_000 }, { timestamp: 900 }])).toBeUndefined()
  })
})
