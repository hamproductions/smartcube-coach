/**
 * Ported from hakatashi/smart-cube-timer (https://github.com/hakatashi/smart-cube-timer)
 * Source file: lib/MoveSequence.js
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
 * - `assert` (Node) is replaced with a local `invariant` helper so this stays
 *   safe to bundle for the browser.
 * - lodash's `flatten`/`last`/`sumBy`/`tail` are replaced with small local
 *   equivalents restricted to the shapes used here.
 * - All geometry (getOrientation, getOrientationFromRotation, getRelativeFace,
 *   getRelativeFaceFromFaces, moveToRotation) is imported from
 *   ./smartCubeTimerUtils, which reimplements the source's `sylvester`-backed
 *   math without that dependency (see header of that file).
 * - Real TypeScript types replace the source's untyped move/orientation
 *   object literals; the branch structure, evaluation order, and the slice
 *   recovery / accumulation-mode algorithms are otherwise unchanged.
 */

import {
  type Face,
  type Move,
  type SliceFace,
  faces,
  getNotation,
  getOppositeFace,
  getOrientation,
  getOrientationFromRotation,
  getRelativeFace,
  getRelativeFaceFromFaces,
  mod,
  moveToRotation,
  sliceFaces,
} from './smartCubeTimerUtils'

export type {Move} from './smartCubeTimerUtils'

export type MoveSequenceMode = 'addition' | 'reduction' | 'raw'

export interface RouxBlockOrientation {
  side: Face
  bottomDirection: Face
}

export interface ToTextOptions {
  cross?: Face | null
  rouxBlock?: RouxBlockOrientation | null
  fixDirection?: boolean
  slices?: Array<'M' | 'E' | 'S'>
}

export interface CubeOrientation {
  left: Face
  down: Face
}

// `toText`'s output accumulator may contain slice moves (M/E/S) recovered
// from adjacent opposite-face opposite-sign turns, in addition to the plain
// face moves stored in `this.moves`.
interface OutputMove {
  face: Face | SliceFace
  amount: number
  width?: 1 | 2
  time?: number
}

function invariant(condition: unknown, message = 'invariant failed'): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function last<T>(items: readonly T[]): T | undefined {
  return items[items.length - 1]
}

function tail<T>(items: readonly T[]): T[] {
  return items.slice(1)
}

function flatten<T>(items: readonly T[][]): T[] {
  return items.reduce<T[]>((acc, chunk) => acc.concat(chunk), [])
}

function sumBy<T>(items: readonly T[], fn: (item: T) => number): number {
  return items.reduce((total, item) => total + fn(item), 0)
}

const moveStrings = new Map<string, {face: Face; amount: number}>([
  ...faces.map((face): [string, {face: Face; amount: number}] => [face, {face, amount: 1}]),
  ...faces.map((face): [string, {face: Face; amount: number}] => [`${face}'`, {face, amount: -1}]),
  ...faces.map((face): [string, {face: Face; amount: number}] => [`${face}2`, {face, amount: 2}]),
  ...faces.map((face): [string, {face: Face; amount: number}] => [`${face}2'`, {face, amount: -2}]),
])

const normalizeMove = (
  {face, amount, width}: Move,
  {down, left}: {down: Face | null; left: Face | null},
): Move => {
  invariant((faces as readonly string[]).includes(face))

  if (down === null) {
    return {amount, face, width}
  }

  if (left === null) {
    const normalizedFace = getRelativeFace(face, {from: down, to: 'D'})
    return {amount, face: normalizedFace, width}
  }

  const normalizedFace = getRelativeFaceFromFaces(face, {from: [down, left], to: ['D', 'L']})
  return {amount, face: normalizedFace, width}
}

const normalizeAmount = (amount: number): number => mod(amount + 1, 4) - 1

