import { Alg } from 'cubing/alg'
import type { KPattern, KPuzzle } from 'cubing/kpuzzle'
import type { AlgorithmRecord } from '../../../domain/models'
import { holdPermutation } from '../../../domain/cubeHold'
import { remapMoveForPlayer } from '../../../domain/cubedex/smartcubeParity'
import { faceTurnsOnly } from '../../../domain/faceTurnsOnly'
import { reorientToSolvedCenters } from '../../../domain/lastLayer'
import { isEollCase } from '../../../domain/training'

export type CaseGoal = 'f2l' | 'oriented' | 'edges-oriented' | 'solved'

const AUF = ['', 'U', 'U2', "U'"]
const LL_CORNERS = [0, 1, 2, 3]
const LL_EDGES = [0, 1, 2, 3]
const F2L_CORNERS = [4, 5, 6, 7]
const F2L_EDGES = [4, 5, 6, 7, 8, 9, 10, 11]

type Orbit = { pieces: number[]; orientation: number[] }

const inPlace = (orbit: Orbit, indices: number[]) => indices.every((index) => orbit.pieces[index] === index && orbit.orientation[index] === 0)
const oriented = (orbit: Orbit, indices: number[]) => indices.every((index) => orbit.orientation[index] === 0)

export function goalFor(record: AlgorithmRecord): CaseGoal {
  if (record.set === 'F2L') return 'f2l'
  if (isEollCase(record)) return 'edges-oriented'
  if (record.set === 'OLL' && !record.id.startsWith('cubedex-')) return 'oriented'
  return 'solved'
}

export const GOAL_LABEL: Record<CaseGoal, string> = {
  f2l: 'first two layers solved',
  oriented: 'last layer oriented',
  'edges-oriented': 'last layer edges oriented',
  solved: 'cube solved'
}

export function solverMove(move: string, rotation: string) {
  return remapMoveForPlayer(move, holdPermutation(rotation))
}

const ROTATIONS = ['', 'x', 'x2', "x'", 'z', "z'"].flatMap((base) => ['', 'y', 'y2', "y'"].map((turn) => [base, turn].filter(Boolean).join(' ')))

export const tokens = (alg: string) => alg.replace(/[()]/g, ' ').split(/\s+/).filter(Boolean)

const centresHome = (pattern: KPattern) => pattern.patternData.CENTERS.pieces.every((piece, index) => piece === index)

export function caseDisplay(puzzle: KPuzzle | undefined, record: AlgorithmRecord) {
  const setup = faceTurns(record.setup)
  const replay = faceTurns(record.algorithm)
  if (!puzzle) return { setup, replay }
  try {
    const target = puzzle.defaultPattern().applyAlg(new Alg(record.setup))
    const fix = ROTATIONS.find((rotation) => centresHome(rotation ? target.applyAlg(new Alg(rotation)) : target)) ?? ''
    const shown = target.applyAlg(new Alg(fix))
    const undo = fix ? new Alg(fix).invert().toString() : ''
    const faceSetup = apply(puzzle.defaultPattern(), setup).isIdentical(shown) ? setup : [...tokens(record.setup), ...tokens(fix)]
    const faceReplay = faceTurns(`${undo} ${record.algorithm}`)
    const replayWorks = patternMeetsGoal(puzzle, apply(shown, faceReplay), goalFor(record))
    return { setup: faceSetup, replay: replayWorks ? faceReplay : [...tokens(undo), ...tokens(record.algorithm)] }
  } catch {
    return { setup, replay }
  }
}

export function faceTurns(alg: string): string[] {
  try {
    return faceTurnsOnly(alg.replace(/[()]/g, ' ').replace(/2'/g, '2')).moves
  } catch {
    return alg.split(/\s+/).filter(Boolean)
  }
}

function normalised(pattern: KPattern) {
  return reorientToSolvedCenters(pattern) ?? pattern
}

function apply(pattern: KPattern, moves: string[]) {
  return moves.length ? pattern.applyAlg(new Alg(moves.join(' '))) : pattern
}

function f2lSolved(pattern: KPattern) {
  const { CORNERS, EDGES } = pattern.patternData
  return inPlace(CORNERS, F2L_CORNERS) && inPlace(EDGES, F2L_EDGES)
}

export function patternMeetsGoal(puzzle: KPuzzle, pattern: KPattern, goal: CaseGoal) {
  const state = normalised(pattern)
  if (goal === 'solved') return AUF.some((auf) => apply(state, auf ? [auf] : []).isIdentical(puzzle.defaultPattern()))
  if (!f2lSolved(state)) return false
  if (goal === 'f2l') return true
  const { CORNERS, EDGES } = state.patternData
  if (goal === 'edges-oriented') return oriented(EDGES, LL_EDGES)
  return oriented(EDGES, LL_EDGES) && oriented(CORNERS, LL_CORNERS)
}

export function casePattern(puzzle: KPuzzle, record: AlgorithmRecord) {
  return normalised(puzzle.defaultPattern().applyAlg(new Alg(record.setup)))
}

export function reachesGoal(puzzle: KPuzzle, record: AlgorithmRecord, moves: string[]) {
  if (!moves.length) return false
  try {
    return patternMeetsGoal(puzzle, apply(casePattern(puzzle, record), moves), goalFor(record))
  } catch {
    return false
  }
}

export function matchesCase(puzzle: KPuzzle, record: AlgorithmRecord, moves: string[]) {
  try {
    const actual = normalised(apply(puzzle.defaultPattern(), moves))
    const target = normalised(casePattern(puzzle, record))
    return AUF.some((auf) => apply(target, auf ? [auf] : []).isIdentical(actual))
  } catch {
    return false
  }
}
