import { Alg } from 'cubing/alg'
import { puzzles } from 'cubing/puzzles'
import type { KPattern } from 'cubing/kpuzzle'
import { recognizeOll, recognizePll } from './caseRecognition'
import { recognizeF2l } from './f2lRecognition'
import { framePattern, optimalCrossMovesInFrame } from './crossSolver'
import { optimalCrossPlusPairSolution } from './pairSolver'
import { betterSlotThan, scoreSlots } from './betterSlot'
import { reorientToSolvedCenters } from './lastLayer'
import type { AlgorithmRecord, StageRecord } from './models'
import { recoveredNotation } from './sliceRecovery'
import { slotColoursFromPattern } from './slotColours'
import { patternToPlayerAlg } from './cubedex/scramble'
import simplifyRotations from './simplifyRotations'

export type TimestampedMove = {
  move: string
  timestamp: number
}

export type ReconstructionCompletion = {
  id: string
  name: string
  remaining: string
}

type StagePredicate = {
  name: string
  satisfied: (pattern: KPattern, reference: KPattern) => boolean
}

const pieceMatches = (pattern: KPattern, reference: KPattern, orbit: 'EDGES' | 'CORNERS', index: number) => {
  const actual = pattern.patternData[orbit]
  const expected = reference.patternData[orbit]
  return actual.pieces[index] === expected.pieces[index] && actual.orientation[index] === expected.orientation[index]
}

type CrossFace = {
  name: string
  crossEdges: number[]
  lastLayerEdges: number[]
  lastLayerCorners: number[]
  slots: ReadonlyArray<{ slot: 'FR' | 'FL' | 'BL' | 'BR'; corner: number; edge: number }>
}

const crossFaces: CrossFace[] = [
  {
    name: 'D',
    crossEdges: [4, 5, 6, 7],
    lastLayerEdges: [0, 1, 2, 3],
    lastLayerCorners: [0, 1, 2, 3],
    slots: [
      { slot: 'FR', corner: 4, edge: 8 },
      { slot: 'FL', corner: 5, edge: 9 },
      { slot: 'BL', corner: 6, edge: 11 },
      { slot: 'BR', corner: 7, edge: 10 }
    ]
  },
  {
    name: 'U',
    crossEdges: [0, 1, 2, 3],
    lastLayerEdges: [4, 5, 6, 7],
    lastLayerCorners: [4, 5, 6, 7],
    slots: [
      { slot: 'FR', corner: 0, edge: 8 },
      { slot: 'BR', corner: 1, edge: 10 },
      { slot: 'BL', corner: 2, edge: 11 },
      { slot: 'FL', corner: 3, edge: 9 }
    ]
  }
]

const crossSolvedOn = (pattern: KPattern, reference: KPattern, face: CrossFace) =>
  face.crossEdges.every((index) => pieceMatches(pattern, reference, 'EDGES', index))

const crossSolved = (pattern: KPattern, reference: KPattern) => crossFaces.some((face) => crossSolvedOn(pattern, reference, face))

const f2lSlots = [
  { slot: 'FR', corner: 4, edge: 8 },
  { slot: 'FL', corner: 5, edge: 9 },
  { slot: 'BL', corner: 6, edge: 11 },
  { slot: 'BR', corner: 7, edge: 10 }
] as const

export type F2lSlot = typeof f2lSlots[number]['slot']

const solvedSlots = (pattern: KPattern, reference: KPattern) =>
  f2lSlots.filter(({ corner, edge }) => pieceMatches(pattern, reference, 'CORNERS', corner) && pieceMatches(pattern, reference, 'EDGES', edge)).map(({ slot }) => slot)

const f2lPairs = (pattern: KPattern, reference: KPattern) => solvedSlots(pattern, reference).length

const ollSolved = (pattern: KPattern, reference: KPattern) =>
  [0, 1, 2, 3].every((index) => pattern.patternData.EDGES.orientation[index] === reference.patternData.EDGES.orientation[index]) &&
  [0, 1, 2, 3].every((index) => pattern.patternData.CORNERS.orientation[index] === reference.patternData.CORNERS.orientation[index])

