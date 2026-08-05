import { useState } from 'react'
import { css } from 'styled-system/css'
import { styled } from 'styled-system/jsx'
import { ReconstructEditor } from '../ReconstructEditor'
import { RecoStudy } from '../RecoStudy'
import { TurnPacer } from '../TurnPacer'
import { NotimerPractice } from '../ao1k/NotimerPractice'
import { Ao1kSettingsPanel } from '../ao1k/Ao1kSettingsPanel'
import type { NotimerChecklistStore } from '../../domain/ao1k/notimerChecklist'

// Written from scratch. The previous Library was five unrelated panels stacked down
// one column because each ported feature was mounted wherever it fit — a leftovers
// bin, not a page. Library has one job: work on a solve you already have. So the page
// is a single workspace with one thing in view at a time, chosen from a rail, instead
// of five things competing down an endless scroll.

type Tool = 'reconstruct' | 'study' | 'pace' | 'checklist' | 'settings'

const TOOLS: Array<{ id: Tool; label: string; blurb: string }> = [
  { id: 'reconstruct', label: 'Reconstruct', blurb: 'Fix the moves we recorded' },
  { id: 'study', label: 'Study', blurb: "Read someone else's solve" },
  { id: 'pace', label: 'Pace', blurb: 'Turn to a metronome' },
  { id: 'checklist', label: 'Checklist', blurb: 'Pre and post solve notes' },
  { id: 'settings', label: 'Settings', blurb: 'Cube colours and playback' }
]

const Rail = styled('nav', {
  base: {
    display: 'grid',
    gap: '0',
    alignContent: 'start',
    borderRightWidth: { base: '0', lg: '1px' },
    borderBottomWidth: { base: '1px', lg: '0' },
    borderColor: 'rule'
  }
})

const RailItem = styled('button', {
  base: {
    display: 'grid',
    gap: '0.5',
    justifyItems: 'start',
    textAlign: 'left',
    px: '0',
    py: '4',
    pr: { lg: '8' },
    bg: 'transparent',
    cursor: 'pointer',
    borderBottomWidth: '1px',
    borderColor: 'rule',
    _last: { borderBottomWidth: '0' }
  },
  variants: {
    active: { true: {} }
  }
})

export function LibraryPage({ notimerStore }: { notimerStore: NotimerChecklistStore }) {
  const [tool, setTool] = useState<Tool>('reconstruct')
  const current = TOOLS.find((entry) => entry.id === tool) ?? TOOLS[0]

  return (
    <div className={css({ display: 'grid', gap: '0', gridTemplateColumns: { base: '1fr', lg: '15rem minmax(0, 1fr)' }, minH: '70vh' })}>
      <Rail aria-label="Library tools">
        {TOOLS.map((entry) => {
          const active = entry.id === tool
          return (
            <RailItem key={entry.id} type="button" active={active} aria-current={active ? 'page' : undefined} onClick={() => setTool(entry.id)}>
              <span className={css({
                fontSize: 'lg',
                letterSpacing: '-0.02em',
                color: active ? 'green' : 'ink'
              })}>{entry.label}</span>
              <span className={css({ fontFamily: 'mono', fontSize: '2xs', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'inkMuted' })}>{entry.blurb}</span>
            </RailItem>
          )
        })}
      </Rail>

      <section className={css({ pl: { lg: '10' }, pt: { base: '8', lg: '0' } })} aria-label={current.label}>
        {tool === 'reconstruct' && <ReconstructEditor />}
        {tool === 'study' && <RecoStudy />}
        {tool === 'pace' && <TurnPacer />}
        {tool === 'checklist' && <NotimerPractice store={notimerStore} />}
        {tool === 'settings' && <Ao1kSettingsPanel />}
      </section>
    </div>
  )
}
