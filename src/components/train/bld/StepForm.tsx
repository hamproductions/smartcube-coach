import { forwardRef, useState, type KeyboardEvent, type Ref } from 'react'
import { css, cx } from 'styled-system/css'
import { Button } from '../../ui/Button'
import { parseCount, toPairs, type Step, type StepInput } from './memo'
import { choiceClass, fieldClass, focusRing, kbdClass } from './ui'

type Props = {
  step: Step
  last: boolean
  canGoBack: boolean
  draft: string
  onDraft: (value: string) => void
  onSubmit: (value: string, input: StepInput) => void
  onBack: () => void
  onSkip: () => void
}

const parityClass = css({
  minH: '14', px: '3', borderRadius: 'control', borderWidth: '1px', borderColor: 'floating', bg: 'container', color: 'ink', fontSize: 'lg', fontWeight: 'medium', cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '2', _hover: { bg: 'floating' }, '&[data-picked]': { borderColor: 'green' }, ...focusRing
})

const HINT: Record<Step['id'], string> = {
  edges: 'Type the edge letter pairs in order. Spaces are optional.',
  corners: 'Type the corner letter pairs in order. Spaces are optional.',
  parity: 'Is there edge and corner parity? Press 1 for no, 2 for yes.',
  flips: 'How many edges are flipped? Type the number or tap it.',
  twists: 'How many corners are twisted? Type the number or tap it.'
}

export const StepForm = forwardRef<HTMLInputElement | HTMLDivElement, Props>(function StepForm({ step, last, canGoBack, draft, onDraft, onSubmit, onBack, onSkip }, ref) {
  const [error, setError] = useState('')

  const submit = (value: string, input: StepInput) => {
    if (step.kind === 'count' && parseCount(value, step.max ?? 12) === undefined) {
      setError(`Enter a whole number from 0 to ${step.max}.`)
      return
    }
    setError('')
    onSubmit(value, input)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace' && !event.currentTarget.value && canGoBack) {
      event.preventDefault()
      onBack()
    }
  }

  const pairs = step.kind === 'memo' ? toPairs(draft) : []
  const actions = (
    <div className={css({ display: 'flex', gap: '2', flexWrap: 'wrap' })}>
      {step.kind !== 'yes-no' && (
        <Button type="submit" variant="solid">{last ? 'Check memo' : 'Next'} <kbd className={kbdClass}>Enter</kbd></Button>
      )}
      <Button type="button" variant="outline" disabled={!canGoBack} onClick={onBack}>Back</Button>
      <Button type="button" variant="ghost" onClick={onSkip}>New scramble</Button>
    </div>
  )

  return (
    <form
      aria-label={step.label}
      onSubmit={(event) => { event.preventDefault(); submit(draft, 'keyboard') }}
      className={css({ display: 'flex', flexDirection: 'column', gap: '3' })}
    >
      <div className={css({ display: 'grid', gap: '1' })}>
        <h2 className={css({ fontSize: 'lg', fontWeight: 'semibold' })}>{step.label}</h2>
        <p id={`bld-hint-${step.id}`} className={css({ fontSize: 'sm', color: 'inkVariant' })}>{HINT[step.id]}</p>
      </div>

      {step.kind === 'memo' && (
        <>
          <input
            ref={ref as Ref<HTMLInputElement>}
            aria-label={step.label}
            aria-describedby={`bld-hint-${step.id}`}
            value={draft}
            onChange={(event) => onDraft(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="AB CD EF"
            autoComplete="off"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint={last ? 'done' : 'next'}
            className={fieldClass}
          />
          <p aria-live="polite" className={css({ fontSize: 'sm', color: 'inkVariant', minH: '5' })}>
            {pairs.length ? <><span className={css({ fontFamily: 'mono', color: 'ink', letterSpacing: '0.06em' })}>{pairs.join(' ')}</span> · <span className={css({ fontFamily: 'mono', fontVariantNumeric: 'tabular-nums' })}>{pairs.length}</span> pair{pairs.length === 1 ? '' : 's'}</> : 'Submit it empty if there are no targets.'}
          </p>
        </>
      )}

      {step.kind === 'yes-no' && (
        <div ref={ref as Ref<HTMLDivElement>} tabIndex={-1} role="group" aria-label="Parity" aria-describedby={`bld-hint-${step.id}`} className={css({ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '2', outline: 'none' })}>
          {['No', 'Yes'].map((value, index) => (
            <button key={value} type="button" data-picked={draft === value || undefined} className={parityClass} onClick={() => submit(value, 'pointer')}>
              {value} <kbd className={kbdClass}>{index + 1}</kbd>
            </button>
          ))}
        </div>
      )}

      {step.kind === 'count' && (
        <>
          <input
            ref={ref as Ref<HTMLInputElement>}
            aria-label={step.label}
            aria-describedby={`bld-hint-${step.id}`}
            value={draft}
            onChange={(event) => { onDraft(event.target.value.replaceAll(/\D/g, '').slice(0, 2)); setError('') }}
            onKeyDown={onKeyDown}
            inputMode="numeric"
            placeholder="0"
            autoComplete="off"
            enterKeyHint={last ? 'done' : 'next'}
            className={cx(fieldClass, css({ maxW: '10rem' }))}
          />
          <div role="group" aria-label={`${step.label} count`} className={css({ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(44px, 1fr))', gap: '1.5' })}>
            {Array.from({ length: (step.max ?? 12) + 1 }, (_, value) => (
              <button key={value} type="button" aria-label={`${value} ${step.id === 'flips' ? 'flipped edges' : 'twisted corners'}`} data-picked={draft === String(value) || undefined} className={choiceClass} onClick={() => submit(String(value), 'pointer')}>
                {value}
              </button>
            ))}
          </div>
        </>
      )}

      {error && <p role="alert" className={css({ color: 'error', fontSize: 'sm' })}>{error}</p>}
      {actions}
    </form>
  )
})