const pllSolved = (pattern: KPattern, reference: KPattern) =>
  ['', 'U', 'U2', "U'"].some((auf) => pattern.isIdentical(auf ? reference.applyAlg(auf) : reference))

const rotationFrames = ['', 'x', 'x2', "x'", 'z', "z'"].flatMap((base) => ['', 'y', 'y2', "y'"].map((turn) => [base, turn].filter(Boolean).join(' ')))

function solveProgress(pattern: KPattern, solved: KPattern, lockedFace?: string) {
  let best = 0
  let slots: F2lSlot[] = []
  let frame = ''
  let face = lockedFace
  const candidates = lockedFace ? crossFaces.filter((entry) => entry.name === lockedFace) : crossFaces
  for (const rotation of rotationFrames) {
    const reference = rotation ? solved.applyAlg(rotation) : solved
    for (const candidate of candidates) {
      if (!crossSolvedOn(pattern, reference, candidate)) continue
      const reached = reachedOnFace(pattern, reference, candidate)
      if (reached > best) {
        best = reached
        slots = solvedSlotsOn(pattern, reference, candidate)
        frame = rotation
        face = candidate.name
      }
    }
  }
  return { reached: best, slots, frame, face }
}

function reachedOnFace(pattern: KPattern, reference: KPattern, face: CrossFace) {
  let reached = 1
  const pairs = solvedSlotsOn(pattern, reference, face).length
  for (let index = 1; index <= 4; index += 1) {
    if (pairs < index) return reached
    reached = index + 1
  }
  if (!ollSolvedOn(pattern, reference, face)) return reached
  reached = 6
  if (!pllSolved(pattern, reference)) return reached
  return 8
}

const solvedSlotsOn = (pattern: KPattern, reference: KPattern, face: CrossFace) =>
  face.slots.filter(({ corner, edge }) => pieceMatches(pattern, reference, 'CORNERS', corner) && pieceMatches(pattern, reference, 'EDGES', edge)).map(({ slot }) => slot)

const ollSolvedOn = (pattern: KPattern, reference: KPattern, face: CrossFace) =>
  face.lastLayerEdges.every((index) => pattern.patternData.EDGES.orientation[index] === reference.patternData.EDGES.orientation[index]) &&
  face.lastLayerCorners.every((index) => pattern.patternData.CORNERS.orientation[index] === reference.patternData.CORNERS.orientation[index])

const predicates: StagePredicate[] = [
  { name: 'Cross', satisfied: crossSolved },
  { name: 'F2L 1', satisfied: (pattern, reference) => f2lPairs(pattern, reference) >= 1 },
  { name: 'F2L 2', satisfied: (pattern, reference) => f2lPairs(pattern, reference) >= 2 },
  { name: 'F2L 3', satisfied: (pattern, reference) => f2lPairs(pattern, reference) >= 3 },
  { name: 'F2L 4', satisfied: (pattern, reference) => f2lPairs(pattern, reference) >= 4 },
  { name: 'OLL', satisfied: ollSolved },
  { name: 'PLL', satisfied: pllSolved },
  { name: 'AUF', satisfied: (pattern, reference) => pattern.isIdentical(reference) }
]

export function suggestReconstructionCompletions(
  prefix: string,
  algorithms: Pick<AlgorithmRecord, 'id' | 'name' | 'algorithm'>[]
): ReconstructionCompletion[] {
  const moves = prefix.trim().split(/\s+/).filter(Boolean)
  const remainingMoves = (completion: ReconstructionCompletion) => completion.remaining.split(/\s+/).filter(Boolean).length

  return algorithms.flatMap((algorithm) => {
    const candidate = algorithm.algorithm.split(/\s+/)
    if (moves.length >= candidate.length || !moves.every((move, index) => move === candidate[index])) return []

    return [{
      id: algorithm.id,
      name: algorithm.name,
      remaining: candidate.slice(moves.length).join(' ')
    }]
  }).sort((left, right) => remainingMoves(left) - remainingMoves(right))
}

