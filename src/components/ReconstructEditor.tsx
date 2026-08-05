import { Alg } from 'cubing/alg'
import { useMemo, useState } from 'react'
import { defaultAlgorithms } from '../domain/training'
import { suggestReconstructionCompletions } from '../domain/reconstruction'
import { solveGuidedPosition } from '../domain/guidedSolve'
import { attachReconstruction } from '../domain/attachReconstruction'
import { repositories } from '../storage/database'
import type { RecoStage } from '../integrations/reco'
import { ANALYSIS_VERSION, type AlgorithmRecord, type StageRecord } from '../domain/models'
import { CubePlayback } from './CubePlayback'
import { createId } from '../domain/ids'
import AlgSuggester from '../domain/algSuggester'
import AlgSpeedEstimator from '../domain/ergonomics'

const initialScramble = ''
const initialReconstruction = ''

const speedEstimator = new AlgSpeedEstimator()

const moveAlphabet = new Map<string, string>()
function moveChar(move: string) {
  const existing = moveAlphabet.get(move)
  if (existing) return existing
  const char = String.fromCodePoint(0xe000 + moveAlphabet.size)
  moveAlphabet.set(move, char)
  return char
}
function moveHash(moves: string[]) {
  return moves.map(moveChar).join('')
}

const algByName = new Map(defaultAlgorithms.map((record) => [record.name, record]))
const algSuggesterIndex = new AlgSuggester(
  defaultAlgorithms.map((record) => ({ alg: record.name, hash: moveHash(record.algorithm.split(/\s+/)) }))
)

function parseLines(text: string): RecoStage[] {
  return text.split(/\n+/).map((line) => {
    const [alg, ...labels] = line.split('//')
    const normalized = alg.trim()
    new Alg(normalized)
    return { label: labels.join('//').trim() || 'Unlabeled', alg: normalized, moves: normalized.split(/\s+/).filter(Boolean) }
  }).filter((stage) => stage.moves.length)
}

function automaticLines(moves: string[], stages?: StageRecord[]) {
  if (!stages?.length) return `${moves.join(' ')} // Captured solve`

  return [...stages]
    .sort((left, right) => left.startEvent - right.startEvent)
    .map((stage) => `${moves.slice(stage.startEvent, stage.endEvent + 1).join(' ')} // ${stage.name}`)
    .filter((line) => !line.startsWith(' //'))
    .join('\n')
}

type ReconstructEditorProps = {
  solveId?: string
  initialScramble?: string
  initialMoves?: string[]
  initialStages?: StageRecord[]
  sourceEventIds?: string[]
}

