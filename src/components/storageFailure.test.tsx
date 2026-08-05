import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { repositories } from '../storage/database'
import { HistoryProgress } from './HistoryProgress'
import { TrainerHub } from './TrainerHub'
import { CubeConnectionProvider } from '../device/CubeConnection'

describe('storage failure is reported, not disguised as empty', () => {
  const failures: Array<() => void> = []

  beforeEach(() => {
    for (const key of ['solves', 'stages', 'attempts', 'findings', 'prescriptions', 'transfers', 'algorithms'] as const) {
      const spy = vi.spyOn(repositories[key], 'all').mockRejectedValue(new Error('storage blocked'))
      failures.push(() => spy.mockRestore())
    }
  })

  afterEach(() => {
    for (const restore of failures.splice(0)) restore()
  })

  it('tells the user their solve history could not be read', async () => {
    render(<HistoryProgress />)

    await waitFor(() => expect(screen.getByText(/Local storage is unavailable/)).toBeInTheDocument())
    expect(screen.getByText(/Nothing shown here is a real record/)).toBeInTheDocument()
  }, 20_000)

  it('tells the user the trainer could not load its cases', async () => {
    render(<CubeConnectionProvider><TrainerHub /></CubeConnectionProvider>)

    await waitFor(() => expect(screen.getByText(/Local storage is unavailable/)).toBeInTheDocument())
    expect(screen.getByText(/attempts will not be saved/)).toBeInTheDocument()
  }, 20_000)
})