/**
 * A short alg that reproduces a position, derived from the cube state with min2phase and
 * inverted. Same position, same setup, however the solver arrived there.
 */
function setupAlgFor(pattern: KPattern): string | undefined {
  try {
    // min2phase writes a half turn as `F2'`; it is the same turn as `F2` and that is how a
    // cuber reads it.
    const alg = patternToPlayerAlg(pattern).trim().replaceAll("2'", '2')
    return alg.length > 0 ? alg : undefined
  } catch {
    return undefined
  }
}

async function pairOptimum(pattern: KPattern, slot: F2lSlot, actualMoves: number) {
  // Keep the solution, not just its length: "8 wasted turns, look for the shorter insert" is
  // the app describing an answer it already has. Showing the moves is the whole point.
  const solution = await optimalCrossPlusPairSolution(pattern, slot)
  if (solution === undefined || solution.length < 1 || solution.length > actualMoves) return undefined
  return solution
}

/**
 * The F2L case of a stage, taking acubemy's `detectF2LCase` lookahead (recorded in
 * docs/research/acubemy-solve-2026-08-04.md §82): when the state at stage entry is not one
 * of the catalogued cases — the pair's pieces are still buried in another slot, say — scan
 * forward through the stage's own moves for the first point at which it is one, instead of
 * leaving the stage unnamed. docs/research/acubemy-solve-2026-08-04.md §84 recorded the
 * absence of this fallback here as the one gap against that reference.
 *
 * The final move is excluded: by then the pair is placed, which is not a case.
 */
export async function f2lCaseOfStage(entryPattern: KPattern, slot: F2lSlot, segment: TimestampedMove[], frame: string, rotations: string[]) {
  const atEntry = await recognizeF2l(await framePattern(entryPattern, frame, rotations), slot)
  if (atEntry) return atEntry

  let pattern = entryPattern
  let seen = 0
  for (const entry of segment.slice(0, -1)) {
    pattern = pattern.applyAlg(entry.move)
    if (/^[xyz]/i.test(entry.move)) seen += 1
    const found = await recognizeF2l(await framePattern(pattern, frame, rotations.slice(seen)), slot)
    if (found) return found
  }
  return undefined
}

export function simplifyRotationEvents(events: TimestampedMove[]): TimestampedMove[] {
  const result: TimestampedMove[] = []
  let index = 0
  while (index < events.length) {
    if (!/^[xyz]/i.test(events[index].move)) {
      result.push(events[index])
      index += 1
      continue
    }
    let end = index
    while (end < events.length && /^[xyz]/i.test(events[end].move)) end += 1
    const run = events.slice(index, end)
    const simplified = simplifyRotations(run.map((entry) => entry.move).join(' ')).filter(Boolean)
    const timestamp = run[run.length - 1].timestamp
    for (const move of simplified) result.push({ move, timestamp })
    index = end
  }
  return result
}

// Full-sequence lookahead for locking the cross/F2L face. Mirrors acubemy's
// `getFirstSolvedF2LFace`: walk the whole solve once per candidate face and
// prefer the face on which the *complete* first-two-layers resolves
// earliest, rather than the first face on which the cross alone happens to
// complete. A cross-only match can pick the wrong face when a cross
// incidentally completes on the other layer before the real F2L-anchored
// face does. Falls back to the first cross-only hit (the previous
// behaviour) only when no candidate face's F2L ever resolves.
function lockCrossFace(seriesByFace: Map<string, ReturnType<typeof solveProgress>[]>, faceNames: string[]): string | undefined {
  const firstIndexAtLeast = (faceName: string, threshold: number) => {
    const index = seriesByFace.get(faceName)!.findIndex((entry) => entry.reached >= threshold)
    return index === -1 ? undefined : index
  }

  const f2lComplete = faceNames
    .map((name) => ({ name, index: firstIndexAtLeast(name, 5) }))
    .filter((candidate): candidate is { name: string; index: number } => candidate.index !== undefined)
  if (f2lComplete.length) return f2lComplete.reduce((best, candidate) => (candidate.index < best.index ? candidate : best)).name

  const crossOnly = faceNames
    .map((name) => ({ name, index: firstIndexAtLeast(name, 1) }))
    .filter((candidate): candidate is { name: string; index: number } => candidate.index !== undefined)
  return crossOnly.length ? crossOnly.reduce((best, candidate) => (candidate.index < best.index ? candidate : best)).name : undefined
}

