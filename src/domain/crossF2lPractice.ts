import { Alg } from 'cubing/alg'
import type { KPattern } from 'cubing/kpuzzle'
import { puzzles } from 'cubing/puzzles'
import { optimalCrossMoves } from './crossSolver'
import { reorientToSolvedCenters } from './lastLayer'

export type Face = 'U' | 'D' | 'F' | 'B' | 'L' | 'R'
export const faces: readonly Face[] = ['U', 'D', 'F', 'B', 'L', 'R']

const edgeNames = ['UF', 'UR', 'UB', 'UL', 'DF', 'DR', 'DB', 'DL', 'FR', 'FL', 'BR', 'BL']
const cornerNames = ['UFR', 'URB', 'UBL', 'ULF', 'DRF', 'DFL', 'DLB', 'DBR']

const sameLetters = (left: string, right: string) => [...left].sort().join('') === [...right].sort().join('')

export type PairSlot = { name: string; corner: number; edge: number }

export type CrossFaceSpec = { face: Face; crossEdges: number[]; slots: PairSlot[] }

function specFor(face: Face): CrossFaceSpec {
  const crossEdges = edgeNames.flatMap((name, index) => (name.includes(face) ? [index] : []))
  const slots = cornerNames.flatMap((name, corner) => {
    if (!name.includes(face)) return []
    const sides = [...name].filter((letter) => letter !== face).sort((left, right) => faces.indexOf(left as Face) - faces.indexOf(right as Face)).join('')
    const edge = edgeNames.findIndex((candidate) => sameLetters(candidate, sides))
    return [{ name: sides, corner, edge }]
  })
  return { face, crossEdges, slots }
}

export const crossFaceSpecs: Record<Face, CrossFaceSpec> = {
  U: specFor('U'), D: specFor('D'), F: specFor('F'), B: specFor('B'), L: specFor('L'), R: specFor('R')
}

const edgeHome = (pattern: KPattern, index: number) =>
  pattern.patternData.EDGES.pieces[index] === index && pattern.patternData.EDGES.orientation[index] === 0

const cornerHome = (pattern: KPattern, index: number) =>
  pattern.patternData.CORNERS.pieces[index] === index && pattern.patternData.CORNERS.orientation[index] === 0

export type FaceProgress = { face: Face; cross: boolean; slots: string[] }

/** Cross and solved F2L pairs on every face, read from the cube alone. Centres are put back into the solved frame first, so slice turns do not matter. */
export function crossProgress(pattern: KPattern): FaceProgress[] | undefined {
  const upright = reorientToSolvedCenters(pattern)
  if (!upright) return undefined
  return faces.map((face) => {
    const spec = crossFaceSpecs[face]
    const cross = spec.crossEdges.every((index) => edgeHome(upright, index))
    const slots = cross ? spec.slots.filter(({ corner, edge }) => cornerHome(upright, corner) && edgeHome(upright, edge)).map(({ name }) => name) : []
    return { face, cross, slots }
  })
}

export type PracticeGoal = { pairs: number; face: Face | 'any' }

export const goalLabel = (pairs: number) => (pairs === 0 ? 'Cross' : pairs === 4 ? 'Full F2L' : `Cross + ${pairs} pair${pairs === 1 ? '' : 's'}`)

/** The face the goal is satisfied on, preferring the one with the most pairs; undefined while it is not met. */
export function goalReached(pattern: KPattern, goal: PracticeGoal): FaceProgress | undefined {
  const progress = crossProgress(pattern)
  if (!progress) return undefined
  const candidates = progress.filter((entry) => (goal.face === 'any' || entry.face === goal.face) && entry.cross && entry.slots.length >= goal.pairs)
  return candidates.reduce<FaceProgress | undefined>((best, entry) => (best === undefined || entry.slots.length > best.slots.length ? entry : best), undefined)
}

export const turnCount = (moves: string[]) => moves.filter((move) => !/^[xyz]/i.test(move)).length

export type PracticeMove = { move: string; cube: number | null; wall: number }

export type PracticeAttempt = {
  id: string
  at: number
  pairs: number
  goalFace: Face | 'any'
  face: Face
  slots: string[]
  durationMs: number
  recognitionMs: number | null
  moves: string[]
  turns: number
  scrambleTurns: number
  startAlg?: string
  bestCross?: { turns: number; face: Face }
}

