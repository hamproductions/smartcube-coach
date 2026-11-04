import { useMemo, useState } from 'react'
import { Alg } from 'cubing/alg'
import type { KPuzzle } from 'cubing/kpuzzle'
import { css, cx } from 'styled-system/css'
import { DASH } from '../../ui/Page'
import type { AlgorithmRecord, TrainerAttempt } from '../../../domain/models'
import { classifyCaseAttributes, matchesCaseAttributes, type CaseAttributeSlot, type CaseAttributes } from '../../../domain/caseAttributes'
import { caseAverages, caseStats, learningState } from '../../../domain/training'
import { CasePreview } from '../../ui/CasePreview'
import { searchCases } from './catalogue'
import { seconds } from './hooks'
import { Action, Chip, focusRing, labelText, mono } from './ui'

const SHAPE_GROUPS = [
  { key: 'cornerOrientation', title: 'Corner facing', options: [['up_down', 'Up or down'], ['front_back', 'Front or back'], ['side', 'Left or right']] },
  { key: 'cornerPosition', title: 'Corner', options: [['top', 'Top layer'], ['bottom_correct', 'In its slot'], ['bottom_wrong', 'Wrong slot']] },
  { key: 'edgePosition', title: 'Edge', options: [['top', 'Top layer'], ['solved_slot', 'In its slot'], ['wrong_slot', 'Wrong slot']] },
  { key: 'edgeOrientation', title: 'Edge facing', options: [['oriented', 'Oriented'], ['unoriented', 'Unoriented']] }
] as const

const STATE_LABEL = { unlearned: 'New', learning: 'Learning', finished: 'Learned' } as const

function useShapeAttributes(records: AlgorithmRecord[], puzzle: KPuzzle | undefined, enabled: boolean) {
  return useMemo(() => {
    const map = new Map<string, CaseAttributes>()
    if (!enabled || !puzzle) return map
    for (const record of records) {
      const slot = record.orientations[0]?.toLowerCase() as CaseAttributeSlot | undefined
      if (!slot || !['fr', 'fl', 'br', 'bl'].includes(slot)) continue
      try {
        map.set(record.id, classifyCaseAttributes(puzzle.defaultPattern().applyAlg(new Alg(record.setup)), slot))
      } catch {
        continue
      }
    }
    return map
  }, [records, puzzle, enabled])
}

