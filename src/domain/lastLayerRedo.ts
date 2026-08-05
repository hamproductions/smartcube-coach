import { Alg } from 'cubing/alg'
import { puzzles } from 'cubing/puzzles'
import { ollCases, pllCases } from './algorithmCatalogue'
import type { SolveRecord, StageRecord } from './models'

export type LastLayerRedo = {
  stage: 'OLL' | 'PLL'
  caseName: string
  setup: string
  yours: string
  trained: string
  preAuf: string
  yourMoves: number
  trainedMoves: number
  saved: number
}

const aufs = ['', 'U', 'U2', "U'"]

export async function buildLastLayerRedo(
  solve: Pick<SolveRecord, 'scramble' | 'moves'>,
  stage: StageRecord
): Promise<LastLayerRedo | undefined> {
  if (stage.name !== 'OLL' && stage.name !== 'PLL') return undefined
  if (!stage.caseId || stage.caseId.endsWith('skip')) return undefined
  const entry = [...ollCases, ...pllCases].find((item) => item.id === stage.caseId)
  if (!entry) return undefined

  const puzzle = await puzzles['3x3x3'].kpuzzle()
  const solved = puzzle.defaultPattern()
  const before = solve.moves.slice(0, stage.startEvent)
  const yours = solve.moves.slice(stage.startEvent, stage.endEvent + 1)
  const setup = [solve.scramble, ...before].filter(Boolean).join(' ')
  const start = solved.applyAlg(new Alg(setup))
  const frame = stage.frame ? new Alg(stage.frame).invert() : undefined
  const transformation = start.experimentalToTransformation()
  const framed = frame && transformation ? solved.applyAlg(frame).applyTransformation(transformation) : start

  const satisfied = (pattern: typeof framed) => stage.name === 'OLL'
    ? [0, 1, 2, 3].every((index) => pattern.patternData.EDGES.orientation[index] === 0) &&
      [0, 1, 2, 3].every((index) => pattern.patternData.CORNERS.orientation[index] === 0)
    : aufs.some((auf) => pattern.applyAlg(auf).isIdentical(solved))

  const preAuf = aufs.find((auf) => satisfied(framed.applyAlg(new Alg([auf, entry.algorithm].filter(Boolean).join(' ')))))
  if (preAuf === undefined) return undefined

  const trained = [preAuf, entry.algorithm].filter(Boolean).join(' ')
  const yourMoves = yours.filter((move) => !/^[xyz]/i.test(move)).length
  const trainedMoves = trained.split(/\s+/).filter(Boolean).filter((move) => !/^[xyz]/i.test(move)).length

  return {
    stage: stage.name,
    caseName: stage.caseName ?? entry.name,
    setup,
    yours: yours.join(' '),
    trained,
    preAuf: preAuf || 'none',
    yourMoves,
    trainedMoves,
    saved: Math.max(0, yourMoves - trainedMoves)
  }
}
