import { Alg } from 'cubing/alg'
import { puzzles } from 'cubing/puzzles'
import { useMemo, useState } from 'react'
import { defaultAlgorithms } from '../domain/training'
import { repositories } from '../storage/database'
import type { RecoStage } from '../integrations/reco'
import { CubePlayback } from './CubePlayback'

const initialScramble = ''
const initialReconstruction = ''

function parseLines(text: string): RecoStage[] {
  return text.split(/\n+/).map((line) => {
    const [alg, ...labels] = line.split('//')
    const normalized = alg.trim()
    new Alg(normalized)
    return { label: labels.join('//').trim() || 'Unlabeled', alg: normalized, moves: normalized.split(/\s+/).filter(Boolean) }
  }).filter((stage) => stage.moves.length)
}

type ReconstructEditorProps = {
  solveId?: string
  initialScramble?: string
  initialMoves?: string[]
  sourceEventIds?: string[]
}

export function ReconstructEditor({ solveId = 'manual-reconstruction', initialScramble: suppliedScramble, initialMoves, sourceEventIds = [] }: ReconstructEditorProps = {}) {
  const [scramble, setScramble] = useState(suppliedScramble ?? initialScramble)
  const [text, setText] = useState(initialMoves?.length ? `${initialMoves.join(' ')} // Captured solve` : initialReconstruction)
  const [method, setMethod] = useState('CFOP')
  const [orientation, setOrientation] = useState('White / Green')
  const [message, setMessage] = useState('Editable source telemetry remains untouched.')
  const [solving, setSolving] = useState(false)
  const parsed = useMemo(() => {
    try {
      new Alg(scramble)
      return { stages: parseLines(text), error: '' }
    } catch (error) {
      return { stages: [] as RecoStage[], error: error instanceof Error ? error.message : 'Invalid notation' }
    }
  }, [scramble, text])
  const moves = parsed.stages.flatMap((stage) => stage.moves)
  const query = text.split(/\s+/).at(-1)?.toLowerCase() ?? ''
  const suggestions = query ? defaultAlgorithms.filter((record) => record.name.toLowerCase().includes(query) || record.id.includes(query)).slice(0, 4) : []

  const solveState = async () => {
    setSolving(true)
    try {
      const puzzle = await puzzles['3x3x3'].kpuzzle()
      const { experimentalSolve3x3x3IgnoringCenters } = await import('cubing/search')
      const solution = await experimentalSolve3x3x3IgnoringCenters(puzzle.defaultPattern().applyAlg(scramble))
      setText(`${solution.toString()} // Solver-backed solution`)
      setMessage('Generated with cubing.js search from the exact scramble state.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Solver failed')
    } finally {
      setSolving(false)
    }
  }

  const saveRevision = async () => {
    if (parsed.error) return
    const existing = (await repositories.revisions.all()).filter((revision) => revision.solveId === solveId).sort((left, right) => right.createdAt - left.createdAt)
    let cursor = 0
    const lines = parsed.stages.map((stage, index) => {
      const mapped = sourceEventIds.slice(cursor, cursor + stage.moves.length)
      cursor += stage.moves.length
      return {
        id: `${solveId}:line-${index + 1}`,
        sourceEventIds: mapped,
        insertedMoves: stage.moves.slice(mapped.length),
        label: stage.label
      }
    })
    await repositories.revisions.put({
      id: crypto.randomUUID(),
      solveId,
      parentRevisionId: existing[0]?.id,
      analysisVersion: '1',
      method,
      lines,
      createdAt: Date.now(),
      origin: 'user-edit'
    })
    setMessage(`Saved revision ${existing.length + 1}. ${sourceEventIds.length} immutable source events remain linked.`)
  }

  const shareUrl = `https://alg.cubing.net/?setup=${encodeURIComponent(scramble)}&alg=${encodeURIComponent(text)}`

  return (
    <section className="surface-stack">
      <article className="panel editor-panel">
        <div className="surface-heading">
          <div>
            <span className="eyebrow green">RECONSTRUCT / EDITABLE + RECOMPUTABLE</span>
            <h2>Line reconstruction and autocomplete.</h2>
          </div>
          <button className="button secondary" disabled={solving || !scramble.trim()} onClick={solveState}>{solving ? 'Solving…' : 'Solve state'}</button>
        </div>
        <div className="editor-options">
          <label>Method<select value={method} onChange={(event) => setMethod(event.target.value)}><option>CFOP</option><option>Roux</option><option>ZZ</option><option>APB</option></select></label>
          <label>Orientation<select value={orientation} onChange={(event) => setOrientation(event.target.value)}><option>White / Green</option><option>Yellow / Blue</option><option>Color neutral</option></select></label>
        </div>
        <label className="editor-field">Scramble<input value={scramble} onChange={(event) => setScramble(event.target.value)} /></label>
        <label className="editor-field">Reconstruction<textarea value={text} onChange={(event) => setText(event.target.value)} /></label>
        {parsed.error && <p className="import-error" role="alert">{parsed.error}</p>}
        <div className="autocomplete-row">
          {suggestions.map((suggestion) => (
            <button key={suggestion.id} onClick={() => setText(`${text}\n${suggestion.algorithm} // ${suggestion.set}: ${suggestion.name}`)}>
              <strong>{suggestion.name}</strong><span>{suggestion.algorithm}</span>
            </button>
          ))}
        </div>
        <div className="editor-actions">
          <button disabled={!moves.length} onClick={() => void saveRevision()}>Save revision</button>
          <button disabled={!text.trim()} onClick={() => void navigator.clipboard.writeText(text)}>Copy text</button>
          <button disabled={!moves.length} onClick={() => void navigator.clipboard.writeText(shareUrl)}>Copy share link</button>
          {moves.length > 0 && <a href={shareUrl} rel="noreferrer" target="_blank">Open animated export</a>}
        </div>
        <p className="editor-message">{method} · {orientation} · {message}</p>
      </article>
      {!parsed.error && moves.length > 0 && <article className="panel playback-panel"><CubePlayback title="Editable reconstruction" scramble={scramble} moves={moves} stages={parsed.stages} /></article>}
    </section>
  )
}
