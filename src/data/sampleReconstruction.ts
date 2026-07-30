import type { RecoStage } from '../integrations/reco'

export const sampleScramble = "R' U' F D2 L2 F2 U B2 R2 D2 F2 D' B R2 U' R' B2 L D F2"

export const sampleReconstructionStages: RecoStage[] = [
  { label: 'Cross', alg: "D R F' L2 D2 R' D F U", moves: ['D', 'R', "F'", 'L2', 'D2', "R'", 'D', 'F', 'U'] },
  { label: 'F2L 1', alg: "R U R' U' F' U F U", moves: ['R', 'U', "R'", "U'", "F'", 'U', 'F', 'U'] },
  { label: 'F2L 2', alg: "U' R U2 R' U R U' R' U2 y", moves: ["U'", 'R', 'U2', "R'", 'U', 'R', "U'", "R'", 'U2', 'y'] },
  { label: 'F2L 3', alg: "L' U' L U R U R' U' y'", moves: ["L'", "U'", 'L', 'U', 'R', 'U', "R'", "U'", "y'"] },
  { label: 'F2L 4', alg: "R U' R' U2 F' U F U' R", moves: ['R', "U'", "R'", 'U2', "F'", 'U', 'F', "U'", 'R'] },
  { label: 'OLL', alg: "U R U2 R2 F R F' U2 R' F", moves: ['U', 'R', 'U2', 'R2', 'F', 'R', "F'", 'U2', "R'", 'F'] },
  { label: 'PLL', alg: "R2 U R U R' U' R' U' R' U R' U' R2 U", moves: ['R2', 'U', 'R', 'U', "R'", "U'", "R'", "U'", "R'", 'U', "R'", "U'", 'R2', 'U'] }
]

export const sampleReconstructionMoves = sampleReconstructionStages.flatMap((stage) => stage.moves)
