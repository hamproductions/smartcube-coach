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
import { css, cx } from 'styled-system/css'
import { Section, card, fieldLabel, mono, primaryButton, secondaryButton, textInput } from './ui/Page'
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
  const [message, setMessage] = useState('')
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

  const chip = cx(mono, css({
    display: 'inline-flex', alignItems: 'baseline', gap: '2', minH: '44px', px: '3', borderRadius: 'control',
    borderWidth: '1px', borderColor: 'floating', bg: 'container', color: 'ink', fontSize: 'xs', cursor: 'pointer', textAlign: 'left',
    _hover: { borderColor: 'outline' },
    _focusVisible: { outline: '2px solid', outlineColor: 'green', outlineOffset: '2px' }
  }))
  const chipName = css({ fontFamily: 'sans', fontWeight: 'semibold', fontSize: 'sm' })

  return (
    <Section id="reconstruct" title="Fix a reconstruction" description="Type or correct the moves of a solve, one stage per line with a // label. Tab accepts the first suggestion.">
      <div className={css({ display: 'grid', gap: '8', gridTemplateColumns: { base: '1fr', lg: !parsed.error && moves.length > 0 ? 'minmax(0, 7fr) minmax(0, 5fr)' : '1fr' }, alignItems: 'start' })}>
        <div className={css({ display: 'flex', flexDirection: 'column', gap: '4', minW: '0' })}>
          {needsAttachment && (
            <div className={cx(card, css({ p: '4', display: 'flex', flexDirection: 'column', gap: '3' }))}>
              <p className={css({ fontSize: 'sm', color: 'inkVariant' })}>This solve has no captured move stream. Type the reconstruction you solved it with to unlock stage splits, case recognition and route comparison.</p>
              <label className={fieldLabel}>Typed solution<textarea aria-label="Typed solution" rows={3} value={typedSolution} onChange={(event) => setTypedSolution(event.target.value)} className={cx(textInput, mono, css({ resize: 'vertical' }))} /></label>
              <button type="button" className={cx(secondaryButton, css({ alignSelf: 'flex-start' }))} disabled={attaching || !typedSolution.trim()} onClick={() => void attachTypedSolution()}>{attaching ? 'Checking...' : 'Attach reconstruction'}</button>
              {attachStatus && <p className={css({ fontSize: 'sm', color: 'amber' })} role="status">{attachStatus}</p>}
            </div>
          )}
          <div className={css({ display: 'grid', gap: '3', gridTemplateColumns: { base: '1fr', sm: '10rem minmax(0, 1fr)' } })}>
            <label className={fieldLabel}>Method
              <select value={method} onChange={(event) => setMethod(event.target.value)} className={cx(textInput, css({ cursor: 'pointer' }))}><option>CFOP</option><option>Roux</option><option>ZZ</option><option>APB</option></select>
            </label>
            <label className={fieldLabel}>Scramble<input value={scramble} onChange={(event) => setScramble(event.target.value)} className={cx(textInput, mono)} /></label>
          </div>
          <label className={fieldLabel}>Reconstruction<textarea rows={8} value={text} onChange={(event) => setText(event.target.value)} className={cx(textInput, mono, css({ resize: 'vertical', lineHeight: '1.7' }))} onKeyDown={(event) => {
            const suggestion = suggestions[0]
            if (event.key !== 'Tab' || !suggestion) return
            event.preventDefault()
            completeActiveLine(suggestion.remaining, suggestion.name)
          }} /></label>
          {parsed.error && <p className={css({ fontSize: 'sm', color: 'error' })} role="alert">{parsed.error}</p>}
          <div aria-label="Algorithm suggestions" className={css({ display: 'flex', flexWrap: 'wrap', gap: '2', _empty: { display: 'none' } })}>
            {suggestions.map((suggestion) => (
              <button type="button" key={suggestion.id} className={chip} onClick={() => completeActiveLine(suggestion.remaining, suggestion.name)}>
                <span className={chipName}>{suggestion.name}</span><span className={css({ color: 'inkVariant' })}>{suggestion.remaining}</span>
              </button>
            ))}
          </div>
          {algAlternatives.length > 0 && (
            <div className={css({ display: 'flex', flexDirection: 'column', gap: '2' })}>
              <span className={css({ fontSize: 'xs', color: 'inkVariant' })}>Close matches</span>
              <div aria-label="Alternative algorithms" className={css({ display: 'flex', flexWrap: 'wrap', gap: '2' })}>
                {algAlternatives.map((alternative) => (
                  <button type="button" key={alternative.id} className={chip} onClick={() => completeActiveLine(alternative.algorithm.split(/\s+/).slice(activeMoves.length).join(' '), alternative.name)}>
                    <span className={chipName}>{alternative.name}</span><span className={css({ color: 'inkVariant' })}>{alternative.algorithm}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {!parsed.error && moves.length > 0 && (
            <section aria-label="Ergonomic assessment" className={css({ display: 'flex', alignItems: 'baseline', gap: '3', flexWrap: 'wrap' })}>
              <span className={css({ fontSize: 'sm', color: 'inkVariant' })}>Ergonomics</span>
              <strong className={cx(mono, css({ fontSize: 'lg' }))}>{ergonomicsScore}</strong>
              <small className={css({ fontSize: 'xs', color: 'inkVariant' })}>Ao1K speed estimate, lower is better</small>
            </section>
          )}
          <div className={css({ display: 'flex', gap: '2', flexWrap: 'wrap' })}>
            <button type="button" className={primaryButton} disabled={!moves.length} onClick={() => void saveRevision()}>Save revision</button>
            <button type="button" className={secondaryButton} disabled={solving || !scramble.trim()} onClick={solveState}>{solving ? 'Solving...' : 'Solve state'}</button>
            <button type="button" className={secondaryButton} disabled={!text.trim()} onClick={() => void navigator.clipboard.writeText(text).then(() => setMessage('Copied the reconstruction.'))}>Copy text</button>
            <button type="button" className={secondaryButton} disabled={!moves.length} onClick={() => void navigator.clipboard.writeText(shareUrl).then(() => setMessage('Copied a link to alg.cubing.net.'))}>Copy share link</button>
            {moves.length > 0 && <a href={shareUrl} rel="noreferrer" target="_blank" className={secondaryButton}>Open in alg.cubing.net</a>}
          </div>
          {message && <p role="status" className={css({ fontSize: 'sm', color: 'inkVariant' })}>{message}</p>}
        </div>
        {!parsed.error && moves.length > 0 && <CubePlayback title="Replay" scramble={scramble} moves={moves} stages={parsed.stages} />}
      </div>
    </Section>
  )
}