const joinMoves = <T extends {face: Face | SliceFace; amount: number}>(lastMove: T, newMove: T): T[] => {
  if (lastMove.face !== newMove.face) {
    return [lastMove, newMove]
  }

  if (Math.sign(lastMove.amount) !== Math.sign(newMove.amount)) {
    return [lastMove, newMove]
  }

  const newAmount = lastMove.amount + newMove.amount
  if (Math.abs(newAmount) <= 2) {
    return [
      {
        ...lastMove,
        amount: newAmount,
      },
    ]
  }

  return [
    {
      ...lastMove,
      amount: Math.sign(newAmount) * 2,
    },
    {
      ...newMove,
      amount: newAmount - Math.sign(newAmount) * 2,
    },
  ]
}

export default class MoveSequence {
  moves: Move[]
  mode: MoveSequenceMode

  constructor(moves: Move[] = [], {mode = 'addition'}: {mode?: MoveSequenceMode} = {}) {
    this.moves = moves
    this.mode = mode
  }

  toText({cross = null, rouxBlock = null, fixDirection = false, slices = []}: ToTextOptions = {}): {text: string; orientation: CubeOrientation} {
    const moves: OutputMove[] = []

    if (rouxBlock === null) {
      const cubeOrientation: CubeOrientation =
        cross === null
          ? {
              left: 'L',
              down: 'D',
            }
          : getOrientation({from: cross, to: 'D'})

      for (const move of this.moves) {
        const newMove = normalizeMove(move, {
          down: cubeOrientation.down,
          left: cubeOrientation.left,
        })
        const lastMove = moves.length !== 0 && last(moves)

        // slice move detection
        if (lastMove && getOppositeFace(newMove.face) === lastMove.face && Math.sign(newMove.amount) * Math.sign(lastMove.amount) === -1) {
          const slice = slices.find((s) => newMove.face === sliceFaces[s] || lastMove.face === sliceFaces[s])

          if (slice !== undefined) {
            const direction = -Math.sign([newMove, lastMove].find(({face}) => face === sliceFaces[slice])!.amount)
            const amount = Math.min(Math.abs(newMove.amount), Math.abs(lastMove.amount)) * direction
            const rotation = moveToRotation({
              face: newMove.face,
              amount: -Math.sign(newMove.amount) * Math.abs(amount),
            })
            const newOrientation = getOrientationFromRotation(cubeOrientation, rotation)

            const newMoves = [
              {
                ...lastMove,
                amount: lastMove.amount + amount * (Math.sign(lastMove.amount) === direction ? -1 : 1),
              },
              {
                face: slice,
                amount,
                ...(lastMove.time === undefined ? {} : {time: lastMove.time}),
              },
              {
                ...newMove,
                amount: newMove.amount - amount * (Math.sign(lastMove.amount) === direction ? -1 : 1),
              },
            ].filter((m) => m.amount !== 0)

            moves.pop()

            if (this.mode === 'addition' && moves.length > 0) {
              invariant(newMoves.length > 0)
              const newJoinedMoves = joinMoves(last(moves)!, newMoves[0])
              moves.pop()
              moves.push(...newJoinedMoves, ...tail(newMoves))
            } else {
              moves.push(...newMoves)
            }

            cubeOrientation.left = newOrientation.left
            cubeOrientation.down = newOrientation.down

            continue
          }
        }

        moves.push(newMove)
      }

      return {
        text: moves.map((move) => getNotation(move)).join(' '),
        orientation: cubeOrientation,
      }
    }

    const cubeOrientation: CubeOrientation = {
      left: rouxBlock.side,
      down: rouxBlock.bottomDirection,
    }

    for (const move of this.moves) {
      if (fixDirection && move.face === cubeOrientation.left) {
        moves.push(
          normalizeMove(
            {
              face: getOppositeFace(move.face),
              amount: move.amount,
              width: 2,
            },
            {
              down: cubeOrientation.down,
              left: cubeOrientation.left,
            },
          ),
        )
        const newDownFace = (['D', 'B', 'U', 'F'] as const)[(move.amount + 4) % 4]
        cubeOrientation.down = getRelativeFaceFromFaces(newDownFace, {
          from: ['L', 'D'],
          to: [cubeOrientation.left, cubeOrientation.down],
        })
      } else {
        moves.push(
          normalizeMove(move, {
            down: cubeOrientation.down,
            left: cubeOrientation.left,
          }),
        )
      }
    }

    return {
      text: moves.map((move) => getNotation(move)).join(' '),
      orientation: cubeOrientation,
    }
  }

