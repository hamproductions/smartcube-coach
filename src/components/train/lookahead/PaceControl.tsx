import { css } from 'styled-system/css'
import { PACES, PACE_LABEL, type Pace } from './remember'

export function PaceControl({ pace, onChange }: { pace: Pace; onChange: (pace: Pace) => void }) {
  return (
    <div role="group" aria-label="Pace" className={css({ display: 'flex', alignItems: 'center', gap: '2' })}>
      <span className={css({ fontSize: 'xs', color: 'inkVariant' })}>Pace</span>
      <div className={css({ display: 'inline-flex', p: '0.5', gap: '0.5', borderRadius: 'control', bg: 'container', borderWidth: '1px', borderColor: 'floating' })}>
        {PACES.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={pace === option}
            onClick={() => onChange(option)}
            className={css(css.raw({ minH: 'touch', minW: '16', px: '3', borderRadius: 'control', fontSize: 'sm', cursor: 'pointer', color: 'inkVariant', bg: 'transparent', _hover: { color: 'ink' }, _focusVisible: { outline: '2px solid', outlineColor: 'green', outlineOffset: '1px' } }), pace === option ? css.raw({ bg: 'floating', color: 'ink' }) : undefined)}
          >
            {PACE_LABEL[option]}
          </button>
        ))}
      </div>
    </div>
  )
}
