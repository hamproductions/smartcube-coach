import { useEffect, useRef, useState, type ReactNode } from 'react'
import { css, cx } from 'styled-system/css'
import { DASH } from '../../ui/Page'
import { useCubeConnection } from '../../../device/CubeConnection'
import type { CubeInputSource } from '../../../device/inputSource'
import { bluetoothSource } from '../../../device/sources'
import { supportsWebBluetooth } from '../../../device/webBluetooth'
import { Button } from '../../ui/Button'
import { BluetoothIcon } from '../../ui/Icon'
import { CasePicker, selectionLabel } from './CasePicker'
import { DEFAULT_HOLD, faceMoves, readHold, type Hold } from './frame'
import { CubeStage, Key, LiveClock, Segmented, SessionStrip, Toggle, labelClass, numberClass, seconds, useKeys } from './parts'
import { F2L_ORDERS, ORDER_LABEL, displayCaseName, type F2lOrder } from './queue'
import { readChoice, readFlag, readIdList, writeChoice, writeFlag, writeIdList } from './remember'
import { useF2lDrill, type F2lDrill } from './useF2lDrill'

const ORDER_KEY = 'f2l-cube:order'
const FAILED_KEY = 'f2l-cube:failed-first'
const CASES_KEY = 'f2l-cube:cases'

const capital = (value: string) => value.charAt(0).toUpperCase() + value.slice(1)

const panelClass = css({ display: 'grid', gap: '5', alignContent: 'start' })
const headingClass = css({ fontSize: { base: '2xl', md: '3xl' }, fontWeight: 'semibold', letterSpacing: '-0.02em', lineHeight: '1.1' })
const algClass = cx(numberClass, css({ fontSize: { base: 'lg', md: 'xl' }, letterSpacing: '0.06em', color: 'ink', wordBreak: 'break-word' }))

function ConnectGate({ source }: { source?: CubeInputSource }) {
  const cubeLink = useCubeConnection()
  const connect = () => void cubeLink.connect(source ?? bluetoothSource({ requestInitialState: true })).catch(() => undefined)
  const failure = cubeLink.status !== 'No cube connected' && !cubeLink.connecting ? cubeLink.status : ''
  return (
    <section aria-label="Connect" className={css({ display: 'grid', gap: '4', justifyItems: 'center', textAlign: 'center', maxW: '520px', mx: 'auto', py: { base: '8', md: '16' } })}>
      <span aria-hidden className={css({ display: 'grid', placeItems: 'center', w: '16', h: '16', borderRadius: 'pill', bg: 'container', color: 'green' })}><BluetoothIcon size={32} /></span>
      <h2 className={headingClass}>Connect your smart cube</h2>
      <p className={css({ color: 'inkVariant', fontSize: 'md' })}>The drill watches your cube to follow the setup and to know the moment the pair is solved.</p>
      <Button variant="solid" disabled={cubeLink.connecting} onClick={connect} css={{ minH: '14', px: '8', fontSize: 'md' }}>
        <BluetoothIcon size={18} /> {cubeLink.connecting ? 'Connecting' : 'Connect cube'}
      </Button>
      {failure ? <p role="status" className={css({ fontSize: 'sm', color: 'error' })}>{failure}</p> : null}
      {!source && !supportsWebBluetooth() ? <p className={css({ fontSize: 'sm', color: 'amber' })}>This browser has no Web Bluetooth. Use Chrome or Edge on desktop or Android.</p> : null}
    </section>
  )
}

function SetupMoves({ moves, progress, size = 'big' }: { moves: string[]; progress: number; size?: 'big' | 'small' }) {
  return (
    <ol aria-label="Setup moves" className={css({ display: 'flex', flexWrap: 'wrap', gap: size === 'big' ? '2' : '1', listStyle: 'none', p: '0', m: '0' })}>
      {moves.map((move, index) => {
        const done = index < progress
        const current = index === progress
        return (
          <li
            key={index}
            aria-current={current ? 'step' : undefined}
            className={cx(
              numberClass,
              css(
                { display: 'grid', placeItems: 'center', minW: '9', minH: '9', px: '2', borderRadius: 'control', borderWidth: '1px', borderColor: 'floating', color: 'ink', fontWeight: 'medium', fontSize: 'md' },
                size === 'big' && { minW: { base: '12', md: '14' }, minH: { base: '12', md: '14' }, fontSize: { base: '2xl', md: '3xl' } },
                done && { color: 'green', borderColor: 'transparent', bg: 'container', opacity: '0.7' },
                current && { borderColor: 'green', borderWidth: '2px', bg: 'floating' }
              )
            )}
          >
            {move}
          </li>
        )
      })}
    </ol>
  )
}

