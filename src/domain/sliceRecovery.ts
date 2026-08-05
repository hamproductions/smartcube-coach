export type Face = 'U' | 'D' | 'L' | 'R' | 'F' | 'B'
export type SliceLetter = 'M' | 'E' | 'S'
export type NotationFace = Face | SliceLetter

export type RecoveredMove = {
  notation: string
  rawIndices: number[]
}

export type SliceRecoveryResult = {
  moves: RecoveredMove[]
  sliceCount: number
  rotationCount: number
}

type Axis = 'x' | 'y' | 'z'
type Vec3 = readonly [number, number, number]

type Emitted = {
  notation: string
  face?: NotationFace
  amount?: number
  rawIndices: number[]
}

const FACE_VECTOR: Record<Face, Vec3> = {
  U: [0, 0, 1],
  D: [0, 0, -1],
  R: [1, 0, 0],
  L: [-1, 0, 0],
  F: [0, -1, 0],
  B: [0, 1, 0]
}

const FACE_BY_VECTOR = new Map<string, Face>((Object.keys(FACE_VECTOR) as Face[]).map((face) => [FACE_VECTOR[face].join(','), face]))

const OPPOSITE: Record<Face, Face> = { U: 'D', D: 'U', L: 'R', R: 'L', F: 'B', B: 'F' }
const AXIS_OF_FACE: Record<Face, Axis> = { R: 'x', L: 'x', U: 'y', D: 'y', F: 'z', B: 'z' }
const CANONICAL_SIGN: Record<Face, 1 | -1> = { R: 1, L: -1, U: 1, D: -1, F: 1, B: -1 }
const SLICE_LETTER_OF_FACE: Record<Face, SliceLetter> = { R: 'M', L: 'M', U: 'E', D: 'E', F: 'S', B: 'S' }
const SLICE_ANCHOR: Record<SliceLetter, Face> = { M: 'L', E: 'D', S: 'F' }

const rotateVector = (vec: Vec3, axis: Axis, amount: 1 | -1): Vec3 => {
  const [a, b, c] = vec
  if (axis === 'x') return amount === 1 ? [a, -c, b] : [a, c, -b]
  if (axis === 'y') return amount === 1 ? [-b, a, c] : [b, -a, c]
  return amount === 1 ? [-c, b, a] : [c, b, -a]
}

class OrientationFrame {
  private vectors: Record<Face, Vec3> = { ...FACE_VECTOR }

  toLogical(deviceFace: Face): Face {
    const vector = this.vectors[deviceFace]
    const face = FACE_BY_VECTOR.get(vector.join(','))
    if (!face) throw new Error(`unresolvable orientation for ${deviceFace}`)
    return face
  }

  rotate(axis: Axis, amount: number) {
    const sign: 1 | -1 = amount < 0 ? -1 : 1
    for (let step = 0; step < Math.abs(amount); step += 1) {
      for (const face of Object.keys(this.vectors) as Face[]) {
        this.vectors[face] = rotateVector(this.vectors[face], axis, sign)
      }
    }
  }
}

const parseMove = (move: string): { face: Face; amount: number } | undefined => {
  const match = /^([UDLRFB])(2)?('?)$/.exec(move)
  if (!match) return undefined
  const magnitude = match[2] ? 2 : 1
  return { face: match[1] as Face, amount: match[3] ? -magnitude : magnitude }
}

const renderTurn = (face: NotationFace, amount: number): string => {
  const magnitude = Math.abs(amount)
  return `${face}${magnitude === 2 ? '2' : ''}${amount < 0 ? "'" : ''}`
}

const isFace = (face: NotationFace | undefined): face is Face => face !== undefined && face in FACE_VECTOR

type Collapse = {
  sliceLetter: SliceLetter
  sliceAmount: number
  remainingLast: number
  remainingIncoming: number
  rotationAxis: Axis
  rotationAmount: number
}

const collapse = (last: { face: Face; amount: number }, incoming: { face: Face; amount: number }): Collapse => {
  const sliceLetter = SLICE_LETTER_OF_FACE[last.face]
  const anchorFace = SLICE_ANCHOR[sliceLetter]
  const anchorAmount = last.face === anchorFace ? last.amount : incoming.amount
  const direction = -Math.sign(anchorAmount)
  const magnitude = Math.min(Math.abs(last.amount), Math.abs(incoming.amount))
  const sliceAmount = magnitude * direction

  const carrySign = Math.sign(last.amount) === direction ? -1 : 1
  const remainingLast = last.amount + sliceAmount * carrySign
  const remainingIncoming = incoming.amount - sliceAmount * carrySign

  const virtualAmount = Math.sign(incoming.amount) * magnitude
  const rotationAxis = AXIS_OF_FACE[incoming.face]
  const rotationAmount = virtualAmount * CANONICAL_SIGN[incoming.face]

  return { sliceLetter, sliceAmount, remainingLast, remainingIncoming, rotationAxis, rotationAmount }
}

/**
 * Collapses a raw smart-cube move stream into slice notation (M/E/S), folding
 * the whole-cube rotation implied by each collapse into a running, gyro-free
 * orientation so every later move is relabeled into that same solving frame.
 */
export function recoverSlices(moves: string[]): SliceRecoveryResult {
  const frame = new OrientationFrame()
  const emitted: Emitted[] = []
  let sliceCount = 0
  let rotationCount = 0

  for (const [index, raw] of moves.entries()) {
    const parsed = parseMove(raw)
    if (!parsed) {
      emitted.push({ notation: raw, rawIndices: [index] })
      continue
    }

    const logicalFace = frame.toLogical(parsed.face)
    const incoming = { face: logicalFace, amount: parsed.amount }
    const lastEntry = emitted.at(-1)

    if (
      lastEntry &&
      isFace(lastEntry.face) &&
      lastEntry.amount !== undefined &&
      OPPOSITE[lastEntry.face] === incoming.face &&
      Math.sign(lastEntry.amount) * Math.sign(incoming.amount) === -1
    ) {
      const result = collapse({ face: lastEntry.face, amount: lastEntry.amount }, incoming)
      const priorRawIndices = lastEntry.rawIndices
      emitted.pop()

      if (result.remainingLast !== 0) {
        emitted.push({
          notation: renderTurn(lastEntry.face, result.remainingLast),
          face: lastEntry.face,
          amount: result.remainingLast,
          rawIndices: priorRawIndices
        })
      }

      emitted.push({
        notation: renderTurn(result.sliceLetter, result.sliceAmount),
        face: result.sliceLetter,
        amount: result.sliceAmount,
        rawIndices: [...priorRawIndices, index]
      })
      sliceCount += 1

      if (result.remainingIncoming !== 0) {
        emitted.push({
          notation: renderTurn(incoming.face, result.remainingIncoming),
          face: incoming.face,
          amount: result.remainingIncoming,
          rawIndices: [index]
        })
      }

      if (result.rotationAmount !== 0) {
        frame.rotate(result.rotationAxis, result.rotationAmount)
        rotationCount += 1
      }

      continue
    }

    emitted.push({ notation: renderTurn(incoming.face, incoming.amount), face: incoming.face, amount: incoming.amount, rawIndices: [index] })
  }

  return {
    moves: emitted.map(({ notation, rawIndices }) => ({ notation, rawIndices })),
    sliceCount,
    rotationCount
  }
}

export function recoveredNotation(moves: string[]): string {
  return recoverSlices(moves).moves.map((move) => move.notation).join(' ')
}
