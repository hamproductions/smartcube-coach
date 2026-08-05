// Ported from Dave2ooo/F2LTrainer (https://github.com/Dave2ooo/F2LTrainer)
// Source: src/lib/types/caseAttributes.ts
//
// Upstream keys this taxonomy to F2LTrainer's own numeric case ids inside
// group buckets ('basic' | 'basicBack' | 'advanced' | 'expert'), a case-id
// space this app does not share. The taxonomy itself (the four attributes,
// their value sets, and the position/orientation semantics behind them) is
// copied verbatim; the per-id lookup table is replaced with a classifier
// computed directly from the resulting KPattern, using the same piece and
// orientation math as the upstream F2L_SLOTS/isSlotSolved checks, so it can
// classify any case in this app's own F2L catalogue.

import type { KPattern } from 'cubing/kpuzzle'

export type CornerPosition = 'top' | 'bottom_correct' | 'bottom_wrong'
export type CornerOrientation = 'up_down' | 'front_back' | 'side'
export type EdgePosition = 'top' | 'solved_slot' | 'wrong_slot'
export type EdgeOrientation = 'oriented' | 'unoriented'

export interface CaseAttributes {
  cornerPosition: CornerPosition
  cornerOrientation: CornerOrientation
  edgePosition: EdgePosition
  edgeOrientation: EdgeOrientation
}

export type CaseAttributeSlot = 'fr' | 'fl' | 'br' | 'bl'

const F2L_SLOTS: Record<CaseAttributeSlot, { edge: number; corner: number }> = {
  fr: { edge: 8, corner: 4 },
  fl: { edge: 9, corner: 5 },
  br: { edge: 10, corner: 7 },
  bl: { edge: 11, corner: 6 }
}

const BOTTOM_CORNER_INDICES = [4, 5, 6, 7]
const F2L_SLOT_EDGE_INDICES = [8, 9, 10, 11]

function classifyCornerPosition(corners: { pieces: number[] }, cornerIndex: number): CornerPosition {
  const currentIndex = corners.pieces.indexOf(cornerIndex)
  if (currentIndex === cornerIndex) return 'bottom_correct'
  if (BOTTOM_CORNER_INDICES.includes(currentIndex)) return 'bottom_wrong'
  return 'top'
}

function classifyCornerOrientation(corners: { pieces: number[]; orientation: number[] }, cornerIndex: number): CornerOrientation {
  const currentIndex = corners.pieces.indexOf(cornerIndex)
  const twist = corners.orientation[currentIndex]
  if (twist === 1) return 'front_back'
  if (twist === 2) return 'side'
  return 'up_down'
}

function classifyEdgePosition(edges: { pieces: number[] }, edgeIndex: number): EdgePosition {
  const currentIndex = edges.pieces.indexOf(edgeIndex)
  if (currentIndex === edgeIndex) return 'solved_slot'
  if (F2L_SLOT_EDGE_INDICES.includes(currentIndex)) return 'wrong_slot'
  return 'top'
}

function classifyEdgeOrientation(edges: { pieces: number[]; orientation: number[] }, edgeIndex: number): EdgeOrientation {
  const currentIndex = edges.pieces.indexOf(edgeIndex)
  return edges.orientation[currentIndex] === 0 ? 'oriented' : 'unoriented'
}

export function classifyCaseAttributes(pattern: KPattern, slot: CaseAttributeSlot): CaseAttributes {
  const corners = pattern.patternData.CORNERS
  const edges = pattern.patternData.EDGES
  const { edge, corner } = F2L_SLOTS[slot]
  return {
    cornerPosition: classifyCornerPosition(corners, corner),
    cornerOrientation: classifyCornerOrientation(corners, corner),
    edgePosition: classifyEdgePosition(edges, edge),
    edgeOrientation: classifyEdgeOrientation(edges, edge)
  }
}

export function matchesCaseAttributes(attributes: CaseAttributes, filter: Partial<CaseAttributes>): boolean {
  return (Object.keys(filter) as Array<keyof CaseAttributes>).every((key) => filter[key] === undefined || filter[key] === attributes[key])
}
