import type { ReactNode } from 'react'
import { css, cx } from 'styled-system/css'
import { Icon, IC } from '../ui/Icon'
import { routeHref, type Section } from '../../app/route'

export const NAV: Array<{ section: Section; label: string; icon: string | readonly string[] }> = [
  { section: 'solve', label: 'Solve', icon: IC.solve },
  { section: 'train', label: 'Train', icon: IC.target },
  { section: 'stats', label: 'Stats', icon: IC.progress },
  { section: 'study', label: 'Study', icon: IC.study },
  { section: 'settings', label: 'Settings', icon: IC.train }
]

const navLink = css({
  display: 'flex', alignItems: 'center', gap: '2',
  px: '3.5', h: '9', borderRadius: 'control',
  color: 'inkVariant', fontSize: '14px', fontWeight: 'medium', whiteSpace: 'nowrap',
  textDecoration: 'none', transition: 'color 120ms, background 120ms',
  _hover: { color: 'ink', bg: 'floating' },
  _focusVisible: { outline: '2px solid', outlineColor: 'green', outlineOffset: '2px' },
  '&[aria-current=page]': { color: 'ink', bg: 'floating' }
})

const tabLink = css({
  flex: '1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1',
  minH: '14', color: 'inkVariant', fontSize: '11px', fontWeight: 'medium', textDecoration: 'none',
  _focusVisible: { outline: '2px solid', outlineColor: 'green', outlineOffset: '-2px' },
  '&[aria-current=page]': { color: 'green' }
})

export function AppShell({ active, status, children }: { active: Section; status?: ReactNode; children: ReactNode }) {
  return (
    <div className={css({ h: '100dvh', display: 'flex', flexDirection: 'column', bg: 'surface', color: 'ink' })}>
      <header className={css({
        flexShrink: '0', display: 'flex', alignItems: 'center', gap: '4',
        h: '14', px: { base: '4', md: '6' },
        borderBottomWidth: '1px', borderColor: 'floating', bg: 'surface'
      })}>
        <a href={routeHref({ section: 'solve' })} className={css({ display: 'flex', alignItems: 'center', gap: '2.5', color: 'ink', textDecoration: 'none', flexShrink: '0' })}>
          <span className={css({ w: '7', h: '7', borderRadius: 'control', bg: 'green', color: 'onGreen', display: 'grid', placeItems: 'center' })}>
            <Icon d={IC.cube} size={16} strokeWidth={2} />
          </span>
          <span className={css({ fontWeight: 'semibold', fontSize: '15px', letterSpacing: '-0.01em' })}>Smart Cube Coach</span>
        </a>
        <nav aria-label="Primary" className={css({ display: { base: 'none', md: 'flex' }, gap: '1', mx: 'auto' })}>
          {NAV.map((item) => (
            <a key={item.section} href={routeHref({ section: item.section })} aria-current={active === item.section ? 'page' : undefined} className={navLink}>
              <Icon d={item.icon} size={16} />
              {item.label}
            </a>
          ))}
        </nav>
        <div className={css({ ml: { base: 'auto', md: '0' }, display: 'flex', alignItems: 'center', gap: '3', minW: '0' })}>{status}</div>
      </header>

      <main className={css({ flex: '1', minH: '0', overflowY: 'auto', display: 'flex', flexDirection: 'column' })}>{children}</main>

      <nav aria-label="Primary mobile" className={cx(css({
        display: { base: 'flex', md: 'none' }, flexShrink: '0',
        borderTopWidth: '1px', borderColor: 'floating', bg: 'container',
        pb: 'env(safe-area-inset-bottom, 0px)'
      }))}>
        {NAV.map((item) => (
          <a key={item.section} href={routeHref({ section: item.section })} aria-current={active === item.section ? 'page' : undefined} className={tabLink}>
            <Icon d={item.icon} size={20} />
            {item.label}
          </a>
        ))}
      </nav>
    </div>
  )
}
