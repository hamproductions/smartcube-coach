import { css } from 'styled-system/css'
import { styled } from 'styled-system/jsx'
import type { CaseAttributes } from '../../domain/caseAttributes'

// Ported from docs/design/stitch/f2l_advanced_shape_filters/code.html: a dialog over the
// library with one column per shape axis and a slot quadrant, and a live match count in
// the footer. The export shows three columns; this app classifies four axes, so corner
// position keeps its own column rather than dropping a filter that already works.

const Column = styled('div', {
  base: { display: 'flex', flexDirection: 'column', gap: '4' }
})

const ColumnTitle = styled('h3', {
  base: {
    fontFamily: 'sans', fontSize: 'xs', fontWeight: 'bold',
    letterSpacing: '0.12em', textTransform: 'uppercase', color: 'inkVariant',
    borderBottomWidth: '1px', borderColor: 'floating', pb: '2'
  }
})

const Choice = styled('button', {
  base: {
    display: 'flex', alignItems: 'center', gap: '3', w: 'full',
    p: '3', borderRadius: 'control', textAlign: 'left',
    bg: 'container', borderWidth: '1px', borderColor: 'floating',
    color: 'ink', cursor: 'pointer', fontSize: 'sm',
    _hover: { bg: 'floating' }
  },
  variants: {
    active: { true: { borderColor: 'green', color: 'green', bg: 'rgba(34,197,94,0.08)' } }
  }
})

const Action = styled('button', {
  base: {
    minH: '48px', px: '6', borderRadius: 'control', cursor: 'pointer',
    fontFamily: 'sans', fontSize: 'xs', fontWeight: 'bold',
    letterSpacing: '0.12em', textTransform: 'uppercase',
    bg: 'transparent', color: 'ink', borderWidth: '1px', borderColor: 'transparent',
    _hover: { bg: 'floating', borderColor: 'floating' }
  },
  variants: {
    primary: { true: { bg: 'green', color: 'onGreen', boxShadow: '0 0 15px rgba(34,197,94,0.2)', _hover: { bg: 'greenBright' } } }
  }
})

const SLOTS = [['BL', 'bl'], ['BR', 'br'], ['FL', 'fl'], ['FR', 'fr']] as const

const GROUPS = [
  { key: 'cornerOrientation', title: 'Corner facing', options: [['up_down', 'Facing up / down'], ['front_back', 'Facing front / back'], ['side', 'Facing left / right']] },
  { key: 'cornerPosition', title: 'Corner position', options: [['top', 'Top layer'], ['bottom_correct', 'Bottom, correct slot'], ['bottom_wrong', 'Bottom, wrong slot']] },
  { key: 'edgePosition', title: 'Edge position', options: [['top', 'Top layer'], ['solved_slot', 'Solved slot'], ['wrong_slot', 'Wrong slot']] },
  { key: 'edgeOrientation', title: 'Edge facing', options: [['oriented', 'Oriented'], ['unoriented', 'Unoriented']] }
] as const

export type ShapeFilterDialogProps = {
  filter: Partial<CaseAttributes>
  subset: string
  matchCount: number
  onChange(next: Partial<CaseAttributes>): void
  onSubset(next: string): void
  onReset(): void
  onClose(): void
}

export function ShapeFilterDialog({ filter, subset, matchCount, onChange, onSubset, onReset, onClose }: ShapeFilterDialogProps) {
  return (
    <div
      className={css({
        position: 'fixed', inset: '0', zIndex: '50',
        display: 'grid', placeItems: 'center', p: '6',
        bg: 'rgba(9,9,11,0.75)', backdropFilter: 'blur(4px)'
      })}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label="Shape filter"
        onClick={(event) => event.stopPropagation()}
        className={css({
          w: 'full', maxW: '960px', maxH: '85vh', display: 'flex', flexDirection: 'column',
          bg: 'surface', borderWidth: '1px', borderColor: 'floating', borderRadius: 'card', overflow: 'hidden'
        })}
      >
        <div className={css({ p: '6', borderBottomWidth: '1px', borderColor: 'floating', bg: 'container', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '4' })}>
          <div>
            <h2 className={css({ fontSize: '2xl', fontWeight: 'bold', color: 'ink', letterSpacing: '-0.02em' })}>Shape filter</h2>
            <p className={css({ mt: '1', color: 'inkVariant' })}>Isolate specific F2L cases by geometry.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close shape filter"
            className={css({ w: '12', h: '12', borderRadius: 'pill', bg: 'transparent', color: 'inkVariant', cursor: 'pointer', fontSize: 'xl', _hover: { bg: 'floating', color: 'ink' } })}
          >×</button>
        </div>

        <div className={css({ flex: '1', minH: '0', overflowY: 'auto', p: '6', display: 'grid', gap: '8', gridTemplateColumns: '1fr', md: { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }, lg: { gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' } })}>
          {GROUPS.map((group) => (
            <Column key={group.key}>
              <ColumnTitle>{group.title}</ColumnTitle>
              {group.options.map(([value, label]) => {
                const active = filter[group.key] === value
                return (
                  <Choice
                    key={value}
                    type="button"
                    active={active}
                    aria-pressed={active}
                    onClick={() => onChange({ ...filter, [group.key]: active ? undefined : value })}
                  >
                    <span className={css({ flex: '1' })}>{label}</span>
                    {/* aria-pressed already conveys the state; leaving the glyph in the
                        accessible name made every option read "Oriented ○". */}
                    <span aria-hidden="true" className={css({ fontFamily: 'mono', fontSize: 'xs' })}>{active ? '●' : '○'}</span>
                  </Choice>
                )
              })}
            </Column>
          ))}

          <Column>
            <ColumnTitle>Target slot</ColumnTitle>
            {/* The quadrant mirrors the cube seen from above, so the button positions
                match where the slot actually is. */}
            <div className={css({ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '2', w: '160px' })}>
              {SLOTS.map(([label, value]) => {
                const active = subset.toLowerCase() === value
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => onSubset(active ? 'All' : label)}
                    className={css({
                      h: '72px', display: 'grid', placeItems: 'center',
                      borderRadius: 'control', borderWidth: active ? '2px' : '1px',
                      borderColor: active ? 'green' : 'floating',
                      bg: active ? 'rgba(34,197,94,0.16)' : 'container',
                      color: active ? 'green' : 'inkVariant',
                      fontFamily: 'mono', fontWeight: active ? 'bold' : 'normal',
                      cursor: 'pointer', _hover: { bg: 'floating' }
                    })}
                  >{label}</button>
                )
              })}
            </div>
          </Column>
        </div>

        <div className={css({ p: '6', borderTopWidth: '1px', borderColor: 'floating', bg: 'container', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '4', flexWrap: 'wrap' })}>
          <span className={css({ fontFamily: 'mono', fontSize: 'sm', color: 'inkVariant' })}>
            Showing <strong className={css({ color: 'ink' })}>{matchCount}</strong> matching case{matchCount === 1 ? '' : 's'}
          </span>
          <div className={css({ display: 'flex', gap: '4' })}>
            <Action type="button" onClick={onReset}>Reset</Action>
            <Action type="button" primary onClick={onClose}>Apply</Action>
          </div>
        </div>
      </div>
    </div>
  )
}
