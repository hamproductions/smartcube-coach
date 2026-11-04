import type { ReactNode } from 'react'
import { css, cx } from 'styled-system/css'
import { Chip, focusRing, labelText } from './ui'

export type SetupStep = 'set' | 'subset' | 'learning' | 'ready'

export type StepOption = { value: string; label?: string; count?: number }

export type StepDefinition = { id: Exclude<SetupStep, 'ready'>; label: string; title: string; value: string; options: StepOption[] }

export function SetupSteps({ steps, step, onStep, onChoose, children }: {
  steps: StepDefinition[]
  step: SetupStep
  onStep: (step: SetupStep) => void
  onChoose: (step: StepDefinition['id'], value: string) => void
  children?: ReactNode
}) {
  const open = steps.find((entry) => entry.id === step)
  return (
    <div className={css({ display: 'flex', flexDirection: 'column', gap: '5' })}>
      <nav aria-label="Setup" className={css({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '2' })}>
        {steps.map((entry) => (
          <button
            key={entry.id}
            type="button"
            aria-current={step === entry.id ? 'step' : undefined}
            onClick={() => onStep(step === entry.id ? 'ready' : entry.id)}
            className={cx(
              css({
                display: 'inline-flex', alignItems: 'center', gap: '2', minH: '44px', px: '3', borderRadius: 'control',
                bg: 'container', color: 'ink', cursor: 'pointer', fontSize: 'sm', borderWidth: '1px', borderColor: 'floating',
                _hover: { borderColor: 'outline' },
                '&[aria-current=step]': { borderColor: 'green', bg: 'container' }
              }),
              focusRing
            )}
          >
            <span className={labelText}>{entry.label}</span>{' '}
            <span className={css({ fontWeight: 'semibold' })}>{entry.options.find((option) => option.value === entry.value)?.label ?? entry.value}</span>
          </button>
        ))}
      </nav>
      {open ? (
        <section aria-label={open.title} className={css({ display: 'flex', flexDirection: 'column', gap: '3' })}>
          <h2 className={css({ fontSize: 'lg', fontWeight: 'semibold' })}>{open.title}</h2>
          <div className={css({ display: 'flex', flexWrap: 'wrap', gap: '2' })}>
            {open.options.map((option) => (
              <Chip key={option.value} active={option.value === open.value} count={option.count} onClick={() => onChoose(open.id, option.value)}>
                {option.label ?? option.value}
              </Chip>
            ))}
          </div>
        </section>
      ) : children}
    </div>
  )
}
