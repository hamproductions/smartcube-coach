import { useEffect, useRef, useState, type ReactNode } from 'react'
import { css, cx } from 'styled-system/css'
import { DASH } from '../../ui/Page'
import { Cube3D } from '../../solve/Cube3D'

export const focusRing = { _focusVisible: { outline: '2px solid', outlineColor: 'green', outlineOffset: '2px' } } as const

export const numberClass = css({ fontFamily: 'mono', fontVariantNumeric: 'tabular-nums' })

export const labelClass = css({ fontSize: 'xs', color: 'inkVariant' })

export const seconds = (ms: number | undefined) => ms === undefined ? DASH : (ms / 1000).toFixed(2)

export function CubeStage({ setupAlg, caption }: { setupAlg: string; caption?: ReactNode }) {
  return (
    <figure className={css({ display: 'grid', gap: '2', justifyItems: 'center', m: '0', w: 'full' })}>
      <div className={css({ w: 'full', maxW: { base: '220px', md: '360px', xl: '420px' }, aspectRatio: '1', mx: 'auto' })}>
        <Cube3D setupAlg={setupAlg} />
      </div>
      {caption ? <figcaption className={css({ display: { base: 'none', md: 'block' }, fontSize: 'sm', color: 'inkVariant', textAlign: 'center' })}>{caption}</figcaption> : null}
    </figure>
  )
}

export function Segmented<T extends string>({ label, options, value, onChange, labels }: { label: string; options: readonly T[]; value: T; onChange: (value: T) => void; labels: Record<T, string> }) {
  return (
    <div role="group" aria-label={label} className={css({ display: 'inline-flex', p: '1', gap: '1', borderRadius: 'card', bg: 'container', borderWidth: '1px', borderColor: 'floating', flexWrap: 'wrap' })}>
      {options.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={value === option}
          onClick={() => onChange(option)}
          className={css(
            { minH: '44px', minW: '44px', px: '3', borderRadius: 'control', fontSize: 'sm', fontWeight: 'medium', cursor: 'pointer', color: 'inkVariant', bg: 'transparent', _hover: { color: 'ink' }, ...focusRing },
            value === option && { bg: 'floating', color: 'ink' }
          )}
        >
          {labels[option]}
        </button>
      ))}
    </div>
  )
}

export function Toggle({ pressed, onChange, children }: { pressed: boolean; onChange: (pressed: boolean) => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={() => onChange(!pressed)}
      className={css(
        { display: 'inline-flex', alignItems: 'center', gap: '2', minH: 'touch', px: '3', borderRadius: 'card', borderWidth: '1px', borderColor: 'floating', bg: 'container', color: 'inkVariant', fontSize: 'sm', fontWeight: 'medium', cursor: 'pointer', _hover: { color: 'ink' }, ...focusRing },
        pressed && { color: 'ink', borderColor: 'green' }
      )}
    >
      <span aria-hidden className={css({ w: '3', h: '3', borderRadius: 'pill', borderWidth: '2px', borderColor: 'outline' }, pressed && { bg: 'green', borderColor: 'green' })} />
      {children}
    </button>
  )
}

export function Key({ children }: { children: ReactNode }) {
  return <kbd className={css({ fontFamily: 'mono', fontSize: '2xs', px: '1.5', py: '0.5', borderRadius: 'control', borderWidth: '1px', borderColor: 'floating', color: 'inkVariant', bg: 'surface' })}>{children}</kbd>
}

export function LiveClock({ since, className }: { since: number; className?: string }) {
  const [now, setNow] = useState(() => performance.now())
  useEffect(() => {
    let frame = 0
    const tick = () => {
      setNow(performance.now())
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [since])
  return <span className={cx(numberClass, className)}>{seconds(Math.max(0, now - since))}</span>
}

export type StripStat = { label: string; value: ReactNode }

export function SessionStrip({ stats, recent }: { stats: StripStat[]; recent: Array<{ success: boolean; label: string; text: string }> }) {
  return (
    <section aria-label="Session" className={css({ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', columnGap: '6', rowGap: '3', pt: '4', borderTopWidth: '1px', borderColor: 'rule' })}>
      {stats.map((stat) => (
        <div key={stat.label} className={css({ display: 'grid' })}>
          <span className={labelClass}>{stat.label}</span>
          <span className={cx(numberClass, css({ fontSize: 'lg', color: 'ink', lineHeight: '1.2' }))}>{stat.value}</span>
        </div>
      ))}
      {recent.length ? (
        <ol aria-label="Last attempts" className={css({ display: 'flex', flexWrap: 'wrap', gap: '1', listStyle: 'none', p: '0', m: '0' })}>
          {recent.map((entry, index) => (
            <li
              key={index}
              aria-label={entry.label}
              className={cx(
                numberClass,
                css({ fontSize: 'xs', px: '1.5', py: '0.5', borderRadius: 'control', borderWidth: '1px' }),
                entry.success ? css({ borderColor: 'green', color: 'green' }) : css({ borderColor: 'error', color: 'error' })
              )}
            >
              {entry.text}
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  )
}

export function useKeys(handler: (event: KeyboardEvent) => boolean | void) {
  const ref = useRef(handler)
  ref.current = handler
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || event.metaKey || event.ctrlKey || event.altKey) return
      if (document.querySelector('[role=dialog]')) return
      if (event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable="true"]')) return
      if ((event.key === ' ' || event.key === 'Enter') && event.target instanceof Element && event.target.closest('button, a')) return
      if (ref.current(event)) event.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [ref])
}
