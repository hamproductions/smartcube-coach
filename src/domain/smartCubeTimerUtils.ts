/**
 * Ported from hakatashi/smart-cube-timer (https://github.com/hakatashi/smart-cube-timer)
 * Source file: lib/utils.js
 *
 * MIT License
 *
 * Copyright (c) 2018 Koki Takahashi
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 * Adaptation notes (this port):
 * - Source used `sylvester` (Vector/Matrix/Line classes) for the 3D rotation
 *   math backing getOrientation/getRelativeFace/getRelativeFaceFromFaces. That
 *   package is not a dependency of this repo, so it is reimplemented below as
 *   plain-function vector/matrix helpers over axis-aligned unit vectors
 *   (vCross/vDot/vRotate/mRotation/mMul/...), preserving the exact algorithm,
 *   branch structure and evaluation order of the original functions.
 * - `assert` (Node) is replaced with a local `invariant` helper so this stays
 *   safe to bundle for the browser.
 * - lodash's `isEqual`/`minBy` are replaced with local equivalents restricted
 *   to the shapes actually used here (number[] equality, min-by-number).
 * - Roux-specific helpers (findRouxBlock, isRouxBlockSatisfied,
 *   isRouxStageSatisfied, getCll, getLseo) and their CLL/LSEO data tables are
 *   included in full for fidelity with SolveAnalyzer.pushMoves, which
 *   dispatches to either CFOP or Roux predicates depending on solve mode.
 * - UI-only helpers from the source file (formatTime, formatDate,
 *   formatSerializedDate, idealTextColor) were intentionally NOT ported --
 *   out of stated scope (cube/solve analysis, not presentation formatting).
 */

export const faces = ['U', 'R', 'F', 'D', 'L', 'B'] as const
export type Face = (typeof faces)[number]
export type RotationAxis = 'x' | 'y' | 'z'
export type SliceFace = 'M' | 'E' | 'S'
export type NotationFace = Face | RotationAxis | SliceFace | ''

export interface Move {
  face: Face
  amount: number
  width?: 1 | 2
  time?: number
}

export interface AxisMove {
  face: RotationAxis
  amount: number
}

function invariant(condition: unknown, message = 'invariant failed'): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function fail(message: string): never {
  throw new Error(message)
}

function isEqualNumberArray(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index])
}

function minBy<T>(items: readonly T[], scorer: (item: T) => number): T {
  invariant(items.length > 0, 'minBy requires a non-empty array')
  let best = items[0]
  let bestScore = scorer(best)
  for (const item of items.slice(1)) {
    const score = scorer(item)
    if (score < bestScore) {
      best = item
      bestScore = score
    }
  }
  return best
}

// --- minimal vector/matrix math over 3D axis vectors (replaces `sylvester`) ---

type Vec3 = readonly [number, number, number]
type Mat3 = readonly [Vec3, Vec3, Vec3]

const EPS = 1e-9

const eq = (a: number, b: number, eps = EPS) => Math.abs(a - b) <= eps

const vAdd = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const vSub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const vScale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s]
const vDot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const vCross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]
const vMagnitude = (a: Vec3): number => Math.sqrt(vDot(a, a))
const vUnit = (a: Vec3): Vec3 => {
  const magnitude = vMagnitude(a)
  invariant(magnitude > EPS, 'cannot normalize a zero vector')
  return vScale(a, 1 / magnitude)
}
const vAngleFrom = (a: Vec3, b: Vec3): number => {
  const cos = vDot(a, b) / (vMagnitude(a) * vMagnitude(b))
  return Math.acos(Math.min(1, Math.max(-1, cos)))
}
const vDistanceFrom = (a: Vec3, b: Vec3): number => vMagnitude(vSub(a, b))
const vIsParallelTo = (a: Vec3, b: Vec3): boolean => vAngleFrom(a, b) <= EPS
const vIsAntiparallelTo = (a: Vec3, b: Vec3): boolean => Math.PI - vAngleFrom(a, b) <= EPS
const vIsPerpendicularTo = (a: Vec3, b: Vec3): boolean => Math.abs(vDot(a, b)) <= EPS

// Rodrigues' rotation formula: rotates `v` by `angle` radians around `axis`.
const vRotate = (v: Vec3, angle: number, axis: Vec3): Vec3 => {
  const k = vUnit(axis)
  const cosT = Math.cos(angle)
  const sinT = Math.sin(angle)
  return vAdd(
    vAdd(vScale(v, cosT), vScale(vCross(k, v), sinT)),
    vScale(k, vDot(k, v) * (1 - cosT)),
  )
}

const mIdentity = (): Mat3 => [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
]

// Rodrigues' rotation formula, matrix form: R = I*cos + (1-cos)*k k^T + sin*[k]_x
const mRotation = (angle: number, axis: Vec3): Mat3 => {
  const [kx, ky, kz] = vUnit(axis)
  const cosT = Math.cos(angle)
  const sinT = Math.sin(angle)
  const t = 1 - cosT
  return [
    [cosT + kx * kx * t, kx * ky * t - kz * sinT, kx * kz * t + ky * sinT],
    [ky * kx * t + kz * sinT, cosT + ky * ky * t, ky * kz * t - kx * sinT],
    [kz * kx * t - ky * sinT, kz * ky * t + kx * sinT, cosT + kz * kz * t],
  ]
}

const mMulVec = (m: Mat3, v: Vec3): Vec3 => [
  m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
  m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
  m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
]

// a.multiply(b) in sylvester terms: (a*b)(v) === a(b(v))
const mMul = (a: Mat3, b: Mat3): Mat3 => {
  const result: number[][] = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ]
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      result[row][col] = a[row][0] * b[0][col] + a[row][1] * b[1][col] + a[row][2] * b[2][col]
    }
  }
  return result as unknown as Mat3
}

// Rotation matrices are orthonormal, so inverse === transpose.
const mInverse = (m: Mat3): Mat3 => [
  [m[0][0], m[1][0], m[2][0]],
  [m[0][1], m[1][1], m[2][1]],
  [m[0][2], m[1][2], m[2][2]],
]

const mElement = (m: Mat3, row: 1 | 2 | 3, col: 1 | 2 | 3): number => m[row - 1][col - 1]

// --- original data ---

const faceVectors: Record<Face, Vec3> = {
  U: [0, 0, 1],
  R: [1, 0, 0],
  F: [0, -1, 0],
  D: [0, 0, -1],
  L: [-1, 0, 0],
  B: [0, 1, 0],
}

const rotationFaces: Record<RotationAxis, Face> = {
  x: 'R',
  y: 'U',
  z: 'F',
}

export const sliceFaces: Record<'M' | 'E' | 'S', Face> = {
  M: 'L',
  E: 'D',
  S: 'F',
}

