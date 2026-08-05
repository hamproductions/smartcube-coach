import { solvedCube, turn, type CubeModel } from './cubeMath'

const offsets: Record<string, number> = { U: 0, R: 3, F: 6, D: 9, L: 12, B: 15 }

function apply(moves: string[]) {
  let cube = solvedCube()
  for (const move of moves) cube = turn(cube, move)
  return cube
}

function preservesFreePair(moves: string[]) {
  const cube = apply(moves)
  return cube.ca[4] === 4 && cube.ea[8] === 16
}

export type FreePairPrompt = { seed: string; setup: string; options: [string, string]; answer: 'A' | 'B' }

export function generateFreePairPrompt(seed: string): FreePairPrompt {
  const swap = seed.split('').reduce((total, character) => total + character.charCodeAt(0), 0) % 2 === 1
  const options: [string, string] = swap ? ['L', 'R'] : ['R', 'L']
  return { seed, setup: 'U', options, answer: preservesFreePair(['U', options[0]]) ? 'A' : 'B' }
}

export function gradeFreePair(prompt: FreePairPrompt, answer: string) {
  return prompt.answer === answer.trim().toUpperCase()
}
