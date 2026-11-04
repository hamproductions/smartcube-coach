import { solvedCube, turn, type CubeModel } from './cubeMath'

export type BldDrill = {
  seed: string
  buffer: string
  letterScheme: string
  scramble: string
  permutation: string[]
  cycles: string[][]
  memo: string
  cornerPermutation: string[]
  cornerCycles: string[][]
  cornerMemo: string
  flippedEdges: number
  twistedCorners: number
  parity: boolean
}

export const defaultLetterScheme = 'ABCDEFGHIJKLMNOPQRSTUVWX'

export function normalizeLetterScheme(input: string) {
  const scheme = input.replaceAll(/\s+/g, '').toUpperCase()
  if (!/^[A-Z]{24}$/.test(scheme) || new Set(scheme).size !== 24) throw new Error('Letter scheme needs 24 unique letters')
  return scheme
}

function hash(seed: string) {
  let value = 2166136261
  for (const character of seed) {
    value ^= character.charCodeAt(0)
    value = Math.imul(value, 16777619)
  }
  return value >>> 0
}

function random(seed: string) {
  let state = hash(seed)
  return () => {
    state = Math.imul(1664525, state) + 1013904223 >>> 0
    return state / 2 ** 32
  }
}

const facesByAxis = [['U', 'D'], ['R', 'L'], ['F', 'B']]
const suffixes = ['', "'", '2']
const moveOffsets: Record<string, number> = { U: 0, R: 3, F: 6, D: 9, L: 12, B: 15 }

function scrambleFromSeed(seed: string) {
  const rng = random(`${seed}:scramble`)
  const moves: string[] = []
  let previousAxis = -1
  for (let index = 0; index < 25; index += 1) {
    const axes = [0, 1, 2].filter((axis) => axis !== previousAxis)
    const axis = axes[Math.floor(rng() * axes.length)]
    moves.push(`${facesByAxis[axis][Math.floor(rng() * 2)]}${suffixes[Math.floor(rng() * suffixes.length)]}`)
    previousAxis = axis
  }
  return moves
}

function cubeFromMoves(moves: string[]) {
  let cube = solvedCube()
  for (const move of moves) cube = turn(cube, move)
  return cube
}

function stickerPermutation(cube: CubeModel) {
  const permutation = new Array<number>(24)
  for (let position = 0; position < 12; position += 1) {
    const encoded = cube.ea[position]
    const piece = encoded >> 1
    const orientation = encoded & 1
    for (let sticker = 0; sticker < 2; sticker += 1) permutation[piece * 2 + sticker] = position * 2 + ((sticker + orientation) % 2)
  }
  return permutation
}

function cornerStickerPermutation(cube: CubeModel) {
  const permutation = new Array<number>(24)
  for (let position = 0; position < 8; position += 1) {
    const encoded = cube.ca[position]
    const piece = encoded & 7
    const orientation = encoded >> 3
    for (let sticker = 0; sticker < 3; sticker += 1) permutation[piece * 3 + sticker] = position * 3 + ((sticker + orientation) % 3)
  }
  return permutation
}

type Trace = { targets: number[]; cycles: number[][]; misoriented: number }

export function traceMemo(permutation: number[], perPiece: number, bufferSticker: number): Trace {
  const at = new Array<number>(permutation.length)
  permutation.forEach((location, home) => { at[location] = home })
  const pieceOf = (sticker: number) => Math.floor(sticker / perPiece)
  const pieces = permutation.length / perPiece
  const bufferPiece = pieceOf(bufferSticker)
  const inPlace = (piece: number) => pieceOf(at[piece * perPiece]) === piece
  const solved = (piece: number) => at[piece * perPiece] === piece * perPiece
  const done = new Set<number>([bufferPiece])
  for (let piece = 0; piece < pieces; piece += 1) if (inPlace(piece)) done.add(piece)
  const misoriented = [...Array(pieces).keys()].filter((piece) => piece !== bufferPiece && inPlace(piece) && !solved(piece)).length
  const targets: number[] = []
  const cycles: number[][] = []
  let cycle = [bufferSticker]
  let anchor = bufferPiece
  let current = bufferSticker
  for (let guard = 0; guard < permutation.length * 2; guard += 1) {
    const target = at[current]
    if (pieceOf(target) !== anchor) {
      targets.push(target)
      cycle.push(target)
      done.add(pieceOf(target))
      current = target
      continue
    }
    if (anchor !== bufferPiece) {
      targets.push(target)
      cycle.push(target)
    }
    if (cycle.length > 1) cycles.push(cycle)
    const next = [...Array(pieces).keys()].find((piece) => !done.has(piece))
    if (next === undefined) break
    const start = next * perPiece
    targets.push(start)
    done.add(next)
    anchor = next
    current = start
    cycle = [start]
  }
  return { targets, cycles, misoriented }
}

function hasOddPermutation(values: number[]) {
  let inversions = 0
  for (let index = 0; index < values.length; index += 1) for (let next = index + 1; next < values.length; next += 1) if (values[index] > values[next]) inversions += 1
  return inversions % 2 === 1
}

function memoFromTargets(letters: string[]) {
  return letters.reduce<string[]>((pairs, letter, index) => {
    if (index % 2 === 0) pairs.push(letter)
    else pairs[pairs.length - 1] += letter
    return pairs
  }, []).join(' ')
}

export function generateBldDrill(seed: string, buffer = 'A', letterScheme = defaultLetterScheme): BldDrill {
  const scheme = normalizeLetterScheme(letterScheme)
  const normalizedBuffer = buffer.trim().toUpperCase()
  if (!scheme.includes(normalizedBuffer)) throw new Error('Buffer must be in the letter scheme')
  const scrambleMoves = scrambleFromSeed(seed)
  const cube = cubeFromMoves(scrambleMoves)
  const permutationIndexes = stickerPermutation(cube)
  const cornerPermutationIndexes = cornerStickerPermutation(cube)
  const bufferIndex = scheme.indexOf(normalizedBuffer)
  const edges = traceMemo(permutationIndexes, 2, bufferIndex)
  const corners = traceMemo(cornerPermutationIndexes, 3, bufferIndex)
  const letters = (indexes: number[]) => indexes.map((index) => scheme[index])
  return {
    seed,
    buffer: normalizedBuffer,
    letterScheme: scheme,
    scramble: scrambleMoves.join(' '),
    permutation: permutationIndexes.map((index) => scheme[index]),
    cycles: edges.cycles.map(letters),
    memo: memoFromTargets(letters(edges.targets)),
    cornerPermutation: cornerPermutationIndexes.map((index) => scheme[index]),
    cornerCycles: corners.cycles.map(letters),
    cornerMemo: memoFromTargets(letters(corners.targets)),
    flippedEdges: edges.misoriented,
    twistedCorners: corners.misoriented,
    parity: hasOddPermutation(cube.ea.map((edge) => edge >> 1))
  }
}

export function validateMemo(drill: BldDrill, input: string) {
  return input.replaceAll(/\s+/g, '').toUpperCase() === drill.memo.replaceAll(/\s+/g, '')
}

export function validateCornerMemo(drill: BldDrill, input: string) {
  return input.replaceAll(/\s+/g, '').toUpperCase() === drill.cornerMemo.replaceAll(/\s+/g, '')
}
