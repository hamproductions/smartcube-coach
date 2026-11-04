import { css } from 'styled-system/css'

export const focusRing = { _focusVisible: { outline: '2px solid', outlineColor: 'green', outlineOffset: '2px' } } as const

export const labelClass = css({ fontSize: 'xs', color: 'inkVariant' })

export const monoClass = css({ fontFamily: 'mono', fontVariantNumeric: 'tabular-nums' })

export const kbdClass = css({ fontFamily: 'mono', fontSize: 'xs', opacity: '0.7', display: { base: 'none', md: 'inline' } })

export const fieldStyle = {
  w: 'full', fontFamily: 'mono', fontSize: 'xl', letterSpacing: '0.08em', textTransform: 'uppercase', px: '4', minH: '14',
  borderRadius: 'control', bg: 'container', borderWidth: '1px', borderColor: 'floating', color: 'ink',
  _placeholder: { color: 'outline', textTransform: 'none', letterSpacing: 'normal' }, ...focusRing
} as const

export const fieldClass = css(fieldStyle)

export const choiceClass = css({
  minH: '44px', minW: '44px', px: '3', borderRadius: 'control', borderWidth: '1px', borderColor: 'floating', bg: 'container',
  fontFamily: 'mono', fontSize: 'md', fontVariantNumeric: 'tabular-nums', color: 'ink', cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '2',
  _hover: { bg: 'floating' }, '&[data-picked]': { borderColor: 'green' }, ...focusRing
})
