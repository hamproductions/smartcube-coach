import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { clearDatabase, repositories } from '../storage/database'
import { ReconstructEditor } from './ReconstructEditor'

describe('ReconstructEditor', () => {
  beforeEach(async () => clearDatabase())
  afterEach(async () => clearDatabase())

  it('saves editable revisions while retaining source event links', async () => {
    const user = userEvent.setup()
    render(<ReconstructEditor solveId="solve-1" initialScramble="R U" initialMoves={["U'", "R'"]} sourceEventIds={['raw-1', 'raw-2']} />)

    await user.click(screen.getByRole('button', { name: 'Save revision' }))

    expect(await screen.findByText(/2 immutable source events remain linked/)).toBeInTheDocument()
    const [revision] = await repositories.revisions.all()
    expect(revision.solveId).toBe('solve-1')
    expect(revision.lines[0].sourceEventIds).toEqual(['raw-1', 'raw-2'])
  })
})