const corners = ['URF', 'UFL', 'ULB', 'UBR', 'DFR', 'DLF', 'DBL', 'DRB'] as const
const edges = ['UR', 'UF', 'UL', 'UB', 'DR', 'DF', 'DL', 'DB', 'FR', 'FL', 'BL', 'BR'] as const

// --- derived data ---

const oppositeFaces = new Map<Face, Face>(
  faces.map((face) => {
    const oppositeVector = vScale(faceVectors[face], -1)
    const found = (Object.entries(faceVectors) as [Face, Vec3][]).find(([, v]) => isEqualNumberArray(v, oppositeVector))
    invariant(found, `no opposite face found for ${face}`)
    return [face, found[0]]
  }),
)

const crossEdgesMap = new Map<Face, [number, string][]>(
  faces.map((face) => [face, [...edges.entries()].filter(([, edge]) => edge.includes(face))]),
)

interface F2lPair {
  corner: string
  cornerIndex: number
  edge: string
  edgeIndex: number
}

const f2lPairsMap = new Map<Face, F2lPair[]>(
  faces.map((face) => [
    face,
    [...corners.entries()]
      .filter(([, corner]) => corner.includes(face))
      .map(([cornerIndex, corner]) => {
        const sortedCorner = [...corner].sort().join('')
        const edge = edges.find((e) => [...e, face].sort().join('') === sortedCorner)
        const edgeIndex = edges.findIndex((e) => [...e, face].sort().join('') === sortedCorner)
        invariant(edge !== undefined, `no matching f2l edge found for ${corner}/${face}`)
        return {corner, cornerIndex, edge, edgeIndex}
      }),
  ]),
)

interface FacePieces {
  edges: [number, string][]
  corners: [number, string][]
}

// Order really matters here
const facePiecesMap = new Map<Face, FacePieces>(
  (
    [
      ['D', {edges: ['DR', 'DB', 'DL', 'DF'], corners: ['DRB', 'DBL', 'DLF', 'DFR']}],
      ['L', {edges: ['UL', 'FL', 'DL', 'BL'], corners: ['UFL', 'DLF', 'DBL', 'ULB']}],
      ['B', {edges: ['UB', 'BL', 'DB', 'BR'], corners: ['ULB', 'DBL', 'DRB', 'UBR']}],
      ['U', {edges: ['UB', 'UR', 'UF', 'UL'], corners: ['UBR', 'URF', 'UFL', 'ULB']}],
      ['R', {edges: ['UR', 'BR', 'DR', 'FR'], corners: ['UBR', 'DRB', 'DFR', 'URF']}],
      ['F', {edges: ['UF', 'FR', 'DF', 'FL'], corners: ['URF', 'DFR', 'DLF', 'UFL']}],
    ] as [Face, {edges: string[]; corners: string[]}][]
  ).map(([face, {edges: edgePieces, corners: cornerPieces}]) => [
    face,
    {
      edges: edgePieces.map((edge) => [edges.findIndex((e) => e === edge), edge] as [number, string]),
      corners: cornerPieces.map((corner) => [corners.findIndex((c) => c === corner), corner] as [number, string]),
    },
  ]),
)

// --- derived data getters ---

export const getNotation = ({face, amount, width = 1}: {face: NotationFace; amount: number; width?: 1 | 2}): string => {
  invariant(width === 1 || width === 2)
  const notationFace = width === 1 ? face : face.toLowerCase()

  if (amount === 0) {
    return ''
  }
  if (amount === 2) {
    return `${notationFace}2`
  }
  if (amount === 1) {
    return notationFace
  }
  if (amount === -1) {
    return `${notationFace}'`
  }

  invariant(amount === -2)
  return `${notationFace}2'`
}

const vectorToFace = (vector: Vec3): Face => {
  const normalizedElements = vector.map((element) => {
    invariant(Math.abs(element - Math.round(element)) <= EPS)
    return Math.round(element)
  }) as unknown as Vec3

  const result = (Object.entries(faceVectors) as [Face, Vec3][]).find(([, faceVector]) => isEqualNumberArray(faceVector, normalizedElements))
  invariant(result, 'vectorToFace: no matching face')

  return result[0]
}

const vectorToRotation = (vector: Vec3): {face: RotationAxis; direction: 1 | -1} => {
  const normalizedElements = vector.map((element) => {
    invariant(Math.abs(element - Math.round(element)) <= EPS)
    return Math.round(element)
  }) as unknown as Vec3

  {
    const result = (Object.entries(rotationFaces) as [RotationAxis, Face][]).find(([, face]) => isEqualNumberArray(faceVectors[face], normalizedElements))
    if (result) {
      return {face: result[0], direction: 1}
    }
  }

  {
    const inversedElements = normalizedElements.map((element) => -element) as unknown as Vec3
    const result = (Object.entries(rotationFaces) as [RotationAxis, Face][]).find(([, face]) => isEqualNumberArray(faceVectors[face], inversedElements))
    invariant(result, 'vectorToRotation: no matching axis')
    return {face: result[0], direction: -1}
  }
}

export const moveToRotation = ({face, amount}: {face: Face; amount: number}): AxisMove => {
  const axisVector = faceVectors[face]
  const {face: rotationFace, direction} = vectorToRotation(axisVector)
  return {
    face: rotationFace,
    amount: amount * direction,
  }
}

export const getOppositeFace = (face: Face): Face => {
  const opposite = oppositeFaces.get(face)
  invariant(opposite, `no opposite face for ${face}`)
  return opposite
}

const getRotationParameter = ({from, to}: {from: Face; to: Face}): {axisVector: Vec3 | null; angle: number | null} => {
  if (from === to) {
    return {axisVector: null, angle: null}
  }

  const fromVector = faceVectors[from]
  const toVector = faceVectors[to]

  const directionFace = to === getOppositeFace(from) ? faces.find((f) => f !== from && f !== to)! : to
  const directionVector = faceVectors[directionFace]

  const axisVector = vCross(fromVector, directionVector)
  const angle = vAngleFrom(fromVector, toVector)

  return {axisVector, angle}
}

const getRotationMatrix = ({from, to}: {from: Face; to: Face}): Mat3 => {
  if (from === to) {
    return mIdentity()
  }

  const {axisVector, angle} = getRotationParameter({from, to})
  return mRotation(angle!, axisVector!)
}

export const getOrientation = ({from, to}: {from: Face; to: Face}): {left: Face; down: Face} => {
  const matrix = getRotationMatrix({from, to})
  const inverse = mInverse(matrix)
  const newLeftVector = mMulVec(inverse, faceVectors.L)
  const newDownVector = mMulVec(inverse, faceVectors.D)
  return {
    left: vectorToFace(newLeftVector),
    down: vectorToFace(newDownVector),
  }
}