// A stage closes at the first move whose application satisfies its predicate. One move can
// close several: an OLL skip is satisfied by the very move that finishes F2L, and a PLL skip
// by the move that finishes OLL. Limiting a move to one closure pushed the skipped stage onto
// the NEXT move, which then wore the skipped stage's name and swallowed a move that belongs
// to the stage after it.
export function computeStageCutIndices(reached: number[], stageCount: number): number[] {
  const cuts: number[] = []
  let nextStage = 0
  for (let index = 0; index < reached.length && nextStage < stageCount; index += 1) {
    while (nextStage < stageCount && reached[index] > nextStage) {
      cuts.push(index)
      nextStage += 1
    }
  }
  return cuts
}

/**
 * rebuild-spec §1.3: bucket each move into a stage by the midpoint between adjacent
 * stage timestamps.
 *
 * The reference needs this because its stage timings come from a *simulation* while the
 * reconstruction moves come from the recorded stream — two clocks that must be aligned,
 * and aligning them by nearest midpoint is what absorbs boundary jitter. This pipeline
 * derives stage timings from the very move stream it is bucketing (`reachedSeries` is
 * computed by applying each recorded move), so both clocks are one clock and the
 * midpoint boundary always falls inside the same gap the index cut sits in.
 *
 * That makes the rule an identity here rather than a no-op that was skipped, so it is
 * implemented as the actual assignment mechanism and pinned by a test. If stage timings
 * ever come from a separate simulation, this is already the correct code path.
 */
export function bucketMovesByStageMidpoints(events: TimestampedMove[], cuts: number[]): number[] {
  const boundaries = cuts.map((cut) => {
    const last = events[cut]
    const next = events[cut + 1]
    if (!last) return Number.POSITIVE_INFINITY
    if (!next) return last.timestamp
    return (last.timestamp + next.timestamp) / 2
  })
  return events.map((event) => boundaries.filter((boundary) => event.timestamp > boundary).length)
}

// rebuild-spec §1.3 boundary-jitter absorption was implemented and then REVERTED.
//
// Sliding a cut onto an adjacent rotation moved the 2nd-pair boundary of the reco.nz
// reconstruction (src/domain/realSolve.test.ts) from 18 to 19, disagreeing with a human
// reconstruction of that solve. The owner's own captures contain zero rotations, so the
// change looked harmless there and only real rotation-bearing data exposed it.
//
// The timestamp-midpoint bucketing that §1.3 actually specifies is implemented and
// proven equivalent in bucketMovesByStageMidpoints() above; the jitter heuristic was an
// addition on top of it, and it is not supported by the ground truth we have.