export function CaseGrid({ records, attempts, selected, onToggle, onSelect, puzzle, shapes }: {
  records: AlgorithmRecord[]
  attempts: TrainerAttempt[]
  selected: Set<string>
  onToggle: (id: string) => void
  onSelect: (ids: string[], on: boolean) => void
  puzzle?: KPuzzle
  shapes?: boolean
}) {
  const [query, setQuery] = useState('')
  const [shapeOpen, setShapeOpen] = useState(false)
  const [shape, setShape] = useState<Partial<CaseAttributes>>({})
  const attributes = useShapeAttributes(records, puzzle, Boolean(shapes))
  const shapeCount = Object.values(shape).filter(Boolean).length
  const shaped = shapeCount ? records.filter((record) => {
    const found = attributes.get(record.id)
    return found ? matchesCaseAttributes(found, shape) : false
  }) : records
  const shown = searchCases(shaped, query)
  const shownSelected = shown.filter((record) => selected.has(record.id)).length

  return (
    <div className={css({ display: 'flex', flexDirection: 'column', gap: '3' })}>
      <div className={css({ display: 'flex', flexWrap: 'wrap', gap: '2', alignItems: 'center' })}>
        <input
          type="search"
          aria-label="Search cases"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={`Search ${shaped.length} cases by name or moves`}
          className={cx(css({
            flex: '1 1 240px', minW: '0', minH: '44px', px: '4', borderRadius: 'control', bg: 'container',
            color: 'ink', borderWidth: '1px', borderColor: 'floating', fontSize: 'sm', _placeholder: { color: 'inkVariant' }
          }), focusRing)}
        />
        {shapes && <Chip active={shapeOpen} count={shapeCount || undefined} onClick={() => setShapeOpen((open) => !open)}>Shape</Chip>}
        <Action disabled={!shown.length || shownSelected === shown.length} onClick={() => onSelect(shown.map((record) => record.id), true)}>Select all shown</Action>
        <Action disabled={!selected.size} onClick={() => onSelect([...selected], false)}>Clear</Action>
      </div>
      {shapes && shapeOpen && (
        <div aria-label="Shape filter" className={css({ display: 'grid', gap: '3', gridTemplateColumns: { base: '1fr', md: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(4, minmax(0, 1fr))' }, p: '3', borderRadius: 'card', bg: 'container', borderWidth: '1px', borderColor: 'floating' })}>
          {SHAPE_GROUPS.map((group) => (
            <div key={group.key} role="group" aria-label={group.title} className={css({ display: 'flex', flexDirection: 'column', gap: '2' })}>
              <span className={labelText}>{group.title}</span>
              <div className={css({ display: 'flex', flexWrap: 'wrap', gap: '2' })}>
                {group.options.map(([value, label]) => {
                  const active = shape[group.key] === value
                  return <Chip key={value} active={active} onClick={() => setShape({ ...shape, [group.key]: active ? undefined : value })}>{label}</Chip>
                })}
              </div>
            </div>
          ))}
        </div>
      )}
      {shown.length === 0 ? (
        <p className={css({ py: '8', textAlign: 'center', color: 'inkVariant' })}>
          {query ? `No case matches "${query}". Clear the search to see all ${shaped.length}.` : 'No cases match these filters. Change the subset, learning state or shape.'}
        </p>
      ) : (
        <div data-case-grid="" className={css({ display: 'grid', gap: '2', gridTemplateColumns: { base: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(3, minmax(0, 1fr))', lg: 'repeat(5, minmax(0, 1fr))', xl: 'repeat(6, minmax(0, 1fr))' } })}>
          {shown.map((record) => (
            <CaseTile key={record.id} record={record} attempts={attempts} selected={selected.has(record.id)} onToggle={() => onToggle(record.id)} />
          ))}
        </div>
      )}
    </div>
  )
}

function CaseTile({ record, attempts, selected, onToggle }: { record: AlgorithmRecord; attempts: TrainerAttempt[]; selected: boolean; onToggle: () => void }) {
  const stat = caseStats(attempts, record.id)
  const averages = caseAverages(attempts, record.id)
  const state = learningState(record)
  return (
    <button
      type="button"
      data-case-card=""
      aria-label={`${record.name}, ${STATE_LABEL[state].toLowerCase()}${stat.practiceCount ? `, ${stat.practiceCount} ${stat.practiceCount === 1 ? 'try' : 'tries'}` : ''}`}
      aria-pressed={selected}
      onClick={onToggle}
      className={cx(css({
        position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: '2', p: '3', textAlign: 'left',
        borderRadius: 'card', borderWidth: '2px', borderColor: 'floating', bg: 'container', cursor: 'pointer', minW: '0',
        _hover: { borderColor: 'outline' },
        _pressed: { borderColor: 'green', bg: 'floating' }
      }), focusRing)}
    >
      <span aria-hidden className={css({
        position: 'absolute', top: '2', left: '2', w: '6', h: '6', borderRadius: 'control', display: 'grid', placeItems: 'center',
        borderWidth: '1px', borderColor: selected ? 'green' : 'outline', bg: selected ? 'green' : 'surface', color: 'onGreen', fontSize: 'xs', fontWeight: 'bold'
      })}>{selected ? '✓' : ''}</span>
      <span className={css({ display: 'grid', placeItems: 'center', h: '96px' })}>
        <CasePreview setup={record.setup} set={record.set} size={88} />
      </span>
      <span className={css({ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '2', minW: '0' })}>
        <span className={css({ fontSize: 'sm', fontWeight: 'semibold', color: 'ink', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' })}>{record.name}</span>
        <span className={css({ fontSize: '2xs', flexShrink: '0', color: state === 'finished' ? 'green' : state === 'learning' ? 'amber' : 'inkVariant' })}>{STATE_LABEL[state]}</span>
      </span>
      {stat.practiceCount > 0 && (
        <span className={cx(mono, css({ display: 'flex', flexWrap: 'wrap', gap: '2', fontSize: '2xs', color: 'inkVariant' }))}>
          <span>ao5 <span>{averages.ao5 === undefined ? DASH : seconds(averages.ao5)}</span></span>
          <span>best <span>{stat.bestTime === undefined ? DASH : seconds(stat.bestTime)}</span></span>
          <span><span>{stat.practiceCount}</span> {stat.practiceCount === 1 ? 'try' : 'tries'}</span>
        </span>
      )}
    </button>
  )
}