const getRotation = ({from, to}: {from: Face; to: Face}): {face: RotationAxis | ''; amount: number} => {
  if (from === to) {
    return {face: '', amount: 0}
  }

  const {axisVector, angle} = getRotationParameter({from, to})

  const {face, direction} = vectorToRotation(vUnit(axisVector!))

  if (eq(angle!, Math.PI)) {
    return {face, amount: 2}
  }

  invariant(eq(angle!, Math.PI / 2))
  if (direction === -1) {
    return {face, amount: 1}
  }

  invariant(direction === 1)
  return {face, amount: -1}
}

const getRotationNotationUncached = ({from, to}: {from: Face; to: Face}): string => {
  const {face, amount} = getRotation({from, to})
  return getNotation({face, amount})
}

const getRelativeFaceUncached = (face: Face, {from, to}: {from: Face; to: Face}): Face => {
  if (from === to) {
    return face
  }

  const faceVector = faceVectors[face]
  const fromVector = faceVectors[from]
  const toVector = faceVectors[to]

  const directionFace = to === getOppositeFace(from) ? faces.find((f) => f !== from && f !== to)! : to
  const directionVector = faceVectors[directionFace]

  const axisVector = vCross(fromVector, directionVector)
  const angle = vAngleFrom(fromVector, toVector)

  const destinationVector = vRotate(faceVector, angle, axisVector)

  return vectorToFace(destinationVector)
}

const relativeFaceCache = new Map<string, Face>()
const rotationNotationCache = new Map<string, string>()
for (const from of faces) {
  for (const to of faces) {
    rotationNotationCache.set([from, to].join(''), getRotationNotationUncached({from, to}))
    for (const face of faces) {
      relativeFaceCache.set([face, from, to].join(''), getRelativeFaceUncached(face, {from, to}))
    }
  }
}

export const getRelativeFace = (face: Face, {from, to}: {from: Face; to: Face}): Face => {
  const cached = relativeFaceCache.get([face, from, to].join(''))
  invariant(cached, `getRelativeFace: cache miss for ${face}/${from}/${to}`)
  return cached
}

export const getRotationNotation = ({from, to}: {from: Face; to: Face}): string => {
  const cached = rotationNotationCache.get([from, to].join(''))
  invariant(cached !== undefined, `getRotationNotation: cache miss for ${from}/${to}`)
  return cached
}

const getRotationMatrixFromFaces = ({from: [from1, from2], to: [to1, to2]}: {from: [Face, Face]; to: [Face, Face]}): Mat3 => {
  const fromVector1 = faceVectors[from1]
  const fromVector2 = faceVectors[from2]
  const toVector1 = faceVectors[to1]
  const toVector2 = faceVectors[to2]

  let matrix: Mat3 = mIdentity()

  // rotate to adjust fromVector1 to toVector1
  if (!vIsParallelTo(fromVector1, toVector1)) {
    const axis = vIsAntiparallelTo(fromVector1, toVector1)
      ? (Object.values(faceVectors).find((v) => vIsPerpendicularTo(fromVector1, v)) as Vec3)
      : vCross(fromVector1, toVector1)
    const angle = vIsParallelTo(vCross(fromVector1, toVector1), axis)
      ? vAngleFrom(toVector1, fromVector1)
      : -vAngleFrom(toVector1, fromVector1)
    invariant(isEqualNumberArray(vRotate(fromVector1, angle, axis).map(Math.round), toVector1))

    matrix = mMul(matrix, mRotation(angle, axis))
  }

  invariant(isEqualNumberArray(mMulVec(matrix, fromVector1).map(Math.round), toVector1))

  // rotate around toVector1 to adjust rotated fromVector2 to toVector2
  const mappedFromVector2 = mMulVec(matrix, fromVector2)

  if (!vIsParallelTo(mappedFromVector2, toVector2)) {
    const angle = vIsParallelTo(vCross(mappedFromVector2, toVector2), toVector1)
      ? vAngleFrom(toVector2, mappedFromVector2)
      : -vAngleFrom(toVector2, mappedFromVector2)

    matrix = mMul(mRotation(angle, toVector1), matrix)
  }

  invariant(isEqualNumberArray(mMulVec(matrix, fromVector1).map(Math.round), toVector1))
  invariant(isEqualNumberArray(mMulVec(matrix, fromVector2).map(Math.round), toVector2))

  return matrix
}

const getRotationFromFaces = ({from: [from1, from2], to: [to1, to2]}: {from: [Face, Face]; to: [Face, Face]}): {x: number; y: number; z: number} => {
  const matrix = getRotationMatrixFromFaces({from: [from1, from2], to: [to1, to2]})

  // decomposit matrix into rotations around x, y, z (application order: x => y => z)
  if (eq(mElement(matrix, 3, 1), 1)) {
    return {
      x: 0,
      y: -Math.PI / 2,
      z: Math.atan2(-mElement(matrix, 1, 2), mElement(matrix, 2, 2)),
    }
  }
  if (eq(mElement(matrix, 3, 1), -1)) {
    return {
      x: 0,
      y: Math.PI / 2,
      z: Math.atan2(-mElement(matrix, 1, 2), mElement(matrix, 2, 2)),
    }
  }
  return {
    x: Math.atan2(mElement(matrix, 3, 2), mElement(matrix, 3, 3)),
    y: Math.atan2(-mElement(matrix, 3, 1), Math.sqrt(mElement(matrix, 3, 2) ** 2 + mElement(matrix, 3, 3) ** 2)),
    z: Math.atan2(mElement(matrix, 2, 1), mElement(matrix, 1, 1)),
  }
}

const getRotationNotationFromFacesUncached = ({from: [from1, from2], to: [to1, to2]}: {from: [Face, Face]; to: [Face, Face]}): string => {
  const rotation = getRotationFromFaces({from: [from1, from2], to: [to1, to2]})
  const notations: string[] = []
  const x = -Math.round((rotation.x / Math.PI) * 2)
  const y = Math.round((rotation.y / Math.PI) * 2)
  const z = -Math.round((rotation.z / Math.PI) * 2)

  if (x % 4 !== 0) {
    notations.push(getNotation({face: 'x', amount: ((x + 5) % 4) - 1}))
  }
  if (y % 4 !== 0) {
    notations.push(getNotation({face: 'z', amount: ((y + 5) % 4) - 1}))
  }
  if (z % 4 !== 0) {
    notations.push(getNotation({face: 'y', amount: ((z + 5) % 4) - 1}))
  }

  return notations.join(' ')
}

const getRelativeFaceFromFacesUncached = (face: Face, {from: [from1, from2], to: [to1, to2]}: {from: [Face, Face]; to: [Face, Face]}): Face => {
  const matrix = getRotationMatrixFromFaces({from: [from1, from2], to: [to1, to2]})
  const faceVector = faceVectors[face]
  const destinationVector = mMulVec(matrix, faceVector)
  return minBy(faces, (f) => vDistanceFrom(destinationVector, faceVectors[f]))
}

