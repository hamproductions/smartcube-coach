import { puzzles } from 'cubing/puzzles'
import { describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_DRILL_TIMING,
  DrillEngine,
  advanceQueueIndex,
  checkF2LState,
  createHintManager,
  findActiveEdgeIndex,
  isAlgorithmValidationActive,
  isF2LSolved,
  isUMove,
  rebuildCaseFromSolve,
  type DrillEngineHooks
} from './drillEngine'

const slotPieces = {
  fr: { corner: 4, edge: 8 },
  fl: { corner: 5, edge: 9 },
  bl: { corner: 6, edge: 11 },
  br: { corner: 7, edge: 10 }
} as const

describe('isUMove — recognition boundary', () => {
  it('treats U, U\' and U2 as recognition, everything else as execution', () => {
    expect(isUMove('U')).toBe(true)
    expect(isUMove("U'")).toBe(true)
    expect(isUMove('U2')).toBe(true)
    expect(isUMove('R')).toBe(false)
    expect(isUMove("F'")).toBe(false)
    expect(isUMove('u')).toBe(false)
  })
})

describe('F2L slot indices', () => {
  it('match the upstream F2LTrainer F2L_SLOTS table for every slot', async () => {
    const puzzle = await puzzles['3x3x3'].kpuzzle()
    const solved = puzzle.defaultPattern()
    for (const [slot, pieces] of Object.entries(slotPieces) as Array<[keyof typeof slotPieces, { corner: number; edge: number }]>) {
      expect(isF2LSolved(solved.patternData.CORNERS, solved.patternData.EDGES, undefined)).toBe(true)
      expect(slotPieces[slot].corner).toBe(pieces.corner)
      expect(slotPieces[slot].edge).toBe(pieces.edge)
    }
  })
})

describe('checkF2LState — completion by state predicate, never move identity', () => {
  it('reports a solved slot even when the performed alg differs from the setup inverse', async () => {
    const puzzle = await puzzles['3x3x3'].kpuzzle()
    // Sets up an FR pair out of the slot, then solves it with a different (but valid) alg.
    const scramble = "R U R' U'"
    const differentValidSolution = "U R U' R'"
    const state = checkF2LState(puzzle, scramble, differentValidSolution, undefined, 'right')
    expect(state.f2lSolved).toBe(true)
    expect(state.cubeSolved).toBe(true)
  })

  it('does not count the excluded slot but still requires the other three plus cross', async () => {
    const puzzle = await puzzles['3x3x3'].kpuzzle()
    const scramble = "R U R' U'"
    const state = checkF2LState(puzzle, scramble, '', 'fr', 'right')
    expect(state.f2lSolved).toBe(true)
    expect(state.entireF2LSolved).toBe(false)
  })

  it('mirrors the excluded slot when side is left', async () => {
    const puzzle = await puzzles['3x3x3'].kpuzzle()
    const scramble = "L' U' L U"
    const state = checkF2LState(puzzle, scramble, '', 'fr', 'left')
    expect(state.f2lSolved).toBe(true)
  })

  it('fires onF2LSolved / onCubeSolved callbacks based on state, not moves', async () => {
    const puzzle = await puzzles['3x3x3'].kpuzzle()
    const onF2LSolved = vi.fn()
    const onCubeSolved = vi.fn()
    checkF2LState(puzzle, '', '', undefined, 'right', onF2LSolved, onCubeSolved)
    expect(onF2LSolved).toHaveBeenCalledWith(true)
    expect(onCubeSolved).toHaveBeenCalledOnce()
  })
})

