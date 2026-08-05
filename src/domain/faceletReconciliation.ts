import { SOLVED_FACELETS, cubeFromFacelets, faceletsOf, turnAll } from './cubeMath'
import { Alg } from 'cubing/alg'
import { KPattern } from 'cubing/kpuzzle'
import { puzzles } from 'cubing/puzzles'
import { experimentalSolve3x3x3IgnoringCenters } from 'cubing/search'

export const solvedFacelets = SOLVED_FACELETS

const moveOffsets: Record<string, number> = { U: 0, R: 3, F: 6, D: 9, L: 12, B: 15 }
const cornerIndices = [0, 3, 2, 1, 4, 5, 6, 7]
const edgeIndices = [1, 0, 3, 2, 5, 4, 7, 6, 8, 9, 11, 10]
const cornerIndexByCubie = Object.fromEntries(cornerIndices.map((index, position) => [index, position]))
const edgeIndexByCubie = Object.fromEntries(edgeIndices.map((index, position) => [index, position]))

function moveIndex(move: string) {
  const matched = /^([URFDLB])(2|')?$/.exec(move)
  if (!matched) return undefined
  const offset = moveOffsets[matched[1]]
  return offset + (matched[2] === '2' ? 1 : matched[2] === "'" ? 2 : 0)
}

function canonicalFacelets(facelets: string) {
  return faceletsOf(cubeFromFacelets(facelets))
}

export function applyFaceletMoves(facelets: string, moves: string[]) {
  return faceletsOf(turnAll(cubeFromFacelets(facelets), moves))
}

export function isSolvedFacelets(facelets: string) {
  if (facelets.length !== 54) return false
  const faces = Array.from({ length: 6 }, (unused, index) => facelets.slice(index * 9, index * 9 + 9))
  const colours = faces.map((face) => face[4])
  if (new Set(colours).size !== 6) return false
  return faces.every((face) => new Set(face).size === 1)
}

/**
 * The cube's reported state as a pattern.
 *
 * The device says what it actually is on every packet; anything that judges the solver
 * against the scramble has to use this rather than the app's own list of the moves it
 * thinks were made, or a single dropped or duplicated packet makes the app disagree with
 * the cube in the solver's hands — and then it is the solver who gets told they are wrong.
 */
export async function patternFromFacelets(facelets: string) {
  const cube = cubeFromFacelets(facelets)
  const puzzle = await puzzles['3x3x3'].kpuzzle()
  const centers = puzzle.defaultPattern().patternData.CENTERS
  return new KPattern(puzzle, {
    EDGES: {
      pieces: edgeIndices.map((index) => edgeIndexByCubie[cube.ea[index] >> 1]),
      orientation: edgeIndices.map((index) => cube.ea[index] & 1)
    },
    CORNERS: {
      pieces: cornerIndices.map((index) => cornerIndexByCubie[cube.ca[index] & 7]),
      orientation: cornerIndices.map((index) => cube.ca[index] >> 3)
    },
    CENTERS: centers
  })
}

export async function setupAlgFromFacelets(facelets: string) {
  const cube = cubeFromFacelets(facelets)
  const puzzle = await puzzles['3x3x3'].kpuzzle()
  const centers = puzzle.defaultPattern().patternData.CENTERS
  const pattern = new KPattern(puzzle, {
    EDGES: {
      pieces: edgeIndices.map((index) => edgeIndexByCubie[cube.ea[index] >> 1]),
      orientation: edgeIndices.map((index) => cube.ea[index] & 1)
    },
    CORNERS: {
      pieces: cornerIndices.map((index) => cornerIndexByCubie[cube.ca[index] & 7]),
      orientation: cornerIndices.map((index) => cube.ca[index] >> 3)
    },
    CENTERS: centers
  })
  return new Alg((await experimentalSolve3x3x3IgnoringCenters(pattern)).toString()).invert().toString()
}

export type FaceletReconciliation = {
  status: 'baseline' | 'verified' | 'mismatch' | 'invalid' | 'unsupported'
  pendingMoves: string[]
  expected?: string
  actual?: string
}

/**
 * A FACELETS reading is only an independent oracle when it is genuinely device-sourced
 * (a hello/battery-request ack or a reset ack). Every other FACELETS reading a QiYi cube
 * emits is a per-move echo the driver synthesises with the same CubieCube maths this app
 * already uses to accumulate moves, so it can only ever disagree because our own event
 * pipeline dropped or reordered something — never because the hardware knows better.
 */
export type FaceletSource = 'device' | 'echo'

export type FaceletDisagreement = {
  source: FaceletSource
  pendingMoves: string[]
  expected: string
  actual: string
}

export class FaceletReconciler {
  private baseline?: string
  private pending: string[] = []
  private disagreementLog: FaceletDisagreement[] = []
  reconcileStatus?: FaceletReconciliation['status']

  get disagreements(): readonly FaceletDisagreement[] {
    return this.disagreementLog
  }

  recordMove(move: string) {
    this.pending.push(move)
  }

  resync(facelets: string): FaceletReconciliation {
    try {
      this.baseline = canonicalFacelets(facelets)
      this.pending = []
      this.reconcileStatus = 'baseline'
      return { status: 'baseline', pendingMoves: [] }
    } catch {
      return { status: 'invalid', pendingMoves: [...this.pending] }
    }
  }

  reconcile(facelets: string, source: FaceletSource = 'device'): FaceletReconciliation {
    const result = this.reconcileInternal(facelets, source)
    this.reconcileStatus = result.status
    return result
  }

  private reconcileInternal(facelets: string, source: FaceletSource): FaceletReconciliation {
    let actual: string
    try {
      actual = canonicalFacelets(facelets)
    } catch {
      return { status: 'invalid', pendingMoves: [...this.pending] }
    }

    if (!this.baseline) {
      this.baseline = actual
      this.pending = []
      return { status: 'baseline', pendingMoves: [] }
    }

    const pendingMoves = [...this.pending]
    let expected: string
    try {
      expected = applyFaceletMoves(this.baseline, pendingMoves)
    } catch {
      return { status: 'unsupported', pendingMoves }
    }

    const agrees = expected === actual
    if (!agrees) this.disagreementLog.push({ source, pendingMoves, expected, actual })
    // Trust the newest reading unconditionally and re-baseline from it, whatever the
    // outcome: a per-move echo is not an independent check, and even a genuine
    // device-sourced disagreement must never freeze the reconciler on a stale
    // expectation that a later reading could otherwise self-correct.
    this.baseline = actual
    this.pending = []
    if (!agrees && source === 'echo') return { status: 'verified', pendingMoves, expected, actual }
    return { status: agrees ? 'verified' : 'mismatch', pendingMoves, expected, actual }
  }
}