const relativeFaceFromFacesCache = new Map<string, Face>()
const rotationNotationFromFacesCache = new Map<string, string>()
for (const from1 of faces) {
  for (const from2 of faces) {
    if (from1 === from2) {
      continue
    }

    for (const to1 of faces) {
      for (const to2 of faces) {
        const fromVector1 = faceVectors[from1]
        const fromVector2 = faceVectors[from2]
        const toVector1 = faceVectors[to1]
        const toVector2 = faceVectors[to2]

        if (vAngleFrom(fromVector2, fromVector1) !== vAngleFrom(toVector2, toVector1)) {
          continue
        }

        rotationNotationFromFacesCache.set(
          [from1, from2, to1, to2].join(''),
          getRotationNotationFromFacesUncached({from: [from1, from2], to: [to1, to2]}),
        )

        for (const face of faces) {
          relativeFaceFromFacesCache.set(
            [face, from1, from2, to1, to2].join(''),
            getRelativeFaceFromFacesUncached(face, {from: [from1, from2], to: [to1, to2]}),
          )
        }
      }
    }
  }
}

export const getRelativeFaceFromFaces = (face: Face, {from, to}: {from: [Face, Face]; to: [Face, Face]}): Face => {
  const cached = relativeFaceFromFacesCache.get([face, from[0], from[1], to[0], to[1]].join(''))
  invariant(cached, `getRelativeFaceFromFaces: cache miss for ${face}`)
  return cached
}

export const getRotationNotationFromFaces = ({from, to}: {from: [Face, Face]; to: [Face, Face]}): string => {
  const cached = rotationNotationFromFacesCache.get([from[0], from[1], to[0], to[1]].join(''))
  invariant(cached !== undefined, 'getRotationNotationFromFaces: cache miss')
  return cached
}

const getMatrixFromRotation = ({face, amount}: AxisMove): Mat3 => {
  const axisVector = faceVectors[rotationFaces[face]]
  return mRotation((-Math.PI * amount) / 2, axisVector)
}

export const getOrientationFromRotation = ({left, down}: {left: Face; down: Face}, {face, amount}: AxisMove): {left: Face; down: Face} => {
  const matrix = getMatrixFromRotation({face, amount})

  const inverse = mInverse(matrix)
  const newLeftDirection = mMulVec(inverse, faceVectors.L)
  const newDownDirection = mMulVec(inverse, faceVectors.D)

  const newLeftFace = getRelativeFaceFromFaces(vectorToFace(newLeftDirection), {from: ['L', 'D'], to: [left, down]})
  const newDownFace = getRelativeFaceFromFaces(vectorToFace(newDownDirection), {from: ['L', 'D'], to: [left, down]})

  return {
    left: newLeftFace,
    down: newDownFace,
  }
}

// --- stage machine data ---

export type CfopStageId = 'unknown' | 'f2l1' | 'f2l2' | 'f2l3' | 'f2l4' | 'oll' | 'pll' | 'auf'
export type RouxStageId = 'unknown' | 'block2' | 'cll' | 'lseo' | 'lsep'
export type StageId = CfopStageId | RouxStageId
export type SolveMode = 'cfop' | 'roux'

const stagesData: Record<SolveMode, {id: StageId}[]> = {
  cfop: [{id: 'unknown'}, {id: 'f2l1'}, {id: 'f2l2'}, {id: 'f2l3'}, {id: 'f2l4'}, {id: 'oll'}, {id: 'pll'}, {id: 'auf'}],
  roux: [{id: 'unknown'}, {id: 'block2'}, {id: 'cll'}, {id: 'lseo'}, {id: 'lsep'}],
}

export const getNextStage = (stage: StageId): StageId | 'solved' => {
  for (const stages of Object.values(stagesData)) {
    for (const [index, stageData] of stages.entries()) {
      // Skip unknown
      if (index === 0) {
        continue
      }

      if (stageData.id === stage) {
        if (index === stages.length - 1) {
          return 'solved'
        }

        return stages[index + 1].id
      }
    }
  }

  return fail(`getNextStage: unknown stage ${stage}`)
}

// --- cube state (Kociemba-style cubie representation) ---

export interface KociembaCubeState {
  cp: number[]
  co: number[]
  ep: number[]
  eo: number[]
  isSolved(): boolean
}

export const findRouxBlock = (cube: KociembaCubeState): {side: Face; bottom: Face; bottomDirection: Face} | null => {
  for (const side of faces) {
    const {co, eo} = getFaceOrientations(side, cube)
    const {cp, ep} = getFacePermutations(side, cube)

    // Check if 2x2 block is satisfied for each corners
    const is2x2BlockSatisfied = [0, 1, 2, 3].map(
      (cornerIndex) =>
        co[cornerIndex] === 0 &&
        eo[cornerIndex] === 0 &&
        eo[(cornerIndex + 1) % 4] === 0 &&
        cp[cornerIndex] === ep[cornerIndex] &&
        (cp[cornerIndex] + 1) % 4 === ep[(cornerIndex + 1) % 4],
    )

    // If sequential 2x2 block is satisfied it's 2x3 block
    const satisfied2x3Block = [0, 1, 2, 3].findIndex((i) => is2x2BlockSatisfied[i] && is2x2BlockSatisfied[(i + 1) % 4])

    if (satisfied2x3Block !== -1) {
      const facePieces = facePiecesMap.get(side)!
      const [, centralEdgePiece] = facePieces.edges[ep[(satisfied2x3Block + 1) % 4]]
      const [, centralDirectionEdgePiece] = facePieces.edges[(satisfied2x3Block + 1) % 4]
      const bottom = [...centralEdgePiece].find((face) => face !== side) as Face
      const bottomDirection = [...centralDirectionEdgePiece].find((face) => face !== side) as Face
      return {side, bottom, bottomDirection}
    }
  }

  return null
}

export const findCross = (cube: KociembaCubeState): Face | null => {
  for (const face of faces) {
    const crossEdges = crossEdgesMap.get(face)!
    const isCrossed = crossEdges.every(([edgeIndex]) => cube.eo[edgeIndex] === 0 && cube.ep[edgeIndex] === edgeIndex)
    if (isCrossed) {
      return face
    }
  }
  return null
}

type NamedCase<T> = [string, string | null, T]

/*
 * === OLL ===
 * Data format is [name, id (algdb), [CO1, CO2, CO3, CO4, EO1, EO2, EO3, EO4]]
 * '0' is oriented correctly.
 */
