import { describe, expect, it } from 'vitest'
import { Alg } from 'cubing/alg'
import { puzzles } from 'cubing/puzzles'
import { cmllCases, collCases, eollCases, toAlgorithmRecord } from '../../../domain/algorithmCatalogue'
import { reorientToSolvedCenters } from '../../../domain/lastLayer'
import { defaultAlgorithms } from '../../../domain/training'
import { caseDisplay, faceTurns, goalFor, matchesCase, patternMeetsGoal, reachesGoal, solverMove } from './caseState'
import { cubedexRecords } from './catalogue'

const catalogue = [
  ...defaultAlgorithms,
  ...eollCases.map((entry) => toAlgorithmRecord(entry)),
  ...collCases.map((entry) => toAlgorithmRecord(entry)),
  ...cmllCases.map((entry) => toAlgorithmRecord(entry)),
  ...cubedexRecords('ZBLL')
]

describe('case state', () => {
  it('draws every catalogued case with its centres home, and replays its algorithm back to solved', async () => {
    const puzzle = await puzzles['3x3x3'].kpuzzle()
    const solved = puzzle.defaultPattern()
    const wrong = catalogue.filter((record) => {
      const display = caseDisplay(puzzle, record)
      const shown = solved.applyAlg(new Alg(display.setup.join(' ')))
      const expected = reorientToSolvedCenters(solved.applyAlg(new Alg(record.setup)))
      const replayed = shown.applyAlg(new Alg(display.replay.join(' ')))
      const centresHome = shown.patternData.CENTERS.pieces.every((piece, index) => piece === index)
      return !expected || !centresHome || !shown.isIdentical(expected) || !patternMeetsGoal(puzzle, replayed, 'solved')
    })
    expect(wrong.map((record) => record.name)).toEqual(['Basic right insert', 'Basic left insert'])
  })

  it('accepts the catalogued algorithm, turned as face turns from the shown frame, as solving its own case', async () => {
    const puzzle = await puzzles['3x3x3'].kpuzzle()
    const failing = catalogue.filter((record) => !reachesGoal(puzzle, record, caseDisplay(puzzle, record).replay))
    expect(failing.map((record) => record.name)).toEqual(['Basic right insert', 'Basic left insert'])
  })

  it('accepts any OLL algorithm that orients the last layer, and rejects one that does not', async () => {
    const puzzle = await puzzles['3x3x3'].kpuzzle()
    const sune = defaultAlgorithms.find((record) => record.name === 'OLL 27 Sune')!
    expect(goalFor(sune)).toBe('oriented')
    expect(reachesGoal(puzzle, sune, "R U R' U R U2 R'".split(' '))).toBe(true)
    expect(reachesGoal(puzzle, sune, "R U R' U R U2 R' U".split(' '))).toBe(true)
    expect(reachesGoal(puzzle, sune, "R U R' U".split(' '))).toBe(false)
  })

  it('recognises a case set up from solved at any final U turn', async () => {
    const puzzle = await puzzles['3x3x3'].kpuzzle()
    const tPerm = defaultAlgorithms.find((record) => record.name === 'T Perm')!
    const setup = faceTurns(tPerm.setup)
    expect(matchesCase(puzzle, tPerm, setup)).toBe(true)
    expect(matchesCase(puzzle, tPerm, [...setup, 'U'])).toBe(true)
    expect(matchesCase(puzzle, tPerm, setup.slice(0, -1))).toBe(false)
  })

  it('reads cube moves in the solver frame for a yellow-top hold', () => {
    expect(['D', "L'", 'F', 'U2'].map((move) => solverMove(move, 'z2'))).toEqual(['U', "R'", 'F', 'D2'])
    expect(solverMove("R'", '')).toBe("R'")
  })
})
