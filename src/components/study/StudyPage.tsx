import { SectionTabs } from '../ui/SectionTabs'
import { StudyLibrary } from './StudyLibrary'
import { ReconstructEditor } from '../ReconstructEditor'
import { RecoStudy } from '../RecoStudy'
import { PageHeader, pageFrameRaw } from '../ui/Page'
import { css } from 'styled-system/css'

const TABS = [
  { id: 'saved', label: 'Saved solves' },
  { id: 'read', label: 'Read a solve' },
  { id: 'reconstruct', label: 'Fix moves' }
]

export function StudyPage({ tab }: { tab?: string }) {
  const active = TABS.some((entry) => entry.id === tab) ? tab! : 'saved'
  return (
    <div className={css(pageFrameRaw, { gap: { base: '6', md: '8' } })}>
      <PageHeader title="Study" description="Read solves move by move: other people's, and your own." />
      <SectionTabs section="study" tabs={TABS} active={active} label="Study views" />
      {active === 'saved' && <StudyLibrary />}
      {active === 'read' && <RecoStudy />}
      {active === 'reconstruct' && <ReconstructEditor />}
    </div>
  )
}
