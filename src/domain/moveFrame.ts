// Behaviour reimplemented (not copied) from Dave2ooo/F2LTrainer, which has no LICENSE
// file in its repository (verified 2026-08-03, see docs/research/feature-harvest.md §5).
// Sources read in full before writing this module:
//   - src/lib/utils/moveValidator.ts:9-671 (rotation/wide/slice helpers, move normalization,
//     sequence matching)
//   - src/lib/components/TrainView/TrainClassicSmart.svelte:254-591 (validateMoveProgress,
//     the rotation/wide/slice/double-move/undo state machine)
//   - docs/smart-cube-architecture.md (coordinate-frame explanation)
// This module is gyro-independent: the frame is derived purely from the move stream, never
// from a gyro reading.

export type MoveFrameVerdict = 'matched' | 'pending' | 'mismatch' | 'complete' | 'undo-progress' | 'undo-complete'

export type MoveFrameStep = {
  verdict: MoveFrameVerdict
  algMoves: string[]
  consumedExpected: number
  rotation: string
  undoMoves: string[]
  impliedRotation?: string
}

const ROTATIONS = ['x', "x'", 'x2', 'y', "y'", 'y2', 'z', "z'", 'z2']
const WIDE_TO_SINGLE_LAYER: Record<string, string> = { r: 'L', l: 'R', u: 'D', d: 'U', f: 'B', b: 'F' }
const WIDE_BASE_ROTATION: Record<string, string> = { r: 'x', l: "x'", u: 'y', d: "y'", f: 'z', b: "z'" }
const SLICE_BASE_ROTATION: Record<string, string> = { M: "x'", E: "y'", S: 'z' }

const ROTATION_MAPS: Record<string, Record<string, string>> = {
  x: { U: 'F', F: 'D', D: 'B', B: 'U', R: 'R', L: 'L' },
  "x'": { U: 'B', B: 'D', D: 'F', F: 'U', R: 'R', L: 'L' },
  x2: { U: 'D', D: 'U', F: 'B', B: 'F', R: 'R', L: 'L' },
  y: { U: 'U', D: 'D', F: 'R', R: 'B', B: 'L', L: 'F' },
  "y'": { U: 'U', D: 'D', F: 'L', L: 'B', B: 'R', R: 'F' },
  y2: { U: 'U', D: 'D', F: 'B', B: 'F', R: 'L', L: 'R' },
  z: { U: 'L', L: 'D', D: 'R', R: 'U', F: 'F', B: 'B' },
  "z'": { U: 'R', R: 'D', D: 'L', L: 'U', F: 'F', B: 'B' },
  z2: { U: 'D', D: 'U', L: 'R', R: 'L', F: 'F', B: 'B' }
}

const ROTATION_INVERSE: Record<string, string> = {
  x: "x'", "x'": 'x', x2: 'x2',
  y: "y'", "y'": 'y', y2: 'y2',
  z: "z'", "z'": 'z', z2: 'z2'
}

const SLICE_EXPANSIONS: Record<string, string[][]> = {
  M: [['R', "L'"], ["L'", 'R']],
  "M'": [["R'", 'L'], ['L', "R'"]],
  M2: [['R2', 'L2'], ['L2', 'R2']],
  E: [['U', "D'"], ["D'", 'U']],
  "E'": [["U'", 'D'], ['D', "U'"]],
  E2: [['U2', 'D2'], ['D2', 'U2']],
  S: [["F'", 'B'], ['B', "F'"]],
  "S'": [['F', "B'"], ["B'", 'F']],
  S2: [['F2', 'B2'], ['B2', 'F2']]
}