export async function segmentCfop(
  scramble: string,
  rawEvents: TimestampedMove[],
  solveId = 'preview'
): Promise<StageRecord[]> {
  const puzzle = await puzzles['3x3x3'].kpuzzle()
  const solved = puzzle.defaultPattern()
  let pattern = solved.applyAlg(scramble)
  let nextStage = 0
  let startEvent = 0
  let stageEntryPattern = pattern
  const startPattern = pattern
  const completedSlots: F2lSlot[] = []
  let stageFrame = ''
  const stages: StageRecord[] = []
  const events = simplifyRotationEvents(rawEvents)

  const faceNames = crossFaces.map((face) => face.name)
  const seriesByFace = new Map<string, ReturnType<typeof solveProgress>[]>()
  for (const face of crossFaces) {
    let scan = startPattern
    const series: ReturnType<typeof solveProgress>[] = []
    for (const event of events) {
      scan = scan.applyAlg(event.move)
      series.push(solveProgress(scan, solved, face.name))
    }
    seriesByFace.set(face.name, series)
  }

  const lockedCrossFace = lockCrossFace(seriesByFace, faceNames)
  const progressByIndex: Array<ReturnType<typeof solveProgress>> = lockedCrossFace
    ? seriesByFace.get(lockedCrossFace)!
    : events.map((_event, index) => {
        let best = seriesByFace.get(faceNames[0])![index]
        for (const name of faceNames.slice(1)) {
          const candidate = seriesByFace.get(name)![index]
          if (candidate.reached > best.reached) best = candidate
        }
        return best
      })

  /**
   * The last layer, decided from the cube itself and with no frame involved.
   *
   * Framing was the whole problem here: the stage frame turns the solve cross-down, a second
   * rotation was applied on top of it, and the two stages did not even agree on which side the
   * cross was — so the recogniser kept being pointed at the CROSS layer, finding it solved, and
   * calling every OLL and PLL a skip. The cross layer is the one whose four edges are home; the
   * last layer is the other one. Nothing else needs to be known.
   */
  const lastLayerRecognitionInput = (candidate: KPattern) => {
    const upright = reorientToSolvedCenters(candidate) ?? candidate
    const crossDown = [4, 5, 6, 7].every((index) => pieceMatches(upright, solved, 'EDGES', index))
    return { pattern: upright, lastLayer: (crossDown ? 'U' : 'D') as 'U' | 'D' }
  }

  const reachedSeries = progressByIndex.map((entry) => entry.reached)
  const cuts = computeStageCutIndices(reachedSeries, predicates.length - 1)
  const cutForStage = (stageIndex: number) => cuts[stageIndex] ?? -1

  for (const [eventIndex, event] of events.entries()) {
    pattern = pattern.applyAlg(event.move)
    const progress = progressByIndex[eventIndex]

    while (nextStage < predicates.length - 1 && cutForStage(nextStage) === eventIndex) {
      const segment = events.slice(startEvent, eventIndex + 1)
      const priorTimestamp = startEvent > 0 ? events[startEvent - 1].timestamp : events[0]?.timestamp ?? event.timestamp
      const firstTimestamp = firstNonTrivialMove(segment, lockedCrossFace)?.timestamp ?? segment[0]?.timestamp ?? event.timestamp
      const executionMs = Math.max(0, event.timestamp - firstTimestamp)
      const recognitionMs = Math.max(0, firstTimestamp - priorTimestamp)
      const rotations = segment.filter(({ move }) => /^[xyz]/i.test(move)).length
      const gaps = segment.map((entry, index) => ({
        after: index > 0 ? segment[index - 1].move : undefined,
        before: entry.move,
        ms: index > 0 ? entry.timestamp - segment[index - 1].timestamp : Math.max(0, entry.timestamp - priorTimestamp),
        index
      }))
      const pauses = gaps.filter(({ ms }) => ms >= 500).length
      const longest = gaps.reduce((worst, gap) => gap.ms > worst.ms ? gap : worst, { after: undefined as string | undefined, before: '', ms: 0, index: 0 })
      const rotationMs = gaps.filter(({ before }) => /^[xyz]/i.test(before)).reduce((total, gap) => total + gap.ms, 0)
      const stage = predicates[nextStage]
      const newSlot = stage.name.startsWith('F2L') ? progress.slots.find((slot) => !completedSlots.includes(slot)) : undefined
      if (newSlot) completedSlots.push(newSlot)
      if (segment.length - rotations === 0) {
        if (segment.length === 0) {
          const isPair = stage.name.startsWith('F2L')
          stages.push({
            id: `${solveId}:${stage.name.toLowerCase().replaceAll(' ', '-')}`,
            solveId,
            method: 'CFOP',
            name: stage.name,
            startEvent,
            firstMoveEvent: startEvent,
            endEvent: eventIndex,
            recognitionMs: 0,
            executionMs: 0,
            moveCount: 0,
            rotationCount: 0,
            pauseCount: 0,
            longestPauseMs: 0,
            rotationMs: 0,
            tps: undefined,
            caseId: isPair ? 'f2l-free' : `${stage.name.toLowerCase()}-skip`,
            caseName: isPair ? 'Free pair' : `${stage.name} skip`,
            slot: newSlot,
            confidence: 1,
            notation: ''
          })
        }
        nextStage += 1
        stageEntryPattern = pattern
        stageFrame = progress.frame
      } else {
        const stageRotations = segment.filter(({ move }) => /^[xyz]/i.test(move)).map(({ move }) => move)
        const framed = stageFrame ? stageEntryPattern.applyAlg(new Alg(stageFrame).invert()) : stageEntryPattern
        const canonicalEntry = framed
        const framedEntry = newSlot
          ? await framePattern(stageEntryPattern, progress.frame, stageRotations)
          : undefined
        // F2L stages cost the most time, and until now they carried a slot but no case, so
        // the row could say "F2L 2 took 2.5s" and nothing about what it was.
        const recognized = stage.name === 'OLL'
          ? await (async () => {
              const { pattern, lastLayer } = lastLayerRecognitionInput(stageEntryPattern)
              return recognizeOll(pattern, lastLayer)
            })()
          : stage.name === 'PLL'
            ? await (async () => {
                const { pattern, lastLayer } = lastLayerRecognitionInput(stageEntryPattern)
                return recognizePll(pattern, lastLayer)
              })()
            : newSlot
              ? await f2lCaseOfStage(stageEntryPattern, newSlot, segment, progress.frame, stageRotations)
              : undefined
        const optimalPair = newSlot && framedEntry
          ? await pairOptimum(framedEntry, newSlot, segment.length - stageRotations.length)
          : undefined
        // Which pair the solver SHOULD have gone for. Every slot still unsolved at this point
        // is scored from the same position, so "you took a 14-move insert when the back-right
        // pair was a 6" is answerable — the single most useful thing a CFOP coach says.
        const freeSlots = newSlot
          ? (['FR', 'FL', 'BR', 'BL'] as const).filter((slot) => !completedSlots.includes(slot) || slot === newSlot)
          : []
        const betterSlot = newSlot && framedEntry && freeSlots.length > 1
          ? betterSlotThan(newSlot, await scoreSlots(framedEntry, [...freeSlots]))
          : undefined
        const optimalMoveCount = stage.name === 'Cross'
          ? await optimalCrossMovesInFrame(startPattern, progress.frame, stageRotations)
          : newSlot
            ? optimalPair?.moves.length
            : recognized?.repertoireMoves

        stages.push({
          id: `${solveId}:${stage.name.toLowerCase().replaceAll(' ', '-')}`,
          solveId,
          method: 'CFOP',
          name: stage.name,
          startEvent,
          firstMoveEvent: startEvent,
          endEvent: eventIndex,
          recognitionMs,
          executionMs,
          moveCount: segment.length - rotations,
          rotationCount: rotations,
          pauseCount: pauses,
          longestPauseMs: Math.round(longest.ms),
          longestPauseAfter: longest.after,
          longestPauseBefore: longest.ms > 0 ? longest.before : undefined,
          rotationMs: Math.round(rotationMs),
          // undefined, not 0: an untimed stage must dash, not claim zero turns per second.
          tps: executionMs > 0 ? (segment.length - rotations) / (executionMs / 1000) : undefined,
          caseId: recognized?.id,
          caseName: recognized?.name,
          // The position, not the route to it. Replaying scramble-plus-every-move printed the
          // solver's whole history back at them — including their own fumbling — where what
          // they need is a short alg that puts the same case in front of them.
          setupAlg: setupAlgFor(stageEntryPattern),
          slot: newSlot,
          slotColours: newSlot && framedEntry ? slotColoursFromPattern(framedEntry, newSlot) : undefined,
          optimalMoveCount,
          optimalMoves: optimalPair?.moves,
          betterSlot: betterSlot && { slot: betterSlot.best.slot, moves: betterSlot.best.moves, saved: betterSlot.saved },
          betterSlotColours: betterSlot && framedEntry ? slotColoursFromPattern(framedEntry, betterSlot.best.slot) : undefined,
          frame: progress.frame,
          confidence: 1,
          notation: recoveredNotation(segment.map((entry) => entry.move))
        })

        startEvent = eventIndex + 1
        nextStage += 1
        stageEntryPattern = pattern
        stageFrame = progress.frame
      }
    }

    const solvedNow = reorientToSolvedCenters(pattern)?.isIdentical(solved) ?? false
    if (solvedNow && !stages.some((stage) => stage.name === 'AUF') && startEvent <= eventIndex) {
      const start = startEvent
      const segment = events.slice(start, eventIndex + 1)
      const priorTimestamp = start > 0 ? events[start - 1].timestamp : events[0]?.timestamp ?? event.timestamp
      const aufExecutionMs = Math.max(0, event.timestamp - (segment[0]?.timestamp ?? event.timestamp))
      stages.push({
        id: `${solveId}:auf`,
        solveId,
        method: 'CFOP',
        name: 'AUF',
        startEvent: start,
        firstMoveEvent: start,
        endEvent: eventIndex,
        recognitionMs: Math.max(0, (segment[0]?.timestamp ?? event.timestamp) - priorTimestamp),
        executionMs: aufExecutionMs,
        moveCount: segment.length,
        rotationCount: 0,
        pauseCount: 0,
        tps: aufExecutionMs > 0 ? segment.length / (aufExecutionMs / 1000) : undefined,
        confidence: 1,
        notation: recoveredNotation(segment.map((entry) => entry.move))
      })
    }
  }

  const catastrophic = stages.some((stage) => stagePlausibility(stage) <= CATASTROPHIC_PLAUSIBILITY)
  return stages.map((stage) => ({
    ...stage,
    confidence: catastrophic ? Math.min(0.2, stagePlausibility(stage)) : stagePlausibility(stage)
  }))
}

