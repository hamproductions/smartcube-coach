import { generatePairTrackingPrompt, gradePairTracking } from '../../../domain/tracking'
import { buildAttempt } from '../lookahead/attempt'
import { LookaheadDrill, type LookaheadRound } from '../lookahead/LookaheadDrill'
import { PairPicker } from '../lookahead/PairPicker'
import { roundSeed } from '../lookahead/remember'

function createRound(round: number): LookaheadRound {
  const prompt = generatePairTrackingPrompt(roundSeed('pair', round))
  return {
    seed: prompt.seed,
    moves: prompt.moves,
    pieces: prompt.target.split(' + '),
    target: `${prompt.target} pair`,
    question: `Where did the ${prompt.target} pair go?`,
    expected: prompt.answer,
    grade: (answer) => gradePairTracking(prompt, answer),
    label: (answer) => answer.split(' ').join(' + '),
    attempt: (answer, success, timing) => buildAttempt({
      caseId: `track-pair-${prompt.target}`,
      family: 'tracking',
      protocol: 'tracking-answer',
      generatorId: 'cubie-pair-tracking',
      seed: prompt.seed,
      scramble: prompt.moves.join(' '),
      constraintHash: `${prompt.target}:${prompt.answer}`,
      answer,
      expectedAnswer: prompt.answer,
      success,
      completeMoveStream: true,
      note: 'Cubie-state-derived F2L pair tracking'
    }, timing)
  }
}

export function PairTrackingTrainer() {
  return (
    <LookaheadDrill
      trainerId="pair-tracking"
      createRound={createRound}
      renderAnswer={({ round, active, verdict, onAnswer }) => <PairPicker key={round.seed} active={active} expected={round.expected} verdict={verdict} onAnswer={onAnswer} />}
    />
  )
}
