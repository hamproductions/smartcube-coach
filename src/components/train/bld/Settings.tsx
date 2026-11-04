import { useEffect, useId, useState } from 'react'
import { css } from 'styled-system/css'
import { Button } from '../../ui/Button'
import { Icon, IC } from '../../ui/Icon'
import { validateConfig, type BldConfig } from './config'
import { fieldClass, fieldStyle, focusRing } from './ui'

export function Settings({ config, open, onToggle, onApply }: { config: BldConfig; open: boolean; onToggle: (open: boolean) => void; onApply: (config: BldConfig) => Promise<void> }) {
  const panelId = useId()
  const [buffer, setBuffer] = useState(config.buffer)
  const [scheme, setScheme] = useState(config.letterScheme)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setBuffer(config.buffer)
    setScheme(config.letterScheme)
  }, [config])

  const apply = async () => {
    try {
      const next = validateConfig(buffer, scheme)
      await onApply(next)
      setError('')
      setSaved(true)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Those settings do not work')
      setSaved(false)
    }
  }

  return (
    <section aria-label="Memo settings" className={css({ display: 'flex', flexDirection: 'column', gap: '3' })}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => onToggle(!open)}
        className={css({ display: 'inline-flex', alignItems: 'center', gap: '2', alignSelf: 'flex-start', minH: '44px', px: '3', borderRadius: 'control', borderWidth: '1px', borderColor: 'floating', bg: 'container', color: 'inkVariant', fontSize: 'sm', cursor: 'pointer', _hover: { color: 'ink' }, ...focusRing })}
      >
        <span className={css({ display: 'inline-flex', transition: 'transform 0.15s ease', transform: open ? 'rotate(-90deg)' : 'rotate(180deg)' })}><Icon d={IC.back} size={14} /></span>
        Settings
        <span className={css({ fontFamily: 'mono', fontSize: 'xs', color: 'outline' })}>buffer {config.buffer} · {config.letterScheme.slice(0, 6)}…</span>
      </button>
      {open && (
        <form
          id={panelId}
          onSubmit={(event) => { event.preventDefault(); void apply() }}
          className={css({ display: 'grid', gap: '3', gridTemplateColumns: { base: '1fr', md: '6rem minmax(0, 1fr) auto' }, alignItems: 'end', p: '4', borderRadius: 'card', bg: 'container', borderWidth: '1px', borderColor: 'floating' })}
        >
          <label className={css({ display: 'grid', gap: '1.5', fontSize: 'sm' })}>
            Buffer
            <input aria-label="Buffer" value={buffer} maxLength={1} autoComplete="off" spellCheck={false} onChange={(event) => { setBuffer(event.target.value); setSaved(false) }} className={fieldClass} />
          </label>
          <label className={css({ display: 'grid', gap: '1.5', fontSize: 'sm', minW: '0' })}>
            Letter scheme, 24 letters in sticker order
            <input aria-label="Letter scheme" value={scheme} autoComplete="off" spellCheck={false} onChange={(event) => { setScheme(event.target.value); setSaved(false) }} className={css({ ...fieldStyle, fontSize: 'md' })} />
          </label>
          <Button type="submit" variant="outline">Apply</Button>
          {error && <p role="alert" className={css({ gridColumn: '1 / -1', color: 'error', fontSize: 'sm' })}>{error}</p>}
          {saved && !error && <p role="status" className={css({ gridColumn: '1 / -1', color: 'inkVariant', fontSize: 'sm' })}>Saved. The memo now uses these letters.</p>}
        </form>
      )}
    </section>
  )
}
