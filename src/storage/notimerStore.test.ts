import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { clearDatabase } from './database'
import { createNotimerChecklistStore } from './notimerStore'
import { persistChecklist } from '../domain/ao1k/notimerChecklist'
import type { NotimerCheckRecord, NotimerSolveRecord } from '../domain/ao1k/notimerChecklist'

const solve = (id: string, sequence: number): NotimerSolveRecord => ({
  id,
  sequence,
  scramble: "R U R'",
  puzzleType: '3x3x3',
  solveDateTime: 1_700_000_000_000 + sequence,
  solveResult: 12_000,
  solveModifier: 'OK',
  comment: null
})

const check = (id: string, solveId: string): NotimerCheckRecord => ({
  id,
  notimerSolveId: solveId,
  checkTemplateId: `template-${id}`,
  checked: true,
  location: 'pre'
})

describe('notimer checklist store', () => {
  beforeEach(async () => clearDatabase())
  afterEach(async () => clearDatabase())

  it('keeps every concurrent write instead of losing all but the last', async () => {
    const store = createNotimerChecklistStore()
    await store.putSolve(solve('s1', 1))

    // The checklist fires its change handlers without awaiting them, so several
    // read-modify-write cycles against the shared row overlap. Unqueued, each one
    // reads the same bucket and the last write wins, silently dropping the others.
    await Promise.all([
      store.addCheck(check('c1', 's1')),
      store.addCheck(check('c2', 's1')),
      store.addCheck(check('c3', 's1'))
    ])

    const checks = await store.getChecksForSolve('s1')
    expect(checks.map((entry) => entry.id).sort()).toEqual(['c1', 'c2', 'c3'])
  })

  it('walks solves by sequence in both directions', async () => {
    const store = createNotimerChecklistStore()
    await store.putSolve(solve('s1', 1))
    await store.putSolve(solve('s3', 3))
    await store.putSolve(solve('s2', 2))

    expect((await store.getLastSolve())?.id).toBe('s3')
    expect((await store.getPreviousSolve(3))?.id).toBe('s2')
    expect((await store.getNextSolve(1))?.id).toBe('s2')
    expect(await store.getNextSolve(3)).toBeUndefined()
    expect(await store.getPreviousSolve(1)).toBeUndefined()
  })

  it('upserts a solve rather than duplicating it', async () => {
    const store = createNotimerChecklistStore()
    await store.putSolve(solve('s1', 1))
    await store.putSolve({ ...solve('s1', 1), comment: 'edited' })

    expect((await store.getLastSolve())?.comment).toBe('edited')
    expect(await store.getPreviousSolve(1)).toBeUndefined()
  })

  it('updates and deletes checks without touching the others', async () => {
    const store = createNotimerChecklistStore()
    await store.putSolve(solve('s1', 1))
    await store.addCheck(check('c1', 's1'))
    await store.addCheck(check('c2', 's1'))

    await store.updateCheck({ ...check('c1', 's1'), checked: false })
    await store.deleteCheck('c2')

    const checks = await store.getChecksForSolve('s1')
    expect(checks).toHaveLength(1)
    expect(checks[0]).toMatchObject({ id: 'c1', checked: false })
  })

  it('finds a check template by id and by text', async () => {
    const store = createNotimerChecklistStore()
    await store.putCheckTemplate({ id: 't1', text: 'Inspect the cross' })

    expect((await store.getCheckTemplateById('t1'))?.text).toBe('Inspect the cross')
    expect((await store.getCheckTemplateByText('Inspect the cross'))?.id).toBe('t1')
    expect(await store.getCheckTemplateByText('missing')).toBeUndefined()
  })

  it('does not duplicate a record when two read-then-add cycles overlap', async () => {
    const store = createNotimerChecklistStore()
    await store.putSolve(solve('s1', 1))

    // This is persistChecklist's shape: read what already exists, then add only what
    // is missing. Its caller fires it without awaiting, so two cycles overlap. With an
    // unqueued read the second cycle sees a snapshot taken before the first cycle's
    // insert landed, decides the template is still missing, and adds it twice.
    const addIfMissing = async () => {
      const existing = await store.getChecksForSolve('s1')
      if (existing.some((entry) => entry.checkTemplateId === 'template-shared')) return
      await store.addCheck({ ...check(store.nextId(), 's1'), checkTemplateId: 'template-shared' })
    }

    await Promise.all([addIfMissing(), addIfMissing()])

    const checks = await store.getChecksForSolve('s1')
    expect(checks.filter((entry) => entry.checkTemplateId === 'template-shared')).toHaveLength(1)
  })
})

describe('notimer checklist persistence', () => {
  beforeEach(async () => clearDatabase())
  afterEach(async () => clearDatabase())

  it('persists a toggle made after the item was first saved', async () => {
    const store = createNotimerChecklistStore()
    await store.putSolve(solve('s1', 1))
    const items = [{ id: 'i1', templateId: '', text: 'Inspect the cross', checked: false, location: 'pre' as const }]

    await persistChecklist(store, 's1', items)
    await persistChecklist(store, 's1', [{ ...items[0], checked: true }])

    const checks = await store.getChecksForSolve('s1')
    expect(checks).toHaveLength(1)
    expect(checks[0].checked).toBe(true)
  })
})

describe('notimer checklist locations', () => {
  beforeEach(async () => clearDatabase())
  afterEach(async () => clearDatabase())

  it('keeps a pre-solve and a post-solve item that share the same text', async () => {
    const store = createNotimerChecklistStore()
    await store.putSolve(solve('s1', 1))

    // Templates are keyed by text, so two blank items resolve to one template. They
    // are still two distinct checklist entries and both must persist.
    await persistChecklist(store, 's1', [
      { id: 'a', templateId: '', text: '', checked: false, location: 'pre' },
      { id: 'b', templateId: '', text: '', checked: false, location: 'post' }
    ])

    const checks = await store.getChecksForSolve('s1')
    expect(checks.map((entry) => entry.location).sort()).toEqual(['post', 'pre'])
  })
})