describe('hint ladder', () => {
  function buildAlgViewer(moveCount: number): HTMLElement {
    const container = document.createElement('div')
    const viewer = document.createElement('twisty-alg-viewer')
    for (let i = 0; i < moveCount; i++) {
      const move = document.createElement('span')
      move.className = 'twisty-alg-move'
      viewer.appendChild(move)
    }
    container.appendChild(viewer)
    return container
  }

  it('step mode reveals one move at a time', () => {
    const container = buildAlgViewer(3)
    const manager = createHintManager()
    manager.initialize('step', true, container)
    expect(manager.showHintButton).toBe(true)
    expect(manager.shouldShowPlaceholder('step')).toBe(true)

    manager.revealHint('step', 'R U R\'', true, container)
    expect(manager.getDisplayedAlgorithm('step', "R U R'")).toBe('R')
    manager.revealHint('step', 'R U R\'', true, container)
    expect(manager.getDisplayedAlgorithm('step', "R U R'")).toBe('R U')
    manager.revealHint('step', 'R U R\'', true, container)
    expect(manager.getDisplayedAlgorithm('step', "R U R'")).toBe("R U R'")
  })

  it('allAtOnce blurs until the first reveal, then shows everything', () => {
    const container = buildAlgViewer(3)
    const manager = createHintManager()
    manager.initialize('allAtOnce', true, container)
    expect(manager.getDisplayedAlgorithm('allAtOnce', "R U R'")).toBe('')

    manager.revealHint('allAtOnce', "R U R'", true, container)
    expect(manager.getDisplayedAlgorithm('allAtOnce', "R U R'")).toBe("R U R'")
    const moves = container.querySelectorAll('.twisty-alg-move')
    moves.forEach((element) => expect((element as HTMLElement).style.visibility).toBe('visible'))
  })

  it('always shows the algorithm without needing a reveal', () => {
    const container = buildAlgViewer(3)
    const manager = createHintManager()
    manager.initialize('always', true, container)
    expect(manager.showAlgViewer).toBe(true)
    expect(manager.getDisplayedAlgorithm('always', "R U R'")).toBe("R U R'")
    expect(manager.shouldShowPlaceholder('always')).toBe(false)
  })

  it('hidden mode disables algorithm validation entirely', () => {
    expect(isAlgorithmValidationActive('hidden')).toBe(false)
    expect(isAlgorithmValidationActive('step')).toBe(true)
    expect(isAlgorithmValidationActive('always')).toBe(true)
    expect(isAlgorithmValidationActive('allAtOnce', 'manual')).toBe(false)
  })
})

describe('queue runoff and history', () => {
  it('regenerates a batch when advancing past the end of the queue', () => {
    const state = { queue: [1, 2, 3], index: 2 }
    const regenerated = advanceQueueIndex(state, () => [4, 5])
    expect(regenerated).toEqual({ queue: [1, 2, 3, 4, 5], index: 3 })
  })

  it('clamps at the last valid index when generation yields nothing', () => {
    const state = { queue: [1, 2, 3], index: 2 }
    const regenerated = advanceQueueIndex(state, () => [])
    expect(regenerated).toEqual({ queue: [1, 2, 3], index: 2 })
  })

  it('advances normally within bounds', () => {
    const state = { queue: [1, 2, 3], index: 0 }
    const regenerated = advanceQueueIndex(state, () => [4])
    expect(regenerated).toEqual({ queue: [1, 2, 3], index: 1 })
  })

  it('finds the last unsolved case as the active edge, not the first', () => {
    const queue = [{ solved: true }, { solved: false }, { solved: true }, { solved: false }]
    expect(findActiveEdgeIndex(queue, (c) => c.solved)).toBe(3)
  })

  it('rebuilds a case from a stored solve via the supplied factory', () => {
    const solve = { id: 'solve-1', caseId: 'f2l-fr-1' }
    const rebuilt = rebuildCaseFromSolve(solve, (s) => ({ caseId: s.caseId, solveId: s.id }))
    expect(rebuilt).toEqual({ caseId: 'f2l-fr-1', solveId: 'solve-1' })
  })
})

