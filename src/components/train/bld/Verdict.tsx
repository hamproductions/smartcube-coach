import { forwardRef } from 'react'
import { css } from 'styled-system/css'
import { Button } from '../../ui/Button'
import { formatSeconds, type Part } from './memo'
import { kbdClass } from './ui'

const pairClass = css({ fontFamily: 'mono', fontSize: 'sm', letterSpacing: '0.04em', px: '0.5', borderRadius: 'control', '&[data-wrong]': { color: 'error', bg: 'floating' }, '&[data-missed]': { color: 'greenBright', bg: 'floating' } })

function Letters({ value, against, label, mark = 'wrong' }: { value: string; against?: string; label: string; mark?: 'wrong' | 'missed' }) {
  const pairs = value.split(/\s+/).filter(Boolean)
  const reference = against?.split(/\s+/).filter(Boolean)
  return (
    <span aria-label={`${label}: ${value || 'none'}`} className={css({ display: 'inline-flex', flexWrap: 'wrap', columnGap: '1.5', rowGap: '0.5', minW: '0' })}>
      {pairs.length === 0 ? <span className={css({ fontSize: 'sm', color: 'inkVariant' })}>none</span> : pairs.map((pair, index) => (
        <span key={index} {...(reference && reference[index] !== pair ? { [`data-${mark}`]: '' } : {})} className={pairClass}>{pair}</span>
      ))}
    </span>
  )
}

export const Verdict = forwardRef<HTMLButtonElement, { parts: Part[]; memoMs: number; onNext: () => void }>(function Verdict({ parts, memoMs, onNext }, ref) {
  const right = parts.filter((part) => part.right).length
  const allRight = right === parts.length
  return (
    <section aria-label="Verdict" aria-live="polite" data-testid="bld-verdict" className={css({ display: 'flex', flexDirection: 'column', gap: '3', p: { base: '4', md: '5' }, borderRadius: 'card', bg: 'container', borderWidth: '1px', borderColor: allRight ? 'green' : 'floating' })}>
      <div className={css({ display: 'grid', gap: '1' })}>
        <h2 className={css({ fontSize: 'xl', fontWeight: 'semibold', color: allRight ? 'green' : 'error' })}>{allRight ? 'Correct' : 'Wrong'}</h2>
        <p className={css({ fontSize: 'sm', color: 'inkVariant' })}>
          <span className={css({ fontFamily: 'mono', fontVariantNumeric: 'tabular-nums', color: 'ink' })}>{right} of {parts.length}</span> parts right, memo <span className={css({ fontFamily: 'mono', fontVariantNumeric: 'tabular-nums', color: 'ink' })}>{formatSeconds(memoMs)} s</span>
        </p>
      </div>
      <ul className={css({ display: 'grid', listStyle: 'none', p: '0', m: '0' })}>
        {parts.map((part) => {
          const memo = part.id === 'edges' || part.id === 'corners'
          return (
            <li key={part.id} data-testid={`bld-part-${part.id}`} className={css({ display: 'grid', gridTemplateColumns: { base: 'minmax(0, 1fr) auto', xl: '7.5rem minmax(0, 1fr) auto' }, columnGap: '3', rowGap: '1', alignItems: 'baseline', py: '2', borderTopWidth: '1px', borderColor: 'floating' })}>
              <span className={css({ fontSize: 'sm', color: 'inkVariant' })}>{part.label}</span>
              <span className={css({ gridColumn: { base: '2', xl: '3' }, gridRow: '1', fontSize: 'sm', fontWeight: 'semibold', color: part.right ? 'green' : 'error' })}>{part.right ? 'Right' : 'Wrong'}</span>
              <div className={css({ gridColumn: { base: '1 / -1', xl: '2' }, gridRow: { xl: '1' }, display: 'grid', gap: '1', minW: '0' })}>
                {part.right ? (
                  memo ? <Letters label="Yours" value={part.yours} /> : <span className={css({ fontFamily: 'mono', fontVariantNumeric: 'tabular-nums' })}>{part.yours}</span>
                ) : (
                  <>
                    <div className={css({ display: 'flex', gap: '2', alignItems: 'baseline' })}>
                      <span className={css({ fontSize: 'xs', color: 'inkVariant', w: '3.5rem', flexShrink: '0' })}>Yours</span>
                      {memo ? <Letters label="Yours" value={part.yours} against={part.correct} /> : <span className={css({ fontFamily: 'mono', fontVariantNumeric: 'tabular-nums', color: 'error' })}>{part.yours || '-'}</span>}
                    </div>
                    <div className={css({ display: 'flex', gap: '2', alignItems: 'baseline' })}>
                      <span className={css({ fontSize: 'xs', color: 'inkVariant', w: '3.5rem', flexShrink: '0' })}>Correct</span>
                      {memo ? <Letters label="Correct" value={part.correct} against={part.yours} mark="missed" /> : <span className={css({ fontFamily: 'mono', fontVariantNumeric: 'tabular-nums' })}>{part.correct}</span>}
                    </div>
                  </>
                )}
              </div>
            </li>
          )
        })}
      </ul>
      <div>
        <Button ref={ref} variant="solid" onClick={onNext}>Next scramble <kbd className={kbdClass}>Space</kbd></Button>
      </div>
    </section>
  )
})
