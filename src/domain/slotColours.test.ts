import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { puzzles } from 'cubing/puzzles'
import { segmentCfop } from './reconstruction'
import { slotColoursFromPattern } from './slotColours'

const OPPOSITE: Record<string, string> = {
  white: 'yellow', yellow: 'white', green: 'blue', blue: 'green', red: 'orange', orange: 'red'
}

describe('slot colours', () => {
  it('reads a slot straight off a solved cube', async () => {
    const kpuzzle = await puzzles['3x3x3'].kpuzzle()
    const solved = kpuzzle.defaultPattern()
    expect(slotColoursFromPattern(solved, 'FR')?.map((colour) => colour.name)).toEqual(['green', 'red'])
    expect(slotColoursFromPattern(solved, 'BL')?.map((colour) => colour.name)).toEqual(['blue', 'orange'])
  })

  it('follows the cube when it is turned, instead of assuming an orientation', async () => {
    const kpuzzle = await puzzles['3x3x3'].kpuzzle()
    // x2 puts yellow on top and swaps front and back; the front-right slot shows blue/red.
    const turned = kpuzzle.defaultPattern().applyAlg('x2')
    expect(slotColoursFromPattern(turned, 'FR')?.map((colour) => colour.name)).toEqual(['blue', 'red'])
    // y moves the front face to the left; the front-right slot becomes red/blue.
    const spun = kpuzzle.defaultPattern().applyAlg('y')
    expect(slotColoursFromPattern(spun, 'FR')?.map((colour) => colour.name)).toEqual(['red', 'blue'])
  })

  it('gives every F2L stage of a real solve a sane pair of colours', async () => {
    const solve = JSON.parse(readFileSync(`${process.cwd()}/public/reco/13444.json`, 'utf8')) as { scramble: string; moves: string[] }
    const events = solve.moves.map((move, index) => ({ move, timestamp: index * 90 }))
    const stages = await segmentCfop(solve.scramble, events, 'colours')
    const scored = stages.filter((stage) => stage.slot)
    expect(scored.length).toBeGreaterThan(0)

    const seen = new Set<string>()
    for (const stage of scored) {
      const colours = stage.slotColours
      expect(colours, `${stage.name} has colours`).toBeDefined()
      expect(colours!.length).toBe(2)
      const [first, second] = colours!.map((colour) => colour.name)
      // A slot is between two ADJACENT faces: never a colour and its opposite, never a repeat.
      expect(first, `${stage.name} distinct`).not.toBe(second)
      expect(OPPOSITE[first], `${stage.name} not opposite faces`).not.toBe(second)
      // The four slots of one solve are four different pairs.
      const key = [first, second].sort().join('/')
      expect(seen.has(key), `${stage.name} pair ${key} not repeated`).toBe(false)
      seen.add(key)
    }
  }, 120_000)
})
