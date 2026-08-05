import type { ReactNode } from 'react'
import { css } from 'styled-system/css'
import { styled } from 'styled-system/jsx'

// Instrument, not dashboard. Nothing here draws a box: sections are separated by a
// single hairline rule and generous space, numbers are set large in mono, and the
// accent is spent only on the value the screen exists to show. Cards-in-a-grid was
// what made every surface read the same.

export const Stack = styled('section', {
  base: { display: 'grid', gap: '12', alignContent: 'start', w: 'full' }
})

export const Panel = styled('article', {
  base: {
    display: 'grid',
    gap: '4',
    alignContent: 'start',
    pt: '6',
    borderTopWidth: '1px',
    borderColor: 'rule'
  }
})

export const Eyebrow = styled('span', {
  base: {
    fontFamily: 'mono',
    fontSize: '2xs',
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    color: 'inkMuted'
  },
  variants: {
    tone: {
      accent: { color: 'green' },
      warn: { color: 'green' },
      good: { color: 'green' }
    }
  }
})

export const PanelTitle = styled('h2', {
  base: {
    fontSize: { base: '2xl', md: '3xl' },
    fontWeight: 'normal',
    letterSpacing: '-0.03em',
    lineHeight: '1.05',
    color: 'ink',
    maxW: 'reading'
  }
})

export const PanelNote = styled('p', {
  base: { fontSize: 'sm', lineHeight: '1.6', color: 'inkMuted', maxW: 'reading' }
})

export const Actions = styled('div', {
  base: { display: 'flex', flexWrap: 'wrap', gap: '6', pt: '2' }
})

type MetricProps = { label: string; value: ReactNode; note?: ReactNode }

// The readout. No cells, no borders, no equal-weight grid — the first metric is the
// headline and the rest sit beside it at a quieter size, which is how you actually
// read an instrument.
export function MetricStrip({ label, metrics }: { label: string; metrics: MetricProps[] }) {
  const [lead, ...rest] = metrics
  if (!lead) return null

  return (
    <section aria-label={label} className={css({ display: 'grid', gap: '8' })}>
      <div className={css({ display: 'grid', gap: '1' })}>
        <span className={css({ fontFamily: 'mono', fontSize: '2xs', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'inkMuted' })}>{lead.label}</span>
        <strong className={css({
          fontFamily: 'mono',
          fontSize: { base: '6xl', md: '8xl' },
          fontWeight: 'normal',
          lineHeight: '0.85',
          letterSpacing: '-0.05em',
          color: 'green',
          fontVariantNumeric: 'tabular-nums'
        })}>{lead.value}</strong>
        {lead.note ? <small className={css({ fontFamily: 'mono', fontSize: 'xs', color: 'inkMuted' })}>{lead.note}</small> : null}
      </div>

      {rest.length > 0 && (
        <div className={css({ display: 'flex', flexWrap: 'wrap', gap: '10', pt: '2', borderTopWidth: '1px', borderColor: 'rule' })}>
          {rest.map((metric) => (
            <div key={metric.label} className={css({ display: 'grid', gap: '1', pt: '4' })}>
              <span className={css({ fontFamily: 'mono', fontSize: '2xs', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'inkMuted' })}>{metric.label}</span>
              <strong className={css({ fontFamily: 'mono', fontSize: '2xl', fontWeight: 'normal', lineHeight: '1', color: 'ink', fontVariantNumeric: 'tabular-nums' })}>{metric.value}</strong>
              {metric.note ? <small className={css({ fontSize: 'xs', color: 'inkMuted' })}>{metric.note}</small> : null}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

export const TwoUp = styled('section', {
  base: {
    display: 'grid',
    gap: '12',
    gridTemplateColumns: '1fr',
    lg: { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '16' }
  }
})
