import { css } from 'styled-system/css'
import { generateEdgeOrientationPrompt, gradeEdgeOrientation } from '../../../domain/tracking'
import { buildAttempt } from '../lookahead/attempt'
import { ChoiceRow } from '../lookahead/Choices'
import { LookaheadDrill, type LookaheadRound } from '../lookahead/LookaheadDrill'
import { roundSeed } from '../lookahead/remember'

const ORIENTATIONS = ['oriented', 'flipped'] as const
const LABEL: Record<string, string> = { oriented: 'Oriented', flipped: 'Flipped' }

function createRound(round: number): LookaheadRound {
  const prompt = generateEdgeOrientationPrompt(roundSeed('orientation', round))
  return {
    seed: prompt.seed,
    moves: prompt.moves,
    pieces: [prompt.target],
    target: `${prompt.target} edge`,
    question: `Is the ${prompt.target} edge oriented or flipped?`,
    expected: prompt.answer,
    grade: (answer) => gradeEdgeOrientation(prompt, answer),
    label: (answer) => LABEL[answer] ?? answer,
    attempt: (answer, success, timing) => buildAttempt({
      caseId: `orient-edge-${prompt.target}`,
      family: 'tracking',
      protocol: 'orientation-answer',
      generatorId: 'cubie-edge-orientation',
      seed: prompt.seed,
      scramble: prompt.moves.join(' '),
      constraintHash: `${prompt.target}:${prompt.answer}`,
      answer,
      expectedAnswer: prompt.answer,
      success,
      completeMoveStream: true,
      note: 'Cubie-state-derived edge orientation'
    }, timing)
  }
}

export function EdgeOrientationTrainer() {
  return (
    <LookaheadDrill
      trainerId="edge-orientation"
      createRound={createRound}
      renderAnswer={({ round, active, verdict, onAnswer }) => (
        <div className={css({ display: 'grid', gap: '2' })}>
          <ChoiceRow label="Edge orientation" choices={ORIENTATIONS} active={active} onPick={onAnswer} expected={verdict ? round.expected : undefined} picked={verdict?.answer} render={(choice) => <span className={css({ fontFamily: 'sans' })}>{LABEL[choice]}</span>} />
          <span className={css({ fontSize: 'xs', color: 'inkVariant' })}>Oriented means it solves with R, L, U and D turns only. F and B quarter turns flip edges.</span>
        </div>
      )}
    />
  )
}
