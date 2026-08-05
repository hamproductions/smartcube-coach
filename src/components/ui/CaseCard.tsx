import { styled } from 'styled-system/jsx'
import { css } from 'styled-system/css'
import { CasePreview } from './CasePreview'

// Ported from docs/design/stitch/training_case_library/code.html. A card is a status pill
// floating over a 128px picture, then a body with the case name, its group badge, and the
// algorithm itself in a bordered mono inset. An unlearned case is dimmed and desaturated
// so the grid reads as progress at a glance.

const Card = styled('button', {
  base: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    textAlign: 'left',
    overflow: 'hidden',
    borderRadius: 'card',
    borderWidth: '1px',
    borderColor: 'floating',
    bg: 'container',
    cursor: 'pointer',
    transition: 'border-color 0.2s ease, background 0.2s ease',
    _hover: { borderColor: 'outline', bg: 'floating' }
  },
  variants: {
    selected: { true: { borderColor: 'green' } },
    locked: { true: { opacity: '0.6' } }
  }
})

const StatusPill = styled('span', {
  base: {
    position: 'absolute',
    top: '3',
    right: '3',
    zIndex: '10',
    px: '2',
    py: '0.5',
    borderRadius: 'pill',
    fontFamily: 'sans',
    fontSize: '2xs',
    fontWeight: 'bold',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    whiteSpace: 'nowrap'
  },
  variants: {
    tone: {
      learned: { bg: 'green', color: 'onGreen' },
      learning: { bg: 'amber', color: '#231a00' },
      locked: { bg: 'floating', color: 'inkVariant', borderWidth: '1px', borderColor: 'outline' }
    }
  }
})

const Picture = styled('div', {
  base: {
    // 128px, the export's h-32. Written in px because the spacing scale is 4px-based and
    // stops at 20 — '32' would pass straight through as 32px and crush the preview.
    h: '128px',
    w: 'full',
    p: '3',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    bg: 'surface',
    borderBottomWidth: '1px',
    borderColor: 'floating'
  },
  variants: {
    // The export desaturates unlearned cases, but a fresh library is 100% unlearned and
    // the whole grid went grey. Recognition depends on facelet colour, so it stays.
    locked: { true: { opacity: '0.85' } }
  }
})

const Badge = styled('span', {
  base: {
    px: '1.5',
    py: '0.5',
    borderRadius: 'control',
    bg: 'floating',
    color: 'inkVariant',
    fontFamily: 'sans',
    fontSize: '2xs',
    fontWeight: 'bold',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    whiteSpace: 'nowrap'
  }
})

type CaseCardProps = {
  name: string
  badge: string
  setup: string
  alg?: string
  mastery: number
  selected: boolean
  stats?: { label: string; value: string }[]
  onSelect: () => void
  onOpen: () => void
}

// The design's three states map onto the mastery the trainer already tracks, rather than
// a separate flag that could drift away from it.
function statusOf(mastery: number) {
  if (mastery >= 0.8) return 'learned' as const
  if (mastery > 0) return 'learning' as const
  return 'locked' as const
}

export function CaseCard({ name, badge, setup, alg, mastery, selected, stats, onSelect, onOpen }: CaseCardProps) {
  const status = statusOf(mastery)
  const algorithm = alg ?? setup

  return (
    <Card
      type="button"
      data-case-card=""
      selected={selected}
      locked={status === 'locked'}
      aria-pressed={selected}
      // A single click opens the case, as in the export. It used to only toggle a subtle
      // selection border, with the detail hidden behind a double-click — so clicking a
      // card looked like it did nothing. Queue selection moved to the checkbox below.
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        onOpen()
      }}
    >
      {/* Explicit control for building a time-attack queue, since the card body now
          opens the case. */}
      <span
        role="checkbox"
        aria-checked={selected}
        aria-label={`Select ${name} for the queue`}
        tabIndex={0}
        onClick={(event) => { event.stopPropagation(); onSelect() }}
        onKeyDown={(event) => {
          if (event.key !== ' ' && event.key !== 'Enter') return
          event.preventDefault()
          event.stopPropagation()
          onSelect()
        }}
        className={css({
          position: 'absolute', top: '3', left: '3', zIndex: '10',
          w: '5', h: '5', borderRadius: 'control', cursor: 'pointer',
          borderWidth: '1px', borderColor: selected ? 'green' : 'outline',
          bg: selected ? 'green' : 'rgba(9,9,11,0.6)',
          display: 'grid', placeItems: 'center',
          color: 'onGreen', fontSize: '2xs', fontWeight: 'bold'
        })}
      >{selected ? '✓' : ''}</span>

      <StatusPill tone={status}>{status === 'learned' ? 'Learned' : status === 'learning' ? 'Learning' : 'New'}</StatusPill>

      <Picture locked={status === 'locked'}>
        {/* Real renderer, gated on visibility exactly as cubedex does, so a 167-card
            grid only ever mounts a handful of players. */}
        <CasePreview setup={setup} set={badge} size={104} />
      </Picture>

      <div className={css({ p: '4', display: 'flex', flexDirection: 'column', gap: '2' })}>
        <div className={css({ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '2' })}>
          <span className={css({ fontSize: 'md', fontWeight: 'bold', color: 'ink', lineHeight: 'tight' })}>{name}</span>
          <Badge>{badge}</Badge>
        </div>

        {/* The algorithm is the reason the card exists — show it, don't hide it behind a click. */}
        <div
          title={algorithm}
          className={css({
            px: '2', py: '1.5', borderRadius: 'control', bg: 'surface',
            borderWidth: '1px', borderColor: 'floating',
            fontFamily: 'mono', fontSize: 'xs', color: 'greenBright',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
          })}
        >{algorithm}</div>

        {stats?.length ? (
          <div className={css({ display: 'flex', flexWrap: 'wrap', gap: '3', fontFamily: 'mono', fontSize: '2xs', color: 'inkVariant' })}>
            {/* Label and value are separate elements: as one text node the value could not
                be read (or asserted) on its own. */}
            {stats.map((stat) => (
              <span key={stat.label} className={css({ display: 'inline-flex', gap: '1' })}>
                <span>{stat.label}</span><span>{stat.value}</span>
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </Card>
  )
}
