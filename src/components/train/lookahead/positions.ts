import type { ColorInferencePrompt } from '../../../domain/cognitive'

export type PositionCell = { id: string; row: number; col: number }
export type PositionLayer = { name: string; centre?: string; cells: PositionCell[] }

const cell = (id: string, row: number, col: number): PositionCell => ({ id, row, col })

export const EDGE_LAYERS: PositionLayer[] = [
  { name: 'Top layer', centre: 'U', cells: [cell('UB', 0, 1), cell('UL', 1, 0), cell('UR', 1, 2), cell('UF', 2, 1)] },
  { name: 'Middle layer', cells: [cell('BL', 0, 0), cell('BR', 0, 2), cell('FL', 2, 0), cell('FR', 2, 2)] },
  { name: 'Bottom layer', centre: 'D', cells: [cell('DB', 0, 1), cell('DL', 1, 0), cell('DR', 1, 2), cell('DF', 2, 1)] }
]

export const CORNER_LAYERS: PositionLayer[] = [
  { name: 'Top layer', centre: 'U', cells: [cell('ULB', 0, 0), cell('UBR', 0, 2), cell('UFL', 2, 0), cell('URF', 2, 2)] },
  { name: 'Bottom layer', centre: 'D', cells: [cell('DBL', 0, 0), cell('DRB', 0, 2), cell('DLF', 2, 0), cell('DFR', 2, 2)] }
]

export const CHOICE_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '=']

export const layerIds = (layers: PositionLayer[]) => layers.flatMap((layer) => layer.cells.map((position) => position.id))

export const PAIR_SLOT: Record<string, string> = { 'URF + FR': 'front right', 'UFL + FL': 'front left', 'ULB + BL': 'back left', 'UBR + BR': 'back right' }

export const COLOURS = ['White', 'Yellow', 'Green', 'Blue', 'Red', 'Orange'] as const
export type Colour = (typeof COLOURS)[number]

const CORNER_CYCLES: Colour[][] = [
  ['White', 'Green', 'Red'], ['White', 'Red', 'Blue'], ['White', 'Blue', 'Orange'], ['White', 'Orange', 'Green'],
  ['Yellow', 'Red', 'Green'], ['Yellow', 'Blue', 'Red'], ['Yellow', 'Orange', 'Blue'], ['Yellow', 'Green', 'Orange']
]

function hash(seed: string) {
  let value = 2166136261
  for (const character of seed) value = Math.imul(value ^ character.charCodeAt(0), 16777619)
  return value >>> 0
}

export type CornerSticker = { colour: Colour; hidden: boolean }

export function cornerStickers(prompt: ColorInferencePrompt): CornerSticker[] {
  const colours = [...prompt.visible, prompt.answer]
  const cycle = CORNER_CYCLES.find((candidate) => colours.every((colour) => candidate.includes(colour as Colour)))
  if (!cycle) throw new Error(`No corner has ${colours.join(', ')}`)
  const turn = hash(`${prompt.seed}:view`) % 3
  return [0, 1, 2].map((index) => {
    const colour = cycle[(index + turn) % 3]
    return { colour, hidden: colour === prompt.answer }
  })
}
