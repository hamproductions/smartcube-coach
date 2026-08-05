import type { KPattern } from 'cubing/kpuzzle'

/**
 * Which two colours a slot is, read from the cube itself.
 *
 * `FR`, `BL` and the rest are named in the frame the analysis works in, and that frame is not
 * the one the solver holds — so "the BL pair" names nothing they can see. The two side colours
 * are absolute: the same pair of stickers whichever way the cube is turned.
 *
 * Derived the way Ao1K derives it (`Ao1K_site/composables/recon/SimpleCubeInterpreter.tsx`
 * #getF2LPairDirections, line 2047): take the colours from the cube's own state and map them
 * through the scheme, rather than pushing a slot label through a rotation permutation. An
 * earlier attempt did the latter and could not be verified; the centres answer it directly.
 */

/**
 * The CENTERS orbit is ordered U, L, F, R, B, D — confirmed by rotating a solved cube and
 * reading the orbit back, not assumed. Piece n is the centre whose home is face n, so its
 * colour is that face's colour.
 */
const CENTRE_COLOUR = [
  { name: 'white', hex: '#f7f9fc' },
  { name: 'orange', hex: '#ff5900' },
  { name: 'green', hex: '#009b48' },
  { name: 'red', hex: '#b90000' },
  { name: 'blue', hex: '#0051ba' },
  { name: 'yellow', hex: '#ffd500' }
] as const

const FACE_INDEX = { U: 0, L: 1, F: 2, R: 3, B: 4, D: 5 } as const

const SLOT_FACES: Record<string, [keyof typeof FACE_INDEX, keyof typeof FACE_INDEX]> = {
  FR: ['F', 'R'],
  FL: ['F', 'L'],
  BL: ['B', 'L'],
  BR: ['B', 'R']
}

export type SlotColour = { name: string; hex: string }

/**
 * The slot's two side colours in the frame the pattern is expressed in. The centre sitting on
 * each face says what colour that face is, so nothing has to be inferred about orientation.
 */
export function slotColoursFromPattern(pattern: KPattern, slot: string): SlotColour[] | undefined {
  const faces = SLOT_FACES[slot]
  if (!faces) return undefined
  const centres = pattern.patternData.CENTERS?.pieces
  if (!centres) return undefined

  const colours = faces.map((face) => CENTRE_COLOUR[centres[FACE_INDEX[face]]])
  if (colours.some((colour) => colour === undefined)) return undefined
  return colours.map((colour) => ({ name: colour.name, hex: colour.hex }))
}
