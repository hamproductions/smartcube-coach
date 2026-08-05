import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { puzzles } from 'cubing/puzzles'
import { recoverSlices, recoveredNotation } from './sliceRecovery'
import { reorientToSolvedCenters } from './lastLayer'

const fixturesDir = join(__dirname, '..', 'device', 'fixtures', 'user-sessions')
const fixtureFiles = readdirSync(fixturesDir).filter((name) => name.endsWith('.json')).sort()

type SessionFixture = { events: Array<{ event: { type: string; move?: string } }> }

const rawMovesOf = (path: string): string[] => {
  const data = JSON.parse(readFileSync(path, 'utf8')) as SessionFixture
  return data.events.filter((entry) => entry.event.type === 'MOVE').map((entry) => entry.event.move as string)
}

describe('recoverSlices', () => {
  it('collapses every opposite-face opposite-sign pair into its correct slice letter and sign', () => {
    expect(recoveredNotation(['R', "L'"])).toBe('M')
    expect(recoveredNotation(['L', "R'"])).toBe("M'")
    expect(recoveredNotation(['U', "D'"])).toBe('E')
    expect(recoveredNotation(['D', "U'"])).toBe("E'")
    expect(recoveredNotation(['F', "B'"])).toBe("S'")
    expect(recoveredNotation(['B', "F'"])).toBe('S')
  })

  it('does not collapse an opposite-face pair separated by an intervening move', () => {
    expect(recoveredNotation(['R', 'U', "L'"])).toBe("R U L'")
    expect(recoverSlices(['R', 'U', "L'"]).sliceCount).toBe(0)
  })

  it('does not collapse same-sign opposite-face moves', () => {
    expect(recoveredNotation(['R', 'L'])).toBe('R L')
  })

  it('folds the implied whole-cube rotation into a running orientation so a later move is relabeled correctly', () => {
    expect(recoveredNotation(['R', "L'", 'F'])).toBe('M D')
    expect(recoveredNotation(['R', "L'", 'U'])).toBe('M F')
    expect(recoveredNotation(['L', "R'", 'U'])).toBe("M' B")
    expect(recoveredNotation(['F', "B'", 'U'])).toBe("S' L")
    expect(recoveredNotation(['B', "F'", 'L'])).toBe('S U')
    expect(recoveredNotation(['D', "U'", 'F'])).toBe("E' L")
  })

  it('reports how many slices and rotations were recovered', () => {
    const single = recoverSlices(['R', "L'", 'U'])
    expect(single.sliceCount).toBe(1)
    expect(single.rotationCount).toBe(1)

    const two = recoverSlices(['R', "L'", 'U', 'D', "U'"])
    expect(two.sliceCount).toBe(2)
    expect(two.rotationCount).toBe(2)
  })

  it('reproduces the same relative cube state as the raw stream on every real hardware capture', async () => {
    expect(fixtureFiles.length).toBeGreaterThan(0)

    const kpuzzle = await puzzles['3x3x3'].kpuzzle()
    const solved = kpuzzle.defaultPattern()
    const report: Array<{ file: string; raw: number; slices: number; rotations: number }> = []

    for (const file of fixtureFiles) {
      const raw = rawMovesOf(join(fixturesDir, file))
      expect(raw.length, file).toBeGreaterThan(0)

      const result = recoverSlices(raw)
      const recoveredAlg = result.moves.map((move) => move.notation).join(' ')

      const rawPattern = solved.applyAlg(raw.join(' '))
      const recoveredPattern = solved.applyAlg(recoveredAlg)

      const rawCanonical = reorientToSolvedCenters(rawPattern) ?? rawPattern
      const recoveredCanonical = reorientToSolvedCenters(recoveredPattern) ?? recoveredPattern

      expect(recoveredCanonical.isIdentical(rawCanonical), file).toBe(true)

      report.push({ file, raw: raw.length, slices: result.sliceCount, rotations: result.rotationCount })
    }

    console.info('slice recovery per real capture:', report)
  }, 120_000)
})
