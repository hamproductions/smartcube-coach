import { describe, expect, it } from 'vitest'
import { simulateCfopSolve } from './cfopSimulation'
import { segmentCfop } from './reconstruction'
import { ollCases, pllCases } from './algorithmCatalogue'

describe('last-layer case recognition inside a solve', () => {
  it('names the OLL and PLL the solver actually had', async () => {
    for (const seed of ['alpha', 'beta', 'gamma', 'delta']) {
      const simulated = await simulateCfopSolve(seed)
      const stages = await segmentCfop(simulated.scramble, simulated.events, `sim-${seed}`)
      const oll = stages.find((stage) => stage.name === 'OLL')
      const pll = stages.find((stage) => stage.name === 'PLL')
      // Compare the case the solver was given against the case recognition named, not
      // their algorithm strings: the same case is written differently depending on which
      // face the solver held it against, and the simulated stream is expressed in the
      // fixed frame a cube reports in.
      const ollCaseId = simulated.stages.find((stage) => stage.name === 'OLL')!.caseId
      const pllCaseId = simulated.stages.find((stage) => stage.name === 'PLL')!.caseId

      expect(oll?.caseId, `${seed} OLL recognized`).toBeDefined()
      expect(pll?.caseId, `${seed} PLL recognized`).toBeDefined()
      expect(ollCases.some((entry) => entry.id === oll!.caseId), `${seed} OLL in catalogue`).toBe(true)
      expect(pllCases.some((entry) => entry.id === pll!.caseId), `${seed} PLL in catalogue`).toBe(true)
      expect(oll!.caseId, `${seed} OLL identity`).toBe(ollCaseId)
      expect(pll!.caseId, `${seed} PLL identity`).toBe(pllCaseId)
    }
  }, 120_000)

  it('labels F2L stages with an F2L case and leaves the rest unlabelled', async () => {
    const simulated = await simulateCfopSolve('labels')
    const stages = await segmentCfop(simulated.scramble, simulated.events, 'sim-labels')

    for (const stage of stages.filter((entry) => !['OLL', 'PLL'].includes(entry.name))) {
      if (stage.name.startsWith('F2L')) {
        // Only the 41 catalogued cases can be named: a pair whose pieces are trapped in
        // another slot is not one of them, and inventing a name for it would be a lie.
        if (stage.caseId !== undefined) expect(stage.caseId, stage.name).toMatch(/^f2l-(fr|fl|bl|br)-\d+$/)
        continue
      }
      expect(stage.caseId, stage.name).toBeUndefined()
    }
  }, 60_000)
})
