import type { AlgorithmRecord, TrainerAttempt } from './models'

const now = Date.now()

export const defaultAlgorithms: AlgorithmRecord[] = [
  { id: 'f2l-insert-right', set: 'F2L', name: 'Basic right insert', algorithm: "U R U' R'", setup: "R U R'", targetMs: 900, mastery: 0, dueAt: now, orientations: ['FR'] },
  { id: 'f2l-insert-left', set: 'F2L', name: 'Basic left insert', algorithm: "U' L' U L", setup: "L' U' L", targetMs: 900, mastery: 0, dueAt: now, orientations: ['FL'] },
  { id: 'f2l-sledge', set: 'F2L', name: 'Sledge insert', algorithm: "R' F R F'", setup: "F R' F' R", targetMs: 850, mastery: 0, dueAt: now, orientations: ['FR'] },
  { id: 'oll-sune', set: 'OLL', name: 'Sune', algorithm: "R U R' U R U2 R'", setup: "R U2 R' U' R U' R'", targetMs: 900, mastery: 0, dueAt: now, orientations: ['U', "U'", 'U2'] },
  { id: 'oll-antisune', set: 'OLL', name: 'Anti-Sune', algorithm: "R U2 R' U' R U' R'", setup: "R U R' U R U2 R'", targetMs: 900, mastery: 0, dueAt: now, orientations: ['U', "U'", 'U2'] },
  { id: 'pll-t', set: 'PLL', name: 'T Perm', algorithm: "R U R' U' R' F R2 U' R' U' R U R' F'", setup: "F R U' R' U R U R2 F' R U R U' R'", targetMs: 1200, mastery: 0, dueAt: now, orientations: ['U', "U'", 'U2'] },
  { id: 'pll-ua', set: 'PLL', name: 'Ua Perm', algorithm: "M2 U M U2 M' U M2", setup: "M2 U' M U2 M' U' M2", targetMs: 1100, mastery: 0, dueAt: now, orientations: ['U', "U'", 'U2'] },
  { id: 'pll-ub', set: 'PLL', name: 'Ub Perm', algorithm: "M2 U' M U2 M' U' M2", setup: "M2 U M U2 M' U M2", targetMs: 1100, mastery: 0, dueAt: now, orientations: ['U', "U'", 'U2'] }
]

export function chooseTrainingCase(cases: AlgorithmRecord[], attempts: TrainerAttempt[], timestamp = Date.now()) {
  return [...cases].sort((left, right) => {
    const leftFailures = attempts.filter((attempt) => attempt.caseId === left.id && attempt.outcome !== 'success').length
    const rightFailures = attempts.filter((attempt) => attempt.caseId === right.id && attempt.outcome !== 'success').length
    const leftScore = (left.dueAt <= timestamp ? 100 : 0) + leftFailures * 20 + (1 - left.mastery) * 10
    const rightScore = (right.dueAt <= timestamp ? 100 : 0) + rightFailures * 20 + (1 - right.mastery) * 10
    return rightScore - leftScore
  })[0]
}

export function updateMastery(record: AlgorithmRecord, success: boolean, elapsedMs: number, timestamp = Date.now()): AlgorithmRecord {
  const speedPass = elapsedMs <= record.targetMs
  const delta = success ? (speedPass ? 0.18 : 0.1) : -0.2
  const mastery = Math.min(1, Math.max(0, record.mastery + delta))
  const intervalDays = success ? Math.max(1, Math.round(1 + mastery * 13)) : 0
  return { ...record, mastery, dueAt: timestamp + intervalDays * 86_400_000 }
}

export function progressiveHint(record: AlgorithmRecord, level: number) {
  if (level <= 0) return `${record.set} · no hints revealed`
  if (level === 1) return `Setup: ${record.setup}`
  if (level === 2) return `First trigger: ${record.algorithm.split(/\s+/).slice(0, 4).join(' ')}`
  return record.algorithm
}
