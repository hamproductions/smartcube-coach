import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { puzzles } from 'cubing/puzzles'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { clearDatabase, repositories } from '../../../storage/database'
import { twoLookOllCases } from '../../../domain/training'
import { CasesTrainer } from '../views/Cases'
import { caseDisplay } from './caseState'
import { chooseSetup, cubeMovesFor, fakeCube, renderWithCube, seededAttempt } from './testing'

const tiles = () => document.querySelectorAll('[data-case-grid] [data-case-card]')

describe('Algorithm cases trainer', () => {
  beforeEach(async () => clearDatabase())
  afterEach(async () => clearDatabase())

  it('walks setup one row at a time and remembers it for the next visit', async () => {
    const user = userEvent.setup()
    const { unmount } = renderWithCube(<CasesTrainer />)

    expect(await screen.findByRole('heading', { name: 'Choose a set' }, { timeout: 20_000 })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^PLL \d+$/ }))
    expect(screen.getByRole('heading', { name: 'Choose a subset' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Choose a set' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^All subsets 21$/ }))
    expect(screen.getByRole('heading', { name: 'Choose which cases to drill' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^All cases 21$/ }))
    expect(screen.getByRole('button', { name: /^Start session · 21 cases/ })).toBeEnabled()
    unmount()

    renderWithCube(<CasesTrainer />)
    expect(await screen.findByRole('button', { name: /^Start session · 21 cases/ }, { timeout: 20_000 })).toBeEnabled()
    expect(screen.getByRole('button', { name: /^Set PLL/ })).toBeInTheDocument()
  }, 60_000)

  it('times recognition and execution with Space and records a solved and a missed attempt', async () => {
    const user = userEvent.setup()
    renderWithCube(<CasesTrainer />)
    await chooseSetup(user, /^OLL \d+$/)

    await user.keyboard(' ')
    expect(await screen.findByRole('heading', { name: 'OLL case' })).toBeInTheDocument()
    expect(screen.getByText('Press Space the moment you know the case.')).toBeInTheDocument()
    await user.keyboard(' ')
    expect(await screen.findByText(/^Recognition \d+\.\d\d$/)).toBeInTheDocument()
    await user.keyboard(' ')
    expect(await screen.findByLabelText('Verdict')).toHaveTextContent('Solved')
    expect(screen.getByText('Last 5 average')).toBeInTheDocument()
    await waitFor(async () => expect(await repositories.attempts.all()).toHaveLength(1))

    await user.keyboard(' ')
    await user.keyboard('2')
    expect(await screen.findByLabelText('Verdict')).toHaveTextContent('Missed')
    await waitFor(async () => expect(await repositories.attempts.all()).toHaveLength(2))

    const attempts = await repositories.attempts.all()
    expect(attempts.map((attempt) => attempt.outcome).sort()).toEqual(['incorrect', 'success'])
    expect(attempts.every((attempt) => attempt.protocol === 'algorithm-rehearsal' && attempt.input === 'keyboard')).toBe(true)
    const solved = attempts.find((attempt) => attempt.outcome === 'success')!
    expect(solved.recognitionMs).toBeGreaterThanOrEqual(0)
    expect(solved.executionMs).toBeGreaterThanOrEqual(0)
    expect(within(screen.getByLabelText('Session')).getByText('50%')).toBeInTheDocument()
    expect((await repositories.algorithms.all()).some((record) => record.id === solved.caseId && record.mastery > 0)).toBe(true)
  }, 60_000)

  it('shows the algorithm up front in Learn mode', async () => {
    const user = userEvent.setup()
    renderWithCube(<CasesTrainer />)
    await chooseSetup(user, /^PLL \d+$/)
    await user.click(screen.getByRole('button', { name: 'Learn' }))
    await user.click(screen.getByRole('button', { name: /^Start session/ }))

    const name = (await screen.findByRole('heading', { level: 2 })).textContent ?? ''
    const record = (await repositories.algorithms.all()).find((entry) => entry.name === name)
    expect(record).toBeDefined()
    expect(screen.getByLabelText('Hint')).toHaveTextContent(record!.algorithm)
  }, 60_000)

  it('lists per-case statistics in Review mode', async () => {
    const user = userEvent.setup()
    renderWithCube(<CasesTrainer />)
    await chooseSetup(user, /^OLL \d+$/)
    await user.click(screen.getByRole('button', { name: 'Review' }))
    expect(screen.getByRole('heading', { name: 'Case statistics' })).toBeInTheDocument()
    expect(screen.getByText(/^No attempts yet\./)).toBeInTheDocument()
  }, 60_000)

  it('practises exactly the cases picked in the grid', async () => {
    const user = userEvent.setup()
    renderWithCube(<CasesTrainer />)
    await chooseSetup(user, /^OLL \d+$/)
    await user.click(screen.getByRole('button', { name: 'Pick cases' }))

    expect(screen.getByRole('button', { name: /^Practice selected/ })).toBeDisabled()
    expect(screen.getByText('Select the OLL cases to practise.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^OLL 1 Runway,/ }))
    await user.click(screen.getByRole('button', { name: /^OLL 2 Zamboni,/ }))
    await user.click(screen.getByRole('button', { name: /^Practice selected \(2\)/ }))

    await user.keyboard(' ')
    await user.keyboard(' ')
    await screen.findByLabelText('Verdict')
    expect(['OLL 1 Runway', 'OLL 2 Zamboni']).toContain(screen.getByRole('heading', { level: 2 }).textContent)
  }, 60_000)

  it('asks for the case from two sides only and records the choice', async () => {
    const user = userEvent.setup()
    renderWithCube(<CasesTrainer />)
    await chooseSetup(user, /^OLL \d+$/)
    await user.click(screen.getByRole('button', { name: 'Recognise' }))
    await user.click(screen.getByRole('button', { name: /^Start session/ }))

    expect(await screen.findByRole('heading', { name: 'Which case is this?' })).toBeInTheDocument()
    for (const side of ['Front', 'Right']) {
      const stickers = await screen.findByRole('group', { name: `${side} stickers` }, { timeout: 15_000 })
      expect(within(stickers).getAllByRole('img').map((sticker) => sticker.getAttribute('aria-label'))).toHaveLength(3)
    }
    expect(screen.queryByLabelText('Case diagram')).not.toBeInTheDocument()

    const choices = screen.getAllByRole('button').filter((button) => /^\d/.test(button.textContent ?? ''))
    expect(choices).toHaveLength(4)
    await user.keyboard('1')
    await screen.findByLabelText('Verdict')
    await waitFor(async () => {
      const [attempt] = await repositories.attempts.all()
      expect(attempt.family).toBe('recognition')
      expect(attempt.protocol).toBe('multiple-choice')
      expect(attempt.answerCorrect).toBe(attempt.answer === attempt.expectedAnswer)
    })
  }, 60_000)

  it('verifies the case on a smart cube by state: setup routed from the cube, clock waits, then solve', async () => {
    const user = userEvent.setup()
    const cube = fakeCube()
    renderWithCube(<CasesTrainer />, cube.source)
    await chooseSetup(user, /^OLL \d+$/)
    await screen.findByText(/Injected cube connected/)
    await user.click(screen.getByRole('button', { name: 'Pick cases' }))
    await user.click(screen.getByRole('button', { name: /^OLL 27 Sune,/ }))
    await user.click(screen.getByRole('button', { name: /^Practice selected \(1\)/ }))

    expect(await screen.findByRole('heading', { name: 'Turn this from where your cube is' })).toBeInTheDocument()
    const puzzle = await puzzles['3x3x3'].kpuzzle()
    const sune = (await repositories.algorithms.all()).find((record) => record.name === 'OLL 27 Sune')!
    const display = caseDisplay(puzzle, sune)
    for (const move of cubeMovesFor(display.setup)) await act(async () => cube.turn(move))
    await waitFor(() => expect(screen.getByText('Look, then turn. The clock starts on your first turn.')).toBeInTheDocument(), { timeout: 5_000 })
    expect(screen.getByLabelText('Timer')).toHaveTextContent('0.00')

    for (const move of cubeMovesFor(display.replay)) await act(async () => cube.turn(move))
    await waitFor(() => expect(screen.getByText('Solved')).toBeInTheDocument(), { timeout: 5_000 })
    await waitFor(async () => {
      const [attempt] = await repositories.attempts.all()
      expect(attempt.protocol).toBe('state-success')
      expect(attempt.input).toBe('smart-cube')
      expect(attempt.dataQuality.setupVerifiedByState).toBe(true)
      expect(attempt.recognitionMs).toBeGreaterThan(0)
    })
  }, 60_000)

  it('sets the learning state of every shown case in one action', async () => {
    const user = userEvent.setup()
    renderWithCube(<CasesTrainer />)
    await chooseSetup(user, /^PLL \d+$/)
    await user.click(screen.getByRole('button', { name: 'Manage cases' }))
    await user.click(screen.getByRole('button', { name: 'Mark all learning' }))

    await waitFor(async () => {
      const pll = (await repositories.algorithms.all()).filter((record) => record.set === 'PLL')
      expect(pll.length).toBe(21)
      expect(pll.every((record) => record.mastery === 0.4)).toBe(true)
    })
    expect(screen.getByText('21 cases marked learning.')).toBeInTheDocument()
  }, 60_000)

  it('adds a personal case only with every field, normalising curly quotes through the move preview', async () => {
    const user = userEvent.setup()
    renderWithCube(<CasesTrainer />)
    await chooseSetup(user, /^PLL \d+$/)
    await user.click(screen.getByRole('button', { name: 'Manage cases' }))

    await user.type(screen.getByRole('textbox', { name: 'New case name' }), 'My bracket insert')
    await user.type(screen.getByRole('textbox', { name: 'New case algorithm' }), 'R U R‘ U‘')
    expect(screen.getByRole('button', { name: 'Add personal case' })).toBeDisabled()
    const preview = screen.getByLabelText('Move preview')
    expect(within(preview).getAllByText(/^(R|U|R'|U')$/).map((node) => node.textContent)).toEqual(['R', 'U', "R'", "U'"])
    expect(within(preview).getByText('4 moves')).toBeInTheDocument()

    await user.type(screen.getByRole('textbox', { name: 'New case subset' }), 'Insert')
    await user.click(screen.getByRole('button', { name: 'Add personal case' }))
    expect(await screen.findByText('My bracket insert added to PLL.')).toBeInTheDocument()
    const record = (await repositories.algorithms.all()).find((item) => item.name === 'My bracket insert')
    expect(record?.algorithm).toBe("R U R' U'")
    expect(record?.setup).toBe("U R U' R'")

    await user.click(screen.getByRole('button', { name: 'Back to setup' }))
    await user.click(screen.getByRole('button', { name: 'Pick cases' }))
    expect(screen.getByRole('button', { name: /^My bracket insert,/ })).toBeInTheDocument()
  }, 60_000)

  it('offers the sub-catalogues and the ported cubedex sets with their real counts', async () => {
    const user = userEvent.setup()
    renderWithCube(<CasesTrainer />)
    expect(await screen.findByRole('button', { name: /^OCLL 7$/ }, { timeout: 20_000 })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^2-Look PLL 6$/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^2-Look OLL 10$/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^COLL 40$/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^CMLL 42$/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^WVLS 27$/ })).toBeInTheDocument()

    const twoLook = (await repositories.algorithms.all()).filter((record) => twoLookOllCases([record]).length > 0).map((record) => record.id).sort()
    expect(twoLook).toEqual(['eoll-dot', 'eoll-l', 'eoll-line', 'oll-21', 'oll-22', 'oll-23', 'oll-24', 'oll-25', 'oll-26', 'oll-27'])

    await user.click(screen.getByRole('button', { name: /^WVLS 27$/ }))
    await waitFor(async () => expect((await repositories.algorithms.all()).filter((record) => record.id.startsWith('cubedex-wvls-'))).toHaveLength(27), { timeout: 20_000 })
    await user.click(await screen.findByRole('button', { name: /^0 Oriented 8$/ }, { timeout: 20_000 }))
    await user.click(screen.getByRole('button', { name: /^All cases 8$/ }))
    await user.click(screen.getByRole('button', { name: 'Pick cases' }))
    await waitFor(() => expect(tiles()).toHaveLength(8))
    expect(screen.getByRole('button', { name: /^WV 20,/ })).toBeInTheDocument()
  }, 60_000)

  it('narrows the case grid by subset and learning state', async () => {
    const user = userEvent.setup()
    renderWithCube(<CasesTrainer />)
    await user.click(await screen.findByRole('button', { name: /^PLL \d+$/ }, { timeout: 20_000 }))
    await user.click(screen.getByRole('button', { name: /^Edge Perm 4$/ }))
    await user.click(screen.getByRole('button', { name: /^Learned 0$/ }))
    expect(screen.getByText(/^No learned cases in PLL Edge Perm\./)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Start session/ })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: /^Cases Learned/ }))
    await user.click(screen.getByRole('button', { name: /^All cases 4$/ }))
    await user.click(screen.getByRole('button', { name: 'Pick cases' }))
    await waitFor(() => expect(tiles()).toHaveLength(4))
  }, 60_000)

  it('shows each case tile its ao5 from stored attempts and nothing for a case never tried', async () => {
    const now = Date.now()
    await Promise.all([1_000, 2_000, 3_000, 4_000, 5_000].map((totalMs, index) => repositories.attempts.put(seededAttempt('oll-01', totalMs, now + index))))
    await Promise.all([1_000, 2_000].map((totalMs, index) => repositories.attempts.put(seededAttempt('oll-02', totalMs, now + index))))
    const user = userEvent.setup()
    renderWithCube(<CasesTrainer />)
    await chooseSetup(user, /^OLL \d+$/)
    await user.click(screen.getByRole('button', { name: 'Pick cases' }))

    const solved = screen.getByRole('button', { name: /^OLL 1 Runway,/ })
    expect(within(solved).getByText('3.00')).toBeInTheDocument()
    const partial = screen.getByRole('button', { name: /^OLL 2 Zamboni,/ })
    expect(within(partial).getByText('–')).toBeInTheDocument()
    expect(within(partial).getByText('2')).toBeInTheDocument()
    const fresh = screen.getByRole('button', { name: /^OLL 3 Anti-Mounted Fish,/ })
    expect(within(fresh).queryByText(/ao5/)).not.toBeInTheDocument()
  }, 60_000)
})
