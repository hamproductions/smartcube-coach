export type TrainerStage = 'Cross' | 'F2L' | 'Last layer' | 'Look-ahead' | 'Turning' | 'Blindfold'

export type TrainerInfo = {
  id: string
  stage: TrainerStage
  name: string
  purpose: string
  cube: 'required' | 'optional' | 'none'
}

export const TRAINERS: TrainerInfo[] = [
  { id: 'cross-goal', stage: 'Cross', name: 'Cross to pairs', purpose: 'Solve a scramble up to the cross, or the cross plus up to four pairs, against the clock.', cube: 'optional' },
  { id: 'cross-plan', stage: 'Cross', name: 'Plan the cross', purpose: 'Read a scramble in inspection and plan the whole cross before turning.', cube: 'none' },
  { id: 'f2l-cube', stage: 'F2L', name: 'F2L on the cube', purpose: 'Set up an F2L case on your cube and solve the pair; the cube checks it.', cube: 'required' },
  { id: 'free-pair', stage: 'F2L', name: 'Free pair', purpose: 'Pick the finish that solves one pair and leaves another free.', cube: 'none' },
  { id: 'cases', stage: 'Last layer', name: 'Algorithm cases', purpose: 'Learn and drill OLL, PLL, COLL and more, with recognition and execution timed apart.', cube: 'optional' },
  { id: 'time-attack', stage: 'Last layer', name: 'Time attack', purpose: 'Run a set of cases back to back against a target time for each.', cube: 'optional' },
  { id: 'pair-tracking', stage: 'Look-ahead', name: 'Pair tracking', purpose: 'Follow an F2L pair through a sequence of turns and say where it ends up.', cube: 'none' },
  { id: 'piece-tracking', stage: 'Look-ahead', name: 'Piece tracking', purpose: 'Follow one edge through a sequence of turns.', cube: 'none' },
  { id: 'edge-orientation', stage: 'Look-ahead', name: 'Edge orientation', purpose: 'Tell whether an edge is oriented after a sequence of turns.', cube: 'none' },
  { id: 'hidden-colours', stage: 'Look-ahead', name: 'Hidden colours', purpose: 'Work out the sticker you cannot see from the ones you can.', cube: 'none' },
  { id: 'pacer', stage: 'Turning', name: 'Turn pacer', purpose: 'Turn to a metronome to build a steady, even turning speed.', cube: 'none' },
  { id: 'checklist', stage: 'Turning', name: 'Solve checklist', purpose: 'Slow, untimed solves with a checklist before and after each one.', cube: 'none' },
  { id: 'blindfold', stage: 'Blindfold', name: 'Memo', purpose: 'Memorise a scramble as letter pairs and check the memo.', cube: 'none' }
]

export const TRAINER_STAGES: TrainerStage[] = ['Cross', 'F2L', 'Last layer', 'Look-ahead', 'Turning', 'Blindfold']

export function trainerById(id: string | undefined) {
  return TRAINERS.find((trainer) => trainer.id === id)
}