function Verdict({ drill }: { drill: F2lDrill }) {
  const verdict = drill.verdict
  if (!verdict) return null
  return (
    <section aria-label="Verdict" aria-live="polite" className={css({ display: 'grid', gap: '3', p: '4', borderRadius: 'card', bg: 'container', borderLeftWidth: '3px', borderColor: 'green' })}>
      <div className={css({ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '4' })}>
        <strong className={css({ fontSize: '3xl', lineHeight: '1', fontWeight: 'semibold', color: 'green' })}>Solved</strong>
        <span className={cx(numberClass, css({ fontSize: { base: '4xl', md: '6xl' }, lineHeight: '1', color: 'ink' }))}>{seconds(verdict.totalMs)}</span>
      </div>
      <p className={cx(numberClass, css({ fontSize: 'sm', color: 'inkVariant' }))}>Recognition {seconds(verdict.recognitionMs)} s · Execution {seconds(verdict.executionMs)} s{verdict.wrongMoves ? ` · ${verdict.wrongMoves} off the reference` : ''}</p>
      <div className={css({ display: 'grid', gap: '1' })}>
        <span className={labelClass}>{displayCaseName(verdict.record)}, reference</span>
        <span className={algClass}>{verdict.record.algorithm}</span>
      </div>
    </section>
  )
}

function SecondaryRow({ children }: { children: ReactNode }) {
  return <div className={css({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '2', pt: '1' })}>{children}</div>
}

