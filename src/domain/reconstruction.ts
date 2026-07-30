import { puzzles } from 'cubing/puzzles'
import type { KPattern } from 'cubing/kpuzzle'
import type { StageRecord } from './models'

export type TimestampedMove = {
  move: string
  timestamp: number
}

type StagePredicate = {
  name: string
  satisfied: (pattern: KPattern, solved: KPattern) => boolean
}

const pieceSolved = (pattern: KPattern, orbit: 'EDGES' | 'CORNERS', index: number) => {
  const data = pattern.patternData[orbit]
  return data.pieces[index] === index && data.orientation[index] === 0
}

const crossSolved = (pattern: KPattern) => [4, 5, 6, 7].every((index) => pieceSolved(pattern, 'EDGES', index))

const f2lPairs = (pattern: KPattern) => [
  [4, 8],
  [5, 9],
  [6, 11],
  [7, 10]
].filter(([corner, edge]) => pieceSolved(pattern, 'CORNERS', corner) && pieceSolved(pattern, 'EDGES', edge)).length

const ollSolved = (pattern: KPattern) =>
  [0, 1, 2, 3].every((index) => pattern.patternData.EDGES.orientation[index] === 0) &&
  [0, 1, 2, 3].every((index) => pattern.patternData.CORNERS.orientation[index] === 0)

const pllSolved = (pattern: KPattern, solved: KPattern) =>
  ['', 'U', 'U2', "U'"].some((auf) => pattern.applyAlg(auf).isIdentical(solved))

const predicates: StagePredicate[] = [
  { name: 'Cross', satisfied: (pattern) => crossSolved(pattern) },
  { name: 'F2L 1', satisfied: (pattern) => f2lPairs(pattern) >= 1 },
  { name: 'F2L 2', satisfied: (pattern) => f2lPairs(pattern) >= 2 },
  { name: 'F2L 3', satisfied: (pattern) => f2lPairs(pattern) >= 3 },
  { name: 'F2L 4', satisfied: (pattern) => f2lPairs(pattern) >= 4 },
  { name: 'OLL', satisfied: (pattern) => ollSolved(pattern) },
  { name: 'PLL', satisfied: pllSolved },
  { name: 'AUF', satisfied: (pattern, solved) => pattern.isIdentical(solved) }
]

export async function segmentCfop(
  scramble: string,
  events: TimestampedMove[],
  solveId = 'preview'
): Promise<StageRecord[]> {
  const puzzle = await puzzles['3x3x3'].kpuzzle()
  const solved = puzzle.defaultPattern()
  let pattern = solved.applyAlg(scramble)
  let nextStage = 0
  let startEvent = 0
  const stages: StageRecord[] = []

  for (const [eventIndex, event] of events.entries()) {
    pattern = pattern.applyAlg(event.move)

    while (nextStage < predicates.length && predicates[nextStage].satisfied(pattern, solved)) {
      const segment = events.slice(startEvent, eventIndex + 1)
      const priorTimestamp = startEvent > 0 ? events[startEvent - 1].timestamp : 0
      const firstTimestamp = segment[0]?.timestamp ?? event.timestamp
      const executionMs = Math.max(0, event.timestamp - firstTimestamp)
      const recognitionMs = Math.max(0, firstTimestamp - priorTimestamp)
      const rotations = segment.filter(({ move }) => /^[xyz]/i.test(move)).length
      const pauses = segment.filter(({ timestamp }, index) => index > 0 && timestamp - segment[index - 1].timestamp >= 500).length
      const activeMs = Math.max(1, event.timestamp - priorTimestamp)

      stages.push({
        id: `${solveId}:${predicates[nextStage].name.toLowerCase().replaceAll(' ', '-')}`,
        solveId,
        method: 'CFOP',
        name: predicates[nextStage].name,
        startEvent,
        firstMoveEvent: startEvent,
        endEvent: eventIndex,
        recognitionMs,
        executionMs,
        moveCount: segment.length - rotations,
        rotationCount: rotations,
        pauseCount: pauses,
        tps: (segment.length - rotations) / (activeMs / 1000),
        confidence: 1
      })

      startEvent = eventIndex + 1
      nextStage += 1
    }
  }

  return stages
}
