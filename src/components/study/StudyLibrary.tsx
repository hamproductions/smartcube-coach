import { Fragment, useEffect, useState } from 'react'
import { css } from 'styled-system/css'
import { styled } from 'styled-system/jsx'
import { ScramblePreview } from '../ui/ScramblePreview'
import { repositories } from '../../storage/database'
import { createId } from '../../domain/ids'
import type { StudyRecord } from '../../domain/models'

// Ported from docs/design/stitch/study_reconstructions/code.html: an import card beside
// library stats, then the saved studies as a table. Stats are counted from the stored
// records, so an empty library reports zero rather than the export's sample figures.

const Card = styled('section', {
  base: {
    bg: 'container', borderWidth: '1px', borderColor: 'floating',
    borderRadius: 'card', p: '6', display: 'flex', flexDirection: 'column', gap: '4'
  }
})

const LabelCaps = styled('span', {
  base: {
    fontFamily: 'sans', fontSize: 'xs', fontWeight: 'bold',
    letterSpacing: '0.12em', textTransform: 'uppercase', color: 'inkVariant'
  }
})

const DASH = '—'

/**
 * Reads a pasted reconstruction.
 *
 * The first non-empty line is the scramble and the rest is the solution, which is the
 * shape reconstruction sites and the app's own exports both produce. Anything it cannot
 * split into two move sequences is rejected rather than stored half-parsed.
 */
export function parsePastedStudy(text: string): { scramble: string; moves: string[] } | undefined {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean)
  if (lines.length < 2) return undefined
  const [scramble, ...rest] = lines
  const moves = rest.join(' ').split(/\s+/).filter(Boolean)
  if (!scramble.trim() || moves.length === 0) return undefined
  return { scramble: scramble.trim(), moves }
}

