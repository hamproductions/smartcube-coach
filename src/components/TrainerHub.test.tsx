import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Alg } from 'cubing/alg'
import { clearDatabase, repositories } from '../storage/database'
import { generateColorInference } from '../domain/cognitive'
import { generateEdgeOrientationPrompt, generateEdgeTrackingPrompt, generatePairTrackingPrompt } from '../domain/tracking'
import { generateCrossInspectionPrompt } from '../domain/inspection'
import { generateBldDrill } from '../domain/bld'
import { generateFreePairPrompt } from '../domain/freePair'
import { twoLookOllCases, defaultAlgorithms } from '../domain/training'
import { CubeConnectionProvider } from '../device/CubeConnection'
import type { CubeEvent, CubeInputSource } from '../device/inputSource'
import type { TrainerAttempt } from '../domain/models'
import { TrainerHub } from './TrainerHub'

const fakeCubeSource = () => {
  const state = { emit: undefined as undefined | ((event: CubeEvent) => void | Promise<void>) }
  const source: CubeInputSource = {
    id: 'fake-drill-cube',
    label: 'Injected drill cube',
    async start(onEvent, onStatus) {
      state.emit = onEvent
      onStatus('Injected drill cube ready')
      return {
        name: 'Injected drill cube',
        protocol: 'contract',
        mac: 'aa:bb',
        capabilities: { facelets: true, battery: false, gyroscope: false },
        provenance: 'cube',
        requestState: async () => undefined,
        stop: async () => undefined
      }
    }
  }
  return { source, state }
}

const emitMove = (state: { emit?: (event: CubeEvent) => void | Promise<void> }, move: string) => {
  const timestamp = Date.now()
  return state.emit?.({ type: 'MOVE', face: 0, direction: 1, move, localTimestamp: timestamp, cubeTimestamp: timestamp, timestamp } as CubeEvent)
}

const buildAttempt = (caseId: string, totalMs: number, startedAt: number): TrainerAttempt => ({
  id: `seed-${caseId}-${startedAt}`,
  sessionId: 's',
  caseId,
  caseVersion: 1,
  family: 'algorithm',
  protocol: 'typed-answer',
  curriculumMode: 'drill',
  setup: { seed: 's', generatorId: 'g', generatorVersion: '1', caseId, scramble: '', constraintHash: '' },
  input: 'keyboard',
  startedAt,
  endedAt: startedAt + totalMs,
  phaseEvents: [],
  totalMs,
  outcome: 'success',
  hintEvents: [],
  wrongMoves: 0,
  divergenceCount: 0,
  correctionMoveCount: 0,
  rawEventIds: [],
  dataQuality: { completeMoveStream: true, setupVerifiedByState: true, packetLossSuspected: false, timingUsable: true, notes: [] },
  schemaVersion: 1
})

