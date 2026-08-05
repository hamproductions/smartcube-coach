import { describe, expect, it } from 'vitest'
import { recordDrop, reconnectDecision, reconnectDelayMs } from './reconnect'

describe('reconnect policy', () => {
  it('retries three times inside the window and then hands back to the user', () => {
    let drops: number[] = []
    const statuses: string[] = []

    for (let attempt = 1; attempt <= 4; attempt += 1) {
      drops = recordDrop(drops, attempt * 1_000)
      statuses.push(reconnectDecision(drops, true).status)
    }

    expect(statuses).toEqual([
      'Cube dropped · reconnecting (1/3)',
      'Cube dropped · reconnecting (2/3)',
      'Cube dropped · reconnecting (3/3)',
      'Cube keeps dropping · reconnect manually'
    ])
    expect(reconnectDecision(drops, true).retry).toBe(false)
  })

  it('forgets drops older than the window so an occasional drop still retries', () => {
    const drops = recordDrop(recordDrop([1_000, 2_000, 3_000], 40_000), 41_000)

    expect(drops).toEqual([40_000, 41_000])
    expect(reconnectDecision(drops, true).retry).toBe(true)
  })

  it('never auto-reconnects a link the user closed', () => {
    expect(reconnectDecision([1_000], false)).toEqual({ retry: false, status: 'Cube disconnected' })
  })

  it('backs off further with each consecutive drop', () => {
    expect(reconnectDelayMs([1])).toBe(400)
    expect(reconnectDelayMs([1, 2, 3])).toBe(1_200)
  })
})