/**
 * rebuild-spec §1.5: execution starts at the first move that is not undone later in the
 * segment and is not a quick probing turn on the face opposite the cross.
 *
 * The previous rule skipped the opposite face outright and only looked one move ahead
 * for a cancellation, so a deliberate AUF that began the execution was misread as
 * recognition, and a turn undone three moves later still counted as the start.
 */
const EXECUTION_GAP_THRESHOLD_MS = 400

function undoneLaterInSegment(segment: TimestampedMove[], index: number) {
  const face = segment[index].move[0]
  let net = quarterTurns(segment[index].move)
  for (let ahead = index + 1; ahead < segment.length; ahead += 1) {
    const move = segment[ahead].move
    if (/[xyz]/i.test(move[0])) continue
    if (move[0] !== face) break
    net = (net + quarterTurns(move)) % 4
    if (net === 0) return true
  }
  return false
}

function firstNonTrivialMove(segment: TimestampedMove[], crossFace: string | undefined) {
  const auf = crossFace === 'U' ? 'D' : 'U'
  for (const [index, entry] of segment.entries()) {
    const face = entry.move[0]
    if (/[xyz]/i.test(face)) continue
    if (undoneLaterInSegment(segment, index)) continue
    // An opposite-face turn is a probe only when the next move follows straight after
    // it; one held for longer than the threshold is the solver already executing.
    if (face === auf) {
      const next = segment[index + 1]
      if (next && next.timestamp - entry.timestamp < EXECUTION_GAP_THRESHOLD_MS) continue
    }
    return entry
  }
  return undefined
}

