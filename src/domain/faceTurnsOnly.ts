import { applyRotationToMove, combineRotations, decomposeAlgorithmMove } from './moveFrame'

// A smart cube reports single-face quarter and half turns only. It has no way to see a
// whole-cube reorientation, and it reports the two layers of a wide or slice turn as the
// separate faces they physically are. Anything driving this app's device pipeline with
// algorithm notation — the software simulator running the OLL/PLL catalogue, a typed
// reconstruction — therefore has to be reduced to that same vocabulary first, or it does
// not describe anything a cube could have sent.
//
// The decomposition is not reimplemented here. `moveFrame` is this project's port of
// F2LTrainer's move validator and already knows how each wide and slice move splits into
// a face turn plus an implied rotation, and how a rotation rewrites the moves that follow
// it. This module only walks the sequence and accumulates.

export type FaceTurnFold = { moves: string[]; rotations: string[]; rotation: string }

// Reduces an algorithm to the face turns a cube would have reported, plus the whole-cube
// rotation that was folded away. Applying `moves` and then `rotations` reproduces the
// original algorithm's pattern exactly — the rotation is only where the solver ends up
// holding the cube, which no cube reports and no solved test should care about.
//
// Each following move is rewritten through the accumulated rotation, which is the
// direction moveFrame's applyRotationToMove takes — note this is the opposite convention
// to cubedex/smartcubeParity's remapMoveForPlayer, which needs the inverse. Taking the
// wrong direction silently yields a different, still-plausible sequence that no longer
// describes the same solve, which is why faceTurnsOnly.test.ts checks state equivalence
// against cubing.js for every catalogued algorithm rather than trusting either convention.
//
// `startRotation` carries the frame across a boundary, so a multi-stage solve can be folded
// one stage at a time without a rotation at the end of one stage being lost before the next.
export function faceTurnsOnly(alg: string, startRotation = ''): FaceTurnFold {
  let rotation = startRotation
  const moves: string[] = []
  const rotations: string[] = []

  for (const token of alg.split(/\s+/).filter(Boolean)) {
    const { rotation: implied, faceMoves } = decomposeAlgorithmMove(token)
    for (const faceMove of faceMoves) {
      moves.push(applyRotationToMove(faceMove, rotation))
    }
    if (implied) {
      rotation = combineRotations([rotation, implied])
      rotations.push(implied)
    }
  }

  return { moves, rotations, rotation }
}
