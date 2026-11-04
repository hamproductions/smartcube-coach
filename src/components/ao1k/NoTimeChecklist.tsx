import { useState } from 'react'
import { css } from 'styled-system/css'
import {
  addChecklistItem,
  removeChecklistItem,
  toggleChecklistItem,
  updateChecklistItemText,
  type ChecklistItem,
  type ChecklistLocation
} from '../../domain/ao1k/notimerChecklist'

export type NoTimeChecklistProps = {
  items: ChecklistItem[]
  location: ChecklistLocation
  onChange: (next: ChecklistItem[]) => void
  makeId: () => string
}

const plain = (html: string) => html.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim()

const small = css({
  px: '2', minH: '44px', borderRadius: 'control', fontSize: 'xs', color: 'inkVariant', cursor: 'pointer', bg: 'transparent',
  _hover: { color: 'ink', bg: 'floating' }, _focusVisible: { outline: '2px solid', outlineColor: 'green' }
})

export function NoTimeChecklist({ items, location, onChange, makeId }: NoTimeChecklistProps) {
  const filtered = items.filter((item) => item.location === location)
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const add = () => {
    const next = addChecklistItem(items, location, makeId)
    onChange(next)
    const created = next[next.length - 1]
    if (created) setEditing({ id: created.id, text: '' })
  }

  const commit = () => {
    if (!editing) return
    onChange(editing.text.trim() ? updateChecklistItemText(items, editing.id, editing.text) : removeChecklistItem(items, editing.id))
    setEditing(null)
  }

  return (
    <section aria-label={location === 'pre' ? 'Before the solve' : 'After the solve'} className={css({ display: 'flex', flexDirection: 'column', gap: '2' })}>
      <h2 className={css({ fontSize: 'sm', fontWeight: 'semibold' })}>{location === 'pre' ? 'Before the solve' : 'After the solve'}</h2>
      {filtered.length === 0 && <p className={css({ fontSize: 'sm', color: 'inkVariant' })}>{location === 'pre' ? 'Add what you want to check before you start, for example "Plan the cross and first pair".' : 'Add what you want to note after, for example "Any pause longer than a second?".'}</p>}
      <ul className={css({ listStyle: 'none', m: '0', p: '0', display: 'flex', flexDirection: 'column', gap: '1' })}>
        {filtered.map((item) => {
          const text = plain(item.text)
          return (
            <li key={item.id} className={css({ display: 'flex', alignItems: 'center', gap: '2', minH: '11', px: '2', borderRadius: 'control', bg: 'container', borderWidth: '1px', borderColor: 'floating' })}>
              {editing?.id === item.id ? (
                <form onSubmit={(event) => { event.preventDefault(); commit() }} className={css({ flex: '1', display: 'flex', gap: '2' })}>
                  <input
                    autoFocus
                    aria-label="Checklist item text"
                    value={editing.text}
                    onChange={(event) => setEditing({ id: item.id, text: event.target.value })}
                    onBlur={commit}
                    className={css({ flex: '1', minW: '0', bg: 'surface', color: 'ink', px: '2', minH: '9', borderRadius: 'control', borderWidth: '1px', borderColor: 'outline', fontSize: 'sm' })}
                  />
                </form>
              ) : (
                <label className={css({ flex: '1', display: 'flex', alignItems: 'center', gap: '3', cursor: 'pointer', minW: '0' })}>
                  <input
                    type="checkbox"
                    aria-label={text ? `Toggle ${text}` : 'Toggle checklist item'}
                    checked={item.checked}
                    onChange={() => onChange(toggleChecklistItem(items, item.id))}
                    className={css({ w: '5', h: '5', accentColor: '#22c55e', flexShrink: '0' })}
                  />
                  <span className={css({ fontSize: 'sm', color: item.checked ? 'inkVariant' : 'ink', textDecoration: item.checked ? 'line-through' : 'none', overflowWrap: 'anywhere' })}>{text || 'Untitled item'}</span>
                </label>
              )}
              {deleting === item.id ? (
                <span className={css({ display: 'flex', alignItems: 'center', gap: '1', fontSize: 'xs' })}>
                  Delete?
                  <button type="button" className={small} onClick={() => { onChange(removeChecklistItem(items, item.id)); setDeleting(null) }}>Yes, delete</button>
                  <button type="button" className={small} onClick={() => setDeleting(null)}>Keep</button>
                </span>
              ) : editing?.id !== item.id && (
                <span className={css({ display: 'flex', gap: '1' })}>
                  <button type="button" className={small} aria-label="Edit item" onClick={() => setEditing({ id: item.id, text })}>Edit</button>
                  <button type="button" className={small} aria-label="Delete item" onClick={() => setDeleting(item.id)}>Delete</button>
                </span>
              )}
            </li>
          )
        })}
      </ul>
      <button type="button" onClick={add} className={css({ alignSelf: 'flex-start', px: '3', minH: '11', borderRadius: 'control', borderWidth: '1px', borderStyle: 'dashed', borderColor: 'outline', color: 'inkVariant', fontSize: 'sm', cursor: 'pointer', _hover: { color: 'ink' }, _focusVisible: { outline: '2px solid', outlineColor: 'green' } })}>Add item</button>
    </section>
  )
}
