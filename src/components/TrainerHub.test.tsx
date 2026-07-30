import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { clearDatabase, repositories } from '../storage/database'
import { TrainerHub } from './TrainerHub'

describe('TrainerHub grading', () => {
  beforeEach(async () => clearDatabase())
  afterEach(async () => clearDatabase())

  it('records success only when the typed answer matches the case', async () => {
    const user = userEvent.setup()
    render(<TrainerHub />)

    await waitFor(() => expect(screen.getByRole('button', { name: 'Start session' })).toBeEnabled(), { timeout: 10_000 })
    await user.click(screen.getByRole('button', { name: 'Start session' }))
    expect(screen.getByRole('heading', { name: 'Recognize the case' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Basic right insert execution' })).not.toBeInTheDocument()

    const answer = screen.getByRole('textbox', { name: 'Case answer' })
    await user.type(answer, 'wrong case')
    await user.click(screen.getByRole('button', { name: 'Submit answer' }))
    await waitFor(async () => expect(await repositories.attempts.all()).toHaveLength(1))

    await user.type(screen.getByRole('textbox', { name: 'Case answer' }), 'Basic right insert')
    await user.click(screen.getByRole('button', { name: 'Submit answer' }))
    await waitFor(async () => expect(await repositories.attempts.all()).toHaveLength(2))

    const attempts = await repositories.attempts.all()
    expect(attempts.map((attempt) => attempt.outcome)).toEqual(['incorrect', 'success'])
    expect(attempts.every((attempt) => attempt.protocol === 'typed-answer')).toBe(true)
    expect(attempts.every((attempt) => attempt.answerCorrect === (attempt.outcome === 'success'))).toBe(true)
  }, 30_000)
})
