import { useEffect, useId, useState } from 'react'
import { css, cx } from 'styled-system/css'
import { ScramblePreview } from '../ui/ScramblePreview'
import { repositories } from '../../storage/database'
import { createId } from '../../domain/ids'
import { routeHref } from '../../app/route'
import { DASH, Section, card, dangerButton, mono, primaryButton, secondaryButton, textInput, textInputRaw } from '../ui/Page'
import type { StudyRecord } from '../../domain/models'

export function parsePastedStudy(text: string): { scramble: string; moves: string[] } | undefined {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean)
  if (lines.length < 2) return undefined
  const [scramble, ...rest] = lines
  const moves = rest.join(' ').split(/\s+/).filter(Boolean)
  if (!scramble.trim() || moves.length === 0) return undefined
  return { scramble: scramble.trim(), moves }
}

export function StudyLibrary() {
  const [studies, setStudies] = useState<StudyRecord[]>()
  const [text, setText] = useState('')
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string>()
  const [openId, setOpenId] = useState<string>()
  const pasteId = useId()

  useEffect(() => {
    void repositories.studies.all()
      .then((all) => setStudies(all.sort((left, right) => right.importedAt - left.importedAt)))
      .catch(() => setStudies([]))
  }, [])

  const importPasted = () => {
    const parsed = parsePastedStudy(text)
    if (!parsed) {
      setError('Needs a scramble on the first line and the solution on the lines below.')
      return
    }
    const record: StudyRecord = {
      id: createId(),
      sourceUrl: '',
      solver: 'Pasted',
      result: '',
      scramble: parsed.scramble,
      moves: parsed.moves,
      notes: '',
      bookmarks: [],
      importedAt: Date.now()
    }
    setError(undefined)
    void repositories.studies.put(record).then(() => {
      setStudies((current) => [record, ...(current ?? [])])
      setText('')
    })
  }

  const all = studies ?? []
  const needle = query.trim().toLowerCase()
  const shown = needle
    ? all.filter((study) => `${study.solver} ${study.sourceUrl} ${study.result} ${study.scramble}`.toLowerCase().includes(needle))
    : all
  const avgMoves = all.length ? all.reduce((sum, study) => sum + study.moves.length, 0) / all.length : undefined

  return (
    <div className={css({ display: 'flex', flexDirection: 'column', gap: '10' })}>
      <Section id="add-study" title="Save a solve to study" description="Paste the scramble on the first line and the solution on the lines below it.">
        <form
          onSubmit={(event) => { event.preventDefault(); importPasted() }}
          className={css({ position: 'relative', display: 'flex', flexDirection: 'column', gap: '3', alignItems: 'flex-start' })}
        >
          <label htmlFor={pasteId} className={css({ srOnly: true })}>Paste reconstruction</label>
          <textarea
            id={pasteId}
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={"Scramble on the first line\nSolution on the lines below"}
            rows={5}
            className={cx(textInput, mono, css({ resize: 'vertical', lineHeight: '1.6' }))}
          />
          {error && <p role="alert" className={css({ fontSize: 'sm', color: 'error' })}>{error}</p>}
          <button type="submit" disabled={!text.trim()} className={primaryButton}>Save solve</button>
        </form>
      </Section>

      <Section
        id="saved-studies"
        title="Saved solves"
        description={all.length ? <span className={mono}>{all.length} saved · {avgMoves === undefined ? DASH : avgMoves.toFixed(1)} moves on average</span> : undefined}
        action={all.length > 0 && (
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search solver, source or scramble"
            aria-label="Search saved solves"
            className={css(textInputRaw, { w: { base: 'full', md: '20rem' }, bg: 'container' })}
          />
        )}
      >
        {studies === undefined ? null : all.length === 0 ? (
          <div className={cx(card, css({ p: { base: '5', md: '6' }, display: 'flex', flexDirection: 'column', gap: '3', alignItems: 'flex-start' }))}>
            <p className={css({ fontWeight: 'semibold' })}>Nothing saved yet</p>
            <p className={css({ color: 'inkVariant', fontSize: 'sm', maxW: '60ch' })}>
              Paste a solve above, or import a public reconstruction under Read a solve. Imported solves are saved here too.
            </p>
            <a href={routeHref({ section: 'study', detail: 'read' })} className={secondaryButton}>Read a solve</a>
          </div>
        ) : shown.length === 0 ? (
          <p className={css({ color: 'inkVariant', fontSize: 'sm' })}>No saved solve matches "{query.trim()}".</p>
        ) : (
          <ul className={cx(card, css({ listStyle: 'none', m: '0', p: '0', overflow: 'hidden' }))}>
            {shown.map((study) => {
              const open = openId === study.id
              const name = study.solver || 'Unknown solver'
              return (
                <li key={study.id} className={css({ borderTopWidth: '1px', borderColor: 'floating', _first: { borderTopWidth: '0' } })}>
                  <div className={css({ display: 'grid', gridTemplateColumns: { base: '48px minmax(0, 1fr)', md: '56px minmax(0, 1fr) 5rem 5rem auto' }, gap: { base: '3', md: '4' }, alignItems: 'center', p: '4' })}>
                    <ScramblePreview scramble={study.scramble} cellPx={8} view="layer" />
                    <div className={css({ minW: '0' })}>
                      <p className={css({ fontWeight: 'medium' })}>{name}</p>
                      <p className={cx(mono, css({ fontSize: 'xs', color: 'inkVariant', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }))}>{study.sourceUrl || study.scramble}</p>
                    </div>
                    <span className={cx(mono, css({ fontSize: 'sm', color: 'inkVariant', textAlign: { md: 'right' }, gridColumn: { base: '2', md: 'auto' } }))}>
                      {study.result ? `${study.result}s` : DASH}<span className={css({ display: { md: 'none' } })}> · {study.moves.length} moves</span>
                    </span>
                    <span className={cx(mono, css({ display: { base: 'none', md: 'block' }, fontSize: 'sm', textAlign: 'right' }))}>{study.moves.length} moves</span>
                    <div className={css({ display: 'flex', gap: '2', justifyContent: { md: 'flex-end' }, gridColumn: { base: '1 / -1', md: 'auto' } })}>
                      <button type="button" aria-expanded={open} aria-label={`${open ? 'Hide' : 'Open'} ${name}`} onClick={() => setOpenId(open ? undefined : study.id)} className={secondaryButton}>{open ? 'Hide' : 'Open'}</button>
                      <button
                        type="button"
                        aria-label={`Delete ${name}`}
                        onClick={() => {
                          void repositories.studies.remove(study.id)
                            .then(() => setStudies((current) => current?.filter((entry) => entry.id !== study.id)))
                            .catch(() => setError('Could not delete that solve.'))
                        }}
                        className={dangerButton}
                      >Delete</button>
                    </div>
                  </div>
                  {open && (
                    <dl className={css({ px: '4', pb: '4', display: 'grid', gridTemplateColumns: { base: '1fr', md: '6rem minmax(0, 1fr)' }, columnGap: '4', rowGap: '1', fontSize: 'sm' })}>
                      <dt className={css({ color: 'inkVariant', fontSize: 'xs', pt: '0.5' })}>Scramble</dt>
                      <dd className={cx(mono, css({ m: '0', wordBreak: 'break-word', mb: '2' }))}>{study.scramble}</dd>
                      <dt className={css({ color: 'inkVariant', fontSize: 'xs', pt: '0.5' })}>Solution</dt>
                      <dd className={cx(mono, css({ m: '0', wordBreak: 'break-word', lineHeight: '1.6', color: 'greenBright' }))}>{study.moves.join(' ')}</dd>
                      {study.notes && (
                        <>
                          <dt className={css({ color: 'inkVariant', fontSize: 'xs', pt: '2' })}>Notes</dt>
                          <dd className={css({ m: '0', pt: '2', color: 'inkVariant', whiteSpace: 'pre-wrap' })}>{study.notes}</dd>
                        </>
                      )}
                    </dl>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </Section>
    </div>
  )
}