function getBaseFace(move: string): string {
  return move.replace(/['2]/g, '')
}

function getModifier(move: string, baseFace: string): string {
  return move.replace(baseFace, '')
}

function getTurnCount(move: string): number {
  if (move.includes('2')) return 2
  if (move.includes("'")) return 3
  return 1
}

function turnCountToMove(baseFace: string, count: number): string | null {
  const normalized = count % 4
  if (normalized === 0) return null
  if (normalized === 1) return baseFace
  if (normalized === 2) return baseFace + '2'
  return baseFace + "'"
}

export function isRotationMove(move: string): boolean {
  return ROTATIONS.includes(move)
}

export function isWideMove(move: string): boolean {
  return getBaseFace(move) in WIDE_TO_SINGLE_LAYER
}

export function isSliceMove(move: string): boolean {
  return ['M', 'E', 'S'].includes(getBaseFace(move))
}

export function wideToSingleLayerMove(move: string): string | null {
  const baseFace = getBaseFace(move)
  const singleLayerFace = WIDE_TO_SINGLE_LAYER[baseFace]
  if (!singleLayerFace) return null
  return singleLayerFace + getModifier(move, baseFace)
}

export function getWideImplicitRotation(move: string): string {
  const baseFace = getBaseFace(move)
  const baseRotation = WIDE_BASE_ROTATION[baseFace]
  if (!baseRotation) return ''
  const modifier = getModifier(move, baseFace)
  if (modifier === '2') return getBaseFace(baseRotation) + '2'
  if (modifier === "'") return inverseSingleRotation(baseRotation)
  return baseRotation
}

export function getSliceImplicitRotation(move: string): string {
  const baseFace = getBaseFace(move)
  const baseRotation = SLICE_BASE_ROTATION[baseFace]
  if (!baseRotation) return ''
  const modifier = getModifier(move, baseFace)
  if (modifier === '2') return getBaseFace(baseRotation) + '2'
  if (modifier === "'") return inverseSingleRotation(baseRotation)
  return baseRotation
}

export function expandSliceMove(move: string): string[][] {
  return SLICE_EXPANSIONS[move] ?? [[move]]
}

export function getSliceFirstMoves(move: string): string[] {
  const expansions = expandSliceMove(move)
  if (expansions.length === 1 && expansions[0].length === 1 && expansions[0][0] === move) return []
  const firstMoves = new Set<string>()
  for (const ordering of expansions) if (ordering.length > 0) firstMoves.add(ordering[0])
  return Array.from(firstMoves)
}

export function inverseMove(move: string): string {
  if (move.includes('2')) return move
  if (move.includes("'")) return move.replace("'", '')
  return move + "'"
}

function inverseSingleRotation(rotation: string): string {
  return ROTATION_INVERSE[rotation] ?? rotation
}

function applySingleRotationToMove(move: string, rotation: string): string {
  if (!rotation) return move
  const baseFace = getBaseFace(move)
  const modifier = getModifier(move, baseFace)
  const map = ROTATION_MAPS[rotation]
  if (!map) return move
  const newFace = map[baseFace]
  if (!newFace) return move
  return newFace + modifier
}

export function applyRotationToMove(move: string, rotation: string): string {
  if (!rotation) return move
  const rotations = rotation.split(' ').filter((r) => r.trim() !== '')
  return rotations.reduce((result, rot) => applySingleRotationToMove(result, rot), move)
}

export function inverseRotation(rotation: string): string {
  if (!rotation) return ''
  const rotations = rotation.split(' ').filter((r) => r.trim() !== '')
  if (rotations.length === 0) return ''
  return rotations.reverse().map((r) => inverseSingleRotation(r)).join(' ')
}

const AXIS_OF: Record<string, string> = { x: 'x', "x'": 'x', x2: 'x', y: 'y', "y'": 'y', y2: 'y', z: 'z', "z'": 'z', z2: 'z' }
const TURNS_OF: Record<string, number> = { x: 1, "x'": 3, x2: 2, y: 1, "y'": 3, y2: 2, z: 1, "z'": 3, z2: 2 }

function simplifyRotationSequence(rotations: string[]): string[] {
  const result: string[] = []
  for (const rot of rotations) {
    const last = result[result.length - 1]
    const lastAxis = last ? AXIS_OF[last] : undefined
    const currentAxis = AXIS_OF[rot]
    if (last && lastAxis && currentAxis && lastAxis === currentAxis) {
      const totalTurns = ((TURNS_OF[last] ?? 0) + (TURNS_OF[rot] ?? 0)) % 4
      result.pop()
      const combined = turnCountToMove(currentAxis, totalTurns)
      if (combined) result.push(combined)
    } else {
      result.push(rot)
    }
  }
  return result
}

function findSingleRotationEquivalent(compoundRotation: string): string | null {
  const testFaces = ['U', 'D', 'F', 'B', 'R', 'L']
  const candidates = ['x', "x'", 'x2', 'y', "y'", 'y2', 'z', "z'", 'z2', '']
  const combined: Record<string, string> = {}
  for (const face of testFaces) combined[face] = applyRotationToMove(face, compoundRotation)
  for (const rot of candidates) {
    let matches = true
    for (const face of testFaces) {
      if (applySingleRotationToMove(face, rot) !== combined[face]) {
        matches = false
        break
      }
    }
    if (matches) return rot
  }
  return null
}

export function combineRotations(rotations: string[]): string {
  const flat: string[] = []
  for (const rot of rotations) {
    if (!rot.trim()) continue
    if (rot.includes(' ')) flat.push(...rot.split(' ').filter((r) => r.trim() !== ''))
    else flat.push(rot)
  }
  if (flat.length === 0) return ''
  if (flat.length === 1) return flat[0]

  const simplified = simplifyRotationSequence(flat)
  if (simplified.length === 0) return ''

  const single = findSingleRotationEquivalent(simplified.join(' '))
  if (single !== null) return single
  return simplified.join(' ')
}

export function coalesceMoves(moves: string[]): string[] {
  const result: string[] = []
  let i = 0
  while (i < moves.length) {
    const baseFace = getBaseFace(moves[i])
    let totalTurns = getTurnCount(moves[i])
    let j = i + 1
    while (j < moves.length && getBaseFace(moves[j]) === baseFace) {
      totalTurns += getTurnCount(moves[j])
      j += 1
    }
    const coalesced = turnCountToMove(baseFace, totalTurns)
    if (coalesced) result.push(coalesced)
    i = j
  }
  return result
}

export function cancelMoves(moves: string[]): string[] {
  const result: string[] = []
  for (const move of moves) {
    const last = result[result.length - 1]
    const baseFace = getBaseFace(move)
    const lastBaseFace = last ? getBaseFace(last) : undefined
    if (last && baseFace === lastBaseFace) {
      const totalTurns = (getTurnCount(last) + getTurnCount(move)) % 4
      result.pop()
      const merged = turnCountToMove(baseFace, totalTurns)
      if (merged) result.push(merged)
    } else {
      result.push(move)
    }
  }
  return result
}

export function normalizeMoves(moves: string[]): string[] {
  const expanded: string[] = []
  for (const move of moves) {
    if (isSliceMove(move)) expanded.push(...expandSliceMove(move)[0])
    else expanded.push(move)
  }
  return cancelMoves(coalesceMoves(expanded))
}

function areSequencesEquivalent(seq1: string[], seq2: string[]): boolean {
  if (seq1.length !== seq2.length) return false
  const norm1 = normalizeMoves(seq1)
  const norm2 = normalizeMoves(seq2)
  if (norm1.length !== norm2.length) return false
  return norm1.every((move, index) => move === norm2[index])
}

function generateAllSliceExpansions(moves: string[]): string[][] {
  let expansions: string[][] = [[]]
  for (const move of moves) {
    if (isSliceMove(move)) {
      const sliceExpansions = expandSliceMove(move)
      const next: string[][] = []
      for (const existing of expansions) for (const ordering of sliceExpansions) next.push([...existing, ...ordering])
      expansions = next
    } else {
      expansions = expansions.map((exp) => [...exp, move])
    }
  }
  return expansions
}

export function matchesMoveSequence(performed: string[], expected: string[]): { match: boolean; consumedCount: number } {
  if (performed.length === 0 || expected.length === 0) return { match: false, consumedCount: 0 }

  const normalizedPerformed = normalizeMoves(performed)
  if (normalizedPerformed.length === 0) return { match: false, consumedCount: 0 }

  for (let consumeCount = expected.length; consumeCount >= 1; consumeCount -= 1) {
    const expectedPrefix = expected.slice(0, consumeCount)
    const allExpansions = generateAllSliceExpansions(expectedPrefix)
    for (const expandedExpected of allExpansions) {
      if (areSequencesEquivalent(normalizedPerformed, expandedExpected)) return { match: true, consumedCount: consumeCount }
    }
  }

  return { match: false, consumedCount: 0 }
}

export function decomposeAlgorithmMove(move: string): { rotation: string; faceMoves: string[] } {
  if (isRotationMove(move)) return { rotation: move, faceMoves: [] }
  if (isWideMove(move)) {
    const singleLayer = wideToSingleLayerMove(move)
    return { rotation: getWideImplicitRotation(move), faceMoves: singleLayer ? [singleLayer] : [] }
  }
  if (isSliceMove(move)) return { rotation: getSliceImplicitRotation(move), faceMoves: expandSliceMove(move)[0] }
  return { rotation: '', faceMoves: [move] }
}

const LOOKAHEAD_WINDOW = 5

export class MoveFrameSession {
  private currentIndex = 0
  private buffer: string[] = []
  private rotation = ''
  private undo: string[] = []

  constructor(private readonly expectedMoves: string[]) {}

  get frameRotation(): string {
    return this.rotation
  }

  get expectedIndex(): number {
    return this.currentIndex
  }

  get pendingUndoMoves(): readonly string[] {
    return this.undo
  }

  handleRawMove(rawMoveInput: string): MoveFrameStep {
    const rawMove = rawMoveInput.trim()
    if (!rawMove) return this.snapshot('pending', [], 0)

    if (this.undo.length > 0) return this.handleUndoMove(rawMove)

    this.skipAutoRotations()

    if (this.currentIndex >= this.expectedMoves.length) {
      const algMove = applyRotationToMove(rawMove, inverseRotation(this.rotation))
      return this.snapshot('complete', [algMove], 0)
    }

    this.buffer.push(rawMove)

    const wideStep = this.tryMatchWideMove()
    if (wideStep) return wideStep

    return this.tryMatchRegularMoves()
  }

  private skipAutoRotations(): void {
    const applied: string[] = []
    while (this.currentIndex < this.expectedMoves.length && isRotationMove(this.expectedMoves[this.currentIndex])) {
      applied.push(this.expectedMoves[this.currentIndex])
      this.currentIndex += 1
    }
    if (applied.length > 0) {
      const allRotations = this.rotation ? [this.rotation, ...applied] : applied
      this.rotation = combineRotations(allRotations)
    }
  }

  private tryMatchWideMove(): MoveFrameStep | null {
    const expected = this.expectedMoves[this.currentIndex]
    if (!expected || !isWideMove(expected)) return null
    const singleLayerMove = wideToSingleLayerMove(expected)
    if (!singleLayerMove) return null

    const inverseRot = inverseRotation(this.rotation)
    const transformedBuffer = this.buffer.map((move) => applyRotationToMove(move, inverseRot))
    const normalized = normalizeMoves(transformedBuffer)
    const { match, consumedCount } = matchesMoveSequence(normalized, [singleLayerMove])
    if (!match || consumedCount === 0) return null

    // Wide moves are physically reoriented in the user's hands, so the implicit rotation is
    // prepended (undone first when transforming a later absolute move into the algorithm frame).
    const implicitRotation = getWideImplicitRotation(expected)
    this.rotation = combineRotations([implicitRotation, this.rotation].filter((rotation) => rotation !== ''))
    this.currentIndex += 1
    this.buffer = []
    return this.snapshot('matched', [singleLayerMove], 1, implicitRotation || undefined)
  }

  private tryMatchRegularMoves(): MoveFrameStep {
    const expectedWindow = this.expectedMoves.slice(this.currentIndex, this.currentIndex + LOOKAHEAD_WINDOW)
    const inverseRot = inverseRotation(this.rotation)
    const transformedBuffer = this.buffer.map((move) => applyRotationToMove(move, inverseRot))
    const normalized = normalizeMoves(transformedBuffer)

    const { match, consumedCount } = matchesMoveSequence(normalized, expectedWindow)

    if (match && consumedCount > 0) {
      const matchedMoves = this.expectedMoves.slice(this.currentIndex, this.currentIndex + consumedCount)
      let impliedRotation: string | undefined
      for (const matchedMove of matchedMoves) {
        if (!isSliceMove(matchedMove)) continue
        const implicitRot = getSliceImplicitRotation(matchedMove)
        if (!implicitRot) continue
        // Slice moves change the user's physical grip in the absolute frame, so the implicit
        // rotation is prepended, same reasoning as wide moves.
        impliedRotation = implicitRot
        this.rotation = combineRotations([implicitRot, this.rotation].filter((rotation) => rotation !== ''))
      }

      this.currentIndex += consumedCount
      this.buffer = []
      return this.snapshot('matched', normalized, consumedCount, impliedRotation)
    }

    if (normalized.length >= 1) {
      const expectedMove = expectedWindow[0]
      const expectedBaseFace = expectedMove ? getBaseFace(expectedMove) : ''
      const isExpectedDoubleMove = !!expectedMove && expectedMove.includes('2')

      const couldBeDoubleMove =
        isExpectedDoubleMove &&
        this.buffer.length === 1 &&
        normalized.length === 1 &&
        getBaseFace(normalized[0]) === expectedBaseFace

      const couldBeSliceMove =
        !!expectedMove &&
        isSliceMove(expectedMove) &&
        this.buffer.length === 1 &&
        normalized.length === 1 &&
        getSliceFirstMoves(expectedMove).includes(normalized[0])

      if (couldBeDoubleMove || couldBeSliceMove) return this.snapshot('pending', [], 0)

      this.raiseUndo()
      return this.snapshot('mismatch', [], 0)
    }

    return this.snapshot('pending', [], 0)
  }

  private raiseUndo(): void {
    const inverseRot = inverseRotation(this.rotation)
    for (let i = this.buffer.length - 1; i >= 0; i -= 1) {
      const inverseRaw = inverseMove(this.buffer[i])
      this.undo.push(applyRotationToMove(inverseRaw, inverseRot))
    }
    this.buffer = []
  }

  private handleUndoMove(rawMove: string): MoveFrameStep {
    const inverseRot = inverseRotation(this.rotation)
    const incomingAlg = applyRotationToMove(rawMove, inverseRot)
    const expectedUndo = this.undo[0]

    if (incomingAlg === expectedUndo) {
      this.undo.shift()
      return this.snapshot(this.undo.length === 0 ? 'undo-complete' : 'undo-progress', [incomingAlg], 0)
    }

    const inverseRaw = inverseMove(rawMove)
    this.undo.unshift(applyRotationToMove(inverseRaw, inverseRot))
    return this.snapshot('mismatch', [], 0)
  }

  private snapshot(verdict: MoveFrameVerdict, algMoves: string[], consumedExpected: number, impliedRotation?: string): MoveFrameStep {
    return {
      verdict,
      algMoves,
      consumedExpected,
      rotation: this.rotation,
      undoMoves: [...this.undo],
      impliedRotation
    }
  }
}