const olls: NamedCase<number[]>[] = [
  ['OLL Skip', null, [0, 0, 0, 0, 0, 0, 0, 0]],
  ['OLL 1', 'oll1', [2, 1, 2, 1, 1, 1, 1, 1]],
  ['OLL 2', 'oll2', [1, 2, 2, 1, 1, 1, 1, 1]],
  ['OLL 3', 'oll3', [2, 2, 0, 2, 1, 1, 1, 1]],
  ['OLL 4', 'oll4', [1, 0, 1, 1, 1, 1, 1, 1]],
  ['OLL 5', 'oll5', [2, 0, 2, 2, 1, 0, 0, 1]],
  ['OLL 6', 'oll6', [0, 1, 1, 1, 0, 0, 1, 1]],
  ['OLL 7', 'oll7', [2, 2, 0, 2, 0, 1, 1, 0]],
  ['OLL 8', 'oll8', [1, 0, 1, 1, 0, 0, 1, 1]],
  ['OLL 9', 'oll9', [0, 1, 1, 1, 1, 1, 0, 0]],
  ['OLL 10', 'oll10', [0, 2, 2, 2, 1, 1, 0, 0]],
  ['OLL 11', 'oll11', [2, 2, 0, 2, 1, 0, 0, 1]],
  ['OLL 12', 'oll12', [0, 1, 1, 1, 1, 0, 0, 1]],
  ['OLL 13', 'oll13', [2, 2, 0, 2, 1, 0, 1, 0]],
  ['OLL 14', 'oll14', [1, 0, 1, 1, 1, 0, 1, 0]],
  ['OLL 15', 'oll15', [2, 0, 2, 2, 1, 0, 1, 0]],
  ['OLL 16', 'oll16', [0, 1, 1, 1, 1, 0, 1, 0]],
  ['OLL 17', 'oll17', [1, 0, 2, 0, 1, 1, 1, 1]],
  ['OLL 18', 'oll18', [0, 2, 1, 0, 1, 1, 1, 1]],
  ['OLL 19', 'oll19', [0, 1, 2, 0, 1, 1, 1, 1]],
  ['OLL 20', 'oll20', [0, 0, 0, 0, 1, 1, 1, 1]],
  ['OLL 21', 'oll21', [2, 1, 2, 1, 0, 0, 0, 0]],
  ['OLL 22', 'oll22', [1, 2, 2, 1, 0, 0, 0, 0]],
  ['OLL 23', 'oll23', [0, 2, 1, 0, 0, 0, 0, 0]],
  ['OLL 24', 'oll24', [0, 0, 1, 2, 0, 0, 0, 0]],
  ['OLL 25', 'oll25', [2, 0, 1, 0, 0, 0, 0, 0]],
  ['OLL 26', 'oll26', [1, 1, 1, 0, 0, 0, 0, 0]],
  ['OLL 27', 'oll27', [2, 2, 0, 2, 0, 0, 0, 0]],
  ['OLL 28', 'oll28', [0, 0, 0, 0, 0, 1, 1, 0]],
  ['OLL 29', 'oll29', [0, 1, 2, 0, 1, 1, 0, 0]],
  ['OLL 30', 'oll30', [0, 1, 2, 0, 1, 0, 0, 1]],
  ['OLL 31', 'oll31', [0, 0, 1, 2, 0, 0, 1, 1]],
  ['OLL 32', 'oll32', [0, 0, 1, 2, 1, 0, 0, 1]],
  ['OLL 33', 'oll33', [0, 0, 1, 2, 1, 0, 1, 0]],
  ['OLL 34', 'oll34', [0, 1, 2, 0, 1, 0, 1, 0]],
  ['OLL 35', 'oll35', [2, 0, 1, 0, 1, 0, 0, 1]],
  ['OLL 36', 'oll36', [2, 0, 1, 0, 1, 1, 0, 0]],
  ['OLL 37', 'oll37', [2, 0, 1, 0, 0, 1, 1, 0]],
  ['OLL 38', 'oll38', [0, 1, 0, 2, 0, 1, 1, 0]],
  ['OLL 39', 'oll39', [1, 0, 2, 0, 0, 1, 0, 1]],
  ['OLL 40', 'oll40', [0, 2, 0, 1, 0, 1, 0, 1]],
  ['OLL 41', 'oll41', [0, 2, 1, 0, 1, 0, 0, 1]],
  ['OLL 42', 'oll42', [0, 2, 1, 0, 1, 1, 0, 0]],
  ['OLL 43', 'oll43', [2, 1, 0, 0, 1, 1, 0, 0]],
  ['OLL 44', 'oll44', [0, 0, 2, 1, 1, 0, 0, 1]],
  ['OLL 45', 'oll45', [0, 0, 2, 1, 1, 0, 1, 0]],
  ['OLL 46', 'oll46', [2, 1, 0, 0, 0, 1, 0, 1]],
  ['OLL 47', 'oll47', [2, 1, 1, 2, 0, 0, 1, 1]],
  ['OLL 48', 'oll48', [1, 2, 2, 1, 0, 1, 1, 0]],
  ['OLL 49', 'oll49', [2, 1, 1, 2, 1, 1, 0, 0]],
  ['OLL 50', 'oll50', [1, 2, 2, 1, 1, 0, 0, 1]],
  ['OLL 51', 'oll51', [1, 2, 2, 1, 1, 0, 1, 0]],
  ['OLL 52', 'oll52', [2, 1, 1, 2, 0, 1, 0, 1]],
  ['OLL 53', 'oll53', [2, 1, 2, 1, 1, 0, 0, 1]],
  ['OLL 54', 'oll54', [2, 1, 2, 1, 0, 0, 1, 1]],
  ['OLL 55', 'oll55', [2, 1, 2, 1, 0, 1, 0, 1]],
  ['OLL 56', 'oll56', [2, 1, 2, 1, 1, 0, 1, 0]],
  ['OLL 57', 'oll57', [0, 0, 0, 0, 1, 0, 1, 0]],
]

/*
 * === PLL ===
 * Data format is the same as OLLs
 */
