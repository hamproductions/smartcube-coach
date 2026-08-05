/**
 * Ported from Ao1K/Ao1K_site (https://github.com/Ao1K/Ao1K_site).
 * Source: components/notimer/NoTimeSolveBox.tsx.
 *
 * MIT License
 * Copyright (c) 2025 Ao1K
 *
 * Adaptation notes: the original's two confirmation popups (edit-in-place
 * warning, delete warning) were a page-level <ConfirmationBox> this app
 * has no equivalent of. This port keeps the same toggle / two-click-edit /
 * delete affordances but confirms destructive edits with a native
 * `window.confirm`, and the sanitize-html dependency is replaced with
 * this project's own `sanitizeChecklistText` (see
 * src/domain/ao1k/notimerChecklist.ts) since sanitize-html is not a
 * dependency here. The icon-per-item "shape" (Ao1K's textID -> shapesTable
 * lookup) is reproduced by numbering each unique checklist template by
 * order of first appearance rather than by its storage id, since this
 * project keys templates with uuids, not autoincrement integers.
 */
import { useEffect, useRef, useState } from 'react'
import {
  addChecklistItem,
  removeChecklistItem,
  toggleChecklistItem,
  updateChecklistItemText,
  type ChecklistItem,
  type ChecklistLocation
} from '../../domain/ao1k/notimerChecklist'
import { shapeForId } from '../../domain/ao1k/shapesTable'

export type NoTimeChecklistProps = {
  items: ChecklistItem[]
  location: ChecklistLocation
  onChange: (next: ChecklistItem[]) => void
  makeId: () => string
}

function useTemplateShapes(items: ChecklistItem[]): Map<string, number> {
  const orderRef = useRef<Map<string, number>>(new Map())
  for (const item of items) {
    if (!orderRef.current.has(item.templateId)) {
      orderRef.current.set(item.templateId, orderRef.current.size + 1)
    }
  }
  return orderRef.current
}

export function NoTimeChecklist({ items, location, onChange, makeId }: NoTimeChecklistProps) {
  const filtered = items.filter((item) => item.location === location)
  const shapes = useTemplateShapes(items)
  const [editingId, setEditingId] = useState<string | null>(null)
  const editRefs = useRef<Record<string, HTMLDivElement | null>>({})

  useEffect(() => {
    if (editingId && editRefs.current[editingId]) {
      const node = editRefs.current[editingId]!
      node.focus()
      const range = document.createRange()
      const selection = window.getSelection()
      range.selectNodeContents(node)
      range.collapse(false)
      selection?.removeAllRanges()
      selection?.addRange(range)
    }
  }, [editingId])

  const handleAdd = () => {
    const next = addChecklistItem(items, location, makeId)
    onChange(next)
    const created = next[next.length - 1]
    if (created) setEditingId(created.id)
  }

  const handleToggle = (id: string) => {
    if (editingId === id) return
    onChange(toggleChecklistItem(items, id))
  }

  const commitEdit = (id: string) => {
    const node = editRefs.current[id]
    const text = node?.innerHTML ?? ''
    onChange(updateChecklistItemText(items, id, text))
    setEditingId(null)
  }

  const handleDelete = (id: string) => {
    if (!window.confirm('Delete this checklist item? The history of past solves keeps its own copy.')) return
    onChange(removeChecklistItem(items, id))
  }

  return (
    <div className="ao1k-notimer-checklist">
      <div className="ao1k-notimer-checklist__label">{location === 'pre' ? 'Pre-solve' : 'Post-solve'} checklist</div>
      {filtered.map((item) => {
        const isEditing = editingId === item.id
        return (
          <div key={item.id} className="ao1k-notimer-checklist__row">
            <div
              className="ao1k-notimer-checklist__toggle"
              role="button"
              aria-label={item.text ? `Toggle ${item.text}` : 'Toggle checklist item'}
              tabIndex={0}
              onClick={() => handleToggle(item.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  handleToggle(item.id)
                }
              }}
            >
              <span className="ao1k-notimer-checklist__shape" aria-hidden="true">
                {shapeForId(shapes.get(item.templateId) ?? 0)}
              </span>
              <input type="checkbox" checked={item.checked} readOnly tabIndex={-1} />
              <div
                ref={(node) => {
                  editRefs.current[item.id] = node
                }}
                className="ao1k-notimer-checklist__text"
                contentEditable={isEditing}
                suppressContentEditableWarning
                style={{ pointerEvents: isEditing ? 'auto' : 'none' }}
                onBlur={() => isEditing && commitEdit(item.id)}
                onClick={(event) => isEditing && event.stopPropagation()}
                dangerouslySetInnerHTML={{ __html: item.text }}
              />
            </div>
            <div className="ao1k-notimer-checklist__actions">
              <button type="button" onClick={() => setEditingId(item.id)} aria-label="Edit item">
                ✎
              </button>
              <button type="button" onClick={() => handleDelete(item.id)} aria-label="Delete item">
                ✕
              </button>
            </div>
          </div>
        )
      })}
      <button type="button" className="ao1k-notimer-checklist__add" onClick={handleAdd}>
        + Add item
      </button>
    </div>
  )
}
