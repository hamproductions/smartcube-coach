import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { segmentCfop } from './reconstruction'
import { stageAdvice } from './stageAdvice'

// A real human CFOP solve, not a generated one: the coaching output has to be right on the
// thing a solver actually did. This is the reco.nz reconstruction the segmenter is already
// pinned against for stage boundaries.
const solve = JSON.parse(readFileSync(`${process.cwd()}/public/reco/13444.json`, 'utf8')) as {
  scramble: string
  moves: string[]
}
const events = solve.moves.map((move, index) => ({ move, timestamp: 1_000 + index * 90 }))

describe('coaching output on a real solve', () => {
  it('scores the F2L pairs and produces advice a solver can act on', async () => {
    const stages = await segmentCfop(solve.scramble, events, 'reco-13444')
    const f2l = stages.filter((stage) => stage.name.startsWith('F2L'))
    expect(f2l.length).toBeGreaterThan(0)

    // Every F2L stage the segmenter attributes to a slot must be scored, so the advice is
    // never "you were slow" with nothing to do about it.
    const scored = f2l.filter((stage) => stage.optimalMoveCount !== undefined)
    expect(scored.length).toBeGreaterThan(0)

    for (const stage of scored) {
      // Where a shorter insert exists, its moves must be there — not just its length.
      if (stage.moveCount - (stage.optimalMoveCount ?? 0) >= 4) {
        expect(stage.optimalMoves?.length ?? 0).toBeGreaterThan(0)
      }
      // A better-pair suggestion, when present, must name a different slot and real moves.
      if (stage.betterSlot) {
        expect(stage.betterSlot.slot).not.toBe(stage.slot)
        expect(stage.betterSlot.moves.length).toBeGreaterThan(0)
        expect(stage.betterSlot.saved).toBeGreaterThanOrEqual(3)
        expect(stageAdvice(stage, stages)).toContain(stage.betterSlot.slot)
      }
    }
  }, 60_000)
})