const plls: NamedCase<number[]>[] = [
  ['PLL Skip', null, [0, 1, 2, 3, 0, 1, 2, 3]],
  ['Aa Perm', 'aa', [1, 3, 2, 0, 0, 1, 2, 3]],
  ['Ab Perm', 'ab', [3, 0, 2, 1, 0, 1, 2, 3]],
  ['E Perm', 'e', [3, 2, 1, 0, 0, 1, 2, 3]],
  ['F Perm', 'f', [0, 2, 3, 1, 1, 0, 3, 2]],
  ['Ga Perm', 'ga', [1, 0, 2, 3, 2, 3, 1, 0]],
  ['Gb Perm', 'gb', [1, 0, 2, 3, 3, 2, 0, 1]],
  ['Gc Perm', 'gc', [1, 0, 2, 3, 1, 3, 0, 2]],
  ['Gd Perm', 'gd', [1, 0, 2, 3, 2, 0, 3, 1]],
  ['H Perm', 'h', [0, 1, 2, 3, 2, 3, 0, 1]],
  ['Ja Perm', 'ja', [0, 1, 3, 2, 0, 1, 3, 2]],
  ['Jb Perm', 'jb', [1, 0, 2, 3, 0, 2, 1, 3]],
  ['Na Perm', 'na', [3, 2, 1, 0, 1, 0, 3, 2]],
  ['Nb Perm', 'nb', [3, 2, 1, 0, 3, 2, 1, 0]],
  ['Ra Perm', 'ra', [2, 0, 1, 3, 3, 0, 2, 1]],
  ['Rb Perm', 'rb', [0, 2, 3, 1, 1, 3, 2, 0]],
  ['T Perm', 't', [1, 0, 2, 3, 0, 3, 2, 1]],
  ['Ua Perm', 'ua', [0, 1, 2, 3, 3, 0, 2, 1]],
  ['Ub Perm', 'ub', [0, 1, 2, 3, 1, 3, 2, 0]],
  ['V Perm', 'v', [1, 0, 3, 2, 2, 1, 3, 0]],
  ['Y Perm', 'y', [0, 3, 2, 1, 3, 1, 2, 0]],
  ['Z Perm', 'z', [2, 3, 0, 1, 1, 0, 3, 2]],
]

/*
 * === CLL ===
 * Data format is [name, id (algdb), [CP1, CP2, CP3, CP4, CO1, CO2, CO3, CO4]]
 */
const clls: NamedCase<number[]>[] = [
  ['CLL Skip', null, [0, 1, 2, 3, 0, 0, 0, 0]],
  ['AS1', 'cmllas1', [2, 3, 0, 1, 1, 1, 1, 0]],
  ['AS2', 'cmllas2', [0, 2, 3, 1, 1, 1, 1, 0]],
  ['AS3', 'cmllas3', [2, 1, 3, 0, 1, 1, 1, 0]],
  ['AS4', 'cmllas4', [3, 1, 0, 2, 1, 1, 1, 0]],
  ['AS5', 'cmllas5', [2, 3, 1, 0, 1, 1, 1, 0]],
  ['AS6', 'cmllas6', [1, 0, 3, 2, 1, 1, 1, 0]],
  ['H1', 'cmllh1', [0, 1, 2, 3, 1, 2, 1, 2]],
  ['H2', 'cmllh2', [3, 1, 0, 2, 1, 2, 1, 2]],
  ['H3', 'cmllh3', [0, 1, 3, 2, 1, 2, 1, 2]],
  ['H4', 'cmllh4', [3, 2, 1, 0, 1, 2, 1, 2]],
  ['L1', 'cmlll1', [1, 2, 3, 0, 0, 1, 0, 2]],
  ['L2', 'cmlll2', [1, 3, 2, 0, 0, 1, 0, 2]],
  ['L3', 'cmlll3', [2, 3, 1, 0, 0, 1, 0, 2]],
  ['L4', 'cmlll4', [3, 1, 2, 0, 0, 1, 0, 2]],
  ['L5', 'cmlll5', [3, 2, 0, 1, 0, 1, 0, 2]],
  ['L6', 'cmlll6', [2, 1, 0, 3, 0, 1, 0, 2]],
  ['O1', 'cmllo1', [0, 2, 3, 1, 0, 0, 0, 0]],
  ['O2', 'cmllo2', [3, 2, 1, 0, 0, 0, 0, 0]],
  ['Pi1', 'cmllpi1', [2, 3, 0, 1, 1, 2, 2, 1]],
  ['Pi2', 'cmllpi2', [2, 0, 1, 3, 1, 2, 2, 1]],
  ['Pi3', 'cmllpi3', [1, 0, 2, 3, 1, 2, 2, 1]],
  ['Pi4', 'cmllpi4', [3, 1, 0, 2, 1, 2, 2, 1]],
  ['Pi5', 'cmllpi5', [0, 1, 3, 2, 1, 2, 2, 1]],
  ['Pi6', 'cmllpi6', [3, 2, 1, 0, 1, 2, 2, 1]],
  ['S1', 'cmlls1', [2, 3, 0, 1, 2, 2, 0, 2]],
  ['S2', 'cmlls2', [2, 0, 1, 3, 2, 2, 0, 2]],
  ['S3', 'cmlls3', [0, 3, 1, 2, 2, 2, 0, 2]],
  ['S4', 'cmlls4', [0, 2, 1, 3, 2, 2, 0, 2]],
  ['S5', 'cmlls5', [2, 3, 1, 0, 2, 2, 0, 2]],
  ['S6', 'cmlls6', [1, 0, 3, 2, 2, 2, 0, 2]],
  ['T1', 'cmllt1', [0, 1, 2, 3, 2, 0, 0, 1]],
  ['T2', 'cmllt2', [1, 3, 0, 2, 2, 0, 0, 1]],
  ['T3', 'cmllt3', [1, 0, 2, 3, 2, 0, 0, 1]],
  ['T4', 'cmllt4', [1, 3, 2, 0, 2, 0, 0, 1]],
  ['T5', 'cmllt5', [2, 3, 1, 0, 2, 0, 0, 1]],
  ['T6', 'cmllt6', [3, 2, 1, 0, 2, 0, 0, 1]],
  ['U1', 'cmllu1', [0, 1, 2, 3, 1, 0, 0, 2]],
  ['U2', 'cmllu2', [3, 1, 2, 0, 1, 0, 0, 2]],
  ['U3', 'cmllu3', [0, 3, 1, 2, 1, 0, 0, 2]],
  ['U4', 'cmllu4', [0, 2, 1, 3, 1, 0, 0, 2]],
  ['U5', 'cmllu5', [3, 0, 2, 1, 1, 0, 0, 2]],
  ['U6', 'cmllu6', [0, 3, 2, 1, 1, 0, 0, 2]],
]

/*
 * === LSEO ===
 * Data format is [name, [Number of misoriented bottom edges, EO1, EO2, EO3, EO4]]
 * Name is taken from https://cubingcheatsheet.com/algs3x_roux_lse.html
 */
const lseos: [string, number[]][] = [
  ['EO Skip', [0, 0, 0, 0, 0]],
  ['Case 1', [2, 1, 1, 1, 1]],
  ['Case 2', [2, 0, 1, 0, 1]],
  ['Case 3', [2, 0, 0, 0, 0]],
  ['Case 4', [1, 0, 1, 1, 1]],
  ['Case 5', [0, 1, 1, 1, 1]],
  ['Case 6', [0, 1, 0, 1, 0]],
  ['Case 7', [0, 1, 0, 0, 1]],
  ['Case 8', [1, 0, 0, 1, 0]],
  ['Case 9', [2, 1, 0, 0, 1]],
]

