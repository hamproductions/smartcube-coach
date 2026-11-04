import type { StageRecord } from './models'

import type { Finding, FindingMetric } from './analyzeSolve'

export type Insight = {
  id: string
  headline: string
  evidence: string
  savingMs?: number
  detail?: string
  stage?: string
  /** One concrete thing to practise. */
  action?: string
  /** The trainer that practises it. */
  trainer?: string
  /** The solve where this showed most, to open and replay. */
  example?: { solveId: string; label: string }
  /** Set when this insight maps onto an existing prescription plan. */
  finding?: Finding
}

function findingFor(metric: FindingMetric, observed: number, baseline: number, target: number, impactMs: number, solveId: string, stage: string): Finding {
  return {
    id: `${metric}-${solveId}`,
    metric,
    title: stage,
    observed,
    baseline,
    target,
    impactMs,
    recurrence: 1,
    confidence: 1,
    priority: impactMs,
    evidence: { solveId, stage, fromMs: 0, toMs: 0 }
  }
}

const ms = (value: number) => (value / 1000).toFixed(2)

function duration(stage: StageRecord) {
  return (stage.recognitionMs ?? 0) + (stage.executionMs ?? 0)
}

function mean(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function bySolve(stages: StageRecord[]) {
  const groups = new Map<string, StageRecord[]>()
  for (const stage of stages) {
    const list = groups.get(stage.solveId) ?? []
    list.push(stage)
    groups.set(stage.solveId, list)
  }
  return [...groups.values()]
}

function f2lInOrder(solveStages: StageRecord[]) {
  return solveStages.filter((stage) => stage.name.startsWith('F2L')).sort((left, right) => left.startEvent - right.startEvent)
}

type Family = 'Cross' | 'F2L' | 'OLL' | 'PLL'

const FAMILY_ADVICE: Record<Family, { look: string; lookTrainer: string; turns: string; turnsTrainer: string }> = {
  Cross: {
    look: 'Plan the whole cross in inspection so the first turn starts the solve instead of a search.',
    lookTrainer: 'cross-plan',
    turns: 'Plan the cross in inspection and compare your plan with the shortest one the trainer shows.',
    turnsTrainer: 'cross-plan'
  },
  F2L: {
    look: 'While you insert one pair, find the next. Pair tracking drills exactly that: follow a pair through turns without stopping.',
    lookTrainer: 'pair-tracking',
    turns: 'Drill the F2L cases you solve long until the short insert is automatic. F2L on the cube times each case and shows the reference.',
    turnsTrainer: 'f2l-cube'
  },
  OLL: {
    look: 'Recognise the case from the top pattern before you start turning. Drill OLL in Recognise mode until the name comes instantly.',
    lookTrainer: 'cases',
    turns: 'You are solving some OLLs in more than one algorithm. Learn the full OLL for the cases you two-look.',
    turnsTrainer: 'cases'
  },
  PLL: {
    look: 'Recognise PLL from two sides without rotating. Drill PLL in Recognise mode.',
    lookTrainer: 'cases',
    turns: 'Learn the shorter algorithm for the PLLs you solve long, then run them in Time attack.',
    turnsTrainer: 'time-attack'
  }
}

function familyOf(stage: StageRecord): Family | undefined {
  if (/^cross/i.test(stage.name)) return 'Cross'
  if (stage.name.startsWith('F2L')) return 'F2L'
  if (stage.name === 'OLL') return 'OLL'
  if (stage.name === 'PLL') return 'PLL'
  return undefined
}

function quantile(values: number[], q: number) {
  const sorted = [...values].sort((left, right) => left - right)
  return sorted[Math.floor(q * (sorted.length - 1))] ?? 0
}

/**
 * Where the looking time goes, by step, and how much of it this solver has already shown
 * they can do without: the gap between their usual and their own best quarter.
 */
function recognitionShare(stages: StageRecord[]): Insight | undefined {
  const solves = bySolve(stages)
  if (solves.length < 2) return undefined
  const perFamily = new Map<Family, Array<{ solveId: string; ms: number }>>()
  for (const group of solves) {
    const totals = new Map<Family, number>()
    for (const stage of group) {
      const family = familyOf(stage)
      if (!family || stage.recognitionMs === undefined) continue
      totals.set(family, (totals.get(family) ?? 0) + stage.recognitionMs)
    }
    for (const [family, value] of totals) perFamily.set(family, [...(perFamily.get(family) ?? []), { solveId: group[0].solveId, ms: value }])
  }
  const ranked = [...perFamily.entries()]
    .filter(([, rows]) => rows.length >= 2)
    .map(([family, rows]) => {
      const values = rows.map((row) => row.ms)
      const usual = mean(values)
      const best = quantile(values, 0.25)
      const worst = rows.reduce((top, row) => row.ms > top.ms ? row : top)
      return { family, usual, best, saving: usual - best, worst, count: rows.length }
    })
    .sort((left, right) => right.saving - left.saving)
  const top = ranked[0]
  if (!top || top.saving < 150) return undefined
  const advice = FAMILY_ADVICE[top.family]
  return {
    id: 'recognition-share',
    stage: top.family,
    headline: `You lose about ${ms(top.saving)}s a solve looking before ${top.family === 'F2L' ? 'F2L pairs' : `the ${top.family}`}`,
    evidence: `Your usual ${top.family} recognition is ${ms(top.usual)}s per solve; your best quarter of solves does it in ${ms(top.best)}s.`,
    savingMs: top.saving,
    action: advice.look,
    trainer: advice.lookTrainer,
    example: { solveId: top.worst.solveId, label: `Slowest: ${ms(top.worst.ms)}s looking before ${top.family}` }
  }
}

/**
 * Lookahead: the first pair is planned during inspection, the rest must be found.
 *
 * Reported by position in the F2L sequence rather than by slot, because position is what
 * the measurements separate — see slotBias below for why the slot version is withheld.
 */
function lookaheadCollapse(stages: StageRecord[]): Insight | undefined {
  const solves = bySolve(stages)
  const first: number[] = []
  const later: number[] = []
  let firstWasFastest = 0
  let counted = 0

  for (const group of solves) {
    const pairs = f2lInOrder(group)
    if (pairs.length < 2) continue
    counted += 1
    // Drop unmeasured pairs rather than coercing to 0: `?? 0` turned "we never timed
    // this" into "found instantly", which made firstMean 0 and printed "Infinity x".
    const recognitions = pairs.map((stage) => stage.recognitionMs).filter((value): value is number => value !== undefined)
    if (recognitions.length < 2) continue
    first.push(recognitions[0])
    later.push(...recognitions.slice(1))
    if (recognitions[0] === Math.min(...recognitions)) firstWasFastest += 1
  }
  if (counted === 0 || first.length === 0 || later.length === 0) return undefined
  // A gap that only appears in a minority of solves is noise, not a pattern. Reporting
  // it as "your lookahead stops" would be the same mistake as the slot bottleneck.
  if (firstWasFastest * 2 <= counted) return undefined

  const firstMean = mean(first)
  const laterMean = mean(later)
  if (firstMean <= 0) return undefined
  if (laterMean <= firstMean) return undefined
  // One solve is a solve, not a habit. slotBias already holds this line; so must this.
  if (counted < 2) return undefined

  // If every later pair were found as fast as the first, this is what each solve returns.
  const savingMs = (laterMean - firstMean) * (later.length / counted)

  return {
    id: 'lookahead-collapse',
    headline: `Your lookahead stops after the first pair`,
    action: FAMILY_ADVICE.F2L.look,
    trainer: 'pair-tracking',
    evidence: `First pair is found in ${ms(firstMean)}s, the rest average ${ms(laterMean)}s, ${(laterMean / firstMean).toFixed(1)}x slower, in ${firstWasFastest} of ${counted} solve${counted === 1 ? '' : 's'}.`,
    savingMs,
    detail: 'The first pair is planned during inspection. After that you are searching with the cube stopped, which is why the gap is this wide.',
    // The measured first-pair time is the target: it is this solver's own demonstrated
    // recognition speed, not an aspirational number from someone else's solves.
    finding: findingFor('pair_transition_pause', laterMean, firstMean, Math.round(firstMean), savingMs, solves[0][0]?.solveId ?? '', 'F2L')
  }
}

/** Pauses that land after the same move are a habit, not noise. */
function pauseTrigger(stages: StageRecord[]): Insight | undefined {
  const pairs = stages.filter((stage) => stage.name.startsWith('F2L'))
  const counts = new Map<string, number>()
  let withPause = 0
  for (const stage of pairs) {
    const move = stage.longestPauseAfter
    if (!move) continue
    withPause += 1
    counts.set(move, (counts.get(move) ?? 0) + 1)
  }
  if (withPause < 4) return undefined
  // Four pairs of ONE solve is that solve's shape. A habit has to recur across solves.
  const pausingSolves = new Set(pairs.filter((stage) => stage.longestPauseAfter).map((stage) => stage.solveId))
  if (pausingSolves.size < 2) return undefined

  // D and D' are the same habit — turning the bottom layer to hunt for the next pair.
  const grouped = new Map<string, number>()
  for (const [move, count] of counts) {
    const family = move.replace(/['2]/g, '')
    grouped.set(family, (grouped.get(family) ?? 0) + count)
  }
  const [family, count] = [...grouped.entries()].sort((left, right) => right[1] - left[1])[0]
  if (count / withPause < 0.5) return undefined

  return {
    id: 'pause-trigger',
    headline: `Your longest pause lands right after a ${family} move`,
    evidence: `${count} of ${withPause} timed F2L pairs stall immediately after ${family}.`,
    detail: `You are turning ${family} to bring the next pair into view, then stopping to look for it. Tracking the pair before the ${family} turn removes the pause.`
  }
}

/**
 * Reports turn speed only when it is genuinely healthy, so no finger drill is prescribed
 * against a problem that is not there. The bar is the measured turn rate itself — an
 * earlier version fired whenever recognition passed half of execution, which asserted
 * "your hands are fine" on solves whose own numbers showed more turning than looking.
 */
const HEALTHY_TPS = 5

function executionHealth(stages: StageRecord[]): Insight | undefined {
  const timed = stages.filter((stage) => stage.name.startsWith('F2L') && (stage.tps ?? 0) > 0)
  if (timed.length < 4) return undefined
  // One solve has exactly four F2L pairs, so the length gate alone let this fire off a
  // single solve — the same defect already closed in slotBias and pauseTrigger.
  if (bySolve(stages).length < 2) return undefined
  const tpsMean = mean(timed.map((stage) => stage.tps as number))
  if (tpsMean < HEALTHY_TPS) return undefined

  const recognition = stages.reduce((sum, stage) => sum + (stage.recognitionMs ?? 0), 0)
  const execution = stages.reduce((sum, stage) => sum + (stage.executionMs ?? 0), 0)
  if (recognition + execution === 0) return undefined
  if (recognition / (recognition + execution) < 0.3) return undefined

  return {
    id: 'execution-health',
    headline: `Your turn speed is already there`,
    evidence: `F2L turning averages ${tpsMean.toFixed(1)} TPS, and ${Math.round((recognition / (recognition + execution)) * 100)}% of total solve time is recognition rather than turning.`,
    detail: 'Turning faster is not where the remaining time is. Drill finding the next pair, not executing it.'
  }
}

/**
 * The slot-versus-position question, answered honestly.
 *
 * A slow slot and a late slot look identical until you have seen each slot solved at
 * several positions. Reporting a slot bottleneck before then blames a pair for what is
 * really the order it was solved in, which sends the solver to the wrong drill.
 */
function slotBias(stages: StageRecord[]): Insight | undefined {
  const positions = new Map<string, number[]>()
  for (const group of bySolve(stages)) {
    f2lInOrder(group).forEach((stage, index) => {
      if (!stage.slot) return
      const seen = positions.get(stage.slot) ?? []
      seen.push(index)
      positions.set(stage.slot, seen)
    })
  }
  if (positions.size === 0) return undefined
  // Over a single solve every slot is trivially solved once, so the verdict carries no
  // information — it would just be noise on the per-solve panel.
  if (bySolve(stages).length < 2) return undefined
  const separable = [...positions.values()].every((seen) => new Set(seen).size > 1)
  if (separable) return undefined
  return {
    id: 'slot-not-separable',
    headline: `No slot is provably your weak one yet`,
    evidence: `Each slot has only been solved at ${[...positions.values()].map((seen) => new Set(seen).size).join('/')} distinct position${positions.size === 1 ? '' : 's'} in the pair order.`,
    detail: 'A slot that is always solved last will look slow because it is last. Capture more solves before trusting any per-slot verdict.'
  }
}

/**
 * Extra turns over the shortest solution, by step, priced at this solver's own turn speed.
 */
function moveEfficiency(stages: StageRecord[]): Insight | undefined {
  const scored = stages.filter((stage) => stage.optimalMoveCount !== undefined && stage.moveCount > 0 && familyOf(stage))
  if (scored.length === 0) return undefined
  const solves = new Set(scored.map((stage) => stage.solveId)).size
  if (solves < 2) return undefined
  const waste = (stage: StageRecord) => Math.max(0, stage.moveCount - (stage.optimalMoveCount as number))
  const turning = stages.reduce((sum, stage) => sum + (stage.executionMs ?? 0), 0)
  const turns = stages.reduce((sum, stage) => sum + stage.moveCount, 0)
  const msPerTurn = turns > 0 ? turning / turns : 0
  const byFamily = new Map<Family, StageRecord[]>()
  for (const stage of scored) byFamily.set(familyOf(stage)!, [...(byFamily.get(familyOf(stage)!) ?? []), stage])
  const ranked = [...byFamily.entries()]
    .map(([family, rows]) => ({ family, rows, extraPerSolve: rows.reduce((sum, stage) => sum + waste(stage), 0) / solves }))
    .sort((left, right) => right.extraPerSolve - left.extraPerSolve)
  const top = ranked[0]
  if (!top || top.extraPerSolve < 2) return undefined
  const worst = [...top.rows].sort((left, right) => waste(right) - waste(left))[0]
  const advice = FAMILY_ADVICE[top.family]
  const savingMs = top.extraPerSolve * msPerTurn
  return {
    id: 'move-efficiency',
    stage: worst.name,
    headline: `Your ${top.family === 'F2L' ? 'F2L pairs take' : `${top.family} takes`} ${top.extraPerSolve.toFixed(0)} more turns a solve than needed`,
    evidence: `At your turn speed that is about ${ms(savingMs)}s a solve. Worst: ${worst.name} in ${worst.moveCount} turns where ${worst.optimalMoveCount} would do.`,
    savingMs,
    action: advice.turns,
    trainer: advice.turnsTrainer,
    example: { solveId: worst.solveId, label: `${worst.name}: ${worst.moveCount} turns, shortest ${worst.optimalMoveCount}` }
  }
}

export function buildInsights(stages: StageRecord[]): Insight[] {
  if (stages.length === 0) return []
  const built = [
    recognitionShare(stages),
    moveEfficiency(stages),
    lookaheadCollapse(stages),
    pauseTrigger(stages),
    executionHealth(stages),
    slotBias(stages)
  ].filter((insight): insight is Insight => insight !== undefined)
  // Anything with a measured time saving outranks context.
  return built.sort((left, right) => (right.savingMs ?? 0) - (left.savingMs ?? 0))
}

export function totalStageMs(stages: StageRecord[]) {
  return stages.reduce((sum, stage) => sum + duration(stage), 0)
}