const quarterTurns = (move: string) => move.endsWith('2') ? 2 : move.endsWith("'") ? 3 : 1

const cancels = (first: string, second: string) => {
  const quarter = (move: string) => move.endsWith('2') ? 2 : move.endsWith("'") ? 3 : 1
  return (quarter(first) + quarter(second)) % 4 === 0
}

// Per-stage CFOP-fit plausibility. This project has no calibration data yet
// (no accumulated solve history to fit a real distribution against, see
// docs/research/acubemy-solve-2026-08-04.md #3), so these bounds are NOT
// measured from this project's users. They are sourced from two things we
// do have:
//   - OLL/PLL `typical` come directly from this repo's own
//     `algorithmCatalogue.ts`: the move counts across all 57 catalogued OLL
//     algorithms (6-15 moves) and all 21 catalogued PLL algorithms (7-21).
//     These are execution-only algorithm lengths; they do not budget extra
//     AUF/setup turns.
//   - OLL/PLL `generous` budgets the two-look path from the same catalogue,
//     because a 20-30s solver two-looks both stages and a one-look bound
//     discards their solves outright. Two-look OLL is an edge-orientation alg
//     then an OCLL alg: max EOLL (12, `eollCases`) + max OCLL (11, OLL 21-27
//     in `ollCases`) = 23. Two-look PLL is a corner perm then an edge perm:
//     max corner (18, E perm) + max edge (10, Z perm) = 28. Measured against
//     src/device/fixtures/user-sessions/cube-session-QY-QYSC-S-23C0-2026-08-03T08-31-36.json,
//     a real 25.6s solve whose 17-move OLL and 18-move PLL were being rejected
//     as implausible and dropped from the user's averages.
//   - Cross/F2L `generous` (20) is Rokicki et al.'s "God's Number": no
//     optimal solve of a 3x3x3 needs more than 20 face turns, so no single
//     stage of one can need more either. `typical` (8/9) is the commonly
//     cited average cross/F2L-pair length for an intermediate CFOP solver.
// A stage's plausibility decays linearly from 1 (at or below `typical`) to a
// floor once it reaches `generous`; it is intentionally one-sided (a short
// or zero-move stage is never penalised) because OLL/PLL skips and X-crosses
// are common, legitimate, short stages, not signs of a bad segmentation --
// only a stage that runs unusually long is evidence of a bad boundary.
// To replace this with real calibration, swap `STAGE_MOVE_EXPECTATION`'s
// `{typical, generous}` shape for a `{mean, stddev}` shape computed from this
// project's own accumulated solves, and change `stagePlausibility` to score
// a Gaussian density instead of a linear ramp; every caller of
// `stagePlausibility` stays the same.
const STAGE_MOVE_EXPECTATION: Record<string, { typical: number; generous: number }> = {
  Cross: { typical: 8, generous: 20 },
  'F2L 1': { typical: 9, generous: 20 },
  'F2L 2': { typical: 9, generous: 20 },
  'F2L 3': { typical: 9, generous: 20 },
  'F2L 4': { typical: 9, generous: 20 },
  OLL: { typical: 10, generous: 23 },
  PLL: { typical: 13, generous: 28 }
}

