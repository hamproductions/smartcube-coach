import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { puzzles } from 'cubing/puzzles'
import { reorientToSolvedCenters } from './lastLayer'
import { segmentCfop } from './reconstruction'

/**
 * The setup must reproduce the POSITION, not narrate the route to it. Replaying the scramble
 * plus every move made before the stage printed the solver's own fumbling back at them and
 * grew with every wasted turn; the same position must always give the same short setup.
 */
describe('a stage setup', () => {
  it('puts a solved cube back at the position the stage started from', async () => {
    const solve = JSON.parse(readFileSync(`${process.cwd()}/public/reco/13444.json`, 'utf8')) as { scramble: string; moves: string[] }
    const events = solve.moves.map((move, index) => ({ move, timestamp: index * 90 }))
    const stages = await segmentCfop(solve.scramble, events, 'setup')
    const kpuzzle = await puzzles['3x3x3'].kpuzzle()
    const withSetup = stages.filter((stage) => stage.setupAlg)
    expect(withSetup.length).toBeGreaterThan(0)

    for (const stage of withSetup) {
      let entry = kpuzzle.defaultPattern().applyAlg(solve.scramble)
      for (const move of solve.moves.slice(0, stage.startEvent)) entry = entry.applyAlg(move)
      const fromSetup = kpuzzle.defaultPattern().applyAlg(stage.setupAlg!)
      // Compared with the cube stood upright, because a setup reproduces the position, not the
      // way the solver happened to be holding it.
      const canonicalSetup = reorientToSolvedCenters(fromSetup) ?? fromSetup
      const canonicalEntry = reorientToSolvedCenters(entry) ?? entry
      expect(canonicalSetup.isIdentical(canonicalEntry), `${stage.name}: ${stage.setupAlg}`).toBe(true)
    }
  }, 120_000)

  it('is far shorter than replaying the history', async () => {
    const solve = JSON.parse(readFileSync(`${process.cwd()}/public/reco/13444.json`, 'utf8')) as { scramble: string; moves: string[] }
    const events = solve.moves.map((move, index) => ({ move, timestamp: index * 90 }))
    const stages = await segmentCfop(solve.scramble, events, 'setup-length')
    const scrambleLength = solve.scramble.split(/\s+/).filter(Boolean).length

    for (const stage of stages.filter((entry) => entry.setupAlg)) {
      const history = scrambleLength + stage.startEvent
      const setup = stage.setupAlg!.split(/\s+/).filter(Boolean).length
      expect(setup, `${stage.name}`).toBeLessThanOrEqual(history)
      expect(setup).toBeLessThanOrEqual(25)
    }
  }, 120_000)
})
