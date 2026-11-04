import type { ReactNode } from 'react'
import { css } from 'styled-system/css'

export const pageFrameRaw = css.raw({
  w: 'full', maxW: '1180px', mx: 'auto', px: { base: '4', md: '8' }, py: { base: '6', md: '8' },
  display: 'flex', flexDirection: 'column', gap: { base: '8', md: '10' }
})
export const pageFrame = css(pageFrameRaw)

export function PageHeader({ title, description, children }: { title: string; description: string; children?: ReactNode }) {
  return (
    <header className={css({ display: 'flex', flexDirection: 'column', gap: '1' })}>
      {children}
      <h1 className={css({ fontSize: { base: 'xl', md: '2xl' }, fontWeight: 'semibold', letterSpacing: '-0.02em' })}>{title}</h1>
      <p className={css({ color: 'inkVariant', fontSize: 'sm', maxW: '70ch' })}>{description}</p>
    </header>
  )
}

export function Section({ title, description, action, children, id }: { title: string; description?: ReactNode; action?: ReactNode; children: ReactNode; id?: string }) {
  const headingId = id ? `${id}-heading` : undefined
  return (
    <section id={id} aria-labelledby={headingId} className={css({ display: 'flex', flexDirection: 'column', gap: '4', minW: '0' })}>
      <div className={css({ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '3', flexWrap: 'wrap' })}>
        <div className={css({ display: 'flex', flexDirection: 'column', gap: '1', minW: '0' })}>
          <h2 id={headingId} className={sectionTitle}>{title}</h2>
          {description && <p className={css({ color: 'inkVariant', fontSize: 'sm', maxW: '70ch' })}>{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

export const sectionTitle = css({ fontSize: 'md', fontWeight: 'semibold', color: 'ink' })

export const card = css({ bg: 'container', borderWidth: '1px', borderColor: 'floating', borderRadius: 'card' })

const buttonBase = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '2',
  minH: '44px', px: '4', borderRadius: 'control', borderWidth: '1px',
  fontSize: 'sm', fontWeight: 'medium', whiteSpace: 'nowrap', cursor: 'pointer', textDecoration: 'none',
  transition: 'background 120ms, border-color 120ms, color 120ms',
  _focusVisible: { outline: '2px solid', outlineColor: 'green', outlineOffset: '2px' },
  _disabled: { opacity: '0.45', cursor: 'not-allowed' }
} as const

export const primaryRaw = css.raw(buttonBase, { bg: 'green', borderColor: 'green', color: 'onGreen', fontWeight: 'semibold', _hover: { bg: 'greenBright' }, _disabled: { _hover: { bg: 'green' } } })
export const secondaryRaw = css.raw(buttonBase, { bg: 'transparent', borderColor: 'floating', color: 'ink', _hover: { bg: 'floating' }, _disabled: { _hover: { bg: 'transparent' } } })
export const dangerRaw = css.raw(buttonBase, { bg: 'transparent', borderColor: 'error', color: 'error', _hover: { bg: 'rgba(255,180,171,0.12)' } })

export const primaryButton = css(primaryRaw)
export const secondaryButton = css(secondaryRaw)
export const dangerButton = css(dangerRaw)

export const textInputRaw = css.raw({
  w: 'full', minH: '44px', px: '3', py: '2', borderRadius: 'control',
  bg: 'surface', color: 'ink', borderWidth: '1px', borderColor: 'floating', fontSize: 'sm',
  _placeholder: { color: 'outline' },
  _focusVisible: { outline: '2px solid', outlineColor: 'green', outlineOffset: '1px', borderColor: 'green' }
})
export const textInput = css(textInputRaw)

export const fieldLabel = css({ display: 'flex', flexDirection: 'column', gap: '1.5', fontSize: 'sm', color: 'inkVariant', minW: '0' })

export const mono = css({ fontFamily: 'mono', fontVariantNumeric: 'tabular-nums' })

export const DASH = '–'

export const plain = (text: string) => text.replace(/\s*—\s*/g, ', ')
