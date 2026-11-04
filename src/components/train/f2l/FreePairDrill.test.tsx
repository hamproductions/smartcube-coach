import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { generateFreePairPrompt } from '../../../domain/freePair'
import { clearDatabase, repositories } from '../../../storage/database'
import { FreePairDrill } from './FreePairDrill'

describe('Free pair trainer', () => {
  beforeEach(async () => {
    window.localStorage.clear()
    await clearDatabase()
  })
  afterEach(async () => clearDatabase())

  it('persists state-verified free-pair choices', async () => {
    const user = userEvent.setup()
    render(<FreePairDrill startRound={1} />)

    const prompt = generateFreePairPrompt('free-pair-001')
    if (!prompt) throw new Error('free-pair-001 produced no position')
    expect(screen.getByRole('heading', { name: prompt.caseName })).toBeInTheDocument()
    const index = prompt.finishes.findIndex((finish) => finish !== null)
    await user.click(screen.getByRole('button', { name: `Option ${index + 1}, ${prompt.options[index]}` }))

    await waitFor(async () => expect((await repositories.attempts.all()).some((attempt) => attempt.family === 'free-pair' && attempt.answerCorrect && attempt.caseId === `free-pair-${prompt.caseName.toLowerCase()}-${prompt.slot.toLowerCase()}`)).toBe(true))
    expect(screen.getByText('Free')).toBeInTheDocument()
    expect(screen.getByText(/ leaves the (front left|back left|back right) pair free: finish with /)).toBeInTheDocument()
  })

  it('explains a 2gen rejection of a pair that is free in normal mode', async () => {
    const user = userEvent.setup()
    render(<FreePairDrill startRound={1} />)

    await user.click(screen.getByRole('button', { name: '2gen' }))
    await user.click(screen.getByRole('button', { name: 'Skip' }))
    const prompt = generateFreePairPrompt('free-pair-002', '2gen')
    if (!prompt) throw new Error('free-pair-002 produced no 2gen position')
    const index = prompt.options.findIndex((_, option) => prompt.finishes[option] === null && prompt.normalFinishes[option] !== null)
    expect(index).toBeGreaterThanOrEqual(0)
    await user.click(screen.getByRole('button', { name: `Option ${index + 1}, ${prompt.options[index]}` }))

    expect(await screen.findByText(/^Free in normal mode with .*, but 2gen rejects that finish\.$/)).toBeInTheDocument()
    expect(screen.getByText('Not free')).toBeInTheDocument()
    await waitFor(async () => expect((await repositories.attempts.all()).some((attempt) => attempt.family === 'free-pair' && !attempt.answerCorrect && attempt.dataQuality.notes.includes('solved.no free-pair rule, 2gen mode'))).toBe(true))
  })

  it('answers with number keys, moves on with Space and remembers the mode', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<FreePairDrill startRound={1} />)
    const first = generateFreePairPrompt('free-pair-001')
    const second = generateFreePairPrompt('free-pair-002')
    if (!first || !second) throw new Error('missing free-pair positions')

    await user.keyboard('1')
    expect(await screen.findByRole('button', { name: /Next position/ })).toHaveFocus()
    expect(screen.getByRole('button', { name: `Option 1, ${first.options[0]}` })).toBeDisabled()
    await user.keyboard(' ')
    expect(screen.getByRole('heading', { name: second.caseName })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: `Option 1, ${second.options[0]}` })).toBeEnabled()
    expect(within(screen.getByRole('list', { name: 'Last attempts' })).getAllByRole('listitem')).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: '2gen' }))
    unmount()
    render(<FreePairDrill startRound={1} />)
    expect(screen.getByRole('button', { name: '2gen' })).toHaveAttribute('aria-pressed', 'true')
  })
})
