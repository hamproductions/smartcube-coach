import type { KPattern } from 'cubing/kpuzzle'
import { puzzles } from 'cubing/puzzles'
import { holdPermutation } from './cubeHold'
import { remapMoveForPlayer } from './cubedex/smartcubeParity'
import { bestCross, type Face } from './crossF2lPractice'

const FACES: Face[] = ['U', 'R', 'F', 'D', 'L', 'B']
const SUFFIXES = ['', "'", '2']

export type HeldFrame = { toCube: (move: string) => string; bottom: Face }

export function heldFrame(rotation: string): HeldFrame {
  const perm = holdPermutation(rotation)
  const held: Record<string, Face> = {}
  for (const face of FACES) held[remapMoveForPlayer(face, perm)[0]] = face
  return {
    toCube: (move) => `${held[move[0]] ?? move[0]}${move.slice(1)}`,
    bottom: held.D ?? 'D'
  }
}

export function parsePlan(plan: string) {
  const moves = plan.replace(/[()]/g, ' ').trim().split(/\s+/).filter(Boolean)
  const valid = moves.every((move) => /^[URFDLB](2|'|2')?$/.test(move))
  return valid ? moves.map((move) => move.replace("2'", '2')) : undefined
}

async function crossTurns(pattern: KPattern, face: Face) {
  return (await bestCross(pattern, face))?.turns
}

export async function gradeCrossPlan(scramble: string, plan: string[], frame: HeldFrame) {
  const solved = (await puzzles['3x3x3'].kpuzzle()).defaultPattern()
  const scrambled = solved.applyAlg(scramble)
  const after = plan.length ? scrambled.applyAlg(plan.map(frame.toCube).join(' ')) : scrambled
  const optimal = await crossTurns(scrambled, frame.bottom)
  return { solved: (await crossTurns(after, frame.bottom)) === 0, optimal }
}

export async function optimalCrossPlan(scramble: string, frame: HeldFrame) {
  return optimalCrossFrom((await puzzles['3x3x3'].kpuzzle()).defaultPattern().applyAlg(scramble), frame)
}

export async function optimalCrossFrom(start: KPattern, frame: HeldFrame) {
  let pattern = start
  let remaining = await crossTurns(pattern, frame.bottom)
  const moves: string[] = []
  while (remaining !== undefined && remaining > 0 && moves.length < 10) {
    let stepped = false
    for (const face of FACES) {
      if (moves.length && moves[moves.length - 1][0] === face) continue
      for (const suffix of SUFFIXES) {
        const move = `${face}${suffix}`
        const next = pattern.applyAlg(frame.toCube(move))
        const depth = await crossTurns(next, frame.bottom)
        if (depth === remaining - 1) {
          moves.push(move)
          pattern = next
          remaining = depth
          stepped = true
          break
        }
      }
      if (stepped) break
    }
    if (!stepped) return undefined
  }
  return moves
}
