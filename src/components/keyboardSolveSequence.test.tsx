import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { clearDatabase, repositories } from '../storage/database'
import { MIN_KEYBOARD_SOLVE_MS, STOP_GUARD_MS } from '../domain/keyboardTimer'

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// These drove <LiveSolve/> directly, which App renders nowhere — the suite passed while
// the screen a user actually opens went untested. Render the real app and open the route.
const renderPlayground = async () => {
  const user = userEvent.setup()
  render(<App />)
  await user.click(await screen.findByRole('button', { name: 'Playground' }, { timeout: 10_000 }))
}

const driveOneSolve = async (stopCode: string, stopKey: string) => {
  fireEvent.keyDown(window, { code: 'Space', key: ' ' })
  await sleep(1_000)
  fireEvent.keyUp(window, { code: 'Space', key: ' ' })
  await sleep(2_000)
  fireEvent.keyDown(window, { code: stopCode, key: stopKey })
  fireEvent.keyUp(window, { code: stopCode, key: stopKey })
  await sleep(STOP_GUARD_MS + 100)
}

const driveOneSolveWithRepeatedKeydowns = async (stopCode: string, stopKey: string) => {
  fireEvent.keyDown(window, { code: 'Space', key: ' ' })
  await sleep(500)
  for (let repeat = 0; repeat < 15; repeat += 1) {
    fireEvent.keyDown(window, { code: 'Space', key: ' ', repeat: true })
    await sleep(30)
  }
  fireEvent.keyUp(window, { code: 'Space', key: ' ' })
  await sleep(2_000)
  fireEvent.keyDown(window, { code: stopCode, key: stopKey })
  fireEvent.keyUp(window, { code: stopCode, key: stopKey })
  await sleep(STOP_GUARD_MS + 100)
}

describe('keyboard timer across consecutive solves, inspection off', () => {
  beforeEach(async () => clearDatabase())
  afterEach(async () => {
    vi.restoreAllMocks()
    await clearDatabase()
  })

  it('records approximately 2s for all three solves in a row with inspection left at its default off state', async () => {
    await renderPlayground()

    for (let solve = 0; solve < 3; solve += 1) {
      await driveOneSolve('Escape', 'Escape')
      await waitFor(async () => expect(await repositories.solves.all()).toHaveLength(solve + 1), { timeout: 5_000 })
    }

    const stored = await repositories.solves.all()
    expect(stored).toHaveLength(3)
    for (const solve of stored) {
      const elapsed = solve.endedAt - solve.startedAt
      expect(elapsed).toBeGreaterThanOrEqual(1_900)
      expect(elapsed).toBeLessThanOrEqual(2_300)
    }
  }, 30_000)

  it('does not corrupt the next solve while the previous solve is still being persisted', async () => {
    const originalPut = repositories.solves.put.bind(repositories.solves)
    let delayedOnce = false
    vi.spyOn(repositories.solves, 'put').mockImplementation(async (record) => {
      if (!delayedOnce) {
        delayedOnce = true
        await sleep(1_500)
      }
      return originalPut(record)
    })

    await renderPlayground()

    await driveOneSolve('Escape', 'Escape')
    await driveOneSolve('Escape', 'Escape')

    await waitFor(async () => expect((await repositories.solves.all())).toHaveLength(2), { timeout: 10_000 })

    const stored = await repositories.solves.all()
    for (const solve of stored) {
      expect(solve.endedAt - solve.startedAt).toBeGreaterThanOrEqual(MIN_KEYBOARD_SOLVE_MS)
    }
  }, 30_000)

  it('a keypress landing inside the stop guard window does not start or record a phantom solve', async () => {
    await renderPlayground()

    fireEvent.keyDown(window, { code: 'Space', key: ' ' })
    await sleep(1_000)
    fireEvent.keyUp(window, { code: 'Space', key: ' ' })
    await sleep(2_000)
    fireEvent.keyDown(window, { code: 'Escape', key: 'Escape' })
    fireEvent.keyUp(window, { code: 'Escape', key: 'Escape' })
    // The cockpit has no .time-chip markup; the observable outcome is the stored solve.
    await waitFor(async () => expect(await repositories.solves.all()).toHaveLength(1), { timeout: 5_000 })

    fireEvent.keyDown(window, { code: 'Space', key: ' ' })
    await sleep(50)
    fireEvent.keyUp(window, { code: 'Space', key: ' ' })
    await sleep(STOP_GUARD_MS + 200)

    expect(await repositories.solves.all()).toHaveLength(1)

    await driveOneSolve('Escape', 'Escape')
    await waitFor(async () => expect(await repositories.solves.all()).toHaveLength(2), { timeout: 5_000 })
    expect(await repositories.solves.all()).toHaveLength(2)
  }, 30_000)

  it('records approximately 2s for every solve when the physical hold produces native key-repeat keydowns', async () => {
    await renderPlayground()

    for (let solve = 0; solve < 3; solve += 1) {
      await driveOneSolveWithRepeatedKeydowns('Escape', 'Escape')
      await waitFor(async () => expect(await repositories.solves.all()).toHaveLength(solve + 1), { timeout: 5_000 })
    }

    const stored = await repositories.solves.all()
    expect(stored).toHaveLength(3)
    for (const solve of stored) {
      const elapsed = solve.endedAt - solve.startedAt
      expect(elapsed).toBeGreaterThanOrEqual(1_900)
      expect(elapsed).toBeLessThanOrEqual(2_300)
    }
  }, 30_000)
})

