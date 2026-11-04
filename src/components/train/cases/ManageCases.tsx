import { useState, type ReactNode } from 'react'
import { Alg } from 'cubing/alg'
import { css, cx } from 'styled-system/css'
import type { AlgorithmRecord } from '../../../domain/models'
import { CUBEDEX_QUICK_CATEGORIES, cubedexPreviewMoves, validateCubedexNewAlgDraft, type CubedexQuickCategory } from '../../../domain/cubedex/newAlgAuthoring'
import { createAlgorithmRecord, setLearningState, type LearningState } from '../../../domain/training'
import { recordSetFor, type CaseSet } from './catalogue'
import { Action, Chip, card, focusRing, labelText, mono } from './ui'

const input = cx(css({ w: 'full', minH: '44px', px: '3', borderRadius: 'control', bg: 'surface', color: 'ink', borderWidth: '1px', borderColor: 'floating', fontSize: 'sm' }), focusRing)

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className={css({ display: 'flex', flexDirection: 'column', gap: '1', minW: '0' })}>
      <span className={labelText}>{label}</span>
      {children}
    </label>
  )
}

export function ManageCases({ set, cases, onSave }: { set: CaseSet; cases: AlgorithmRecord[]; onSave: (records: AlgorithmRecord[]) => Promise<void> }) {
  const [category, setCategory] = useState<CubedexQuickCategory>('Custom')
  const [subset, setSubset] = useState('')
  const [name, setName] = useState('')
  const [algorithm, setAlgorithm] = useState('')
  const [setup, setSetup] = useState('')
  const [targetSeconds, setTargetSeconds] = useState(0.9)
  const [message, setMessage] = useState('')
  const [bulkMessage, setBulkMessage] = useState('')
  const preview = algorithm.trim() ? cubedexPreviewMoves(algorithm) : []

  const markAll = async (state: LearningState, label: string) => {
    await onSave(cases.map((record) => setLearningState(record, state)))
    setBulkMessage(`${cases.length} cases marked ${label}.`)
  }

  const add = async () => {
    const validation = validateCubedexNewAlgDraft({ category, subset, name, algorithm })
    if (!validation.ok) {
      setMessage(validation.error)
      return
    }
    try {
      const record = createAlgorithmRecord({
        set: category === 'Custom' ? recordSetFor(set) : category,
        name,
        algorithm: validation.expandedAlgorithm,
        setup: setup.trim() || new Alg(validation.expandedAlgorithm).invert().toString(),
        targetMs: Math.round(targetSeconds * 1000),
        orientations: []
      })
      await onSave([record])
      setSubset('')
      setName('')
      setAlgorithm('')
      setSetup('')
      setMessage(`${record.name} added to ${record.set}.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The case could not be added.')
    }
  }

  return (
    <div className={css({ display: 'grid', gap: '4', gridTemplateColumns: { base: '1fr', lg: '1fr 1.4fr' }, alignItems: 'start' })}>
      <section aria-labelledby="bulk-learning" className={cx(card, css({ p: '4', display: 'flex', flexDirection: 'column', gap: '3' }))}>
        <h2 id="bulk-learning" className={css({ fontSize: 'md', fontWeight: 'semibold' })}>Learning state for {cases.length} shown cases</h2>
        <div className={css({ display: 'flex', flexWrap: 'wrap', gap: '2' })}>
          <Action disabled={!cases.length} onClick={() => void markAll('unlearned', 'new')}>Mark all new</Action>
          <Action disabled={!cases.length} onClick={() => void markAll('learning', 'learning')}>Mark all learning</Action>
          <Action disabled={!cases.length} onClick={() => void markAll('finished', 'learned')}>Mark all learned</Action>
        </div>
        {bulkMessage && <p role="status" className={css({ fontSize: 'sm', color: 'inkVariant' })}>{bulkMessage}</p>}
      </section>
      <section aria-labelledby="personal-case" className={cx(card, css({ p: '4', display: 'flex', flexDirection: 'column', gap: '3' }))}>
        <h2 id="personal-case" className={css({ fontSize: 'md', fontWeight: 'semibold' })}>Add a personal case</h2>
        <div role="group" aria-label="New case category" className={css({ display: 'flex', flexWrap: 'wrap', gap: '2' })}>
          {CUBEDEX_QUICK_CATEGORIES.map((value) => (
            <Chip key={value} active={category === value} onClick={() => setCategory(value)}>{value === 'Custom' ? `This set (${recordSetFor(set)})` : value}</Chip>
          ))}
        </div>
        <div className={css({ display: 'grid', gap: '3', gridTemplateColumns: { base: '1fr', sm: '1fr 1fr' } })}>
          <Field label="Name"><input aria-label="New case name" className={input} value={name} onChange={(event) => setName(event.target.value)} /></Field>
          <Field label="Subset"><input aria-label="New case subset" className={input} value={subset} onChange={(event) => setSubset(event.target.value)} /></Field>
        </div>
        <Field label="Algorithm"><input aria-label="New case algorithm" className={cx(input, mono)} value={algorithm} onChange={(event) => setAlgorithm(event.target.value)} /></Field>
        {preview.length > 0 && (
          <div aria-label="Move preview" className={css({ display: 'flex', flexWrap: 'wrap', gap: '1', alignItems: 'center' })}>
            {preview.map((move, index) => <span key={`${move}-${index}`} className={cx(mono, css({ px: '2', py: '1', borderRadius: 'control', bg: 'floating', fontSize: 'xs' }))}>{move}</span>)}
            <span className={cx(mono, css({ fontSize: 'xs', color: 'inkVariant', ml: '2' }))}>{preview.length} moves</span>
          </div>
        )}
        <div className={css({ display: 'grid', gap: '3', gridTemplateColumns: { base: '1fr', sm: '2fr 1fr' } })}>
          <Field label="Setup, blank for the inverse of the algorithm"><input aria-label="New case setup" className={cx(input, mono)} value={setup} onChange={(event) => setSetup(event.target.value)} /></Field>
          <Field label="Target seconds"><input aria-label="New case target seconds" type="number" min="0.1" step="0.1" className={cx(input, mono)} value={targetSeconds} onChange={(event) => setTargetSeconds(Number(event.target.value))} /></Field>
        </div>
        <div className={css({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '3' })}>
          <Action primary disabled={!name.trim() || !algorithm.trim() || !subset.trim()} onClick={() => void add()}>Add personal case</Action>
          {message && <span role="status" className={css({ fontSize: 'sm', color: 'inkVariant' })}>{message}</span>}
        </div>
      </section>
    </div>
  )
}
