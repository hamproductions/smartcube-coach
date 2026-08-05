import type { StickerColor } from '../components/ui/LastLayerDiagram'
import { composePerm, IDENTITY, SLICE_ROTATION, type FacePerm } from './cubedex/smartcubeParity'

/**
 * How to turn the cube so the solver's own hold is what they see.
 *
 * Ported from f2ltrainer (src/lib/types/rotation.ts): the alg that takes the standard
 * orientation to "this colour on the bottom, this one facing you". Applied AFTER the moves,
 * as a view rotation — putting it before would reinterpret every reported move in a rotated
 * frame, which is a different cube.
 */
const ROTATION_ALG: Record<StickerColor, Partial<Record<StickerColor, string>>> = {
  yellow: { red: 'y', orange: "y'", blue: 'y2', green: '', yellow: '', white: '' },
  white: { red: "z2 y'", orange: 'z2 y', blue: 'z2 y2', green: 'z2', yellow: '', white: '' },
  red: { green: 'z', blue: 'z y2', white: 'z y', yellow: "z y'", red: '', orange: '' },
  orange: { green: "z'", blue: "z' y2", white: "z' y'", yellow: "z' y", red: '', orange: '' },
  green: { red: "x' y", orange: "x' y'", white: "x'", yellow: "x' y2", green: '', blue: '' },
  blue: { red: 'x y', orange: "x y'", white: 'x y2', yellow: 'x', green: '', blue: '' }
}

/**
 * `crossColor` is the colour the solver keeps on the BOTTOM, `frontColor` the one facing
 * them. The app stores the hold as top/front, so the cross colour is the top's opposite.
 */
const OPPOSITE: Record<StickerColor, StickerColor> = {
  white: 'yellow', yellow: 'white', green: 'blue', blue: 'green', red: 'orange', orange: 'red'
}

export function viewRotationForHold(topColor: StickerColor, frontColor: StickerColor) {
  return ROTATION_ALG[OPPOSITE[topColor]]?.[frontColor] ?? ''
}

/**
 * The face permutation a hold's rotation applies.
 *
 * Needed because the rotation goes at the START of the player's setup alg — so every move
 * appended afterwards has to be expressed in the rotated frame. Putting the rotation at the
 * end instead forces a full re-parse per move, and the cube falls behind the solver's hands.
 */
export function holdPermutation(rotationAlg: string): FacePerm {
  return rotationAlg
    .split(/\s+/)
    .filter(Boolean)
    .reduce((perm, token) => {
      const rotation = SLICE_ROTATION[token]
      // rotation first: the tokens apply left to right, so each one acts on the frame the
      // previous ones produced. Folding the other way is identical for a single token —
      // which is why a z2 hold looked correct — and wrong for every two-token rotation.
      return rotation ? composePerm(rotation, perm) : perm
    }, IDENTITY)
}
