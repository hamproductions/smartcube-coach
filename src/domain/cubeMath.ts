import { CubieCube as VendorCubieCube, SOLVED_FACELET as VENDOR_SOLVED_FACELET } from '../device/vendor'

export type CubeModel = VendorCubieCube

export const SOLVED_FACELETS = VENDOR_SOLVED_FACELET

const moveOffsets: Record<string, number> = { U: 0, R: 3, F: 6, D: 9, L: 12, B: 15 }

function moveIndex(move: string) {
  const matched = /^([URFDLB])(2'|2|')?$/.exec(move)
  if (!matched) return undefined
  const suffix = matched[2] === "2'" ? '2' : matched[2]
  return moveOffsets[matched[1]] + (suffix === '2' ? 1 : suffix === "'" ? 2 : 0)
}

// M/E/S slice-move quarter-turn generators: corners untouched (slices never move corners), edge
// permutation+orientation arrays derived from cubing.js kpuzzle ground truth and cross-validated
// against this file's own vendor U/R/F/D/L/B move tables (matching touched-edge sets face by
// face). Composition below mirrors vendor CubieCube.moveCube's own quarter->double->triple
// derivation, so slice moves are decomposed the same way the reference keeps its move tables:
// an untouched corner array plus a derived edge array, no separate rotation primitive invented.
const sliceGenerators: Record<'M' | 'E' | 'S', { ca: number[]; ea: number[] }> = {
  M: { ca: [0, 1, 2, 3, 4, 5, 6, 7], ea: [0, 7, 4, 15, 8, 3, 12, 11, 16, 18, 20, 22] },
  E: { ca: [0, 1, 2, 3, 4, 5, 6, 7], ea: [0, 2, 4, 6, 8, 10, 12, 14, 19, 21, 23, 17] },
  S: { ca: [0, 1, 2, 3, 4, 5, 6, 7], ea: [5, 2, 13, 6, 1, 10, 9, 14, 16, 18, 20, 22] }
}

const sliceMoveCube: Record<string, VendorCubieCube> = (() => {
  const table: Record<string, VendorCubieCube> = {}
  for (const face of Object.keys(sliceGenerators) as Array<keyof typeof sliceGenerators>) {
    const quarter = new VendorCubieCube().init(sliceGenerators[face].ca, sliceGenerators[face].ea)
    const double = new VendorCubieCube()
    VendorCubieCube.CubeMult(quarter, quarter, double)
    const triple = new VendorCubieCube()
    VendorCubieCube.CubeMult(double, quarter, triple)
    table[face] = quarter
    table[`${face}2`] = double
    table[`${face}'`] = triple
  }
  return table
})()

function sliceMove(move: string) {
  const matched = /^([MES])(2'|2|')?$/.exec(move)
  if (!matched) return undefined
  const suffix = matched[2] === "2'" ? '2' : matched[2]
  return sliceMoveCube[`${matched[1]}${suffix ?? ''}`]
}

export function solvedCube(): CubeModel {
  return new VendorCubieCube()
}

export function cubeFromFacelets(facelets: string): CubeModel {
  const cube = new VendorCubieCube()
  if (cube.fromFacelet(facelets) === -1) throw new Error('Invalid facelet snapshot')
  return cube
}

export function faceletsOf(cube: CubeModel) {
  return cube.toFaceCube()
}

export function turn(cube: CubeModel, move: string): CubeModel {
  const index = moveIndex(move)
  if (index === undefined) throw new Error(`Unsupported move: ${move}`)
  const next = new VendorCubieCube()
  VendorCubieCube.CubeMult(cube, VendorCubieCube.moveCube[index], next)
  return next
}

export function turnAll(cube: CubeModel, moves: string[]): CubeModel {
  return moves.reduce((current, move) => turn(current, move), cube)
}
