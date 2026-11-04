import { css, cx } from 'styled-system/css'
import { generateColorInference, gradeColorInference, type ColorInferencePrompt } from '../../../domain/cognitive'
import { buildAttempt } from '../lookahead/attempt'
import { ChoiceRow } from '../lookahead/Choices'
import { COLOUR_SWATCH, CornerDiagram } from '../lookahead/CornerDiagram'
import { LookaheadDrill, type LookaheadRound } from '../lookahead/LookaheadDrill'
import { COLOURS, cornerStickers, type Colour } from '../lookahead/positions'
import { roundSeed } from '../lookahead/remember'

type ColourRound = LookaheadRound & { prompt: ColorInferencePrompt }

function createRound(round: number): ColourRound {
  const prompt = generateColorInference(roundSeed('color', round))
  return {
    prompt,
    seed: prompt.seed,
    moves: [],
    target: `${prompt.visible[0]} and ${prompt.visible[1]}`,
    question: 'Which colour is under the question mark?',
    expected: prompt.answer,
    grade: (answer) => gradeColorInference(prompt, answer),
    label: (answer) => answer,
    attempt: (answer, success, timing) => buildAttempt({
      caseId: 'color-inference-corner',
      family: 'color-inference',
      protocol: 'multiple-choice',
      generatorId: 'corner-color-inference',
      seed: prompt.seed,
      scramble: '',
      constraintHash: [...prompt.visible, prompt.answer].sort().join(':'),
      answer,
      expectedAnswer: prompt.answer,
      success,
      completeMoveStream: false,
      note: 'Generated legal corner color set'
    }, timing)
  }
}

function Swatch({ colour }: { colour: Colour }) {
  return (
    <span className={css({ display: 'inline-flex', alignItems: 'center', gap: '2', fontFamily: 'sans' })}>
      <span aria-hidden className={cx(css({ w: '4', h: '4', borderRadius: 'control', flexShrink: '0' }), COLOUR_SWATCH[colour])} />
      {colour}
    </span>
  )
}

export function HiddenColoursTrainer() {
  return (
    <LookaheadDrill
      trainerId="hidden-colours"
      createRound={createRound}
      renderStage={({ round, phase, size }) => <CornerDiagram stickers={cornerStickers(round.prompt)} reveal={phase === 'verdict'} size={Math.min(size - 60, 200)} />}
      renderAnswer={({ round, active, verdict, onAnswer }) => <ChoiceRow label="Colour" choices={COLOURS} active={active} onPick={onAnswer} expected={verdict ? round.expected : undefined} picked={verdict?.answer} render={(colour) => <Swatch colour={colour as Colour} />} />}
    />
  )
}
