import { type FormEvent, useState } from 'react'
import { normalizeRecoUrl, type RecoReconstruction } from '../integrations/reco'
import type { SolveRecord, StudyRecord } from '../domain/models'
import { computePhaseMetrics } from '../domain/solveMetrics'
import { repositories } from '../storage/database'
import { CubePlayback } from './CubePlayback'
import { css, cx } from 'styled-system/css'
import { DASH, Section, card, mono, primaryButton, secondaryButton, secondaryRaw, sectionTitle, textInput } from './ui/Page'

const defaultUrl = 'https://reco.nz/solve/13444'

const parseSecondsToMs = (value: string | undefined): number | undefined => {
  const seconds = value === undefined ? Number.NaN : Number(value)
  return Number.isFinite(seconds) ? seconds * 1_000 : undefined
}

const formatSeconds = (ms: number | undefined): string => (ms === undefined ? DASH : (ms / 1_000).toFixed(2))
const formatPercent = (value: number | undefined): string => (value === undefined ? DASH : `${value.toFixed(1)}%`)
const formatCount = (value: number | undefined): string => (value === undefined ? DASH : String(value))
const formatRate = (value: number | undefined): string => (value === undefined ? DASH : value.toFixed(2))

export function RecoStudy() {
  const [url, setUrl] = useState(defaultUrl)
  const [reconstruction, setReconstruction] = useState<RecoReconstruction>()
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [error, setError] = useState('')
  const [notes, setNotes] = useState('')
  const [bookmarks, setBookmarks] = useState<number[]>([])
  const [matchingSolve, setMatchingSolve] = useState<SolveRecord>()
  const [focusStage, setFocusStage] = useState('')

  const totalDurationMs = parseSecondsToMs(reconstruction?.stats.Time?.Total)
  const totalMetrics = computePhaseMetrics(reconstruction?.moves ?? [], totalDurationMs, totalDurationMs)

  const importReconstruction = async (event: FormEvent) => {
    event.preventDefault()
    setStatus('loading')
    setError('')

    try {
      const sourceUrl = normalizeRecoUrl(url)
      const solveId = sourceUrl.split('/').at(-1)
      const staticHost = location.hostname.endsWith('github.io')
      if (staticHost && solveId !== '13444') {
        throw new Error('GitHub Pages cannot run the reco.nz importer. Use the included solve 13444 here, or run the Bun server locally for arbitrary public URLs.')
      }
      let response = await fetch(staticHost
        ? `${import.meta.env.BASE_URL}reco/13444.json`
        : `/api/reco/import?url=${encodeURIComponent(sourceUrl)}`)
      if (!response.ok && solveId === '13444') {
        response = await fetch(`${import.meta.env.BASE_URL}reco/13444.json`)
      }
      if (!response.ok) {
        throw new Error('This static deployment can only load bundled solve 13444. Run the Bun server locally for arbitrary public URLs.')
      }
      const payload = await response.json()
      const imported = payload as RecoReconstruction
      const saved = await repositories.studies.get(imported.id)
      const study: StudyRecord = saved ?? {
        id: imported.id,
        sourceUrl: imported.sourceUrl,
        solver: imported.solver,
        result: imported.result,
        scramble: imported.scramble,
        moves: imported.moves,
        notes: '',
        bookmarks: [],
        importedAt: Date.now()
      }
      await repositories.studies.put(study)
      setReconstruction(imported)
      setNotes(study.notes)
      setBookmarks(study.bookmarks)
      setMatchingSolve((await repositories.solves.all()).find((solve) => solve.scramble === imported.scramble))
      setFocusStage(imported.stages.find((stage) => stage.label.toLowerCase() !== 'inspection')?.label ?? '')
      setStatus('idle')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Import failed')
      setStatus('error')
    }
  }

  const updateStudy = async (nextNotes: string, nextBookmarks: number[]) => {
    if (!reconstruction) return
    await repositories.studies.put({
      id: reconstruction.id,
      sourceUrl: reconstruction.sourceUrl,
      solver: reconstruction.solver,
      result: reconstruction.result,
      scramble: reconstruction.scramble,
      moves: reconstruction.moves,
      notes: nextNotes,
      bookmarks: nextBookmarks,
      importedAt: Date.now()
    })
  }

  const updateNotes = (value: string) => {
    setNotes(value)
    void updateStudy(value, bookmarks)
  }

  const toggleBookmark = (moveIndex: number) => {
    const next = bookmarks.includes(moveIndex) ? bookmarks.filter((value) => value !== moveIndex) : [...bookmarks, moveIndex]
    setBookmarks(next)
    void updateStudy(notes, next)
  }

  const th = css({ px: '3', py: '2.5', textAlign: 'right', fontWeight: 'normal', fontSize: 'xs', color: 'inkVariant', whiteSpace: 'nowrap', _first: { textAlign: 'left' } })
  const td = css({ px: '3', py: '2', textAlign: 'right', whiteSpace: 'nowrap', _first: { textAlign: 'left', fontFamily: 'sans' } })
  const comparison = [
    { label: 'Their moves', value: String(reconstruction?.moves.length ?? DASH) },
    { label: 'Your solve of this scramble', value: matchingSolve ? `${matchingSolve.moves.length} moves` : 'Not recorded' },
    { label: 'Move difference', value: matchingSolve && reconstruction ? String(matchingSolve.moves.length - reconstruction.moves.length) : DASH },
    { label: 'Bookmarks', value: String(bookmarks.length) }
  ]

  return (
    <div className={css({ display: 'flex', flexDirection: 'column', gap: '10' })}>
      <Section id="reco-import" title="Study someone else's solve" description="Import a public reconstruction from reco.nz, replay every turn, and keep your own notes next to the original credit.">
        <form onSubmit={importReconstruction} className={css({ display: 'flex', flexDirection: 'column', gap: '3' })}>
          <label htmlFor="reco-url" className={css({ fontSize: 'sm', color: 'inkVariant' })}>reco.nz solve URL</label>
          <div className={css({ display: 'flex', gap: '2', flexDirection: { base: 'column', sm: 'row' } })}>
            <input
              id="reco-url"
              name="reco-url"
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://reco.nz/solve/13444"
              type="url"
              value={url}
              className={cx(textInput, mono, css({ flex: '1' }))}
            />
            <button className={primaryButton} disabled={status === 'loading'} type="submit">
              {status === 'loading' ? 'Importing...' : 'Import reconstruction'}
            </button>
          </div>
          {location.hostname.endsWith('github.io') && <p className={css({ fontSize: 'sm', color: 'inkVariant' })}>This hosted copy can only load the bundled solve 13444. Other imports need the local Bun server.</p>}
          {error && <p className={css({ fontSize: 'sm', color: 'error' })} role="alert">{error}</p>}
        </form>
      </Section>

      {reconstruction && (
        <div className={css({ display: 'flex', flexDirection: 'column', gap: '8' })}>
          <header className={css({ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '4', flexWrap: 'wrap' })}>
            <div className={css({ display: 'flex', flexDirection: 'column', gap: '1', minW: '0' })}>
              <span className={css({ fontSize: 'xs', color: 'inkVariant' })}>{reconstruction.puzzle} · reconstructed by {reconstruction.reconstructor || 'a community contributor'}</span>
              <h2 className={css({ fontSize: 'xl', fontWeight: 'semibold' })}>{reconstruction.solver} · {reconstruction.result}</h2>
              {reconstruction.subtitle && <p className={css({ fontSize: 'sm', color: 'inkVariant' })}>{reconstruction.subtitle}</p>}
            </div>
            <a href={reconstruction.sourceUrl} rel="noreferrer" target="_blank" className={secondaryButton}>Open original on reco.nz</a>
          </header>

          <dl className={css({ display: 'grid', gridTemplateColumns: { base: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' }, gap: '4', m: '0' })}>
            {comparison.map((item) => (
              <div key={item.label} className={css({ display: 'flex', flexDirection: 'column', gap: '0.5' })}>
                <dt className={css({ fontSize: 'xs', color: 'inkVariant' })}>{item.label}</dt>
                <dd className={cx(mono, css({ m: '0', fontSize: 'lg' }))}>{item.value}</dd>
              </div>
            ))}
          </dl>

          <div className={cx(card, css({ overflowX: 'auto' }))}>
            <table className={cx(mono, css({ w: 'full', borderCollapse: 'collapse', fontSize: 'sm' }))}>
              <thead>
                <tr className={css({ borderBottomWidth: '1px', borderColor: 'floating', fontFamily: 'sans' })}>
                  <th scope="col" className={th}>Phase</th>
                  <th scope="col" className={th}>Time</th>
                  <th scope="col" className={th}>Split %</th>
                  <th scope="col" className={th}>STM</th>
                  <th scope="col" className={th}>STPS</th>
                  <th scope="col" className={th}>ETM</th>
                  <th scope="col" className={th}>ETPS</th>
                </tr>
              </thead>
              <tbody>
                {reconstruction.stages.map((stage) => {
                  const durationMs = parseSecondsToMs(reconstruction.stats.Time?.[stage.label])
                  const metrics = computePhaseMetrics(stage.moves, durationMs, totalDurationMs)
                  return (
                    <tr key={stage.label} className={css({ borderBottomWidth: '1px', borderColor: 'floating' })}>
                      <td className={td}>{stage.label}</td>
                      <td className={td}>{formatSeconds(durationMs)}</td>
                      <td className={td}>{formatPercent(metrics.splitPercent)}</td>
                      <td className={td}>{formatCount(metrics.stm)}</td>
                      <td className={td}>{formatRate(metrics.stps)}</td>
                      <td className={td}>{formatCount(metrics.etm)}</td>
                      <td className={td}>{formatRate(metrics.etps)}</td>
                    </tr>
                  )
                })}
                <tr className={css({ fontWeight: 'semibold' })}>
                  <td className={td}>Total</td>
                  <td className={td}>{formatSeconds(totalDurationMs)}</td>
                  <td className={td}>{formatPercent(totalMetrics.splitPercent)}</td>
                  <td className={td}>{formatCount(totalMetrics.stm)}</td>
                  <td className={td}>{formatRate(totalMetrics.stps)}</td>
                  <td className={td}>{formatCount(totalMetrics.etm)}</td>
                  <td className={td}>{formatRate(totalMetrics.etps)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <CubePlayback
            moves={reconstruction.moves}
            scramble={reconstruction.scramble}
            stages={reconstruction.stages}
            title="Replay"
          />

          <div className={css({ display: 'grid', gap: '6', gridTemplateColumns: { base: '1fr', lg: 'repeat(2, minmax(0, 1fr))' } })}>
            <section aria-labelledby="stage-questions" className={css({ display: 'flex', flexDirection: 'column', gap: '3' })}>
              <h3 id="stage-questions" className={sectionTitle}>Pick a stage to study</h3>
              <ul className={css({ display: 'flex', flexDirection: 'column', gap: '2', listStyle: 'none', m: '0', p: '0' })}>
                {reconstruction.stages
                  .filter((stage) => stage.label.toLowerCase() !== 'inspection')
                  .map((stage, index, stages) => {
                    const end = stages.slice(0, index + 1).reduce((sum, item) => sum + item.moves.length, 0)
                    const marked = bookmarks.includes(end)
                    return (
                      <li key={stage.label} className={css({ display: 'flex', gap: '2' })}>
                        <button
                          type="button"
                          aria-label={`Study ${stage.label}`}
                          aria-pressed={focusStage === stage.label}
                          onClick={() => setFocusStage(stage.label)}
                          className={css(secondaryRaw, { flex: '1', justifyContent: 'space-between', '&[aria-pressed=true]': { borderColor: 'green', bg: 'floating' } })}
                        >
                          <span>{stage.label}</span>
                          <span className={cx(mono, css({ fontSize: 'xs', color: 'inkVariant' }))}>{stage.moves.length} moves</span>
                        </button>
                        <button
                          type="button"
                          aria-label={`Bookmark ${stage.label}`}
                          aria-pressed={marked}
                          onClick={() => toggleBookmark(end)}
                          className={marked ? css(secondaryRaw, { w: '44px', px: '0', color: 'amber' }) : css(secondaryRaw, { w: '44px', px: '0', color: 'inkVariant' })}
                        >{marked ? '★' : '☆'}</button>
                      </li>
                    )
                  })}
              </ul>
              <p className={css({ fontSize: 'sm', color: 'inkVariant', lineHeight: '1.6' })}>
                {focusStage
                  ? `What did ${reconstruction.solver} keep or predict during ${focusStage}? Compare orientation, rotations, and how they move into the next stage.`
                  : 'Choose a stage to get a question to study it with.'}
              </p>
            </section>
            <section className={css({ display: 'flex', flexDirection: 'column', gap: '2' })}>
              <label htmlFor="study-notes" className={sectionTitle}>Study notes</label>
              <textarea
                id="study-notes"
                onChange={(event) => updateNotes(event.target.value)}
                placeholder="What can you reuse in your own solves?"
                value={notes}
                rows={6}
                className={cx(textInput, css({ resize: 'vertical', lineHeight: '1.6' }))}
              />
              <small className={css({ fontSize: 'xs', color: 'inkVariant' })}>Saved on this device with reco.nz solve <span className={mono}>#{reconstruction.id}</span>.</small>
            </section>
          </div>
        </div>
      )}
    </div>
  )
}