export interface OllResult {
  index: number
  name: string
  direction: number
  isEdgeOriented: boolean
}

export const getOll = ({eo, co}: {eo: number[]; co: number[]}): OllResult => {
  const coClone = co.slice()
  const eoClone = eo.slice()

  for (const direction of [0, 1, 2, 3]) {
    for (const [index, [name, , oll]] of olls.entries()) {
      if (isEqualNumberArray(oll, [...coClone, ...eoClone])) {
        return {
          index,
          name,
          direction,
          isEdgeOriented: eoClone.every((orientation) => orientation === 0),
        }
      }
    }

    coClone.unshift(coClone.pop()!) // rotate right
    eoClone.unshift(eoClone.pop()!) // rotate right
  }

  return fail('getOll: no matching OLL case')
}

export interface PllResult {
  index: number
  name: string
  direction: number
  shift: number
}

export const getPll = ({ep, cp}: {ep: number[]; cp: number[]}): PllResult => {
  const cpClone = cp.slice()
  const epClone = ep.slice()

  for (const direction of [0, 1, 2, 3]) {
    for (const shift of [0, 1, 2, 3]) {
      for (const [index, [name, , pll]] of plls.entries()) {
        if (
          isEqualNumberArray(pll, [
            ...cpClone.map((perm) => (perm + shift) % 4),
            ...epClone.map((perm) => (perm + shift) % 4),
          ])
        ) {
          return {index, name, direction, shift}
        }
      }
    }

    cpClone.unshift(cpClone.pop()!) // rotate right
    epClone.unshift(epClone.pop()!) // rotate right
  }

  return fail('getPll: no matching PLL case')
}

export interface CllResult {
  index: number
  name: string
  direction: number
  shift: number
}

export const getCll = ({cp, co}: {cp: number[]; co: number[]}): CllResult => {
  const cpClone = cp.slice()
  const coClone = co.slice()

  for (const direction of [0, 1, 2, 3]) {
    for (const shift of [0, 1, 2, 3]) {
      for (const [index, [name, , cll]] of clls.entries()) {
        if (isEqualNumberArray(cll, [...cpClone.map((perm) => (perm + shift) % 4), ...coClone])) {
          return {index, name, direction, shift}
        }
      }
    }

    cpClone.unshift(cpClone.pop()!) // rotate right
    coClone.unshift(coClone.pop()!) // rotate right
  }

  return fail('getCll: no matching CLL case')
}

export interface LseoResult {
  index: number
  name: string
  direction: number
}

export const getLseo = ({topEo, bottomEo}: {topEo: number[]; bottomEo: number[]}): LseoResult => {
  const topEoClone = topEo.slice()
  const bottomMisorientations = bottomEo.filter((orientation) => orientation !== 0).length

  for (const direction of [0, 1, 2, 3]) {
    for (const [index, [name, lseo]] of lseos.entries()) {
      if (isEqualNumberArray(lseo, [bottomMisorientations, ...topEoClone])) {
        return {
          index,
          name,
          direction,
        }
      }
    }

    topEoClone.unshift(topEoClone.pop()!) // rotate right
  }

  return fail('getLseo: no matching LSEO case')
}

export const mod = (n: number, modulo: number): number => ((n % modulo) + modulo) % modulo

const getFaceOrientations = (face: Face, cube: KociembaCubeState, targetFace?: Face): {eo: number[]; co: number[]} => {
  const {edges: targetFaceEdges, corners: targetFaceCorners} = facePiecesMap.get(targetFace || face)!

  const co = targetFaceCorners.map(([cornerIndex, cornerPiece]) => {
    const targetFaceOrientation = [...corners[cube.cp[cornerIndex]]].findIndex((f) => f === face)
    if (targetFaceOrientation === -1) {
      return -1
    }

    return (3 + targetFaceOrientation - [...cornerPiece].findIndex((f) => f === (targetFace || face)) + cube.co[cornerIndex]) % 3
  })

  const eo = targetFaceEdges.map(([edgeIndex, edgePiece]) => {
    const targetFaceOrientation = [...edges[cube.ep[edgeIndex]]].findIndex((f) => f === face)
    if (targetFaceOrientation === -1) {
      return -1
    }

    return (2 + targetFaceOrientation - [...edgePiece].findIndex((f) => f === (targetFace || face)) + cube.eo[edgeIndex]) % 2
  })

  return {eo, co}
}

const getFacePermutations = (face: Face, cube: KociembaCubeState, targetFace?: Face): {cp: number[]; ep: number[]} => {
  const {edges: targetFaceEdges, corners: targetFaceCorners} = facePiecesMap.get(targetFace || face)!
  const {edges: faceEdges, corners: faceCorners} = facePiecesMap.get(face)!

  const cp = targetFaceCorners.map(([targetCornerIndex]) => faceCorners.findIndex(([cornerIndex]) => cornerIndex === cube.cp[targetCornerIndex]))

  const ep = targetFaceEdges.map(([targetEdgeIndex]) => faceEdges.findIndex(([edgeIndex]) => edgeIndex === cube.ep[targetEdgeIndex]))

  return {cp, ep}
}

export interface CfopStageResult {
  result: boolean
  solvedPairs?: string[]
  oll?: OllResult
  pll?: PllResult
}

export const isCfopStageSatisfied = ({cube, stage, cross}: {cube: KociembaCubeState; stage: StageId; cross: Face}): CfopStageResult => {
  const oppositeFace = getOppositeFace(cross)
  const crossEdges = crossEdgesMap.get(cross)!
  const isCrossed = crossEdges.every(([edgeIndex]) => cube.eo[edgeIndex] === 0 && cube.ep[edgeIndex] === edgeIndex)

  if (!isCrossed) {
    return {
      result: false,
    }
  }

  const f2lPairs = f2lPairsMap.get(cross)!
  const solvedPairs: string[] = []
  for (const {cornerIndex, edge, edgeIndex} of f2lPairs) {
    if (cube.co[cornerIndex] === 0 && cube.cp[cornerIndex] === cornerIndex && cube.eo[edgeIndex] === 0 && cube.ep[edgeIndex] === edgeIndex) {
      solvedPairs.push(edge)
    }
  }

  if (stage.startsWith('f2l') && stage !== 'f2l4') {
    if ((stage === 'f2l1' && solvedPairs.length >= 1) || (stage === 'f2l2' && solvedPairs.length >= 2) || (stage === 'f2l3' && solvedPairs.length >= 3)) {
      return {
        result: true,
        solvedPairs,
      }
    }

    return {
      result: false,
      solvedPairs,
    }
  }

  if (solvedPairs.length !== 4) {
    return {
      result: false,
      solvedPairs,
    }
  }

  const {co: llCornerOrientations, eo: llEdgeOrientations} = getFaceOrientations(oppositeFace, cube)

  const oll = getOll({eo: llEdgeOrientations, co: llCornerOrientations})

  if (stage === 'f2l4') {
    return {
      result: true,
      oll,
      solvedPairs,
    }
  }

  const isOriented = [...llCornerOrientations, ...llEdgeOrientations].every((orientation) => orientation === 0)

  if (!isOriented) {
    return {
      result: false,
      oll,
      solvedPairs,
    }
  }

  const {cp: llCornerPermutations, ep: llEdgePermutations} = getFacePermutations(oppositeFace, cube)

  const pll = getPll({ep: llEdgePermutations, cp: llCornerPermutations})

  if (stage === 'oll') {
    return {
      result: true,
      oll,
      pll,
      solvedPairs,
    }
  }

  if (stage === 'pll') {
    return {
      result: pll.name === 'PLL Skip',
      oll,
      pll,
      solvedPairs,
    }
  }

  invariant(stage === 'auf')
  return {
    result: cube.isSolved(),
    oll,
    pll,
    solvedPairs,
  }
}

