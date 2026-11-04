import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { clearDatabase, repositories } from '../../../storage/database'
import { TimeAttackTrainer } from '../views/TimeAttack'
import { renderWithCube } from './testing'

describe('Time attack trainer', () => {
  beforeEach(async () => clearDatabase())
  afterEach(async () => clearDatabase())

  it('runs the picked cases against per-case targets and reports the result from stored attempts', async () => {
    const user = userEvent.setup()
    renderWithCube(<TimeAttackTrainer />)

    await user.click(await screen.findByRole('button', { name: /^Aa Perm,/ }, { timeout: 20_000 }))
    await user.click(screen.getByRole('button', { name: /^Set targets/ }))

    const target = screen.getByRole('spinbutton', { name: 'Target time for Aa Perm' })
    const stored = (await repositories.algorithms.all()).find((record) => record.name === 'Aa Perm')!
    expect(target).toHaveValue(Number((stored.targetMs / 1000).toFixed(2)))
    await user.clear(target)
    await user.type(target, '4.5')
    await waitFor(async () => expect((await repositories.settings.get('trainer-time-attack'))?.value).toMatchObject({ targets: { [stored.id]: 4500 } }))

    await user.click(screen.getByRole('button', { name: /^Start run/ }))
    expect(screen.getByText('Case 1 / 1')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Aa Perm' })).toBeInTheDocument()
    await user.keyboard(' ')

    expect(await screen.findByText('Every target met.')).toBeInTheDocument()
    const attempts = await repositories.attempts.all()
    expect(attempts).toHaveLength(1)
    expect(attempts[0].family).toBe('time-attack')
    expect(attempts[0].protocol).toBe('algorithm-rehearsal')
    expect(attempts[0].targetSatisfied).toBe(attempts[0].totalMs <= 4500)
  }, 60_000)

  it('lists a given-up case as a miss and offers it for the next run', async () => {
    const user = userEvent.setup()
    renderWithCube(<TimeAttackTrainer />)

    await user.click(await screen.findByRole('button', { name: /^T Perm,/ }, { timeout: 20_000 }))
    await user.click(screen.getByRole('button', { name: /^Y Perm,/ }))
    await user.click(screen.getByRole('button', { name: /^Set targets/ }))
    await user.click(screen.getByRole('button', { name: 'Move Y Perm earlier' }))
    const queue = screen.getByRole('list', { name: 'Queue' })
    expect(within(queue).getAllByRole('listitem').map((item) => item.textContent?.match(/[A-Z] Perm/)?.[0])).toEqual(['Y Perm', 'T Perm'])

    await user.keyboard(' ')
    expect(screen.getByRole('heading', { name: 'Y Perm' })).toBeInTheDocument()
    await user.keyboard('2')
    expect(await screen.findByRole('heading', { name: 'T Perm' })).toBeInTheDocument()
    await user.keyboard(' ')

    expect(await screen.findByRole('heading', { name: 'Misses for the next run' })).toBeInTheDocument()
    expect(screen.getByText('Gave up')).toBeInTheDocument()
    await waitFor(async () => expect((await repositories.attempts.all()).map((attempt) => attempt.outcome).sort()).toEqual(['give-up', 'success']))

    await user.click(screen.getByRole('button', { name: 'New run' }))
    await user.click(screen.getByRole('button', { name: /^Clear/ }))
    await user.click(await screen.findByRole('button', { name: /^Add last misses/ }))
    expect(screen.getByText('1 in the queue')).toBeInTheDocument()
  }, 60_000)
})