  toString(options?: ToTextOptions): string {
    return this.toText(options).text
  }

  toObject({cross}: {cross?: Face | null} = {}): Move[] {
    return this.moves.map((move) => {
      const normalizedFace = cross ? getRelativeFace(move.face, {from: cross, to: 'D'}) : move.face
      return {
        ...move,
        face: normalizedFace,
      }
    })
  }

  // Get first move which is not U-turn or canceled by the following move
  // TODO: Cancel U D U' D'
  getFirstNonTrivialMove({cross = null}: {cross?: Face | null} = {}): Move | null {
    let moves = this.toObject({cross})
    let hasCanceledMoves = true

    while (hasCanceledMoves) {
      hasCanceledMoves = false

      // Make chunks by sequencial face moves
      const chunks: Move[][] = []
      for (const move of moves) {
        if (chunks.length === 0) {
          chunks.push([move])
        } else if (last(chunks)![0].face === move.face) {
          last(chunks)!.push(move)
        } else {
          chunks.push([move])
        }
      }

      const nextChunks: Move[][] = chunks.slice()
      for (const [index, chunk] of chunks.entries()) {
        invariant(chunk.length !== 0)

        if (chunk.length === 1) {
          continue
        }

        hasCanceledMoves = true
        const amount = mod(sumBy(chunk, (move) => move.amount), 4)
        if (amount === 0) {
          nextChunks[index] = []
        } else {
          nextChunks[index] = [{...last(chunk)!, amount}]
        }
      }

      moves = flatten(nextChunks)
    }

    if (cross === null) {
      return moves[0] || null
    }

    const topFace = getOppositeFace(cross)
    if (moves.length === 0 || moves[0].face === topFace) {
      return moves[1] || null
    }
    return moves[0] || null
  }

  push(move: Move): void {
    invariant((faces as readonly string[]).includes(move.face))

    const newMove: Move = {
      face: move.face,
      amount: normalizeAmount(move.amount),
      ...(move.time === undefined ? {} : {time: move.time}),
    }

    if (this.length === 0 || this.mode === 'raw') {
      this.moves.push(newMove)
      return
    }

    const lastMove = last(this.moves)!

    if (lastMove.face !== newMove.face) {
      this.moves.push(newMove)
      return
    }

    if (this.mode === 'reduction') {
      const newAmount = normalizeAmount(lastMove.amount + newMove.amount)
      if (newAmount === 0) {
        this.moves.pop()
        return
      }

      lastMove.amount = newAmount
      return
    }

    if (this.mode === 'addition') {
      this.moves.pop()
      this.moves.push(...joinMoves(lastMove, newMove))
    }
  }

  unshift(move: Move): void {
    invariant((faces as readonly string[]).includes(move.face))

    const newMove: Move = {
      face: move.face,
      amount: normalizeAmount(move.amount),
      ...(move.time === undefined ? {} : {time: move.time}),
    }

    if (this.length === 0 || this.mode === 'raw') {
      this.moves.unshift(newMove)
      return
    }

    const firstMove = this.moves[0]

    if (firstMove.face !== newMove.face) {
      this.moves.unshift(newMove)
      return
    }

    if (this.mode === 'reduction') {
      const newAmount = normalizeAmount(firstMove.amount + newMove.amount)
      if (newAmount === 0) {
        this.moves.shift()
        return
      }

      firstMove.amount = newAmount
      return
    }

    if (this.mode === 'addition') {
      this.moves.shift()
      this.moves.unshift(...joinMoves(firstMove, newMove).reverse())
    }
  }

  // Moves count in terms of HTM turns
  get length(): number {
    return this.moves.length
  }

  static fromScramble(scramble: string, options?: {mode?: MoveSequenceMode}): MoveSequence {
    const moves = scramble.split(' ').map((moveString) => {
      invariant(moveStrings.has(moveString), `unknown move notation: ${moveString}`)
      return {...moveStrings.get(moveString)!}
    })
    return new MoveSequence(moves, options)
  }
}