describe('keyboard timer with real nav-button focus, as actually driven', () => {
  beforeEach(async () => clearDatabase())
  afterEach(async () => clearDatabase())

  it('records approximately 2s for all three solves while the Playground nav button holds real DOM focus throughout', async () => {
    const user = userEvent.setup()
    render(<App />)

    const liveSolveNav = screen.getByRole('button', { name: 'Playground' })
    await user.click(liveSolveNav)
    expect(document.activeElement).toBe(liveSolveNav)

    const activeElementLog: Array<{ solve: number; tagName: string | undefined; isNav: boolean }> = []

    // The cockpit has no .time-chip markup — that belonged to the older screen. The
    // observable outcome of a solve on the shipped route is the stored solve.
    for (let solve = 0; solve < 3; solve += 1) {
      activeElementLog.push({
        solve,
        tagName: document.activeElement?.tagName,
        isNav: document.activeElement === liveSolveNav
      })
      await driveOneSolve('Space', ' ')
      await waitFor(async () => expect(await repositories.solves.all()).toHaveLength(solve + 1), { timeout: 5_000 })
    }

    console.log('ACTIVE ELEMENT ACROSS CYCLES', activeElementLog, 'final:', document.activeElement?.tagName, document.activeElement === liveSolveNav)

    const stored = await repositories.solves.all()
    expect(stored).toHaveLength(3)
    for (const solve of stored) {
      const elapsed = solve.endedAt - solve.startedAt
      expect(elapsed).toBeGreaterThanOrEqual(1_900)
      expect(elapsed).toBeLessThanOrEqual(2_300)
    }
  }, 30_000)

  it('keeps the nav button focused (or falls back safely) across the save-triggered re-render after the first solve', async () => {
    const user = userEvent.setup()
    render(<App />)

    const liveSolveNav = screen.getByRole('button', { name: 'Playground' })
    await user.click(liveSolveNav)

    await driveOneSolve('Space', ' ')
    // The cockpit has no .time-chip markup; the observable outcome is the stored solve.
    await waitFor(async () => expect(await repositories.solves.all()).toHaveLength(1), { timeout: 5_000 })

    const stillInDocument = document.body.contains(liveSolveNav)
    const activeAfterFirstSave = document.activeElement
    console.log('FOCUS AFTER FIRST SAVE', {
      stillInDocument,
      activeTag: activeAfterFirstSave?.tagName,
      isSameNavButton: activeAfterFirstSave === liveSolveNav,
      isBody: activeAfterFirstSave === document.body
    })

    await driveOneSolve('Space', ' ')
    await waitFor(async () => expect(await repositories.solves.all()).toHaveLength(2), { timeout: 5_000 })
    await driveOneSolve('Space', ' ')
    await waitFor(async () => expect(await repositories.solves.all()).toHaveLength(3), { timeout: 5_000 })

    const stored = await repositories.solves.all()
    expect(stored).toHaveLength(3)
    for (const solve of stored) {
      const elapsed = solve.endedAt - solve.startedAt
      expect(elapsed).toBeGreaterThanOrEqual(1_900)
      expect(elapsed).toBeLessThanOrEqual(2_300)
    }
  }, 30_000)
})
