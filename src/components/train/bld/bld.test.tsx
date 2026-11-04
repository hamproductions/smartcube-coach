import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { generateBldDrill } from '../../../domain/bld'
import { clearDatabase, repositories } from '../../../storage/database'
import { BlindfoldTrainer } from '../views/Blindfold'

const drill = generateBldDrill('bld-001')
const parity = drill.parity ? '2' : '1'

async function answerAll(user: ReturnType<typeof userEvent.setup>, edges: string, corners: string, flips = String(drill.flippedEdges), twists = String(drill.twistedCorners)) {
  const edgeInput = screen.getByRole('textbox', { name: 'Edge memo' })
  await waitFor(() => expect(edgeInput).toHaveFocus())
  if (edges) await user.type(edgeInput, edges)
  await user.keyboard('{Enter}')
  await user.type(screen.getByRole('textbox', { name: 'Corner memo' }), `${corners}{Enter}`)
  await user.keyboard(parity)
  await user.type(screen.getByRole('textbox', { name: 'Flipped edges' }), `${flips}{Enter}`)
  await user.type(screen.getByRole('textbox', { name: 'Twisted corners' }), `${twists}{Enter}`)
}

describe('Memo trainer', () => {
  beforeEach(async () => {
    window.localStorage.clear()
    await clearDatabase()
  })
  afterEach(async () => clearDatabase())

  it('applies and persists a custom BLD lettering configuration', async () => {
    const user = userEvent.setup()
    render(<BlindfoldTrainer />)

    expect(screen.queryByRole('textbox', { name: 'Buffer' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Settings/ }))
    expect(window.localStorage.getItem('bld:settings-open')).toBe('1')
    await user.clear(screen.getByRole('textbox', { name: 'Buffer' }))
    await user.type(screen.getByRole('textbox', { name: 'Buffer' }), 'Z')
    await user.clear(screen.getByRole('textbox', { name: 'Letter scheme' }))
    await user.type(screen.getByRole('textbox', { name: 'Letter scheme' }), 'ZYXWVUTSRQPONMLKJIHGFEDC')
    await user.click(screen.getByRole('button', { name: 'Apply' }))

    await waitFor(async () => expect(await repositories.settings.get('bld-config')).toEqual({ key: 'bld-config', value: { buffer: 'Z', letterScheme: 'ZYXWVUTSRQPONMLKJIHGFEDC' } }))
    expect(screen.getByRole('button', { name: /Settings/ })).toHaveTextContent('buffer Z')
  })

  it('rejects a broken letter scheme without saving it', async () => {
    const user = userEvent.setup()
    render(<BlindfoldTrainer />)

    await user.click(screen.getByRole('button', { name: /Settings/ }))
    await user.clear(screen.getByRole('textbox', { name: 'Letter scheme' }))
    await user.type(screen.getByRole('textbox', { name: 'Letter scheme' }), 'ABC{Enter}')

    expect(await screen.findByRole('alert')).toHaveTextContent('24 unique letters')
    expect(await repositories.settings.get('bld-config')).toBeUndefined()
  })

  it('persists validated cubie-state BLD memos answered by keyboard', async () => {
    const user = userEvent.setup()
    render(<BlindfoldTrainer />)

    expect(screen.getByTestId('bld-scramble')).toHaveTextContent(drill.scramble)
    await answerAll(user, drill.memo.toLowerCase().replaceAll(' ', ''), drill.cornerMemo)

    expect(within(screen.getByTestId('bld-verdict')).getByRole('heading')).toHaveTextContent('Correct')
    await waitFor(async () => {
      const attempts = await repositories.attempts.all()
      expect(attempts.some((attempt) => attempt.family === 'bld-memo' && attempt.caseId === 'bld-edge-memo' && attempt.answerCorrect)).toBe(true)
      expect(attempts.some((attempt) => attempt.caseId === 'bld-corner-memo' && attempt.answerCorrect)).toBe(true)
      expect(attempts.some((attempt) => attempt.caseId === 'bld-flip-count' && attempt.answerCorrect)).toBe(true)
      expect(attempts.some((attempt) => attempt.caseId === 'bld-twist-count' && attempt.answerCorrect)).toBe(true)
      expect(attempts.some((attempt) => attempt.caseId === 'bld-parity' && attempt.answerCorrect)).toBe(true)
    })
    expect(screen.getByTestId('session-attempts')).toHaveTextContent('1')
    expect(screen.getByTestId('session-correct')).toHaveTextContent('1')
  })

  it('marks a wrong memo and shows the correct one, then moves on with Space', async () => {
    const user = userEvent.setup()
    render(<BlindfoldTrainer />)

    await answerAll(user, 'XX', drill.cornerMemo)

    const verdict = screen.getByTestId('bld-verdict')
    expect(within(verdict).getByRole('heading')).toHaveTextContent('Wrong')
    expect(screen.getByTestId('bld-part-edges')).toHaveTextContent('Wrong')
    expect(screen.getByTestId('bld-part-edges')).toHaveTextContent(drill.memo.split(' ')[0])
    expect(screen.getByTestId('bld-part-corners')).toHaveTextContent('Right')
    await waitFor(async () => expect((await repositories.attempts.all()).some((attempt) => attempt.caseId === 'bld-edge-memo' && attempt.answerCorrect === false)).toBe(true))

    await user.keyboard(' ')
    expect(screen.getByTestId('bld-scramble')).toHaveTextContent(generateBldDrill('bld-002').scramble)
    expect(screen.getByTestId('session-correct')).toHaveTextContent('0')
    expect(window.localStorage.getItem('bld:round')).toBe('2')
  })

  it('answers counts by tap and records pointer input', async () => {
    const user = userEvent.setup()
    render(<BlindfoldTrainer />)

    await user.type(screen.getByRole('textbox', { name: 'Edge memo' }), `${drill.memo}{Enter}`)
    await user.type(screen.getByRole('textbox', { name: 'Corner memo' }), `${drill.cornerMemo}{Enter}`)
    await user.click(screen.getByRole('button', { name: drill.parity ? /Yes/ : /No/ }))
    await user.click(screen.getByRole('button', { name: `${drill.flippedEdges} flipped edges` }))
    await user.click(screen.getByRole('button', { name: `${drill.twistedCorners} twisted corners` }))

    expect(within(screen.getByTestId('bld-verdict')).getByRole('heading')).toHaveTextContent('Correct')
    await waitFor(async () => expect((await repositories.attempts.all()).some((attempt) => attempt.caseId === 'bld-twist-count' && attempt.input === 'pointer')).toBe(true))
  })

  it('goes back a step with Backspace on an empty field', async () => {
    const user = userEvent.setup()
    render(<BlindfoldTrainer />)

    await user.type(screen.getByRole('textbox', { name: 'Edge memo' }), 'ab cd{Enter}')
    await user.keyboard('{Backspace}')

    expect(screen.getByRole('textbox', { name: 'Edge memo' })).toHaveValue('AB CD')
  })
})
