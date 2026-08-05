// Ported from poliva/cubedex (MIT License), commit e5849e2.
// Source: https://github.com/poliva/cubedex/blob/main/src/hooks/useTrainingState.ts
//   - precomputed pattern states + hash index: lines 1380-1396
//   - fast-path / hash-fallback matching and bad-move rollback heuristics
//     (handleSmartcubeMove): lines 1789-1913
//   - trailingWholeCubeRotationMoveCount: https://github.com/poliva/cubedex/blob/main/src/lib/move-helpers.ts lines 1-15
//   - getInverseMove: same file, lines 17-58
// Copyright (c) 2024 Pau Oliva Fora
//
// cubedex's authoritative signal for "did the physical cube match the target sequence" is
// never a literal move-by-move diff. It precomputes the cube *state* (facelets) after every
// prefix of the target sequence once, then after each physical move just asks "does the
// resulting state match any known checkpoint" via an O(1) hash lookup (falling back from a
// cheap direct next-index check). That is what makes it tolerant of hand-scrambling noise,
// a double turn split into two quarter turns, and a wrong-direction turn immediately undone:
// none of those change the resulting *state* once the matching checkpoint is reached, so they
// never register as "diverged" the way a naive move-string comparison would.
//
// This port adapts the state representation from cubedex's `KPattern`/hash to this project's
// existing `CubeModel`/facelets engine (`../domain/cubeMath`), since that is already the
// canonical 3x3x3 state representation used elsewhere in this codebase. The matching and
// bad-move heuristics themselves are unchanged from the source.

import { faceletsOf, solvedCube, turn, type CubeModel } from './cubeMath'

export function trailingWholeCubeRotationMoveCount(moves: string[]): number {
  let count = 0
  for (let index = moves.length - 1; index >= 0; index -= 1) {
    const raw = moves[index].replace(/[()]/g, '').trim()
    if (!raw) continue
    if (/^[xyz](?:2'|2|')?$/i.test(raw)) {
      count += 1
    } else {
      break
    }
  }
  return count
}

const INVERSE_MOVES: Record<string, string> = {
  U: "U'", "U'": 'U', D: "D'", "D'": 'D', L: "L'", "L'": 'L',
  R: "R'", "R'": 'R', F: "F'", "F'": 'F', B: "B'", "B'": 'B',
  u: "u'", "u'": 'u', d: "d'", "d'": 'd', l: "l'", "l'": 'l',
  r: "r'", "r'": 'r', f: "f'", "f'": 'f', b: "b'", "b'": 'b',
  M: "M'", "M'": 'M', E: "E'", "E'": 'E', S: "S'", "S'": 'S',
  x: "x'", "x'": 'x', y: "y'", "y'": 'y', z: "z'", "z'": 'z',
}

export function getInverseMove(move: string): string {
  return INVERSE_MOVES[move] || move
}

export function sanitizeMove(move: string): string {
  return move.replace(/[()]/g, '').trim()
}

export type MoveMatchResult = {
  /** Index into the target sequence the physical cube now matches, or null if diverged. */
  matchedIndex: number | null
  /** Wrong moves accumulated since the last matched checkpoint. */
  badMoves: string[]
  /** True once the physical cube has matched the final checkpoint of the target sequence. */
  complete: boolean
}

/**
 * Tracks a physical move stream (as reported facelets snapshots) against a fixed target
 * move sequence — a scramble to hand-verify, or a solution algorithm to execute — the same
 * mechanism cubedex uses for both. Direct port of `handleSmartcubeMove`'s matching branch.
 */
export class MovesetMatcher {
  private readonly targetMoves: string[]
  private readonly checkpoints: string[] = []
  private readonly checkpointIndexByFacelets = new Map<string, number>()
  private currentMoveIndex = -1
  private badMoves: string[] = []
  private lastMoves: string[] = []

