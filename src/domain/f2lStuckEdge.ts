import { Alg } from 'cubing/alg'
import type { AlgorithmRecord } from './models'

const solutions = [
  "U R' U' R2 U R'",
  "U F' L F L' F' U' F",
  "U B' R B R' U2 F' U' F",
  "U B' U' B U R U R'",
  "U' L U L' U' b' R' b",
  "U L' B L B' U' b' R' b"
]

export const STUCK_EDGE_PREFIX = 'f2l-stuck-edge-'

export function stuckEdgeRecords(timestamp: number): AlgorithmRecord[] {
  return solutions.map((algorithm, index) => ({
    id: `${STUCK_EDGE_PREFIX}${index + 1}`,
    set: 'F2L',
    name: `Stuck edge ${index + 1}`,
    algorithm,
    setup: new Alg(algorithm).invert().toString(),
    targetMs: 2000,
    mastery: 0,
    dueAt: timestamp,
    orientations: ['FR']
  }))
}