export type PracticePhase = 'scrambling' | 'ready' | 'solving' | 'done'

export type PracticeState = {
  phase: PracticePhase
  scrambleTurns: number
  readyAt?: number
  solveMoves: PracticeMove[]
  result?: Omit<PracticeAttempt, 'id' | 'at' | 'startAlg' | 'bestCross'>
}

export const initialPracticeState: PracticeState = { phase: 'scrambling', scrambleTurns: 0, solveMoves: [] }

export type PracticeEvent =
  | { type: 'move'; move: PracticeMove; goal: PracticeGoal; reached: FaceProgress | undefined }
  | { type: 'ready'; wall: number; alreadyMet: boolean }
  | { type: 'unready' }
  | { type: 'restart' }

/** The rule for arming: something has been scrambled, and the goal is not already true. */
export const canArm = (state: PracticeState, alreadyMet: boolean) => state.phase === 'scrambling' && state.scrambleTurns > 0 && !alreadyMet

function durationOf(moves: PracticeMove[]) {
  const first = moves[0]
  const last = moves[moves.length - 1]
  if (first.cube !== null && last.cube !== null && last.cube >= first.cube) return last.cube - first.cube
  return Math.max(0, last.wall - first.wall)
}

export function practiceReducer(state: PracticeState, event: PracticeEvent): PracticeState {
  switch (event.type) {
    case 'restart':
      return initialPracticeState
    case 'unready':
      if (state.phase === 'ready') return { ...state, phase: 'scrambling', readyAt: undefined }
      return state.phase === 'solving' ? { phase: 'scrambling', scrambleTurns: 0, solveMoves: [] } : state
    case 'ready':
      return canArm(state, event.alreadyMet) ? { ...state, phase: 'ready', readyAt: event.wall } : state
    case 'move': {
      const base: PracticeState = state.phase === 'done' ? { phase: 'scrambling', scrambleTurns: 0, solveMoves: [] } : state
      const isTurn = !/^[xyz]/i.test(event.move.move)
      if (base.phase === 'scrambling') return isTurn ? { ...base, scrambleTurns: base.scrambleTurns + 1 } : base
      const solveMoves = [...base.solveMoves, event.move]
      if (event.reached) {
        const moves = solveMoves.map((entry) => entry.move)
        return {
          phase: 'done',
          scrambleTurns: base.scrambleTurns,
          readyAt: base.readyAt,
          solveMoves,
          result: {
            pairs: event.goal.pairs,
            goalFace: event.goal.face,
            face: event.reached.face,
            slots: event.reached.slots,
            durationMs: durationOf(solveMoves),
            recognitionMs: base.readyAt === undefined ? null : Math.max(0, solveMoves[0].wall - base.readyAt),
            moves,
            turns: turnCount(moves),
            scrambleTurns: base.scrambleTurns
          }
        }
      }
      return { ...base, phase: 'solving', solveMoves }
    }
  }
}

/** Whole-cube rotation that carries each face onto D, so the D-cross depth table answers for any face. */
export const faceToDown: Record<Face, string> = { D: '', U: 'x2', F: "x'", B: 'x', R: 'z', L: "z'" }

async function crossDepthOnFace(upright: KPattern, face: Face) {
  if (face === 'D') return optimalCrossMoves(upright)
  const puzzle = await puzzles['3x3x3'].kpuzzle()
  const state = upright.experimentalToTransformation()
  if (!state) return undefined
  const turn = puzzle.algToTransformation(new Alg(faceToDown[face]))
  const relabelled = turn.invert().applyTransformation(state).applyTransformation(turn)
  return optimalCrossMoves(puzzle.defaultPattern().applyTransformation(relabelled))
}

/** Fewest turns that would have solved the cross, over every face (or the one asked for). */
export async function bestCross(pattern: KPattern, only: Face | 'any' = 'any'): Promise<{ turns: number; face: Face } | undefined> {
  const upright = reorientToSolvedCenters(pattern)
  if (!upright) return undefined
  let best: { turns: number; face: Face } | undefined
  for (const face of faces) {
    if (only !== 'any' && only !== face) continue
    const turns = await crossDepthOnFace(upright, face)
    if (turns !== undefined && (best === undefined || turns < best.turns)) best = { turns, face }
  }
  return best
}
