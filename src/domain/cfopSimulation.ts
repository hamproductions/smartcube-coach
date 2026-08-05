import { Alg } from 'cubing/alg'
import { puzzles } from 'cubing/puzzles'
import { defaultAlgorithms } from './training'
import { faceTurnsOnly } from './faceTurnsOnly'

export type SimulatedStage = {
  name: string
  caseId?: string
  moves: string[]
  recognitionMs: number
  executionMs: number
}

export type SimulatedSolve = {
  scramble: string
  stages: SimulatedStage[]
  moves: string[]
  events: Array<{ move: string; timestamp: number }>
  totalMs: number
}

const crossPool = [
  "D' L R D R' U D",
  "D2 F R' D L2",
  "U R2 D' F L D",
  "L D' R2 F D",
  "F R D2 L' U D"
]

const pairPool = [
  "U R U' R'",
  "U' L' U L",
  "R U R' U' R U R'",
  "U' R U R'",
  "y U L' U' L",
  "R U' R' U R U' R'",
  "U2 R U R'",
  "L' U L U' L' U L"
]

function seededRandom(seed: string) {
  let hash = 2_166_136_261
  for (const character of seed) {
    hash ^= character.charCodeAt(0)
    hash = Math.imul(hash, 16_777_619)
  }
  return () => {
    hash += 0x6d2b79f5
    let value = Math.imul(hash ^ (hash >>> 15), 1 | hash)
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value)
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296
  }
}

const pick = <T,>(random: () => number, values: T[]) => values[Math.floor(random() * values.length) % values.length]

export async function simulateCfopSolve(seed = 'sim', level: { recognitionMs: number; turnsPerSecond: number } = { recognitionMs: 700, turnsPerSecond: 3.4 }): Promise<SimulatedSolve> {
  const random = seededRandom(seed)
  const oll = pick(random, defaultAlgorithms.filter((record) => record.set === 'OLL'))
  const pll = pick(random, defaultAlgorithms.filter((record) => record.set === 'PLL'))
  const stageAlgs = [
    { name: 'Cross', alg: pick(random, crossPool) },
    { name: 'F2L 1', alg: pick(random, pairPool) },
    { name: 'F2L 2', alg: pick(random, pairPool) },
    { name: 'F2L 3', alg: pick(random, pairPool) },
    { name: 'F2L 4', alg: pick(random, pairPool) },
    { name: 'OLL', alg: oll.algorithm, caseId: oll.id },
    { name: 'PLL', alg: pll.algorithm, caseId: pll.id }
  ]

  // A smart cube reports face turns only, so the simulated stream must be reduced to
  // them before anything downstream sees it. Left as catalogue notation, the inverted
  // solution below is not a WCA scramble and min2phase — which the solve tracker uses to
  // match one — rejects it outright.
  let foldRotation = ''
  const stageMoves = stageAlgs.map(({ alg }) => {
    const folded = faceTurnsOnly(alg, foldRotation)
    foldRotation = folded.rotation
    return folded.moves
  })
  const solution = stageMoves.flat()

  const puzzle = await puzzles['3x3x3'].kpuzzle()
  // Alg.invert() writes a half turn as R2', which is not WCA notation and which the
  // solver behind scramble matching rejects. A half turn is its own inverse.
  const scramble = new Alg(solution.join(' ')).invert().toString().replace(/2'/g, '2')
  const finalPattern = puzzle.defaultPattern().applyAlg(scramble).applyAlg(solution.join(' '))
  if (!finalPattern.isIdentical(puzzle.defaultPattern())) throw new Error('Simulated CFOP solve does not solve its own scramble')

  const stages: SimulatedStage[] = []
  const events: Array<{ move: string; timestamp: number }> = []
  let timestamp = 0

  for (const [index, stage] of stageAlgs.entries()) {
    const moves = stageMoves[index]
    const recognitionMs = Math.round(level.recognitionMs * (index === 0 ? 0 : 1) * (0.7 + random() * 0.9))
    const perMove = Math.round(1_000 / level.turnsPerSecond)
    timestamp += recognitionMs
    const stageStart = timestamp
    for (const move of moves) {
      timestamp += perMove
      events.push({ move, timestamp })
    }
    stages.push({ name: stage.name, caseId: stage.caseId, moves, recognitionMs, executionMs: timestamp - stageStart })
  }

  return { scramble, stages, moves: solution, events, totalMs: timestamp }
}