describe('TrainerHub grading', () => {
  beforeEach(async () => clearDatabase())
  afterEach(async () => clearDatabase())

  it('records success only when the typed answer matches the case', async () => {
    const user = userEvent.setup()
    render(<CubeConnectionProvider><TrainerHub /></CubeConnectionProvider>)

    await waitFor(() => expect(screen.getByRole('button', { name: 'Start session' })).toBeEnabled(), { timeout: 10_000 })
    await user.click(screen.getByRole('button', { name: 'Start session' }))
    expect(screen.getByRole('heading', { name: 'Recognize the case' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Turn any move to advance playback.' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Controller playback' })).toBeInTheDocument()
    expect(document.querySelector('twisty-player')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Recognized' }))
    const heading = screen.getByRole('heading', { name: /execution$/ }).textContent ?? ''
    const presentedCase = heading.replace(/ execution$/, '')
    expect(presentedCase).not.toBe('')

    const answer = screen.getByRole('textbox', { name: 'Case answer' })
    await user.type(answer, 'wrong case')
    await user.click(screen.getByRole('button', { name: 'Submit answer' }))
    await waitFor(async () => expect(await repositories.attempts.all()).toHaveLength(1))

    await user.click(screen.getByRole('button', { name: 'Recognized' }))
    const nextHeading = screen.getByRole('heading', { name: /execution$/ }).textContent ?? ''
    await user.type(screen.getByRole('textbox', { name: 'Case answer' }), nextHeading.replace(/ execution$/, ''))
    await user.click(screen.getByRole('button', { name: 'Submit answer' }))
    await waitFor(async () => expect(await repositories.attempts.all()).toHaveLength(2))

    const attempts = await repositories.attempts.all()
    expect(attempts.map((attempt) => attempt.outcome).sort()).toEqual(['incorrect', 'success'])
    expect(attempts.every((attempt) => attempt.protocol === 'typed-answer')).toBe(true)
    expect(attempts.every((attempt) => attempt.answerCorrect === (attempt.outcome === 'success'))).toBe(true)
  }, 30_000)

  it('drives controller playback and persists a completed controller pass', async () => {
    let emitMove: ((move: string) => void) | undefined
    const user = userEvent.setup()
    render(<CubeConnectionProvider><TrainerHub controllerConnect={async (onMove) => {
      emitMove = (move) => onMove(move, performance.now())
      return { name: 'Test cube', disconnect: async () => undefined }
    }} /></CubeConnectionProvider>)

    await waitFor(() => expect(screen.getByRole('button', { name: 'Start session' })).toBeEnabled(), { timeout: 10_000 })
    await user.click(screen.getByRole('button', { name: 'Start session' }))
    await user.click(screen.getByRole('button', { name: 'Connect controller' }))
    const target = Number(screen.getByText(/Target \d+ \/ \d+/).textContent?.match(/\/ (\d+)/)?.[1] ?? 0)
    expect(target).toBeGreaterThan(0)
    // Played moves are appended to the setup alg, because a twisty-player renders the
    // position at the START of its alg — moves put in `alg` leave the cube frozen.
    // The drill renders two players: the case preview (static) first, then the controller
    // playback. Playback is the one this asserts on, so take the last, not the first.
    const setupAlg = () => {
      const players = document.querySelectorAll('twisty-player')
      return players[players.length - 1]?.getAttribute('experimental-setup-alg')
    }
    const atRest = setupAlg()
    await act(async () => emitMove?.('F'))
    const duringDrill = setupAlg()
    expect(duringDrill).not.toBe(atRest)
    for (let index = 1; index < target; index += 1) await act(async () => emitMove?.('F'))

    await waitFor(async () => expect((await repositories.attempts.all()).some((attempt) => attempt.protocol === 'algorithm-rehearsal')).toBe(true))
    // A completed pass moves on to the next case, so playback resets to that case's
    // own setup with nothing played yet. Assert the reset concretely — that the move
    // counter is back at zero — rather than merely that the string changed, which any
    // different scramble would satisfy even with playback left broken.
    await waitFor(() => expect(screen.getByText(/Move 0 \/ \d+/)).toBeInTheDocument())
    expect(setupAlg()).not.toBe(duringDrill)
  }, 30_000)

  it('persists color-inference attempts through the shared trainer ledger', async () => {
    const user = userEvent.setup()
    render(<CubeConnectionProvider><TrainerHub /></CubeConnectionProvider>)

    await screen.findByText(/Visible colors:/)
    await user.type(screen.getByRole('textbox', { name: 'Missing color' }), generateColorInference('color-001').answer)
    await user.click(screen.getByRole('button', { name: 'Check missing color' }))

    await waitFor(async () => expect(await repositories.attempts.all()).toHaveLength(1))
    const [attempt] = await repositories.attempts.all()
    expect(attempt.family).toBe('color-inference')
    expect(attempt.protocol).toBe('typed-answer')
    expect(attempt.answerCorrect).toBe(true)
    expect(screen.getByText(`Visible colors: ${generateColorInference('color-002').visible.join(' · ')}`)).toBeInTheDocument()
  })

  it('applies and persists a custom BLD lettering configuration', async () => {
    const user = userEvent.setup()
    render(<CubeConnectionProvider><TrainerHub /></CubeConnectionProvider>)

    await user.clear(screen.getByRole('textbox', { name: 'BLD buffer' }))
    await user.type(screen.getByRole('textbox', { name: 'BLD buffer' }), 'Z')
    await user.clear(screen.getByRole('textbox', { name: 'BLD letter scheme' }))
    await user.type(screen.getByRole('textbox', { name: 'BLD letter scheme' }), 'ZYXWVUTSRQPONMLKJIHGFEDC')
    await user.click(screen.getByRole('button', { name: 'Apply BLD configuration' }))

    await waitFor(() => expect(screen.getByText('Z', { selector: '.bld-grid strong' })).toBeInTheDocument())
    expect(await repositories.settings.get('bld-config')).toEqual({ key: 'bld-config', value: { buffer: 'Z', letterScheme: 'ZYXWVUTSRQPONMLKJIHGFEDC' } })
  })

  it('sets the active case group learning state in one local operation', async () => {
    const user = userEvent.setup()
    render(<CubeConnectionProvider><TrainerHub /></CubeConnectionProvider>)

    const setLearning = await screen.findByRole('button', { name: 'Mark all learning' })
    await waitFor(async () => expect((await repositories.algorithms.all()).filter((record) => record.set === 'F2L').length).toBeGreaterThan(50), { timeout: 60_000 })
    await waitFor(() => expect(setLearning).toBeEnabled())
    await user.click(setLearning)

    await waitFor(async () => {
      const f2l = (await repositories.algorithms.all()).filter((record) => record.set === 'F2L')
      expect(f2l.every((record) => record.mastery === 0.4)).toBe(true)
    }, { timeout: 30_000 })
    expect(screen.getByRole('button', { name: /^Learning \d+$/ })).toBeInTheDocument()
  }, 90_000)

  it('adds a validated personal case to the active trainer set', async () => {
    const user = userEvent.setup()
    render(<CubeConnectionProvider><TrainerHub /></CubeConnectionProvider>)

    await user.type(screen.getByRole('textbox', { name: 'New case subset' }), 'Insert')
    await user.type(screen.getByRole('textbox', { name: 'New case name' }), 'My F2L insert')
    await user.type(screen.getByRole('textbox', { name: 'New case algorithm' }), "R U R'")
    await user.click(screen.getByRole('button', { name: 'Add personal case' }))

    await waitFor(async () => expect((await repositories.algorithms.all()).some((record) => record.name === 'My F2L insert')).toBe(true))
    expect(screen.getByRole('button', { name: /My F2L insert/ })).toBeInTheDocument()
  })

  it('rejects a personal case authored with missing fields, mirroring cubedex\'s required-fields validation', async () => {
    const user = userEvent.setup()
    render(<CubeConnectionProvider><TrainerHub /></CubeConnectionProvider>)

    const addButton = await screen.findByRole('button', { name: 'Add personal case' })
    expect(addButton).toBeDisabled()
    await user.type(screen.getByRole('textbox', { name: 'New case name' }), 'Incomplete case')
    await user.type(screen.getByRole('textbox', { name: 'New case algorithm' }), "R U R'")
    expect(screen.getByRole('button', { name: 'Add personal case' })).toBeDisabled()
  })

  it('normalizes curly-quote notation through the live move preview before persisting the case', async () => {
    const user = userEvent.setup()
    render(<CubeConnectionProvider><TrainerHub /></CubeConnectionProvider>)

    await user.type(screen.getByRole('textbox', { name: 'New case subset' }), 'Insert')
    await user.type(screen.getByRole('textbox', { name: 'New case name' }), 'My bracket insert')
    await user.type(screen.getByRole('textbox', { name: 'New case algorithm' }), 'R U R‘ U‘')

    const preview = screen.getByLabelText('Move preview')
    expect(within(preview).getAllByText(/^(R|U|R'|U')$/).map((node) => node.textContent)).toEqual(['R', 'U', "R'", "U'"])
    expect(within(preview).getByText('4 moves')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Add personal case' }))

    await waitFor(async () => {
      const record = (await repositories.algorithms.all()).find((item) => item.name === 'My bracket insert')
      expect(record?.algorithm).toBe("R U R' U'")
    })
  })

  it('drills the recorded-slowest F2L case first once "Slow First" is enabled', async () => {
    const defaultF2l = defaultAlgorithms.filter((record) => record.set === 'F2L')
    const dummySeed = { ...defaultF2l[0], id: 'f2l-fr-dummy', name: 'Dummy FR seed' }
    await Promise.all([...defaultF2l, dummySeed].map((record) => repositories.algorithms.put(record)))
    const times: Record<string, number> = { 'f2l-insert-right': 9_000, 'f2l-insert-left': 500, 'f2l-sledge': 2_000, 'f2l-fr-dummy': 1_000 }
    await Promise.all(Object.entries(times).map(([caseId, totalMs], index) => repositories.attempts.put(buildAttempt(caseId, totalMs, Date.now() + index))))

    const user = userEvent.setup()
    render(<CubeConnectionProvider><TrainerHub /></CubeConnectionProvider>)

    await user.click(await screen.findByRole('button', { name: 'Slow First' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start real-cube drill' })).toBeEnabled(), { timeout: 15_000 })
    await user.click(screen.getByRole('button', { name: 'Start real-cube drill' }))

    await waitFor(() => expect(screen.getByRole('heading', { level: 3 }).textContent).toBe('Basic right insert'), { timeout: 5_000 })
  }, 30_000)

  it('advances to a different case after completing one, driven by the drill engine queue', async () => {
    const user = userEvent.setup()
    const { source, state } = fakeCubeSource()
    render(<CubeConnectionProvider><TrainerHub source={source} /></CubeConnectionProvider>)

    await waitFor(async () => expect((await repositories.algorithms.all()).filter((record) => record.set === 'F2L').length).toBeGreaterThan(50), { timeout: 60_000 })
    await user.click(await screen.findByRole('button', { name: 'Connect cube for drill' }))
    await user.click(await screen.findByRole('button', { name: 'Start real-cube drill' }))
    await waitFor(() => expect(screen.getByText('Recognize…')).toBeInTheDocument(), { timeout: 3_000 })

    const firstCaseName = screen.getByRole('heading', { level: 3 }).textContent ?? ''
    const firstRecord = (await repositories.algorithms.all()).find((item) => item.name === firstCaseName)
    expect(firstRecord).toBeDefined()
    const firstMoves = new Alg(firstRecord!.setup).invert().toString().split(/\s+/).filter(Boolean)
    for (const move of firstMoves) await act(async () => emitMove(state, move))

    await waitFor(() => expect(screen.getByText('Case solved. Next case…')).toBeInTheDocument(), { timeout: 3_000 })
    await waitFor(() => expect(screen.getByText('Recognize…')).toBeInTheDocument(), { timeout: 3_000 })
    const secondCaseName = screen.getByRole('heading', { level: 3 }).textContent ?? ''
    expect(secondCaseName).not.toBe('')
  }, 30_000)

  it('shows persisted case statistics in review mode', async () => {
    const user = userEvent.setup()
    render(<CubeConnectionProvider><TrainerHub /></CubeConnectionProvider>)

    await user.click(await screen.findByRole('button', { name: 'Review' }))

    expect(screen.getByRole('heading', { name: 'Case statistics' })).toBeInTheDocument()
    expect(screen.getByText('No attempts yet.')).toBeInTheDocument()
  })

  it('persists cubie-derived edge tracking attempts', async () => {
    const user = userEvent.setup()
    render(<CubeConnectionProvider><TrainerHub /></CubeConnectionProvider>)

    const prompt = generateEdgeTrackingPrompt('tracking-001')
    await user.type(await screen.findByRole('textbox', { name: 'Tracked edge location' }), prompt.answer)
    await user.click(screen.getByRole('button', { name: 'Check tracked edge' }))

    await waitFor(async () => expect((await repositories.attempts.all()).some((attempt) => attempt.family === 'tracking' && attempt.answerCorrect)).toBe(true))
  })

  it('persists cubie-derived edge orientation attempts', async () => {
    const user = userEvent.setup()
    render(<CubeConnectionProvider><TrainerHub /></CubeConnectionProvider>)

    const prompt = generateEdgeOrientationPrompt('orientation-001')
    await user.type(await screen.findByRole('textbox', { name: 'Edge orientation' }), prompt.answer)
    await user.click(screen.getByRole('button', { name: 'Check edge orientation' }))

    await waitFor(async () => expect((await repositories.attempts.all()).some((attempt) => attempt.protocol === 'orientation-answer' && attempt.answerCorrect)).toBe(true))
  })

  it('persists cubie-derived pair tracking attempts', async () => {
    const user = userEvent.setup()
    render(<CubeConnectionProvider><TrainerHub /></CubeConnectionProvider>)

    const prompt = generatePairTrackingPrompt('pair-001')
    await user.type(await screen.findByRole('textbox', { name: 'Tracked pair locations' }), prompt.answer)
    await user.click(screen.getByRole('button', { name: 'Check tracked pair' }))

    await waitFor(async () => expect((await repositories.attempts.all()).some((attempt) => attempt.setup.generatorId === 'cubie-pair-tracking' && attempt.answerCorrect)).toBe(true))
  })

  it('persists state-verified free-pair choices', async () => {
    const user = userEvent.setup()
    render(<CubeConnectionProvider><TrainerHub /></CubeConnectionProvider>)

    const prompt = generateFreePairPrompt('free-pair-001')
    const index = prompt.answer === 'A' ? 0 : 1
    await user.click(screen.getByRole('button', { name: `${prompt.answer} · ${prompt.options[index]}` }))
    await user.click(screen.getByRole('button', { name: 'Check free pair' }))

    await waitFor(async () => expect((await repositories.attempts.all()).some((attempt) => attempt.family === 'free-pair' && attempt.answerCorrect)).toBe(true))
  })

  it('persists any state-valid cross plan as an inspection attempt', async () => {
    const user = userEvent.setup()
    render(<CubeConnectionProvider><TrainerHub /></CubeConnectionProvider>)

    const prompt = generateCrossInspectionPrompt('cross-001')
    await user.type(await screen.findByRole('textbox', { name: 'Cross plan' }), new Alg(prompt.scramble).invert().toString())
    await user.click(screen.getByRole('button', { name: 'Check cross plan' }))

    await waitFor(async () => expect((await repositories.attempts.all()).some((attempt) => attempt.family === 'inspection' && attempt.targetSatisfied)).toBe(true))
  })

  it('persists validated cubie-state BLD memos', async () => {
    const user = userEvent.setup()
    render(<CubeConnectionProvider><TrainerHub /></CubeConnectionProvider>)

    await user.type(screen.getByRole('textbox', { name: 'Memo' }), generateBldDrill('bld-001').memo)
    await user.click(screen.getByRole('button', { name: 'Validate memo' }))

    await waitFor(async () => expect((await repositories.attempts.all()).some((attempt) => attempt.family === 'bld-memo' && attempt.answerCorrect)).toBe(true))
  })

  it('persists validated cubie-state BLD corner memos', async () => {
    const user = userEvent.setup()
    render(<CubeConnectionProvider><TrainerHub /></CubeConnectionProvider>)

    await user.type(screen.getByRole('textbox', { name: 'Corner memo' }), generateBldDrill('bld-001').cornerMemo)
    await user.click(screen.getByRole('button', { name: 'Validate corner memo' }))

    await waitFor(async () => expect((await repositories.attempts.all()).some((attempt) => attempt.caseId === 'bld-corner-memo' && attempt.answerCorrect)).toBe(true))
  })

  it('explains what is needed when no case is selected for practice', async () => {
    render(<CubeConnectionProvider><TrainerHub /></CubeConnectionProvider>)

    const button = await screen.findByRole('button', { name: 'Practice selected' })
    expect(button).toBeDisabled()
    expect(screen.getByText('Select one or more cases above to practice only those.')).toBeInTheDocument()
  })

  it('starts a practice session restricted to exactly the selected cases', async () => {
    const user = userEvent.setup()
    render(<CubeConnectionProvider><TrainerHub /></CubeConnectionProvider>)

    await screen.findByRole('option', { name: 'OLL' }, { timeout: 15_000 })
    await user.selectOptions(screen.getByLabelText('Case set'), 'OLL')
    await screen.findByRole('button', { name: /OLL 1 Runway/ })
    await user.click(screen.getByRole('checkbox', { name: /Select OLL 1 Runway/ }))
    await user.click(screen.getByRole('checkbox', { name: /Select OLL 2 Zamboni/ }))

    await user.click(screen.getByRole('button', { name: 'Practice selected (2)' }))
    expect(screen.getByRole('heading', { name: 'Recognize the case' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Recognized' }))

    const heading = screen.getByRole('heading', { name: /execution$/ }).textContent ?? ''
    const presented = heading.replace(/ execution$/, '')
    expect(['OLL 1 Runway', 'OLL 2 Zamboni']).toContain(presented)
  }, 30_000)

  it('derives a two-sided recognition view from real cube state and persists a recognition attempt', async () => {
    const user = userEvent.setup()
    render(<CubeConnectionProvider><TrainerHub /></CubeConnectionProvider>)

    await screen.findByRole('option', { name: 'OLL' }, { timeout: 15_000 })
    await user.selectOptions(screen.getByLabelText('Case set'), 'OLL')
    await user.click(await screen.findByRole('button', { name: 'Recognize' }, { timeout: 15_000 }))
    await user.click(await screen.findByRole('button', { name: 'Start session' }, { timeout: 15_000 }))

    await screen.findByRole('heading', { name: 'What case is this?' }, { timeout: 15_000 })
    await waitFor(() => expect(screen.getByText('Front').closest('div')).toHaveTextContent(/^Front[URFDLB]( [URFDLB]){2}$/), { timeout: 15_000 })
    expect(screen.getByText('Right').closest('div')).toHaveTextContent(/^Right[URFDLB]( [URFDLB]){2}$/)
    expect(document.querySelector('twisty-player')).not.toBeInTheDocument()

    await user.type(screen.getByRole('textbox', { name: 'Recognition answer' }), 'not a real case name')
    await user.click(screen.getByRole('button', { name: 'Submit recognition' }))

    await waitFor(async () => expect((await repositories.attempts.all()).some((attempt) => attempt.family === 'recognition' && attempt.protocol === 'typed-answer' && attempt.outcome === 'incorrect')).toBe(true))
  }, 30_000)

  it('runs a time attack over the selected cases and reports the outcome from persisted attempts', async () => {
    const user = userEvent.setup()
    render(<CubeConnectionProvider><TrainerHub /></CubeConnectionProvider>)

    await screen.findByRole('option', { name: 'OLL' }, { timeout: 15_000 })
    await user.selectOptions(screen.getByLabelText('Case set'), 'OLL')
    await screen.findByRole('button', { name: /OLL 1 Runway/ }, { timeout: 15_000 })
    await user.click(screen.getByRole('checkbox', { name: /Select OLL 1 Runway/ }))

    const targetInput = await screen.findByRole('spinbutton', { name: /Target time for OLL 1 Runway/ }, { timeout: 15_000 })
    expect(targetInput).toHaveValue(1300)

    await user.click(screen.getByRole('button', { name: /Start gauntlet/ }))
    expect(screen.getByText('Case 1 / 1')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Done' }))

    await waitFor(() => expect(screen.getByText(/Time attack complete: \d \/ 1 cases met target\./)).toBeInTheDocument())
    const attempts = await repositories.attempts.all()
    const timeAttackAttempt = attempts.find((attempt) => attempt.family === 'time-attack')
    expect(timeAttackAttempt?.protocol).toBe('algorithm-rehearsal')
    expect(timeAttackAttempt?.targetSatisfied).toBe(timeAttackAttempt!.totalMs <= 1300)
  }, 30_000)

  it('shows per-case ao5 computed from persisted attempts, and an em dash without enough attempts', async () => {
    const user = userEvent.setup()
    const now = Date.now()
    await Promise.all([1_000, 2_000, 3_000, 4_000, 5_000].map((totalMs, index) => repositories.attempts.put(buildAttempt('oll-01', totalMs, now + index))))
    await Promise.all([1_000, 2_000].map((totalMs, index) => repositories.attempts.put(buildAttempt('oll-02', totalMs, now + index))))

    render(<CubeConnectionProvider><TrainerHub /></CubeConnectionProvider>)
    await screen.findByRole('option', { name: 'OLL' }, { timeout: 15_000 })
    await user.selectOptions(screen.getByLabelText('Case set'), 'OLL')

    const solvedCard = await screen.findByRole('button', { name: /OLL 1 Runway/ })
    expect(within(solvedCard).getByText('3.00s')).toBeInTheDocument()

    // Two attempts is not enough for an ao5, so that one stat reads as an em dash.
    const partialCard = screen.getByRole('button', { name: /OLL 2 Zamboni/ })
    expect(within(partialCard).getByText('—')).toBeInTheDocument()
    expect(within(partialCard).getByText('2')).toBeInTheDocument()

    // A case never attempted shows no stat row at all. Six fields of em dashes on
    // every unattempted case is what made this grid unreadable across 167 cards.
    const freshCard = screen.getByRole('button', { name: /OLL 3 Anti-Mounted Fish/ })
    expect(within(freshCard).queryByText('—')).not.toBeInTheDocument()
    // Seeding the 167-case OLL catalogue takes longer than the 5s default, as every
    // sibling test in this file already allows for.
  }, 30_000)

  it('offers OCLL and 2-Look PLL as populated subsets of the full catalogues', async () => {
    const user = userEvent.setup()
    render(<CubeConnectionProvider><TrainerHub /></CubeConnectionProvider>)

    await screen.findByRole('option', { name: 'OCLL' }, { timeout: 15_000 })
    await user.selectOptions(screen.getByLabelText('Case set'), 'OCLL')
    expect(screen.getByRole('button', { name: /OLL 27 Sune/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /OLL 1 Runway/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /OLL 7 Mario/ })).not.toBeInTheDocument()

    await screen.findByRole('option', { name: '2-Look PLL' }, { timeout: 15_000 })
    await user.selectOptions(screen.getByLabelText('Case set'), '2-Look PLL')
    expect(screen.getByRole('button', { name: /Aa Perm/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^T Perm/ })).not.toBeInTheDocument()
  })

  it('exposes 2-Look OLL as exactly the 3 EOLL cases plus the 7 OCLL cases', async () => {
    const user = userEvent.setup()
    render(<CubeConnectionProvider><TrainerHub /></CubeConnectionProvider>)

    await screen.findByRole('option', { name: '2-Look OLL' }, { timeout: 15_000 })
    await user.selectOptions(screen.getByLabelText('Case set'), '2-Look OLL')
    const algorithms = await repositories.algorithms.all()
    const twoLookOllIds = algorithms
      .filter((record) => twoLookOllCases([record]).length > 0)
      .map((record) => record.id)
      .sort()

    expect(twoLookOllIds).toEqual(['eoll-dot', 'eoll-l', 'eoll-line', 'oll-21', 'oll-22', 'oll-23', 'oll-24', 'oll-25', 'oll-26', 'oll-27'])
    expect(twoLookOllIds).toHaveLength(10)

    expect(screen.getByRole('button', { name: /EOLL Dot/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /EOLL Line/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /EOLL Bent/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /OLL 27 Sune/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /OLL 1 Runway/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /OLL 7 Mario/ })).not.toBeInTheDocument()
  })

  it('offers COLL and CMLL as populated case sets with their full catalogue counts', async () => {
    const user = userEvent.setup()
    render(<CubeConnectionProvider><TrainerHub /></CubeConnectionProvider>)

    await screen.findByRole('option', { name: 'COLL' }, { timeout: 15_000 })
    await user.selectOptions(screen.getByLabelText('Case set'), 'COLL')
    expect(await screen.findByRole('button', { name: 'All 40' }, { timeout: 15_000 })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /COLL Anti-Sune 1/ })).toBeInTheDocument()

    await screen.findByRole('option', { name: 'CMLL' }, { timeout: 15_000 })
    await user.selectOptions(screen.getByLabelText('Case set'), 'CMLL')
    expect(await screen.findByRole('button', { name: 'All 42' }, { timeout: 15_000 })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /CMLL O 1/ })).toBeInTheDocument()
  }, 30_000)

  it('starts a practice session restricted to a selected COLL case', async () => {
    const user = userEvent.setup()
    render(<CubeConnectionProvider><TrainerHub /></CubeConnectionProvider>)

    await screen.findByRole('option', { name: 'COLL' }, { timeout: 15_000 })
    await user.selectOptions(screen.getByLabelText('Case set'), 'COLL')
    await screen.findByRole('button', { name: /COLL Anti-Sune 1/ }, { timeout: 15_000 })
    await user.click(screen.getByRole('checkbox', { name: /Select COLL Anti-Sune 1/ }))

    await user.click(screen.getByRole('button', { name: 'Practice selected (1)' }))
    expect(screen.getByRole('heading', { name: 'Recognize the case' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Recognized' }))

    const heading = screen.getByRole('heading', { name: /execution$/ }).textContent ?? ''
    expect(heading.replace(/ execution$/, '')).toBe('COLL Anti-Sune 1')
  }, 30_000)

  it('surfaces the ported cubedex WVLS set with its real case count and subset grouping', async () => {
    const user = userEvent.setup()
    render(<CubeConnectionProvider><TrainerHub /></CubeConnectionProvider>)

    await screen.findByRole('option', { name: 'WVLS' }, { timeout: 15_000 })
    await user.selectOptions(screen.getByLabelText('Case set'), 'WVLS')
    expect(await screen.findByRole('button', { name: 'All 27' }, { timeout: 15_000 })).toBeInTheDocument()
    const stored = await repositories.algorithms.all()
    expect(stored.filter((record) => record.id.startsWith('cubedex-wvls-'))).toHaveLength(27)

    await user.click(screen.getByRole('button', { name: '0 Oriented' }))
    expect(await screen.findByRole('button', { name: /WV 20/ }, { timeout: 15_000 })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /WV 27/ })).toBeInTheDocument()
    expect(document.querySelectorAll('.case-grid [data-case-card]')).toHaveLength(8)
    expect(screen.queryByRole('button', { name: /^WV 8\b/ })).not.toBeInTheDocument()
  }, 30_000)

  it('drills a case selected from a ported cubedex set through the same typed-answer path', async () => {
    const user = userEvent.setup()
    render(<CubeConnectionProvider><TrainerHub /></CubeConnectionProvider>)

    await screen.findByRole('option', { name: 'WVLS' }, { timeout: 15_000 })
    await user.selectOptions(screen.getByLabelText('Case set'), 'WVLS')
    await screen.findByRole('button', { name: /WV 20/ }, { timeout: 15_000 })
    await user.click(screen.getByRole('checkbox', { name: /Select WV 20/ }))
    await user.click(screen.getByRole('button', { name: 'Practice selected (1)' }))

    expect(screen.getByRole('heading', { name: 'Recognize the case' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Recognized' }))
    const heading = screen.getByRole('heading', { name: /execution$/ }).textContent ?? ''
    expect(heading.replace(/ execution$/, '')).toBe('WV 20')

    await user.type(screen.getByRole('textbox', { name: 'Case answer' }), 'WV 20')
    await user.click(screen.getByRole('button', { name: 'Submit answer' }))

    await waitFor(async () => {
      const attempts = await repositories.attempts.all()
      const stored = await repositories.algorithms.all()
      const wv20 = stored.find((record) => record.id === 'cubedex-wvls-wv-20')
      expect(attempts.some((attempt) => attempt.caseId === 'cubedex-wvls-wv-20' && attempt.outcome === 'success')).toBe(true)
      expect(wv20?.mastery).toBeGreaterThan(0)
    })
  }, 30_000)
})

describe('recognition feedback', () => {
  it('confirms the captured recognition split instead of only disabling the button', async () => {
    const user = userEvent.setup()
    render(<CubeConnectionProvider><TrainerHub /></CubeConnectionProvider>)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start session' })).toBeEnabled(), { timeout: 10_000 })
    await user.click(screen.getByRole('button', { name: 'Start session' }))
    expect(screen.getByText('Press Recognized the moment you know the case')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Recognized' }))
    // The redesign states the same fact as the execution baseline it establishes.
    expect(await screen.findByText(/Execution timed from \d+\.\d\ds/)).toBeInTheDocument()
  }, 30_000)
})

describe('real-cube F2L drill engine', () => {
  beforeEach(async () => clearDatabase())
  afterEach(async () => clearDatabase())

  it('runs the countdown sequence before advancing to solving', async () => {
    const user = userEvent.setup()
    render(<CubeConnectionProvider><TrainerHub /></CubeConnectionProvider>)

    await waitFor(async () => expect((await repositories.algorithms.all()).some((record) => record.set === 'F2L')).toBe(true), { timeout: 60_000 })
    await user.click(await screen.findByRole('button', { name: 'Start real-cube drill' }))

    expect(await screen.findByText('3')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('Recognize…')).toBeInTheDocument(), { timeout: 3_000 })
  }, 30_000)

  it('completes a case via the real-cube state predicate and records a state-success solve', async () => {
    const user = userEvent.setup()
    const { source, state } = fakeCubeSource()
    render(<CubeConnectionProvider><TrainerHub source={source} /></CubeConnectionProvider>)

    await waitFor(async () => expect((await repositories.algorithms.all()).some((record) => record.set === 'F2L')).toBe(true), { timeout: 60_000 })
    await user.click(await screen.findByRole('button', { name: 'Connect cube for drill' }))
    await user.click(await screen.findByRole('button', { name: 'Start real-cube drill' }))
    await waitFor(() => expect(screen.getByText('Recognize…')).toBeInTheDocument(), { timeout: 3_000 })

    const caseName = screen.getByRole('heading', { level: 3 }).textContent ?? ''
    const record = (await repositories.algorithms.all()).find((item) => item.name === caseName)
    expect(record).toBeDefined()
    const solveMoves = new Alg(record!.setup).invert().toString().split(/\s+/).filter(Boolean)
    for (const move of solveMoves) await act(async () => emitMove(state, move))

    await waitFor(async () => expect((await repositories.attempts.all()).some((attempt) => attempt.protocol === 'state-success' && attempt.outcome === 'success')).toBe(true), { timeout: 5_000 })
    expect(await screen.findByText(/Recognition \d+ms · Execution \d+ms/)).toBeInTheDocument()
  }, 30_000)

  it('blocks completion on give-up while still applying moves to the drill cube', async () => {
    const user = userEvent.setup()
    const { source, state } = fakeCubeSource()
    render(<CubeConnectionProvider><TrainerHub source={source} /></CubeConnectionProvider>)

    await waitFor(async () => expect((await repositories.algorithms.all()).some((record) => record.set === 'F2L')).toBe(true), { timeout: 60_000 })
    await user.click(await screen.findByRole('button', { name: 'Connect cube for drill' }))
    await user.click(await screen.findByRole('button', { name: 'Start real-cube drill' }))
    await waitFor(() => expect(screen.getByText('Recognize…')).toBeInTheDocument(), { timeout: 3_000 })

    await user.click(screen.getByRole('button', { name: 'Give up (drill)' }))
    expect(screen.getByText('Gave up. Redo or resume when ready.')).toBeInTheDocument()

    const attemptsBefore = (await repositories.attempts.all()).length
    const caseName = screen.getByRole('heading', { level: 3 }).textContent ?? ''
    const record = (await repositories.algorithms.all()).find((item) => item.name === caseName)
    expect(record).toBeDefined()
    const solveMoves = new Alg(record!.setup).invert().toString().split(/\s+/).filter(Boolean)
    for (const move of solveMoves) await act(async () => emitMove(state, move))

    expect(screen.getByText('Gave up. Redo or resume when ready.')).toBeInTheDocument()
    expect(await repositories.attempts.all()).toHaveLength(attemptsBefore)
    expect(screen.getByText(`Move ${solveMoves.length} / ${solveMoves.length}`)).toBeInTheDocument()
  }, 30_000)

  it('narrows the F2L case grid using state-derived case attributes', async () => {
    const user = userEvent.setup()
    render(<CubeConnectionProvider><TrainerHub /></CubeConnectionProvider>)

    await waitFor(async () => expect((await repositories.algorithms.all()).filter((record) => record.set === 'F2L').length).toBeGreaterThan(50), { timeout: 60_000 })
    await waitFor(() => expect(document.querySelectorAll('.case-grid [data-case-card]').length).toBeGreaterThan(50), { timeout: 15_000 })
    const initialCount = document.querySelectorAll('.case-grid [data-case-card]').length

    // State-derived attributes moved behind the shape filter dialog in the redesign.
    await user.click(screen.getByRole('button', { name: /^Shape filter/ }))
    await user.click(await screen.findByRole('button', { name: 'Oriented' }, { timeout: 15_000 }))
    await user.click(screen.getByRole('button', { name: 'Close shape filter' }))
    await waitFor(() => {
      const filteredCount = document.querySelectorAll('.case-grid [data-case-card]').length
      expect(filteredCount).toBeGreaterThan(0)
      expect(filteredCount).toBeLessThan(initialCount)
    }, { timeout: 15_000 })
  }, 30_000)
})

describe('TrainerHub filter toolbar', () => {
  beforeEach(async () => clearDatabase())
  afterEach(async () => clearDatabase())

  it('filters the case grid by subset and by learning state', async () => {
    const user = userEvent.setup()
    render(<CubeConnectionProvider><TrainerHub /></CubeConnectionProvider>)

    await screen.findByRole('option', { name: 'F2L' }, { timeout: 15_000 })
    await user.selectOptions(screen.getByLabelText('Case set'), 'F2L')

    const cards = () => document.querySelectorAll('.case-grid [data-case-card]').length
    await waitFor(() => expect(cards()).toBeGreaterThan(0), { timeout: 15_000 })
    const all = cards()

    // A subset is a strict slice of the set, so choosing one must shrink the grid.
    await user.click(screen.getByRole('button', { name: 'FR' }))
    await waitFor(() => expect(cards()).toBeLessThan(all))
    expect(cards()).toBeGreaterThan(0)

    // Nothing has been practised, so filtering to Learned must empty the grid, and
    // returning to All must restore the subset's full count.
    const slice = cards()
    await user.click(screen.getByRole('button', { name: /^Learned/ }))
    await waitFor(() => expect(cards()).toBe(0))

    await user.click(screen.getByRole('button', { name: /^All \d+$/ }))
    await waitFor(() => expect(cards()).toBe(slice))
  }, 40_000)
})
