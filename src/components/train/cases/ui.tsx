import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { css, cx } from 'styled-system/css'

export const focusRing = css({ _focusVisible: { outline: '2px solid', outlineColor: 'green', outlineOffset: '2px' } })

export const mono = css({ fontFamily: 'mono', fontVariantNumeric: 'tabular-nums' })

export const card = css({ bg: 'container', borderWidth: '1px', borderColor: 'floating', borderRadius: 'card' })

export const labelText = css({ fontSize: 'xs', color: 'inkVariant', fontWeight: 'medium' })

export function Chip({ active, count, children, className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean; count?: number }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cx(
        css({
          display: 'inline-flex', alignItems: 'center', gap: '2', minH: '44px', px: '4',
          borderRadius: 'control', borderWidth: '1px', borderColor: 'floating', bg: 'container',
          color: 'ink', fontSize: 'sm', cursor: 'pointer', whiteSpace: 'nowrap',
          transition: 'border-color 0.15s ease, background-color 0.15s ease',
          _hover: { borderColor: 'outline' },
          _pressed: { bg: 'floating', borderColor: 'green', fontWeight: 'semibold' },
          _disabled: { opacity: '0.4', cursor: 'not-allowed' }
        }),
        focusRing,
        className
      )}
      {...props}
    >
      {children}
      {count !== undefined && <>{' '}<span className={cx(mono, css({ fontSize: 'xs', color: 'inkVariant' }))}>{count}</span></>}
    </button>
  )
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className={cx(mono, css({ px: '1.5', py: '0.5', borderRadius: 'control', borderWidth: '1px', borderColor: 'currentColor', fontSize: '2xs', opacity: '0.7', fontWeight: 'normal', display: { base: 'none', md: 'inline' } }))}>{children}</kbd>
  )
}

export function Action({ primary, compact, hotkey, children, className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { primary?: boolean; compact?: boolean; hotkey?: string }) {
  const look = primary
    ? css({
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '3',
        minH: '56px', px: '6', borderRadius: 'control', borderWidth: '1px',
        fontSize: 'md', fontWeight: 'semibold', cursor: 'pointer', whiteSpace: 'nowrap',
        bg: 'green', borderColor: 'green', color: 'onGreen',
        _hover: { bg: 'greenBright', borderColor: 'greenBright' },
        _disabled: { opacity: '0.4', cursor: 'not-allowed', _hover: { bg: 'green', borderColor: 'green' } }
      })
    : css({
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '3',
        minH: '48px', px: compact ? '3' : '5', borderRadius: 'control', borderWidth: '1px',
        fontSize: 'sm', fontWeight: 'medium', cursor: 'pointer', whiteSpace: 'nowrap',
        bg: 'floating', borderColor: 'floating', color: 'ink',
        _hover: { borderColor: 'outline' },
        _disabled: { opacity: '0.4', cursor: 'not-allowed' }
      })
  return (
    <button type="button" className={cx(look, focusRing, className)} {...props}>
      {children}
      {hotkey && <Kbd>{hotkey}</Kbd>}
    </button>
  )
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'error'; children: ReactNode }) {
  return (
    <p
      role={tone === 'error' ? 'alert' : 'status'}
      className={css({ px: '4', py: '3', fontSize: 'sm', bg: 'container', borderWidth: '1px', borderRadius: 'card', color: tone === 'error' ? 'error' : 'inkVariant', borderColor: tone === 'error' ? 'error' : 'floating' })}
    >{children}</p>
  )
}

export function Stat({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'bad' }) {
  return (
    <div className={css({ display: 'flex', flexDirection: 'column', gap: '0.5', minW: '0' })}>
      <span className={labelText}>{label}</span>
      <span className={cx(mono, css({ fontSize: 'lg', fontWeight: 'semibold', color: tone === 'good' ? 'green' : tone === 'bad' ? 'error' : 'ink' }))}>{value || '-'}</span>
    </div>
  )
}