export function ReconstructEditor({ solveId = 'manual-reconstruction', initialScramble: suppliedScramble, initialMoves, initialStages, sourceEventIds = [] }: ReconstructEditorProps = {}) {
  const [scramble, setScramble] = useState(suppliedScramble ?? initialScramble)
  const [text, setText] = useState(initialMoves?.length ? automaticLines(initialMoves, initialStages) : initialReconstruction)
  const [method, setMethod] = useState('CFOP')
  const [orientation, setOrientation] = useState('White / Green')
  const [message, setMessage] = useState('Editable source telemetry remains untouched.')
  const [solving, setSolving] = useState(false)
  const [typedSolution, setTypedSolution] = useState('')
  const [attaching, setAttaching] = useState(false)
  const [attachStatus, setAttachStatus] = useState('')
  const [attached, setAttached] = useState(false)
  const needsAttachment = !attached && solveId !== 'manual-reconstruction' && !(initialMoves?.length)
  const parsed = useMemo(() => {
    try {
      new Alg(scramble)
      return { stages: parseLines(text), error: '' }
    } catch (error) {
      return { stages: [] as RecoStage[], error: error instanceof Error ? error.message : 'Invalid notation' }
    }
  }, [scramble, text])
  const moves = parsed.stages.flatMap((stage) => stage.moves)
  const activeLine = text.split('\n').at(-1) ?? ''
  const activePrefix = activeLine.split('//')[0].trim()
  const completions = useMemo(
    () => suggestReconstructionCompletions(activePrefix, defaultAlgorithms),
    [activePrefix]
  )
  const suggestions = completions.slice(0, 4)
  const ergonomicsScore = moves.length ? speedEstimator.calcScore(moves.join(' ')) : null
  const activeMoves = activePrefix.split(/\s+/).filter(Boolean)
  const algAlternatives = useMemo(() => {
    if (!activeMoves.length) return []
    const positions: Record<number, { may: string }> = {}
    activeMoves.forEach((move, index) => { positions[index] = { may: moveChar(move) } })
    const exactIds = new Set(completions.map((completion) => completion.id))
    return algSuggesterIndex.searchByPosition({ positions, limit: 20, scoreBy: 'may' })
      .map((result) => algByName.get(result.id))
      .filter((record): record is AlgorithmRecord => record !== undefined && !exactIds.has(record.id))
      .slice(0, 5)
  }, [activePrefix, completions])

  const completeActiveLine = (remaining: string, name: string) => {
    const lines = text.split('\n')
    lines[lines.length - 1] = `${activePrefix} ${remaining} // ${name}`.trim()
    setText(lines.join('\n'))
  }

  const solveState = async () => {
    setSolving(true)
    try {
      const solution = await solveGuidedPosition(scramble, moves)
      if (!solution.length) {
        setMessage('Current reconstructed state is solved.')
        return
      }
      const continuation = `${solution.join(' ')} // Solver continuation`
      setText(text.trim() ? `${text.trim()}\n${continuation}` : continuation)
      setMessage('Generated with cubing.js search from the exact reconstructed state.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Solver failed')
    } finally {
      setSolving(false)
    }
  }

  const attachTypedSolution = async () => {
    setAttaching(true)
    try {
      const record = await repositories.solves.get(solveId)
      if (!record) {
        setAttachStatus('Could not find the underlying solve record to attach this reconstruction to.')
        return
      }
      const result = await attachReconstruction(record, typedSolution)
      if (!result.accepted) {
        setAttachStatus(result.reason)
        return
      }
      await repositories.solves.put(result.solve)
      await Promise.all(result.stages.map((stage) => repositories.stages.put(stage)))
      setScramble(result.solve.scramble)
      setText(automaticLines(result.solve.moves, result.stages))
      setAttached(true)
      const stageNames = result.stages.map((stage) => stage.caseName ? `${stage.name} (${stage.caseName})` : stage.name).join(', ')
      setAttachStatus('')
      setMessage(`Attached. Verified against the scramble, and now analysed: ${stageNames}. Stage move counts and route comparisons are genuine; recognition and execution timing stay unavailable because no per-move timing was captured for a typed reconstruction.`)
    } finally {
      setAttaching(false)
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
      id: createId(),
      solveId,
      parentRevisionId: existing[0]?.id,
      analysisVersion: ANALYSIS_VERSION,
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
            <span className="eyebrow green">EDIT YOUR SOLVE</span>
            <h2>Fix the moves we recorded.</h2>
          </div>
          <button className="button secondary" disabled={solving || !scramble.trim()} onClick={solveState}>{solving ? 'Solving…' : 'Solve state'}</button>
        </div>
        {needsAttachment && (
          <div className="editor-attach">
            <p>This solve has no captured move stream. Type the reconstruction you solved it with to unlock stage segmentation, case recognition and route comparison.</p>
            <label className="editor-field">Typed solution<textarea aria-label="Typed solution" value={typedSolution} onChange={(event) => setTypedSolution(event.target.value)} /></label>
            <button className="button secondary" disabled={attaching || !typedSolution.trim()} onClick={() => void attachTypedSolution()}>{attaching ? 'Verifying…' : 'Attach reconstruction'}</button>
            {attachStatus && <p className="editor-message" role="status">{attachStatus}</p>}
          </div>
        )}
        <div className="editor-options">
          <label>Method<select value={method} onChange={(event) => setMethod(event.target.value)}><option>CFOP</option><option>Roux</option><option>ZZ</option><option>APB</option></select></label>
          <label>Orientation<select value={orientation} onChange={(event) => setOrientation(event.target.value)}><option>White / Green</option><option>Yellow / Blue</option><option>Color neutral</option></select></label>
        </div>
        <label className="editor-field">Scramble<input value={scramble} onChange={(event) => setScramble(event.target.value)} /></label>
        <label className="editor-field">Reconstruction<textarea value={text} onChange={(event) => setText(event.target.value)} onKeyDown={(event) => {
          const suggestion = suggestions[0]
          if (event.key !== 'Tab' || !suggestion) return
          event.preventDefault()
          completeActiveLine(suggestion.remaining, suggestion.name)
        }} /></label>
        {parsed.error && <p className="import-error" role="alert">{parsed.error}</p>}
        <div className="autocomplete-row" aria-label="Algorithm suggestions">
          {suggestions.map((suggestion) => (
            <button key={suggestion.id} onClick={() => completeActiveLine(suggestion.remaining, suggestion.name)}>
              <strong>{suggestion.name}</strong><span>{suggestion.remaining}</span>
            </button>
          ))}
        </div>
        {algAlternatives.length > 0 && (
          <div className="autocomplete-row" aria-label="Alternative algorithms">
            {algAlternatives.map((alternative) => (
              <button key={alternative.id} onClick={() => completeActiveLine(alternative.algorithm.split(/\s+/).slice(activeMoves.length).join(' '), alternative.name)}>
                <strong>{alternative.name}</strong><span>{alternative.algorithm}</span>
              </button>
            ))}
          </div>
        )}
        {!parsed.error && moves.length > 0 && (
          <section className="metric-strip" aria-label="Ergonomic assessment">
            <div><span>Ergonomics</span><strong>{ergonomicsScore}</strong><small>Ao1K speed estimate, lower is better</small></div>
          </section>
        )}
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
