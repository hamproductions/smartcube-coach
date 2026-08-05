import { css } from 'styled-system/css'
import { styled } from 'styled-system/jsx'

// The Train filters were four stacked rows of pills — 27 controls, occupying the
// whole first screen so no case was visible until you scrolled past them. The
// category list is long and mostly rarely-used, so it becomes a real select; the
// three short axes become compact segmented rows. Everything sits on one line and
// the case grid starts near the top.
//
// The segments are buttons rather than Ark's SegmentGroup: that renders radios, and
// swapping the roles under the existing trainer tests would have changed what they
// assert about this toolbar rather than how it looks.
const Bar = styled('div', {
  base: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '3',
    p: '3',
    borderRadius: 'card',
    borderWidth: '1px',
    borderColor: 'floating',
    bg: 'container'
  }
})

const Native = styled('select', {
  base: {
    h: '9',
    px: '2',
    borderRadius: 'control',
    borderWidth: '1px',
    borderColor: 'outline',
    bg: 'container',
    color: 'ink',
    fontSize: 'sm',
    cursor: 'pointer'
  }
})

const Label = styled('span', {
  base: { fontSize: '2xs', letterSpacing: 'widest', textTransform: 'uppercase', color: 'inkVariant' }
})

// The mode TrainerHub's recognitionEligible effect resets to when the current mode
// is not offered by the newly selected set.
const SETTLED_MODE = 'Drill'

type Segment = { value: string; label: string; count?: number }

const Seg = styled('button', {
  base: {
    px: '2.5',
    h: '7',
    borderRadius: 'control',
    bg: 'transparent',
    color: 'inkVariant',
    fontSize: 'sm',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    _hover: { bg: 'floating', color: 'ink' }
  },
  variants: { active: { true: { bg: 'floating', color: 'ink', fontWeight: 'medium' } } }
})

function Segments({ label, value, items, onChange }: { label: string; value: string; items: Segment[]; onChange: (value: string) => void }) {
  return (
    <div className={css({ display: 'flex', alignItems: 'center', gap: '1.5' })}>
      <Label>{label}</Label>
      <div role="tablist" aria-label={label} className={css({ display: 'flex', gap: '0.5', p: '0.5', borderRadius: 'control', bg: 'container' })}>
        {items.map((item) => (
          <Seg type="button" key={item.value} active={value === item.value} aria-pressed={value === item.value} onClick={() => onChange(item.value)}>
            {item.label}{item.count === undefined ? '' : ` ${item.count}`}
          </Seg>
        ))}
      </div>
    </div>
  )
}

export type TrainerToolbarProps = {
  sets: string[]
  set: string
  onSet: (value: string) => void
  subsets: string[]
  subset: string
  onSubset: (value: string) => void
  learning: string
  learningCounts: { all: number; unlearned: number; learning: number; finished: number }
  onLearning: (value: string) => void
  modes: string[]
  mode: string
  onMode: (value: string) => void
}

export function TrainerToolbar({ sets, set, onSet, subsets, subset, onSubset, learning, learningCounts, onLearning, modes, mode, onMode }: TrainerToolbarProps) {
  return (
    <Bar>
      <div className={css({ display: 'flex', alignItems: 'center', gap: '2' })}>
        <Label>Set</Label>
        <Native aria-label="Case set" value={set} onChange={(event) => onSet(event.target.value)}>
          {sets.map((value) => <option key={value} value={value}>{value}</option>)}
        </Native>
      </div>
      {subsets.length > 0 && (
        <Segments label="Subset" value={subset} items={['All', ...subsets].map((value) => ({ value, label: value }))} onChange={onSubset} />
      )}
      <Segments
        label="Learning"
        value={learning}
        items={[
          { value: 'All', label: 'All', count: learningCounts.all },
          { value: 'Unlearned', label: 'Unlearned', count: learningCounts.unlearned },
          { value: 'Learning', label: 'Learning', count: learningCounts.learning },
          { value: 'Learned', label: 'Learned', count: learningCounts.finished }
        ]}
        onChange={onLearning}
      />
      {/* `mode` can briefly hold a value the new set does not offer — switching to a
          set that is not recognition-eligible leaves it on Recognize until the owning
          effect resets it. Fall back to what that effect will actually settle on, so
          the highlight does not land on a mode that was never selected and then jump.
          Resetting mode here instead would clobber Recognize even when the incoming
          set supports it. */}
      <Segments label="Mode" value={modes.includes(mode) ? mode : (modes.includes(SETTLED_MODE) ? SETTLED_MODE : modes[0])} items={modes.map((value) => ({ value, label: value }))} onChange={onMode} />
    </Bar>
  )
}
