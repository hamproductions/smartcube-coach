import type { SolveTelemetry } from '../domain/analyzeSolve'

export const sampleSolve: SolveTelemetry = {
  id: 'solve-1042',
  totalMs: 23840,
  stages: [
    { name: 'Cross', timeMs: 2680, recognitionMs: 420, executionMs: 2260, moves: 9, rotations: 0, pauses: [310] },
    { name: 'F2L 1', timeMs: 2940, recognitionMs: 510, executionMs: 2430, moves: 8, rotations: 0, pauses: [240] },
    { name: 'F2L 2', timeMs: 4180, recognitionMs: 1140, executionMs: 3040, moves: 10, rotations: 2, pauses: [1140, 420] },
    { name: 'F2L 3', timeMs: 3150, recognitionMs: 680, executionMs: 2470, moves: 9, rotations: 0, pauses: [580] },
    { name: 'F2L 4', timeMs: 3570, recognitionMs: 790, executionMs: 2780, moves: 9, rotations: 1, pauses: [710] },
    { name: 'OLL', timeMs: 2860, recognitionMs: 730, executionMs: 2130, moves: 10, rotations: 0, pauses: [660] },
    { name: 'PLL', timeMs: 3460, recognitionMs: 880, executionMs: 2580, moves: 14, rotations: 0, pauses: [810] }
  ],
  history: {
    sampleSize: 12,
    pairTransitionMedianMs: 520,
    f2l2PauseRecurrence: 0.58,
    crossMedianMs: 2410
  }
}

export const trend = [27.4, 26.8, 27.1, 25.9, 25.2, 25.7, 24.8, 24.3, 24.6, 23.8, 23.4, 23.1]
