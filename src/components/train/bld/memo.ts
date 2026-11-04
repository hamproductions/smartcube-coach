import { validateCornerMemo, validateMemo, type BldDrill } from '../../../domain/bld'

export type StepId = 'edges' | 'corners' | 'parity' | 'flips' | 'twists'
export type StepInput = 'keyboard' | 'pointer'
export type StepAnswer = { value: string; at: number; input: StepInput }
export type Answers = Partial<Record<StepId, StepAnswer>>

export type Step = { id: StepId; label: string; short: string; kind: 'memo' | 'yes-no' | 'count'; max?: number }

export const STEPS: Step[] = [
  { id: 'edges', label: 'Edge memo', short: 'Edges', kind: 'memo' },
  { id: 'corners', label: 'Corner memo', short: 'Corners', kind: 'memo' },
  { id: 'parity', label: 'Parity', short: 'Parity', kind: 'yes-no' },
  { id: 'flips', label: 'Flipped edges', short: 'Flips', kind: 'count', max: 12 },
  { id: 'twists', label: 'Twisted corners', short: 'Twists', kind: 'count', max: 8 }
]

export type Part = { id: StepId; label: string; yours: string; correct: string; right: boolean }

export const lettersOnly = (input: string) => input.replaceAll(/[^a-z]/gi, '').toUpperCase()

export function toPairs(input: string) {
  return lettersOnly(input).match(/.{1,2}/g) ?? []
}

export const yesNo = (value: boolean) => (value ? 'Yes' : 'No')

export function parseCount(input: string, max: number) {
  const trimmed = input.trim()
  if (!/^\d{1,2}$/.test(trimmed)) return undefined
  const value = Number(trimmed)
  return value <= max ? value : undefined
}

export function gradeParts(drill: BldDrill, answers: Answers): Part[] {
  const value = (id: StepId) => answers[id]?.value ?? ''
  return [
    { id: 'edges', label: 'Edge memo', yours: toPairs(value('edges')).join(' '), correct: drill.memo, right: validateMemo(drill, value('edges')) },
    { id: 'corners', label: 'Corner memo', yours: toPairs(value('corners')).join(' '), correct: drill.cornerMemo, right: validateCornerMemo(drill, value('corners')) },
    { id: 'parity', label: 'Parity', yours: value('parity'), correct: yesNo(drill.parity), right: value('parity') === yesNo(drill.parity) },
    { id: 'flips', label: 'Flipped edges', yours: value('flips'), correct: String(drill.flippedEdges), right: Number(value('flips')) === drill.flippedEdges && value('flips') !== '' },
    { id: 'twists', label: 'Twisted corners', yours: value('twists'), correct: String(drill.twistedCorners), right: Number(value('twists')) === drill.twistedCorners && value('twists') !== '' }
  ]
}

const EDGE_PIECES = ['UR', 'UF', 'UL', 'UB', 'DR', 'DF', 'DL', 'DB', 'FR', 'FL', 'BL', 'BR']
const CORNER_PIECES = ['URF', 'UFL', 'ULB', 'UBR', 'DFR', 'DLF', 'DBL', 'DRB']

export function bufferPieces(drill: BldDrill) {
  const index = drill.letterScheme.indexOf(drill.buffer)
  const edge = EDGE_PIECES[Math.floor(index / 2)]
  const corner = CORNER_PIECES[Math.floor(index / 3)]
  return { edge, edgeSticker: edge[index % 2], corner, cornerSticker: corner[index % 3] }
}

export const formatSeconds = (ms: number) => (ms / 1000).toFixed(1)
