import { generateEdgeTrackingPrompt, gradeEdgeTracking } from '../../../domain/tracking'
import { buildAttempt } from '../lookahead/attempt'
import { PositionPicker } from '../lookahead/Choices'
import { LookaheadDrill, type LookaheadRound } from '../lookahead/LookaheadDrill'
import { EDGE_LAYERS } from '../lookahead/positions'
import { roundSeed } from '../lookahead/remember'

function createRound(round: number): LookaheadRound {
  const prompt = generateEdgeTrackingPrompt(roundSeed('tracking', round))
  return {
    seed: prompt.seed,
    moves: prompt.moves,
    pieces: [prompt.target],
    target: `${prompt.target} edge`,
    question: `Where is the ${prompt.target} edge now?`,
    expected: prompt.answer,
    grade: (answer) => gradeEdgeTracking(prompt, answer),
    label: (answer) => answer,
    attempt: (answer, success, timing) => buildAttempt({
      caseId: `track-edge-${prompt.target}`,
      family: 'tracking',
      protocol: 'tracking-answer',
      generatorId: 'cubie-edge-tracking',
      seed: prompt.seed,
      scramble: prompt.moves.join(' '),
      constraintHash: `${prompt.target}:${prompt.answer}`,
      answer,
      expectedAnswer: prompt.answer,
      success,
      completeMoveStream: true,
      note: 'Cubie-state-derived edge location'
    }, timing)
  }
}

export function PieceTrackingTrainer() {
  return (
    <LookaheadDrill
      trainerId="piece-tracking"
      createRound={createRound}
      renderAnswer={({ round, active, verdict, onAnswer }) => <PositionPicker label="Edge position" layers={EDGE_LAYERS} active={active} onPick={onAnswer} expected={verdict ? round.expected : undefined} picked={verdict?.answer} />}
    />
  )
}
