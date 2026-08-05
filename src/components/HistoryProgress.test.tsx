import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { clearDatabase, repositories } from '../storage/database'
import { HistoryProgress } from './HistoryProgress'

describe('HistoryProgress', () => {
  beforeEach(async () => clearDatabase())
  afterEach(async () => clearDatabase())

  it('opens captured solves as stage-labeled automatic reconstructions', async () => {
    await repositories.solves.put({
      id: 'solve-1',
      sessionId: 'session-1',
      puzzle: '3x3x3',
      scramble: '',
      scrambleGenerator: 'test',
      startedAt: 1_000,
      endedAt: 2_000,
      penalty: 'none',
      analysisVersion: '1',
      rawEventIds: ['raw-1', 'raw-2', 'raw-3'],
      moves: ['R', 'U', "R'"]
    })
    await repositories.stages.put({ id: 'cross', solveId: 'solve-1', method: 'CFOP', name: 'Cross', startEvent: 0, firstMoveEvent: 0, endEvent: 1, recognitionMs: 0, executionMs: 80, moveCount: 2, rotationCount: 0, pauseCount: 0, tps: 25, confidence: 1 })
    await repositories.stages.put({ id: 'auf', solveId: 'solve-1', method: 'CFOP', name: 'AUF', startEvent: 2, firstMoveEvent: 2, endEvent: 2, recognitionMs: 0, executionMs: 0, moveCount: 1, rotationCount: 0, pauseCount: 0, tps: 12.5, confidence: 1 })
    const user = userEvent.setup()

    render(<HistoryProgress />)
    await user.click(await screen.findByRole('button', { name: 'Edit reconstruction' }))

    expect(screen.getByLabelText('Reconstruction')).toHaveValue("R U // Cross\nR' // AUF")
  })

  it('imports a clean csTimer CSV and reports how many solves landed', async () => {
    const csv = [
      'No.;Time;Comment;Scramble;Date;P.1',
      '1;12.34;;R U R\' U\';1700000000;',
      '2;13.50+;;R2 U2 R2;1700000100;'
    ].join('\r\n')
    const file = new File([csv], 'session.csv', { type: 'text/csv' })

    render(<HistoryProgress />)
    const input = await screen.findByLabelText('Import csTimer CSV file')
    const user = userEvent.setup()
    await user.upload(input, file)

    expect(await screen.findByText('Landed 2 solves from csTimer CSV.')).toBeInTheDocument()
    expect((await repositories.solves.all())).toHaveLength(2)
  })

  it('surfaces each skipped line number and reason from a malformed csTimer CSV', async () => {
    const csv = [
      'No.;Time;Comment;Scramble;Date;P.1',
      '1;12.34;;R U R\' U\';1700000000;',
      '2;not-a-time;;R2 U2 R2;1700000100;',
      '3;14.00;;F R U R\' U\' F\';oops;'
    ].join('\r\n')
    const file = new File([csv], 'session.csv', { type: 'text/csv' })

    render(<HistoryProgress />)
    const input = await screen.findByLabelText('Import csTimer CSV file')
    const user = userEvent.setup()
    await user.upload(input, file)

    expect(await screen.findByText(
      'Landed 1 solve from csTimer CSV. Skipped 2 rows — line 3: unparseable Time field: "not-a-time"; line 4: unparseable Date field: "oops"'
    )).toBeInTheDocument()
    expect((await repositories.solves.all())).toHaveLength(1)
  })
})
