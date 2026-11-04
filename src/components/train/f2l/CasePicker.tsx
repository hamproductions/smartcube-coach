import { useEffect, useRef, useState } from 'react'
import { css, cx } from 'styled-system/css'
import type { AlgorithmRecord } from '../../../domain/models'
import { Button } from '../../ui/Button'
import { focusRing, numberClass } from './parts'
import { SLOT_LABEL, SLOT_ORDER, shortCaseName, slotOf } from './queue'

function groupsOf(records: AlgorithmRecord[]) {
  const slots = [...SLOT_ORDER, ...new Set(records.map(slotOf).filter((slot) => !(SLOT_ORDER as readonly string[]).includes(slot)))]
  return slots
    .map((slot) => ({ slot, label: SLOT_LABEL[slot] ?? (slot || 'Other'), records: records.filter((record) => slotOf(record) === slot) }))
    .filter((group) => group.records.length)
}

export function selectionLabel(selection: string[] | 'all', records: AlgorithmRecord[]) {
  if (selection === 'all') return `All ${records.length} cases`
  const count = records.filter((record) => selection.includes(record.id)).length
  return `${count} of ${records.length} cases`
}

export function CasePicker({ records, selection, onClose }: { records: AlgorithmRecord[]; selection: string[] | 'all'; onClose: (selection: string[] | 'all') => void }) {
  const [picked, setPicked] = useState(() => new Set(selection === 'all' ? records.map((record) => record.id) : selection))
  const dialog = useRef<HTMLDivElement>(null)
  const groups = groupsOf(records)

  const finish = () => onClose(!picked.size ? selection : picked.size === records.length ? 'all' : [...picked])
  const finishRef = useRef(finish)
  finishRef.current = finish

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    dialog.current?.querySelector<HTMLElement>('button')?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      finishRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      previous?.focus()
    }
  }, [])

  const setMany = (ids: string[], on: boolean) => setPicked((current) => {
    const next = new Set(current)
    for (const id of ids) {
      if (on) next.add(id)
      else next.delete(id)
    }
    return next
  })

  return (
    <div className={css({ position: 'fixed', inset: '0', zIndex: '50', display: 'grid', placeItems: { base: 'end stretch', md: 'center' }, bg: 'rgba(0, 0, 0, 0.6)' })} onClick={(event) => { if (event.target === event.currentTarget) finish() }}>
      <div ref={dialog} role="dialog" aria-modal="true" aria-label="Cases to drill" className={css({ display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr) auto', w: 'full', maxW: '760px', maxH: { base: '88dvh', md: '80dvh' }, bg: 'container', borderWidth: '1px', borderColor: 'floating', borderRadius: 'card', overflow: 'hidden' })}>
        <header className={css({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '3', p: '4', borderBottomWidth: '1px', borderColor: 'floating' })}>
          <div>
            <h2 className={css({ fontSize: 'lg', fontWeight: 'semibold' })}>Cases to drill</h2>
            <p className={cx(numberClass, css({ fontSize: 'xs', color: 'inkVariant' }))}>{picked.size} of {records.length} selected</p>
          </div>
          <div className={css({ display: 'flex', gap: '2' })}>
            <Button size="sm" onClick={() => setMany(records.map((record) => record.id), true)}>All</Button>
            <Button size="sm" onClick={() => setPicked(new Set())}>None</Button>
          </div>
        </header>
        <div className={css({ overflowY: 'auto', p: '4', display: 'grid', gap: '5' })}>
          {groups.map((group) => {
            const ids = group.records.map((record) => record.id)
            const count = ids.filter((id) => picked.has(id)).length
            const all = count === ids.length
            return (
              <section key={group.slot} aria-label={group.label} className={css({ display: 'grid', gap: '2' })}>
                <div className={css({ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '3' })}>
                  <h3 className={css({ fontSize: 'sm', fontWeight: 'semibold' })}>{group.label} <span className={cx(numberClass, css({ color: 'inkVariant', fontWeight: 'normal' }))}>{count}/{ids.length}</span></h3>
                  <Button size="sm" variant="ghost" onClick={() => setMany(ids, !all)}>{all ? `Clear ${group.label.toLowerCase()}` : `All ${group.label.toLowerCase()}`}</Button>
                </div>
                <div className={css({ display: 'flex', flexWrap: 'wrap', gap: '1.5' })}>
                  {group.records.map((record) => {
                    const on = picked.has(record.id)
                    const short = shortCaseName(record)
                    return (
                      <button
                        key={record.id}
                        type="button"
                        aria-pressed={on}
                        aria-label={record.name}
                        title={`${record.name}: ${record.algorithm}`}
                        onClick={() => setMany([record.id], !on)}
                        className={cx(
                          /^\d+$/.test(short) && numberClass,
                          css(
                            { minW: '44px', minH: '44px', px: '2', borderRadius: 'control', borderWidth: '1px', borderColor: 'floating', bg: 'surface', color: 'inkVariant', fontSize: 'sm', cursor: 'pointer', _hover: { borderColor: 'outline' }, ...focusRing },
                            on && { bg: 'floating', borderColor: 'green', color: 'ink' }
                          )
                        )}
                      >
                        {short}
                      </button>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
        <footer className={css({ display: 'flex', justifyContent: 'flex-end', gap: '2', p: '4', borderTopWidth: '1px', borderColor: 'floating' })}>
          <Button variant="solid" disabled={!picked.size} onClick={finish}>Done</Button>
        </footer>
      </div>
    </div>
  )
}