  constructor(targetMoves: string[], startFrom: CubeModel = solvedCube()) {
    this.targetMoves = targetMoves.map(sanitizeMove)
    let cursor = startFrom
    // checkpoints[i] = facelets after applying targetMoves[0..i] inclusive (0-indexed),
    // matching cubedex's patternStatesRef exactly (no entry for the pre-move base state).
    for (const move of this.targetMoves) {
      cursor = turn(cursor, move)
      this.checkpoints.push(faceletsOf(cursor))
    }
    for (let index = 0; index < this.checkpoints.length; index += 1) {
      // First occurrence wins so a repeated pattern (rare but possible) resolves to the
      // earliest matching index.
      if (!this.checkpointIndexByFacelets.has(this.checkpoints[index])) {
        this.checkpointIndexByFacelets.set(this.checkpoints[index], index)
      }
    }
  }

  get matchedIndex() {
    return this.currentMoveIndex
  }

  get pendingBadMoves(): readonly string[] {
    return this.badMoves
  }

  reset() {
    this.currentMoveIndex = -1
    this.badMoves = []
    this.lastMoves = []
  }

  /** Feed the facelets snapshot of the cube *after* one physical move (or slice-resolved move). */
  advance(facelets: string, moveLabel: string): MoveMatchResult {
    this.lastMoves = [...this.lastMoves, moveLabel].slice(-256)

    const nextExpectedIdx = this.currentMoveIndex + 1
    let matchedIndex: number | null = null

    // Fast path: the user made the expected next move.
    if (
      nextExpectedIdx >= 0
      && nextExpectedIdx < this.checkpoints.length
      && facelets === this.checkpoints[nextExpectedIdx]
    ) {
      matchedIndex = nextExpectedIdx
    } else {
      const hit = this.checkpointIndexByFacelets.get(facelets)
      if (hit !== undefined) matchedIndex = hit
    }

    if (matchedIndex !== null) {
      this.currentMoveIndex = matchedIndex
      this.badMoves = []
      const tailRotations = trailingWholeCubeRotationMoveCount(this.targetMoves)
      const lastLayerMoveIndex = this.targetMoves.length - 1 - tailRotations
      const finishedIncludingIgnoredRotations = tailRotations > 0
        && lastLayerMoveIndex >= 0
        && matchedIndex === lastLayerMoveIndex

      const complete = matchedIndex === this.targetMoves.length - 1 || finishedIncludingIgnoredRotations
      return { matchedIndex, badMoves: [], complete }
    }

    const nextBadMoves = [...this.badMoves, moveLabel]
    const lastWrongMove = moveLabel

    // The first move was matched (index 0) and the very next move is its exact inverse:
    // the user backed out of the first move entirely — reset to "no moves matched" rather
    // than treating it as divergence.
    if (
      this.currentMoveIndex === 0
      && nextBadMoves.length === 1
      && lastWrongMove === getInverseMove(this.targetMoves[this.currentMoveIndex])
    ) {
      this.currentMoveIndex = -1
      this.badMoves = []
      return { matchedIndex: null, badMoves: [], complete: false }
    }

    // Two bad moves where the second cancels the first (A then A'): the cube is back where
    // it was before either — drop both.
    if (
      nextBadMoves.length >= 2
      && lastWrongMove === getInverseMove(nextBadMoves[nextBadMoves.length - 2])
    ) {
      this.badMoves = nextBadMoves.slice(0, -2)
      return { matchedIndex: null, badMoves: this.badMoves, complete: false }
    }

    // Four of the same move in a row (a stuck/bugged repeat, e.g. a dropped disconnect
    // retriggering the same face turn): drop the run instead of accumulating it forever.
    if (
      nextBadMoves.length > 3
      && this.lastMoves.length > 3
      && this.lastMoves.at(-1) === this.lastMoves.at(-2)
      && this.lastMoves.at(-2) === this.lastMoves.at(-3)
      && this.lastMoves.at(-3) === this.lastMoves.at(-4)
    ) {
      this.badMoves = nextBadMoves.slice(0, -4)
      return { matchedIndex: null, badMoves: this.badMoves, complete: false }
    }

    this.badMoves = nextBadMoves
    return { matchedIndex: null, badMoves: this.badMoves, complete: false }
  }
}
