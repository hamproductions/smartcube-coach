import { css } from 'styled-system/css'
import { routeHref, type Section } from '../../app/route'

export function SectionTabs({ section, tabs, active, label }: { section: Section; tabs: Array<{ id: string; label: string }>; active: string; label: string }) {
  return (
    <nav aria-label={label} className={css({ display: 'flex', gap: '1', overflowX: 'auto', borderBottomWidth: '1px', borderColor: 'floating' })}>
      {tabs.map((tab) => (
        <a
          key={tab.id}
          href={routeHref({ section, detail: tab.id })}
          aria-current={tab.id === active ? 'page' : undefined}
          className={css({
            px: '3', py: '2.5', mb: '-1px', whiteSpace: 'nowrap', fontSize: 'sm', fontWeight: 'medium',
            color: 'inkVariant', textDecoration: 'none', borderBottomWidth: '2px', borderColor: 'transparent',
            _hover: { color: 'ink' },
            _focusVisible: { outline: '2px solid', outlineColor: 'green', outlineOffset: '-2px' },
            '&[aria-current=page]': { color: 'ink', borderColor: 'green' }
          })}
        >{tab.label}</a>
      ))}
    </nav>
  )
}
