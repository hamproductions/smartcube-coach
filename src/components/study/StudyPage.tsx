import { css } from 'styled-system/css'
import { SectionTabs } from '../ui/SectionTabs'
import { StudyLibrary } from './StudyLibrary'
import { ReconstructEditor } from '../ReconstructEditor'
import { RecoStudy } from '../RecoStudy'

const TABS = [
  { id: 'saved', label: 'Saved solves' },
  { id: 'read', label: 'Read a solve' },
  { id: 'reconstruct', label: 'Fix a reconstruction' }
]

export function StudyPage({ tab }: { tab?: string }) {
  const active = TABS.some((entry) => entry.id === tab) ? tab! : 'saved'
  return (
    <div className={css({ w: 'full', maxW: '1280px', mx: 'auto', px: { base: '4', md: '8' }, py: { base: '4', md: '6' }, display: 'flex', flexDirection: 'column', gap: '6' })}>
      <header className={css({ display: 'flex', flexDirection: 'column', gap: '1' })}>
        <h1 className={css({ fontSize: { base: 'xl', md: '2xl' }, fontWeight: 'semibold', letterSpacing: '-0.02em' })}>Study</h1>
        <p className={css({ color: 'inkVariant', fontSize: 'sm' })}>Read solves move by move: other people's, and your own recorded ones.</p>
      </header>
      <SectionTabs section="study" tabs={TABS} active={active} label="Study views" />
      {active === 'saved' && <StudyLibrary />}
      {active === 'read' && <RecoStudy />}
      {active === 'reconstruct' && <ReconstructEditor />}
    </div>
  )
}