const IMPLAUSIBLE_STAGE_FLOOR = 0.1
const CATASTROPHIC_PLAUSIBILITY = 0.1

// Per-stage move-count distribution, described in docs/research/acubemy-solve-2026-08-04.md
// §3 from reading acubemy's shipped analyzer. Scoring each stage against its own
// distribution is the point: a one-move OLL is implausible for OLL and says nothing
// about the cross, so the penalty stays local instead of condemning the whole solve.
const STAGE_DISTRIBUTION: Record<string, { mean: number; deviation: number }> = {
  Cross: { mean: 7.23, deviation: 3.85 },
  'F2L 1': { mean: 8.21, deviation: 4.5 },
  'F2L 2': { mean: 8.23, deviation: 4.38 },
  'F2L 3': { mean: 8.26, deviation: 4.28 },
  'F2L 4': { mean: 8.33, deviation: 3.93 },
  OLL: { mean: 9.93, deviation: 4.78 },
  PLL: { mean: 11.8, deviation: 3.58 }
}

function stagePlausibility(stage: StageRecord): number {
  const distribution = STAGE_DISTRIBUTION[stage.name]
  if (!distribution || stage.moveCount === 0) return 1

  // Two-sided, unlike the move-count ceiling this replaces: that scored a one-move OLL
  // as a perfect fit because it only ever penalised stages for being too long, which is
  // why an OLL that never happened and an eighteen-move F2L pair both passed unnoticed.
  const z = (stage.moveCount - distribution.mean) / distribution.deviation
  const likelihood = Math.exp(-0.5 * z * z)
  return Math.max(IMPLAUSIBLE_STAGE_FLOOR, likelihood)
}
