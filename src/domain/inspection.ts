import { Alg } from 'cubing/alg'
import { puzzles } from 'cubing/puzzles'

const facesByAxis = [['U', 'D'], ['R', 'L'], ['F', 'B']]
const suffixes = ['', "'", '2']

function random(seed: string) {
  let value = 2166136261
  for (const character of seed) value = Math.imul(value ^ character.charCodeAt(0), 16777619)
  return () => {
    value ^= value << 13
    value ^= value >>> 17
    value ^= value << 5
    return (value >>> 0) / 2 ** 32
  }
}

export function generateCrossInspectionPrompt(seed: string) {
  const next = random(seed)
  const moves: string[] = []
  let previousAxis = -1
  for (let index = 0; index < 12; index += 1) {
    const axes = [0, 1, 2].filter((axis) => axis !== previousAxis)
    const axis = axes[Math.floor(next() * axes.length)]
    moves.push(`${facesByAxis[axis][Math.floor(next() * 2)]}${suffixes[Math.floor(next() * suffixes.length)]}`)
    previousAxis = axis
  }
  return { seed, scramble: moves.join(' ') }
}

export async function crossPlanSucceeds(scramble: string, plan: string) {
  try {
    new Alg(plan)
  } catch {
    return false
  }
  const puzzle = await puzzles['3x3x3'].kpuzzle()
  const pattern = puzzle.defaultPattern().applyAlg(scramble).applyAlg(plan)
  return [4, 5, 6, 7].every((index) => pattern.patternData.EDGES.pieces[index] === index && pattern.patternData.EDGES.orientation[index] === 0)
}