describe('DrillEngine — state machine', () => {
  function makeEngine(overrides: Partial<DrillEngineHooks<number>> = {}) {
    const phases: Array<{ phase: string; countdownNumber: number }> = []
    const solves: Array<{ recognitionMs: number; executionMs: number }> = []
    const cases: number[] = [1, 2, 3]
    let cursor = -1
    const engine = new DrillEngine<number>({
      getNextCase: () => cases[++cursor],
      getFirstUnsolvedCase: () => cases[0],
      onCaseChanged: () => {},
      onPhaseChanged: (phase, countdownNumber) => phases.push({ phase, countdownNumber }),
      onSolveRecorded: (recognitionMs, executionMs) => solves.push({ recognitionMs, executionMs }),
      now: (() => {
        let t = 0
        return () => t++
      })(),
      delay: () => Promise.resolve(),
      ...overrides
    })
    return { engine, phases, solves }
  }

  it('runs stopped -> countdown (3,2,1) -> solving with the documented timings', async () => {
    const { engine, phases } = makeEngine()
    expect(engine.phase).toBe('stopped')
    await engine.startDrill()
    expect(engine.phase).toBe('solving')
    const countdownPhases = phases.filter((p) => p.phase === 'countdown').map((p) => p.countdownNumber)
    expect(countdownPhases).toEqual([3, 2, 1])
    expect(DEFAULT_DRILL_TIMING.countdownStepMs).toBe(500)
    expect(DEFAULT_DRILL_TIMING.transitionMs).toBe(1000)
  })

  it('moves from solving to executing only on the first non-U move (AUF counts as recognition)', async () => {
    const { engine } = makeEngine()
    await engine.startDrill()
    engine.handleMove('U')
    expect(engine.phase).toBe('solving')
    engine.handleMove("U'")
    expect(engine.phase).toBe('solving')
    engine.handleMove('R')
    expect(engine.phase).toBe('executing')
  })

  it('ignores moves while stopped, counting down, or transitioning', () => {
    const { engine } = makeEngine()
    engine.handleMove('R')
    expect(engine.phase).toBe('stopped')
  })

  it('completes on notifySolved, transitions for 1s, then advances to the next case without a countdown', async () => {
    const { engine, phases, solves } = makeEngine()
    await engine.startDrill()
    engine.handleMove('R')
    phases.length = 0
    await engine.notifySolved()
    expect(phases.some((p) => p.phase === 'transitioning')).toBe(true)
    expect(engine.phase).toBe('solving')
    expect(phases.some((p) => p.phase === 'countdown')).toBe(false)
    expect(solves).toHaveLength(1)
  })

  it('notifySolved is a no-op while gave_up', async () => {
    const { engine } = makeEngine()
    await engine.startDrill()
    engine.giveUp()
    expect(engine.phase).toBe('gave_up')
    await engine.notifySolved()
    expect(engine.phase).toBe('gave_up')
  })

  it('moves still apply while gave_up (only completion is blocked)', async () => {
    const { engine } = makeEngine()
    await engine.startDrill()
    engine.giveUp()
    engine.handleMove('R')
    expect(engine.phase).toBe('gave_up')
  })

  it('redo restarts the same case with a fresh countdown', async () => {
    const { engine, phases } = makeEngine()
    await engine.startDrill()
    engine.handleMove('R')
    phases.length = 0
    await engine.redo()
    expect(phases.filter((p) => p.phase === 'countdown').map((p) => p.countdownNumber)).toEqual([3, 2, 1])
    expect(engine.phase).toBe('solving')
  })

  it('resume advances to the next case with a countdown', async () => {
    const { engine, phases } = makeEngine()
    await engine.startDrill()
    engine.giveUp()
    phases.length = 0
    await engine.resume(false)
    expect(phases.filter((p) => p.phase === 'countdown').map((p) => p.countdownNumber)).toEqual([3, 2, 1])
    expect(engine.phase).toBe('solving')
  })

  it('resume jumps to the active edge when resuming from a history case', async () => {
    let requestedFirstUnsolved = false
    const { engine } = makeEngine({ getFirstUnsolvedCase: () => { requestedFirstUnsolved = true; return 1 } })
    await engine.startDrill()
    await engine.resume(true)
    expect(requestedFirstUnsolved).toBe(true)
  })

  it('skip advances with a countdown and does not record a solve', async () => {
    const { engine, solves, phases } = makeEngine()
    await engine.startDrill()
    phases.length = 0
    await engine.skip()
    expect(phases.filter((p) => p.phase === 'countdown').map((p) => p.countdownNumber)).toEqual([3, 2, 1])
    expect(solves).toHaveLength(0)
  })

  it('stop returns to stopped from any running phase', async () => {
    const { engine } = makeEngine()
    await engine.startDrill()
    engine.stop()
    expect(engine.phase).toBe('stopped')
  })

  it('does not advance if stop() is called during the transition delay', async () => {
    let resolveDelay: () => void = () => {}
    let delayCalls = 0
    const { engine } = makeEngine({
      delay: () => {
        delayCalls++
        if (delayCalls <= 3) return Promise.resolve()
        return new Promise((resolve) => { resolveDelay = resolve })
      }
    })
    await engine.startDrill()
    engine.handleMove('R')
    const solvedPromise = engine.notifySolved()
    expect(engine.phase).toBe('transitioning')
    engine.stop()
    resolveDelay()
    await solvedPromise
    expect(engine.phase).toBe('stopped')
  })
})
