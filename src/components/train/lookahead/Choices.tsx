import { useEffect, type MouseEvent, type ReactNode } from 'react'
import { css } from 'styled-system/css'
import type { AnswerInput } from './attempt'
import { CHOICE_KEYS, layerIds, type PositionLayer } from './positions'

export type ChoiceMark = 'correct' | 'wrong' | undefined

export function useChoiceKeys(ids: string[], active: boolean, onPick: (id: string, input: AnswerInput) => void) {
  useEffect(() => {
    if (!active) return
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || event.metaKey || event.ctrlKey || event.altKey) return
      if (event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable="true"]')) return
      const index = CHOICE_KEYS.indexOf(event.key)
      if (index < 0 || index >= ids.length) return
      event.preventDefault()
      onPick(ids[index], 'keyboard')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [ids, active, onPick])
}

const inputOf = (event: MouseEvent) => (event.detail === 0 ? 'keyboard' : 'pointer')

const choiceStyle = css.raw({
  position: 'relative',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '2',
  minW: 'touch',
  minH: 'touch',
  px: '2',
  borderRadius: 'control',
  borderWidth: '1px',
  borderColor: 'floating',
  bg: 'container',
  color: 'ink',
  fontFamily: 'mono',
  fontSize: 'sm',
  fontWeight: 'medium',
  cursor: 'pointer',
  transition: 'border-color 0.12s ease, background-color 0.12s ease',
  _hover: { borderColor: 'outline' },
  _focusVisible: { outline: '2px solid', outlineColor: 'green', outlineOffset: '2px' },
  _disabled: { cursor: 'default', _hover: { borderColor: 'floating' } }
})

const markStyle = {
  correct: css.raw({ bg: 'green', borderColor: 'green', color: 'onGreen', _disabled: { _hover: { borderColor: 'green' } } }),
  wrong: css.raw({ borderColor: 'error', color: 'error', borderWidth: '2px', _disabled: { _hover: { borderColor: 'error' } } })
}

const dimStyle = css.raw({ opacity: '0.45' })

const keyClass = css({ position: 'absolute', top: '0.5', left: '1', fontSize: '2xs', color: 'inkVariant', lineHeight: '1' })

export function ChoiceButton({ id, shortcut, active, mark, onPick, children, label }: { id: string; shortcut?: string; active: boolean; mark?: ChoiceMark; onPick: (id: string, input: AnswerInput) => void; children: ReactNode; label?: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-keyshortcuts={shortcut}
      disabled={!active}
      onClick={(event) => onPick(id, inputOf(event))}
      className={css(choiceStyle, mark ? markStyle[mark] : undefined, !active && !mark ? dimStyle : undefined)}
    >
      {shortcut && active ? <span aria-hidden className={keyClass}>{shortcut}</span> : null}
      {children}
    </button>
  )
}

export function markFor(id: string, expected?: string, picked?: string): ChoiceMark {
  if (expected === undefined) return undefined
  if (id === expected) return 'correct'
  if (id === picked) return 'wrong'
  return undefined
}

export function PositionPicker({ label, layers, active, onPick, expected, picked }: { label: string; layers: PositionLayer[]; active: boolean; onPick: (id: string, input: AnswerInput) => void; expected?: string; picked?: string }) {
  const ids = layerIds(layers)
  useChoiceKeys(ids, active, onPick)
  return (
    <div role="group" aria-label={label} className={css({ display: 'grid', gap: '2' })}>
      <div className={css({ display: 'flex', flexWrap: 'wrap', columnGap: { base: '3', md: '6' }, rowGap: '3' })}>
        {layers.map((layer) => (
          <div key={layer.name} className={css({ display: 'grid', gap: '1.5', justifyItems: 'center' })}>
            <span className={css({ fontSize: 'xs', color: 'inkVariant' })}>{layer.name}</span>
            <div className={css({ display: 'grid', gridTemplateColumns: 'repeat(3, 48px)', gridTemplateRows: 'repeat(3, 48px)', gap: '0.5', p: '0.5', borderRadius: 'card', bg: 'surface', borderWidth: '1px', borderColor: 'rule' })}>
              {layer.centre ? <span aria-hidden className={css({ gridRow: '2', gridColumn: '2', display: 'grid', placeItems: 'center', fontFamily: 'mono', fontSize: 'xs', color: 'outline' })}>{layer.centre}</span> : null}
              {layer.cells.map((position) => (
                <div key={position.id} style={{ gridRow: position.row + 1, gridColumn: position.col + 1 }} className={css({ display: 'grid' })}>
                  <ChoiceButton id={position.id} shortcut={CHOICE_KEYS[ids.indexOf(position.id)]} active={active} mark={markFor(position.id, expected, picked)} onPick={onPick}>
                    {position.id}
                  </ChoiceButton>
                </div>
              ))}
            </div>
            <span className={css({ fontSize: '2xs', color: 'inkVariant' })}>Front</span>
          </div>
        ))}
      </div>
      <span className={css({ fontSize: 'xs', color: 'inkVariant' })}>Each layer seen from above.</span>
    </div>
  )
}

export function ChoiceRow({ label, choices, active, onPick, expected, picked, render }: { label: string; choices: readonly string[]; active: boolean; onPick: (id: string, input: AnswerInput) => void; expected?: string; picked?: string; render?: (id: string) => ReactNode }) {
  useChoiceKeys(choices as string[], active, onPick)
  return (
    <div role="group" aria-label={label} className={css({ display: 'grid', gridTemplateColumns: { base: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(3, minmax(0, 1fr))' }, gap: '2', maxW: '480px' })}>
      {choices.map((choice, index) => (
        <ChoiceButton key={choice} id={choice} shortcut={CHOICE_KEYS[index]} active={active} mark={markFor(choice, expected, picked)} onPick={onPick}>
          {render ? render(choice) : choice}
        </ChoiceButton>
      ))}
    </div>
  )
}
