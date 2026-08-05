import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { segmentCfop } from './reconstruction'

/**
 * A real solve's last layer must be NAMED, not called a skip.
 *
 * Recognition used to be pointed at a layer chosen from the locked cross face and then rotated
 * again on top of the stage frame. On a solve whose cross is not on the raw D face that aimed
 * it at the CROSS layer, which is solved by definition by then — so every OLL and PLL of such a
 * solve came back "OLL skip" / "PLL skip", with a dozen moves in the stage.
 */
describe('last layer recognition on a real solve', () => {
  it('names the OLL the solver actually had', async () => {
    const solve = JSON.parse(readFileSync(`${process.cwd()}/public/reco/13444.json`, 'utf8')) as { scramble: string; moves: string[] }
    const events = solve.moves.map((move, index) => ({ move, timestamp: index * 90 }))
    const stages = await segmentCfop(solve.scramble, events, 'll-real')
    const oll = stages.find((stage) => stage.name === 'OLL')

    expect(oll, 'the solve has an OLL stage').toBeDefined()
    expect(oll!.moveCount, 'with real moves in it').toBeGreaterThan(0)
    // Nine moves of OLL is not a skip.
    expect(oll!.caseName, 'OLL is named').toBeDefined()
    expect(oll!.caseName).not.toBe('OLL skip')
    expect(oll!.caseId).toMatch(/^oll-\d+$/)
  }, 120_000)

  it('does not call a stage a skip while it is turning that layer', async () => {
    const solve = JSON.parse(readFileSync(`${process.cwd()}/public/reco/13444.json`, 'utf8')) as { scramble: string; moves: string[] }
    const events = solve.moves.map((move, index) => ({ move, timestamp: index * 90 }))
    const stages = await segmentCfop(solve.scramble, events, 'll-skip')

    for (const stage of stages.filter((entry) => entry.name === 'OLL')) {
      if (stage.moveCount >= 5) expect(stage.caseName, `${stage.name} with ${stage.moveCount} moves`).not.toBe('OLL skip')
    }
  }, 120_000)
})
