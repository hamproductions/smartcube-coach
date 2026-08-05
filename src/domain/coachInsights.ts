import type { StageRecord } from './models'

import type { Finding, FindingMetric } from './analyzeSolve'

export type Insight = {
  id: string
  headline: string
  evidence: string
  savingMs?: number
  detail?: string
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

/**
 * Where the time actually goes: turning versus not turning.
 *
 * This leads because it reframes everything below it. A solver whose hands are fast and
 * whose eyes are slow will otherwise be prescribed finger drills that cannot help.
 */
function recognitionShare(stages: StageRecord[]): Insight | undefined {
  const recognition = stages.reduce((sum, stage) => sum + (stage.recognitionMs ?? 0), 0)
  const execution = stages.reduce((sum, stage) => sum + (stage.executionMs ?? 0), 0)
  const total = recognition + execution
  if (total === 0) return undefined
  const share = recognition / total
  const solves = bySolve(stages)
  const perSolve = solves.map((group) => {
    const rec = group.reduce((sum, stage) => sum + (stage.recognitionMs ?? 0), 0)
    const all = rec + group.reduce((sum, stage) => sum + (stage.executionMs ?? 0), 0)
    return all === 0 ? 0 : rec / all
  })
  return {
    id: 'recognition-share',
    headline: `${Math.round(share * 100)}% of your solve is spent not turning`,
    evidence: `${ms(recognition)}s recognition against ${ms(execution)}s execution across ${solves.length} solve${solves.length === 1 ? '' : 's'} (${perSolve.slice(-8).map((value) => `${Math.round(value * 100)}%`).join(' · ')}).`,
    // The "largest block" claim only holds when recognition actually exceeds turning,
    // which stopped being true once the execution-gap rule (§1.5) moved AUF and undone
    // turns out of recognition. Derive it instead of asserting it.
    detail: share > 0.5
      ? 'Recognition is pauses between moves, not thinking time you can feel. It is the largest single block of time in these solves.'
      : 'Recognition is pauses between moves, not thinking time you can feel. Turning is the bigger share here, but this is the part that responds to lookahead work.'
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
    evidence: `First pair is found in ${ms(firstMean)}s, the rest average ${ms(laterMean)}s — ${(laterMean / firstMean).toFixed(1)}x slower, in ${firstWasFastest} of ${counted} solve${counted === 1 ? '' : 's'}.`,
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
 * Move efficiency: how many turns the solve spent above the optimal solution.
 *
 * `optimalMoveCount` is already computed per stage in reconstruction.ts, and was only
 * ever surfaced in an unmounted component. Wasted turns are the most direct form of
 * "your solution was longer than it needed to be" the stored data supports.
 */
function moveEfficiency(stages: StageRecord[]): Insight | undefined {
  const scored = stages.filter((stage) => stage.optimalMoveCount !== undefined && stage.moveCount > 0)
  if (scored.length === 0) return undefined
  const wasted = scored.reduce((sum, stage) => sum + Math.max(0, stage.moveCount - (stage.optimalMoveCount as number)), 0)
  if (wasted <= 0) return undefined
  const solves = bySolve(stages).length
  const perSolve = wasted / Math.max(1, solves)
  const worst = [...scored].sort((left, right) =>
    (right.moveCount - (right.optimalMoveCount as number)) - (left.moveCount - (left.optimalMoveCount as number)))[0]
  const worstWaste = worst.moveCount - (worst.optimalMoveCount as number)

  return {
    id: 'move-efficiency',
    headline: `You turn ${perSolve.toFixed(1)} more moves per solve than needed`,
    evidence: `${wasted} extra turns across ${scored.length} scored stage${scored.length === 1 ? '' : 's'}; worst is ${worst.name} at ${worst.moveCount} moves against an optimal ${worst.optimalMoveCount} (+${worstWaste}).`,
    detail: 'Extra turns cost time even at a high turn rate. The optimal count is the shortest solution for that exact state, so the gap is recoverable with better planning rather than faster hands.'
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