export function StudyLibrary() {
  const [studies, setStudies] = useState<StudyRecord[]>([])
  const [text, setText] = useState('')
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string>()
  const [openId, setOpenId] = useState<string>()

  useEffect(() => {
    void repositories.studies.all().then((all) => setStudies(all.sort((left, right) => right.importedAt - left.importedAt))).catch(() => undefined)
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
      setStudies((current) => [record, ...current])
      setText('')
    })
  }

  const shown = query.trim()
    ? studies.filter((study) => `${study.solver} ${study.sourceUrl} ${study.result}`.toLowerCase().includes(query.trim().toLowerCase()))
    : studies

  const avgMoves = studies.length
    ? studies.reduce((sum, study) => sum + study.moves.length, 0) / studies.length
    : undefined

  return (
    <div className={css({ flex: '1', minH: '0', overflowY: 'auto', p: '8' })}>
      <div className={css({ maxW: '1152px', mx: 'auto', display: 'flex', flexDirection: 'column', gap: '8' })}>
        <header>
          <h1 className={css({ fontSize: '2xl', fontWeight: 'semibold', color: 'ink', letterSpacing: '-0.02em' })}>Reconstruction study library</h1>
          <p className={css({ mt: '2', color: 'inkVariant', maxW: 'reading' })}>
            Import and study solves. Paste a scramble and its solution to save it here.
          </p>
        </header>

        <div className={css({ display: 'grid', gap: 'gutter', gridTemplateColumns: '1fr', md: { gridTemplateColumns: 'repeat(12, minmax(0, 1fr))' } })}>
          <Card className={css({ md: { gridColumn: 'span 8' } })}>
            <LabelCaps className={css({ color: 'ink' })}>Import from text</LabelCaps>
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={"Scramble on the first line\nSolution on the lines below"}
              aria-label="Paste reconstruction"
              className={css({
                w: 'full', h: '128px', p: '4', resize: 'none',
                bg: 'surface', color: 'ink', borderWidth: '1px', borderColor: 'floating',
                borderRadius: 'control', fontFamily: 'mono', fontSize: 'sm',
                _focus: { outline: 'none', borderColor: 'green' }
              })}
            />
            {error && <p className={css({ fontFamily: 'mono', fontSize: 'xs', color: 'error' })}>{error}</p>}
            <div className={css({ display: 'flex', justifyContent: 'flex-end' })}>
              <button
                type="button"
                onClick={importPasted}
                disabled={!text.trim()}
                className={css({
                  minH: '48px', px: '6', borderRadius: 'control',
                  bg: 'green', color: 'onGreen', cursor: 'pointer',
                  fontFamily: 'sans', fontSize: 'xs', fontWeight: 'bold',
                  letterSpacing: '0.12em', textTransform: 'uppercase',
                  _hover: { bg: 'greenBright' },
                  _disabled: { bg: 'floating', color: 'inkVariant', cursor: 'default' }
                })}
              >Import</button>
            </div>
          </Card>

          <Card className={css({ md: { gridColumn: 'span 4' } })}>
            <LabelCaps>Library stats</LabelCaps>
            <div className={css({ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '4' })}>
              <div>
                <span className={css({ display: 'block', fontFamily: 'mono', fontSize: 'xs', color: 'inkVariant' })}>Saved studies</span>
                <span className={css({ fontSize: '2xl', color: 'ink' })}>{studies.length}</span>
              </div>
              <div>
                <span className={css({ display: 'block', fontFamily: 'mono', fontSize: 'xs', color: 'inkVariant' })}>Avg move count</span>
                <span className={css({ fontSize: '2xl', color: 'ink' })}>{avgMoves === undefined ? DASH : avgMoves.toFixed(1)}</span>
              </div>
            </div>
          </Card>
        </div>

        <div>
          <div className={css({ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '4', mb: '6', pb: '4', borderBottomWidth: '1px', borderColor: 'floating', flexWrap: 'wrap' })}>
            <LabelCaps className={css({ color: 'ink' })}>Saved studies</LabelCaps>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search studies…"
              aria-label="Search studies"
              className={css({
                w: '256px', maxW: 'full', minH: '40px', px: '4', borderRadius: 'control',
                bg: 'container', color: 'ink', borderWidth: '1px', borderColor: 'floating',
                fontFamily: 'mono', fontSize: 'sm',
                _focus: { outline: 'none', borderColor: 'green' }
              })}
            />
          </div>

          <div className={css({ bg: 'container', borderWidth: '1px', borderColor: 'floating', borderRadius: 'card', overflow: 'hidden' })}>
            <div className={css({ display: 'grid', gridTemplateColumns: '64px 1fr 96px 96px 88px', gap: '4', p: '4', borderBottomWidth: '1px', borderColor: 'floating', bg: 'surface' })}>
              <LabelCaps>Preview</LabelCaps>
              <LabelCaps>Source / solver</LabelCaps>
              <LabelCaps className={css({ textAlign: 'right' })}>Time</LabelCaps>
              <LabelCaps className={css({ textAlign: 'right' })}>Moves</LabelCaps>
              <LabelCaps className={css({ textAlign: 'right' })}>Actions</LabelCaps>
            </div>

            {shown.length === 0 ? (
              <p className={css({ p: '8', textAlign: 'center', color: 'inkVariant' })}>
                {studies.length === 0 ? 'No studies saved yet.' : 'No study matches that search.'}
              </p>
            ) : shown.map((study) => (
              <Fragment key={study.id}>
              <div className={css({
                display: 'grid', gridTemplateColumns: '64px 1fr 96px 96px 88px', gap: '4', p: '4',
                alignItems: 'center', borderBottomWidth: '1px', borderColor: 'floating'
              })}>
                <ScramblePreview scramble={study.scramble} cellPx={8} view="layer" />
                <div className={css({ minW: '0' })}>
                  <p className={css({ color: 'ink', fontWeight: 'medium' })}>{study.solver || 'Unknown solver'}</p>
                  <p className={css({ fontFamily: 'mono', fontSize: 'xs', color: 'inkVariant', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' })}>
                    {study.sourceUrl || study.scramble}
                  </p>
                </div>
                <span className={css({ fontFamily: 'mono', fontSize: 'sm', color: 'inkVariant', textAlign: 'right' })}>{study.result || DASH}</span>
                <span className={css({ fontFamily: 'mono', fontSize: 'sm', color: 'ink', textAlign: 'right' })}>{study.moves.length}</span>
                {/* The export ships an ACTIONS column; without it a saved study could be
                    created but never opened or removed. */}
                <div className={css({ display: 'flex', gap: '2', justifyContent: 'flex-end' })}>
                  <button
                    type="button"
                    aria-label={`Open ${study.solver}`}
                    onClick={() => setOpenId((current) => current === study.id ? undefined : study.id)}
                    className={css({ px: '2', minH: '32px', borderRadius: 'control', borderWidth: '1px', borderColor: 'floating', bg: 'transparent', color: 'ink', cursor: 'pointer', fontSize: 'xs', _hover: { bg: 'floating' } })}
                  >{openId === study.id ? 'Hide' : 'Open'}</button>
                  <button
                    type="button"
                    aria-label={`Delete ${study.solver}`}
                    onClick={() => {
                      // `remove`, not `delete` — the wrong name silently no-opped, and
                      // the row disappeared from nothing while the record stayed.
                      void repositories.studies.remove(study.id)
                        .then(() => setStudies((current) => current.filter((entry) => entry.id !== study.id)))
                        .catch(() => setError('Could not delete that study.'))
                    }}
                    className={css({ px: '2', minH: '32px', borderRadius: 'control', borderWidth: '1px', borderColor: 'error', bg: 'transparent', color: 'error', cursor: 'pointer', fontSize: 'xs', _hover: { bg: 'rgba(255,180,171,0.12)' } })}
                  >Delete</button>
                </div>
              </div>
              {openId === study.id && (
                <div className={css({ px: '4', pb: '4', borderBottomWidth: '1px', borderColor: 'floating' })}>
                  <p className={css({ fontFamily: 'mono', fontSize: 'xs', color: 'inkVariant', mb: '1' })}>scramble</p>
                  <p className={css({ fontFamily: 'mono', fontSize: 'sm', color: 'ink', mb: '3' })}>{study.scramble}</p>
                  <p className={css({ fontFamily: 'mono', fontSize: 'xs', color: 'inkVariant', mb: '1' })}>solution · {study.moves.length} moves</p>
                  <p className={css({ fontFamily: 'mono', fontSize: 'sm', color: 'greenBright', letterSpacing: '0.06em' })}>{study.moves.join(' ')}</p>
                </div>
              )}
              </Fragment>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
