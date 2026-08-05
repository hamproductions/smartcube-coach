import type { ReactNode } from 'react'
import { css } from 'styled-system/css'
import { styled } from 'styled-system/jsx'

// Rebuilt against docs/design/stitch/solve_cockpit_kinetic_logic_aligned/screen.png.
// Brand and tagline left, a bordered nav pill-group centred, Connect and status right.
// The app is a fixed-height flex column that never scrolls; only panes scroll.

const Header = styled('header', {
  base: {
    flexShrink: '0',
    display: 'grid',
    gridTemplateColumns: '1fr auto 1fr',
    alignItems: 'center',
    px: '6',
    py: '4',
    bg: 'container',
    borderBottomWidth: '1px',
    borderColor: 'floating'
  }
})

const NavGroup = styled('nav', {
  base: {
    display: 'flex',
    alignItems: 'center',
    gap: '1',
    p: '1',
    bg: 'floating',
    borderRadius: 'control',
    borderWidth: '1px',
    borderColor: '#353437'
  }
})

const NavItem = styled('button', {
  base: {
    display: 'flex',
    alignItems: 'center',
    gap: '2',
    px: '4',
    py: '2',
    borderRadius: 'control',
    bg: 'transparent',
    color: 'inkVariant',
    fontSize: '14px',
    fontWeight: 'medium',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    _hover: { color: 'ink' }
  },
  variants: {
    active: { true: { bg: '#353437', color: 'ink' } }
  }
})

// Ported from docs/design/stitch/training_case_library/code.html: a 256px rail with the
// brand at the top, the destinations below it, and a bottom group. It REPLACES the
// header nav rather than joining it — five export screens carry this rail and the two
// Kinetic Logic aligned screens carry a header pill-group instead, so shipping both
// would give the same five destinations two controls at once.
const Sidebar = styled('nav', {
  base: {
    display: 'flex',
    // Horizontal, scrollable bar on small screens; 256px rail from lg up. One DOM node
    // either way, so the accessibility tree has exactly one primary navigation.
    flexDirection: 'row',
    overflowX: 'auto',
    w: 'full',
    lg: { flexDirection: 'column', w: '256px', overflowX: 'visible' },
    flexShrink: '0',
    py: '6',
    bg: 'container',
    borderRightWidth: '1px',
    borderColor: 'floating'
  }
})

const SideItem = styled('button', {
  base: {
    display: 'flex', alignItems: 'center', gap: '4',
    mx: '2', px: '4', py: '3', borderRadius: 'card',
    bg: 'transparent', color: 'inkVariant', cursor: 'pointer',
    fontFamily: 'sans', fontSize: 'xs', fontWeight: 'bold',
    letterSpacing: '0.1em', textTransform: 'uppercase', textAlign: 'left',
    _hover: { bg: 'floating', color: 'ink' }
  },
  variants: {
    active: { true: { bg: 'floating', color: 'green' } }
  }
})

const Action = styled('button', {
  base: {
    display: 'flex',
    alignItems: 'center',
    gap: '2',
    px: '4',
    py: '2',
    borderRadius: 'control',
    bg: 'floating',
    borderWidth: '1px',
    borderColor: '#353437',
    color: 'ink',
    fontSize: '14px',
    cursor: 'pointer',
    _hover: { bg: '#353437' }
  }
})

type AppShellProps = {
  navItems: Array<{ label: string; icon: string | readonly string[] }>
  activeNav: string
  onNavigate: (label: string) => void
  status?: ReactNode
  children: ReactNode
}

export function AppShell({ navItems, activeNav, onNavigate, status, children }: AppShellProps) {
  return (
    <div className={css({ h: '100dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden', bg: 'surface', color: 'ink' })}>
      <Header>
        <div className={css({ display: 'flex', alignItems: 'center', gap: '3' })}>
          <div className={css({
            w: '8', h: '8', borderRadius: 'control', bg: 'green',
            display: 'grid', placeItems: 'center', color: 'onGreen',
            boxShadow: '0 4px 14px rgba(34,197,94,0.2)'
          })}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <div>
            <h1 className={css({ fontWeight: 'bold', fontSize: 'lg', letterSpacing: '-0.02em', color: 'ink', lineHeight: '1' })}>Smart Cube Coach</h1>
            <p className={css({ fontSize: '2xs', color: 'inkVariant', fontWeight: 'medium', letterSpacing: '0.08em', textTransform: 'uppercase', mt: '0.5' })}>Level up your cubing</p>
          </div>
        </div>

        {/* One navigation only. Rendering the same destinations in a header pill-group
            AND the sidebar put two <nav aria-label="Primary navigation"> in the tree, so
            every destination was announced twice and appeared twice to keyboard users.
            The single rail below reflows to a horizontal bar under lg. */}
        <div />

        <div className={css({ display: 'flex', alignItems: 'center', gap: '3', justifySelf: 'end' })}>
          {status}
          {/* The connection control lives in CubeConnectionIndicator (passed via
              `status`), which shows live state next to it. A second Connect button here
              gave the header two controls for one action. */}
        </div>
      </Header>

      <div className={css({ flex: '1', minH: '0', display: 'flex', flexDirection: 'column', overflow: 'hidden', lg: { flexDirection: 'row' } })}>
        <Sidebar aria-label="Primary navigation">
          <div className={css({ display: 'none', lg: { display: 'flex' }, px: '6', mb: '8', flexDirection: 'column', gap: '1' })}>
            <span className={css({ fontFamily: 'sans', fontSize: 'lg', fontWeight: 'bold', color: 'green', letterSpacing: '-0.02em' })}>CUBE_COACH</span>
            <span className={css({ fontFamily: 'sans', fontSize: '2xs', fontWeight: 'bold', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'inkVariant' })}>Smart cube trainer</span>
          </div>
          <div className={css({ flex: '1', display: 'flex', flexDirection: 'row', gap: '2', lg: { flexDirection: 'column' } })}>
            {navItems.map(({ label }) => (
              <SideItem
                key={label}
                type="button"
                active={activeNav === label}
                aria-current={activeNav === label ? 'page' : undefined}
                onClick={() => onNavigate(label)}
              >{label}</SideItem>
            ))}
          </div>
        </Sidebar>

        <main id="top" className={css({ flex: '1', minW: '0', minH: '0', display: 'flex', flexDirection: 'column', overflow: 'hidden' })}>{children}</main>
      </div>
    </div>
  )
}
