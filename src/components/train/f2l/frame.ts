import { Alg } from 'cubing/alg'
import type { KPattern, KPuzzle } from 'cubing/kpuzzle'
import { cube3x3x3 } from 'cubing/puzzles'
import type { StickerColor } from '../../ui/LastLayerDiagram'
import { holdPermutation, viewRotationForHold } from '../../../domain/cubeHold'
import { remapMoveForPlayer } from '../../../domain/cubedex/smartcubeParity'
import { faceTurnsOnly } from '../../../domain/faceTurnsOnly'
import { reorientToSolvedCenters } from '../../../domain/lastLayer'
import { isF2LSolved } from '../../../domain/drillEngine'
import { defaultPreferences, readPreferences } from '../../../storage/preferences'

export type Hold = { rotation: string; top: StickerColor; front: StickerColor }

export const holdFor = (top: StickerColor, front: StickerColor): Hold => ({ rotation: viewRotationForHold(top, front), top, front })

export const DEFAULT_HOLD = holdFor(defaultPreferences.diagramTopColor, defaultPreferences.diagramFrontColor)

export async function readHold(): Promise<Hold> {
  const prefs = await readPreferences()
  return holdFor(prefs.diagramTopColor, prefs.diagramFrontColor)
}

export const toSolverMove = (move: string, rotation: string) => remapMoveForPlayer(move, holdPermutation(rotation))

export function solverPattern(puzzle: KPuzzle, cubePattern: KPattern, rotation: string): KPattern {
  if (!rotation) return cubePattern
  const transformation = cubePattern.experimentalToTransformation()
  if (!transformation) return cubePattern
  return reorientToSolvedCenters(puzzle.defaultPattern().applyAlg(new Alg(rotation).invert()).applyTransformation(transformation)) ?? cubePattern
}

export function faceMoves(alg: string): string[] {
  const folded = faceTurnsOnly(alg.replace(/[()]/g, ' ')).moves.join(' ')
  if (!folded) return []
  return new Alg(folded).experimentalSimplify({ cancel: true, puzzleLoader: cube3x3x3 }).toString().replace(/2'/g, '2').split(/\s+/).filter(Boolean)
}

export const invertMove = (move: string) => move.endsWith('2') ? move : move.endsWith("'") ? move.slice(0, -1) : `${move}'`

export const f2lSolved = (pattern: KPattern) => isF2LSolved(pattern.patternData.CORNERS, pattern.patternData.EDGES, undefined)