export function F2lCubeDrill({ source }: { source?: CubeInputSource }) {
  const cubeLink = useCubeConnection()
  const [hold, setHold] = useState<Hold>(DEFAULT_HOLD)
  const [order, setOrder] = useState<F2lOrder>(() => readChoice(ORDER_KEY, F2L_ORDERS, 'smart'))
  const [failedFirst, setFailedFirst] = useState(() => readFlag(FAILED_KEY))
  const [selection, setSelection] = useState(() => readIdList(CASES_KEY))
  const [picking, setPicking] = useState(false)
  const [demo, setDemo] = useState(false)
  const nextButton = useRef<HTMLButtonElement>(null)
  const drill = useF2lDrill({ selection, order, failedFirst, hold })

  useEffect(() => {
    let cancelled = false
    void readHold().then((value) => { if (!cancelled) setHold(value) }).catch(() => undefined)
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (drill.phase !== 'gaveUp') return
    nextButton.current?.focus()
    setDemo(false)
    const timer = window.setTimeout(() => setDemo(true), 500)
    return () => window.clearTimeout(timer)
  }, [drill.phase, drill.record?.id])

  const replay = () => {
    setDemo(false)
    window.setTimeout(() => setDemo(true), 350)
  }

  useKeys((event) => {
    const primary = event.key === ' ' || event.key === 'Enter'
    if (!cubeLink.handle) return false
    if (drill.phase === 'idle' && primary && !drill.loading && drill.pool.length) {
      drill.start()
      return true
    }
    if (drill.phase === 'setup' && drill.verdictVisible && primary) {
      drill.dismissVerdict()
      return true
    }
    if ((drill.phase === 'recognition' || drill.phase === 'execution') && event.key.toLowerCase() === 'h' && drill.hintsLeft) {
      drill.revealHint()
      return true
    }
    if (drill.phase === 'gaveUp' && primary) {
      drill.next()
      return true
    }
    return false
  })

  if (!cubeLink.handle) return <ConnectGate source={source} />

  const rotation = hold.rotation
  const join = (...parts: Array<string | string[]>) => parts.flat().filter(Boolean).join(' ')
  const caseAlg = join(rotation, drill.setup)
  const cubeAlg = drill.phase === 'setup'
    ? join(rotation, drill.setup.slice(0, drill.progress), drill.stray)
    : drill.phase === 'recognition' || drill.phase === 'execution'
      ? join(caseAlg, drill.performed)
      : drill.phase === 'gaveUp'
        ? (demo && drill.record ? join(caseAlg, faceMoves(drill.record.algorithm)) : caseAlg)
        : rotation
  const holdText = `${capital(hold.top)} on top, ${hold.front} in front`
  const solved = drill.session.filter((result) => result.outcome === 'success')
  const mean = (values: Array<number | undefined>) => {
    const known = values.filter((value): value is number => value !== undefined)
    return known.length ? `${seconds(known.reduce((sum, value) => sum + value, 0) / known.length)} s` : DASH
  }

  const changeOrder = (value: F2lOrder) => {
    writeChoice(ORDER_KEY, value)
    setOrder(value)
  }
  const changeFailed = (value: boolean) => {
    writeFlag(FAILED_KEY, value)
    setFailedFirst(value)
  }
  const closePicker = (value: string[] | 'all') => {
    writeIdList(CASES_KEY, value)
    setSelection(value)
    setPicking(false)
  }

  const caption = drill.phase === 'setup' ? holdText
    : drill.phase === 'gaveUp' ? (demo ? 'Playing the reference algorithm' : 'The case')
      : drill.phase === 'recognition' || drill.phase === 'execution' ? 'Your turns, live'
        : drill.phase === 'ready' ? 'The goal: first two layers solved'
          : holdText

  let focus: ReactNode
  if (drill.phase === 'idle') {
    focus = (
      <div className={panelClass}>
        <div className={css({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '2' })}>
          <Button onClick={() => setPicking(true)} disabled={drill.loading || !drill.records.length} aria-haspopup="dialog" css={{ minH: 'touch', fontVariantNumeric: 'tabular-nums' }}>
            {drill.loading ? 'Loading cases' : selectionLabel(selection, drill.records)}
          </Button>
          <Segmented label="Order" options={F2L_ORDERS} value={order} onChange={changeOrder} labels={ORDER_LABEL} />
          <Toggle pressed={failedFirst} onChange={changeFailed}>Failed first</Toggle>
        </div>
        <Button variant="solid" disabled={drill.loading || !drill.pool.length} onClick={drill.start} className={css({ justifySelf: 'start', minH: '16', px: '10', fontSize: 'lg' })}>
          Start drill <Key>Space</Key>
        </Button>
        <p className={css({ fontSize: 'sm', color: 'inkVariant', maxW: '60ch' })}>Hold the cube {holdText.toLowerCase()}, with the first two layers solved. Each case gives you setup moves to turn, then you solve the pair and the cube checks it.</p>
        {drill.error ? <p role="alert" className={css({ fontSize: 'sm', color: 'error' })}>{drill.error}</p> : null}
        {!drill.loading && drill.records.length && !drill.pool.length ? <p className={css({ fontSize: 'sm', color: 'amber' })}>No cases selected.</p> : null}
      </div>
    )
  } else if (drill.phase === 'ready') {
    focus = (
      <div className={panelClass}>
        <span className={labelClass}>Before the next case</span>
        <h2 className={headingClass}>Solve the first two layers</h2>
        <p className={css({ fontSize: 'md', color: 'inkVariant', maxW: '52ch' })}>The setup appears as soon as your cube has the cross and all four pairs solved. The last layer can stay as it is.</p>
        <SecondaryRow>
          <Button onClick={drill.resetTracking}>My cube is solved</Button>
          <Button variant="ghost" onClick={drill.next}>Skip case</Button>
          <Button variant="ghost" onClick={drill.stop}>End session</Button>
        </SecondaryRow>
        <p className={css({ fontSize: 'xs', color: 'inkVariant' })}>Use My cube is solved only when the screen and the cube in your hands disagree.</p>
      </div>
    )
  } else if (drill.phase === 'setup') {
    focus = drill.verdictVisible ? (
      <div className={panelClass}>
        <Verdict drill={drill} />
        <div className={css({ display: 'grid', gap: '2' })}>
          <span className={labelClass}>Next setup. Start turning, or press <Key>Space</Key></span>
          <SetupMoves moves={drill.setup} progress={drill.progress} size="small" />
        </div>
      </div>
    ) : (
      <div className={panelClass}>
        <div className={css({ display: 'grid', gap: '1' })}>
          <span className={labelClass}>Set up the case <span className={numberClass}>{drill.progress}/{drill.setup.length}</span></span>
          <h2 className={headingClass}>{drill.record ? displayCaseName(drill.record) : ''}</h2>
        </div>
        <SetupMoves moves={drill.setup} progress={drill.progress} />
        {drill.offTrack ? (
          <p role="status" className={css({ fontSize: 'md', color: 'amber' })}>Off the setup. Undo with <span className={cx(numberClass, css({ fontWeight: 'semibold' }))}>{drill.offTrack}</span></p>
        ) : (
          <p className={css({ fontSize: 'sm', color: 'inkVariant' })}>Turn these from a solved first two layers. The timer starts on the last move.</p>
        )}
        <SecondaryRow>
          <Button variant="ghost" onClick={drill.next}>Skip case</Button>
          <Button variant="ghost" onClick={drill.stop}>End session</Button>
        </SecondaryRow>
      </div>
    )
  } else if (drill.phase === 'recognition' || drill.phase === 'execution') {
    focus = (
      <div className={panelClass}>
        <div className={css({ display: 'grid', gap: '1' })}>
          <span className={css({ fontSize: 'xs', color: drill.phase === 'recognition' ? 'amber' : 'green' })}>{drill.phase === 'recognition' ? 'Recognise' : 'Execute'}</span>
          <h2 className={headingClass}>Solve the pair</h2>
          <span className={css({ fontSize: 'sm', color: 'inkVariant' })}>{drill.record ? displayCaseName(drill.record) : ''}</span>
        </div>
        <LiveClock since={drill.recognitionStartedAt} className={css({ fontSize: { base: '6xl', md: '8xl' }, lineHeight: '1', color: 'ink' })} />
        {drill.recognitionMs !== undefined ? <span className={cx(numberClass, css({ fontSize: 'sm', color: 'inkVariant' }))}>Recognition {seconds(drill.recognitionMs)} s</span> : null}
        <div className={css({ display: 'grid', gap: '2' })}>
          {drill.hint ? <span className={algClass} aria-label="Hint">{drill.hint}</span> : null}
          <SecondaryRow>
            <Button disabled={!drill.hintsLeft} onClick={drill.revealHint}>{drill.hint ? 'Next move' : 'Hint'} <Key>H</Key></Button>
            <Button variant="ghost" onClick={drill.giveUp}>Give up</Button>
          </SecondaryRow>
        </div>
      </div>
    )
  } else {
    focus = (
      <div className={panelClass}>
        <section aria-label="Verdict" aria-live="polite" className={css({ display: 'grid', gap: '3', p: '4', borderRadius: 'card', bg: 'container', borderLeftWidth: '3px', borderColor: 'error' })}>
          <strong className={css({ fontSize: '3xl', lineHeight: '1', fontWeight: 'semibold', color: 'error' })}>Gave up</strong>
          <div className={css({ display: 'grid', gap: '1' })}>
            <span className={labelClass}>{drill.record ? displayCaseName(drill.record) : ''}, reference</span>
            <span className={algClass}>{drill.record?.algorithm}</span>
          </div>
        </section>
        <SecondaryRow>
          <Button ref={nextButton} variant="solid" onClick={drill.next}>Next case <Key>Space</Key></Button>
          <Button onClick={drill.retry}>Try again</Button>
          <Button variant="ghost" onClick={replay}>Replay</Button>
          <Button variant="ghost" onClick={drill.stop}>End session</Button>
        </SecondaryRow>
      </div>
    )
  }

  return (
    <div className={css({ display: 'grid', gap: '6' })}>
      <div className={css({ display: 'grid', gap: { base: '6', lg: '10' }, gridTemplateColumns: { base: '1fr', lg: 'minmax(0, 5fr) minmax(0, 6fr)' }, alignItems: 'start' })}>
        <CubeStage setupAlg={cubeAlg} caption={caption} />
        {focus}
      </div>
      {drill.phase !== 'idle' || drill.session.length ? (
        <SessionStrip
          stats={[
            { label: 'Solved', value: solved.length },
            { label: 'Gave up', value: drill.session.length - solved.length },
            { label: 'Mean recognition', value: mean(solved.map((result) => result.recognitionMs)) },
            { label: 'Mean execution', value: mean(solved.map((result) => result.executionMs)) }
          ]}
          recent={drill.session.slice(-8).map((result) => ({
            success: result.outcome === 'success',
            label: `${displayCaseName(result.record)}: ${result.outcome === 'success' ? `${seconds(result.totalMs)} seconds` : 'gave up'}`,
            text: result.outcome === 'success' ? seconds(result.totalMs) : 'DNF'
          }))}
        />
      ) : null}
      {picking ? <CasePicker records={drill.records} selection={selection} onClose={closePicker} /> : null}
    </div>
  )
}