// face, bottom: color of primary face and bottom color of target block
// bottomDirection: expected direction that bottom of block directs
export const isRouxBlockSatisfied = ({cube, face, bottom, bottomDirection}: {cube: KociembaCubeState; face: Face; bottom: Face; bottomDirection: Face}): boolean => {
  if (face === bottomDirection || getOppositeFace(face) === bottomDirection) {
    return false
  }

  const {co, eo} = getFaceOrientations(face, cube)
  const {cp, ep} = getFacePermutations(face, cube)

  const facePieces = facePiecesMap.get(face)!
  const bottomPieceIndex = facePieces.edges.findIndex(([, edge]) => edge.includes(bottom))
  const bottomDirectionIndex = facePieces.edges.findIndex(([, edge]) => edge.includes(bottomDirection))

  return (
    eo[(bottomDirectionIndex + 3) % 4] === 0 &&
    eo[(bottomDirectionIndex + 0) % 4] === 0 &&
    eo[(bottomDirectionIndex + 1) % 4] === 0 &&
    ep[(bottomDirectionIndex + 3) % 4] === (bottomPieceIndex + 3) % 4 &&
    ep[(bottomDirectionIndex + 0) % 4] === (bottomPieceIndex + 0) % 4 &&
    ep[(bottomDirectionIndex + 1) % 4] === (bottomPieceIndex + 1) % 4 &&
    co[(bottomDirectionIndex + 3) % 4] === 0 &&
    co[(bottomDirectionIndex + 0) % 4] === 0 &&
    cp[(bottomDirectionIndex + 3) % 4] === (bottomPieceIndex + 3) % 4 &&
    cp[(bottomDirectionIndex + 0) % 4] === (bottomPieceIndex + 0) % 4
  )
}

export interface RouxStageResult {
  result: boolean
  bottomDirection?: Face
  cll?: CllResult
  lseo?: LseoResult
}

export const isRouxStageSatisfied = ({cube, stage, rouxBlock: {side, bottom}}: {cube: KociembaCubeState; stage: StageId; rouxBlock: {side: Face; bottom: Face}}): RouxStageResult => {
  const antiSide = getOppositeFace(side)
  const top = getOppositeFace(bottom)

  const bottomDirection = faces.find((face) => isRouxBlockSatisfied({cube, face: side, bottom, bottomDirection: face}))

  if (bottomDirection === undefined) {
    return {
      result: false,
    }
  }

  const block2Satisfied = isRouxBlockSatisfied({cube, face: antiSide, bottom, bottomDirection})

  if (!block2Satisfied) {
    return {
      result: false,
      bottomDirection,
    }
  }

  const topDirection = getOppositeFace(bottomDirection)
  const {co, eo: topEoByTop} = getFaceOrientations(top, cube, topDirection)
  const {cp} = getFacePermutations(top, cube, topDirection)

  const cll = getCll({co, cp})

  if (stage === 'block2') {
    return {
      result: true,
      bottomDirection,
      cll,
    }
  }

  if (cll.name !== 'CLL Skip') {
    return {
      result: false,
      bottomDirection,
      cll,
    }
  }

  const {eo: topEoByBottom} = getFaceOrientations(bottom, cube, topDirection)
  const {eo: bottomEoByTop} = getFaceOrientations(top, cube, bottomDirection)
  const {eo: bottomEoByBottom} = getFaceOrientations(bottom, cube, bottomDirection)

  const topEo = topEoByTop.map((orientation, index) => (orientation === -1 ? topEoByBottom[index] : orientation))
  const bottomEo = bottomEoByTop.map((orientation, index) => (orientation === -1 ? bottomEoByBottom[index] : orientation))

  // LSEO case detection is not working well because orientation of center is not considered
  const lseo = getLseo({topEo, bottomEo})

  if (stage === 'cll') {
    return {
      result: true,
      bottomDirection,
      cll,
      lseo,
    }
  }

  const isLseoSatisfied = lseo.name === 'EO Skip' && (bottomDirection === bottom || topDirection === bottom)

  if (stage === 'lseo') {
    return {
      result: isLseoSatisfied,
      bottomDirection,
      cll,
      lseo,
    }
  }

  invariant(stage === 'lsep')

  return {
    result: cube.isSolved(),
    bottomDirection,
    cll,
    lseo,
  }
}

export const isStageSatisfied = ({
  mode,
  cube,
  stage,
  cross,
  rouxBlock,
}: {
  mode: SolveMode
  cube: KociembaCubeState
  stage: StageId
  cross: Face | null
  rouxBlock: {side: Face; bottom: Face} | null
}): CfopStageResult | RouxStageResult => {
  if (mode === 'cfop') {
    invariant(cross !== null)
    return isCfopStageSatisfied({cube, stage, cross})
  }

  invariant(mode === 'roux')
  invariant(rouxBlock !== null)
  return isRouxStageSatisfied({cube, stage, rouxBlock})
}

export interface InspectionTimingStage {
  sequence: {getFirstNonTrivialMove: (options: {cross: Face | null}) => Move | null}
  time: number
}

export const getInspectionTime = ({stage, cross, previousTime}: {stage: InspectionTimingStage; cross: Face | null; previousTime: number}): {inspection: number | null; execution: number | null} => {
  const firstNonTrivialMove = stage.sequence && stage.sequence.getFirstNonTrivialMove({cross})
  const inspection = firstNonTrivialMove === null || firstNonTrivialMove === undefined ? null : (firstNonTrivialMove.time ?? 0) - previousTime
  const execution = inspection === null ? null : stage.time - (firstNonTrivialMove!.time ?? 0)

  return {inspection, execution}
}
