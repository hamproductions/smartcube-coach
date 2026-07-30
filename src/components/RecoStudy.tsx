import { type FormEvent, useState } from 'react'
import { normalizeRecoUrl, type RecoReconstruction } from '../integrations/reco'
import type { SolveRecord, StudyRecord } from '../domain/models'
import { repositories } from '../storage/database'
import { CubePlayback } from './CubePlayback'

const defaultUrl = 'https://reco.nz/solve/13444'

export function RecoStudy() {
  const [url, setUrl] = useState(defaultUrl)
  const [reconstruction, setReconstruction] = useState<RecoReconstruction>()
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [error, setError] = useState('')
  const [notes, setNotes] = useState('')
  const [bookmarks, setBookmarks] = useState<number[]>([])
  const [matchingSolve, setMatchingSolve] = useState<SolveRecord>()
  const [focusStage, setFocusStage] = useState('')

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

  return (
    <section className="reco-study panel">
      <div className="reco-study-intro">
        <div>
          <span className="eyebrow green">STUDY LIBRARY / RECO.NZ</span>
          <h2>Study someone else's solution.</h2>
          <p>Import a public reconstruction, replay every turn, isolate stages, and keep private notes beside the original attribution.</p>
        </div>
        <form onSubmit={importReconstruction}>
          <label htmlFor="reco-url">reco.nz solve URL</label>
          <div>
            <input
              id="reco-url"
              name="reco-url"
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://reco.nz/solve/13444"
              type="url"
              value={url}
            />
            <button className="button primary" disabled={status === 'loading'} type="submit">
              {status === 'loading' ? 'Importing…' : 'Import reconstruction'}
            </button>
          </div>
          {location.hostname.endsWith('github.io') && <p className="editor-message">Static deployment: solve 13444 is bundled with attribution. Arbitrary imports require the local Bun server.</p>}
          {error && <p className="import-error" role="alert">{error}</p>}
        </form>
      </div>

      {reconstruction && (
        <div className="reco-study-content">
          <div className="reco-attribution">
            <div>
              <span>{reconstruction.puzzle} · reconstructed by {reconstruction.reconstructor || 'community contributor'}</span>
              <h2>{reconstruction.solver} · {reconstruction.result}</h2>
              <p>{reconstruction.subtitle}</p>
            </div>
            <a href={reconstruction.sourceUrl} rel="noreferrer" target="_blank">Open original on reco.nz</a>
          </div>

          <div className="reco-stats">
            {['Time', 'STM', 'STPS'].map((metric) => (
              <div key={metric}>
                <span>{metric}</span>
                <strong>{reconstruction.stats[metric]?.Total ?? '—'}</strong>
                <small>F2L {reconstruction.stats[metric]?.F2L ?? '—'}</small>
              </div>
            ))}
          </div>

          <div className="comparison-strip">
            <div><span>Expert moves</span><strong>{reconstruction.moves.length}</strong></div>
            <div><span>Your same-scramble solve</span><strong>{matchingSolve ? matchingSolve.moves.length : 'Not captured'}</strong></div>
            <div><span>Move delta</span><strong>{matchingSolve ? matchingSolve.moves.length - reconstruction.moves.length : '—'}</strong></div>
            <div><span>Bookmarks</span><strong>{bookmarks.length}</strong></div>
          </div>

          <CubePlayback
            moves={reconstruction.moves}
            scramble={reconstruction.scramble}
            stages={reconstruction.stages}
            title="Reconstruction playback"
          />

          <div className="study-workbench">
            <div>
              <span className="eyebrow">STAGE QUESTIONS</span>
              <div className="study-stage-list">
                {reconstruction.stages
                  .filter((stage) => stage.label.toLowerCase() !== 'inspection')
                  .map((stage, index, stages) => {
                    const end = stages.slice(0, index + 1).reduce((sum, item) => sum + item.moves.length, 0)
                    return (
                      <div className="study-stage-item" key={stage.label}>
                        <button
                          aria-label={`Study ${stage.label}`}
                          aria-pressed={focusStage === stage.label}
                          className={focusStage === stage.label ? 'active' : ''}
                          onClick={() => setFocusStage(stage.label)}
                        >
                          <span>Study {stage.label}</span>
                          <strong>{stage.moves.length} moves</strong>
                        </button>
                        <button aria-label={`Bookmark ${stage.label}`} onClick={() => toggleBookmark(end)}>{bookmarks.includes(end) ? '★' : '☆'}</button>
                      </div>
                    )
                  })}
              </div>
              <p className="study-prompt">
                {focusStage
                  ? `What did ${reconstruction.solver} preserve or predict during ${focusStage}? Compare orientation, rotations, and transition into the next stage.`
                  : 'Choose a stage to create a focused study prompt.'}
              </p>
            </div>
            <div>
              <label htmlFor="study-notes">Study notes</label>
              <textarea
                id="study-notes"
                onChange={(event) => updateNotes(event.target.value)}
                placeholder="What is reusable in your own solves?"
                value={notes}
              />
              <small>Saved locally under reco.nz solve #{reconstruction.id}</small>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
