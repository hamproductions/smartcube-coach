import { useCallback, useEffect, useState } from 'react'
import { css } from 'styled-system/css'
import { Button } from '../../ui/Button'
import type { AnswerInput } from './attempt'
import type { Verdict } from './LookaheadDrill'
import { PositionPicker } from './Choices'
import { CORNER_LAYERS, EDGE_LAYERS } from './positions'

const stepStyle = css.raw({ fontSize: 'sm', color: 'inkVariant' })
const currentStepStyle = css.raw({ color: 'ink', fontWeight: 'semibold' })

export function PairPicker({ active, expected, verdict, onAnswer }: { active: boolean; expected: string; verdict?: Verdict; onAnswer: (answer: string, input: AnswerInput) => void }) {
  const [corner, setCorner] = useState<string>()
  const pickCorner = useCallback((id: string) => setCorner(id), [])
  const pickEdge = useCallback((id: string, input: AnswerInput) => {
    if (corner) onAnswer(`${corner} ${id}`, input)
  }, [corner, onAnswer])

  useEffect(() => {
    if (!active || !corner) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Backspace' || event.defaultPrevented) return
      if (event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable="true"]')) return
      event.preventDefault()
      setCorner(undefined)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, corner])

  if (verdict) {
    const [expectedCorner, expectedEdge] = expected.split(' ')
    const [pickedCorner, pickedEdge] = verdict.answer.split(' ')
    return (
      <div className={css({ display: 'grid', gap: '4' })}>
        <PositionPicker label="Corner position" layers={CORNER_LAYERS} active={false} onPick={pickCorner} expected={expectedCorner} picked={pickedCorner} />
        <PositionPicker label="Edge position" layers={EDGE_LAYERS} active={false} onPick={pickEdge} expected={expectedEdge} picked={pickedEdge} />
      </div>
    )
  }

  return (
    <div className={css({ display: 'grid', gap: '3' })}>
      <div className={css({ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '3', minH: 'touch' })}>
        <span className={css(stepStyle, !corner ? currentStepStyle : undefined)}>1. Corner{corner ? <strong className={css({ fontFamily: 'mono', color: 'green', ml: '1.5' })}>{corner}</strong> : null}</span>
        <span className={css(stepStyle, corner ? currentStepStyle : undefined)}>2. Edge</span>
        {corner ? <Button variant="ghost" onClick={() => setCorner(undefined)} aria-label="Change corner">Change <kbd className={css({ fontFamily: 'mono', fontSize: 'xs', opacity: '0.7', display: { base: 'none', md: 'inline' } })}>Backspace</kbd></Button> : null}
      </div>
      {corner
        ? <PositionPicker label="Edge position" layers={EDGE_LAYERS} active={active} onPick={pickEdge} />
        : <PositionPicker label="Corner position" layers={CORNER_LAYERS} active={active} onPick={pickCorner} />}
    </div>
  )
}
