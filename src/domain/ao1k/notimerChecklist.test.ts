import { describe, expect, it } from 'vitest'
import {
  addChecklistItem,
  deriveNextChecklist,
  filterByLocation,
  isAllUnchecked,
  loadOrDeriveChecklist,
  parseChecklistItems,
  persistChecklist,
  removeChecklistItem,
  sanitizeChecklistText,
  toggleChecklistItem,
  updateChecklistItemText,
  type ChecklistItem,
  type NotimerCheckRecord,
  type NotimerCheckTemplateRecord,
  type NotimerChecklistStore,
  type NotimerSolveRecord
} from './notimerChecklist'

function createInMemoryStore(): NotimerChecklistStore {
  const solves = new Map<string, NotimerSolveRecord>()
  const checks = new Map<string, NotimerCheckRecord>()
  const templates = new Map<string, NotimerCheckTemplateRecord>()
  let counter = 0

  return {
    async getLastSolve() {
      return [...solves.values()].sort((a, b) => b.sequence - a.sequence)[0]
    },
    async getPreviousSolve(beforeSequence) {
      return [...solves.values()]
        .filter((solve) => solve.sequence < beforeSequence)
        .sort((a, b) => b.sequence - a.sequence)[0]
    },
    async getNextSolve(afterSequence) {
      return [...solves.values()]
        .filter((solve) => solve.sequence > afterSequence)
        .sort((a, b) => a.sequence - b.sequence)[0]
    },
    async putSolve(solve) {
      solves.set(solve.id, solve)
    },
    async getChecksForSolve(solveId) {
      return [...checks.values()].filter((check) => check.notimerSolveId === solveId)
    },
    async addCheck(check) {
      checks.set(check.id, check)
    },
    async updateCheck(check) {
      checks.set(check.id, check)
    },
    async deleteCheck(id) {
      checks.delete(id)
    },
    async getCheckTemplateById(id) {
      return templates.get(id)
    },
    async getCheckTemplateByText(text) {
      return [...templates.values()].find((template) => template.text === text)
    },
    async putCheckTemplate(template) {
      templates.set(template.id, template)
    },
    nextId() {
      counter += 1
      return `id-${counter}`
    }
  }
}

const item = (overrides: Partial<ChecklistItem> = {}): ChecklistItem => ({
  id: 'c1',
  checked: false,
  text: 'Check cross color',
  templateId: 't1',
  location: 'pre',
  ...overrides
})

describe('checklist array transforms', () => {
  it('filters by location', () => {
    const items = [item({ id: 'a', location: 'pre' }), item({ id: 'b', location: 'post' })]
    expect(filterByLocation(items, 'pre')).toHaveLength(1)
    expect(filterByLocation(items, 'post')[0].id).toBe('b')
  })

  it('toggles only the targeted item', () => {
    const items = [item({ id: 'a', checked: false }), item({ id: 'b', checked: false })]
    const next = toggleChecklistItem(items, 'a')
    expect(next.find((i) => i.id === 'a')?.checked).toBe(true)
    expect(next.find((i) => i.id === 'b')?.checked).toBe(false)
  })

  it('adds a new blank item at the given location with a fresh id', () => {
    const items = [item({ id: 'a' })]
    let n = 0
    const next = addChecklistItem(items, 'post', () => `new-${++n}`)
    expect(next).toHaveLength(2)
    expect(next[1]).toMatchObject({ location: 'post', text: '', checked: false })
  })

  it('removes an item by id', () => {
    const items = [item({ id: 'a' }), item({ id: 'b' })]
    expect(removeChecklistItem(items, 'a')).toEqual([item({ id: 'b' })])
  })

  it('sanitizes updated text through the allow-listed tag set', () => {
    const items = [item({ id: 'a', text: 'old' })]
    const next = updateChecklistItemText(items, 'a', '<b>bold</b><script>alert(1)</script><span>x</span>')
    expect(next[0].text).toBe('<b>bold</b>x')
  })

  it('isAllUnchecked reports true only when every item is unchecked', () => {
    expect(isAllUnchecked([item({ checked: false }), item({ id: 'b', checked: false })])).toBe(true)
    expect(isAllUnchecked([item({ checked: false }), item({ id: 'b', checked: true })])).toBe(false)
  })
})

describe('sanitizeChecklistText', () => {
  it('strips disallowed tags but keeps allow-listed ones', () => {
    expect(sanitizeChecklistText('<div><b>keep</b><i>also</i><u>this</u><em>drop</em></div>')).toBe(
      '<div><b>keep</b><i>also</i><u>this</u>drop</div>'
    )
  })

  it('caps length at 500 characters', () => {
    const long = 'a'.repeat(600)
    expect(sanitizeChecklistText(long)).toHaveLength(500)
  })
})

describe('deriveNextChecklist', () => {
  it('resets checked state and mints fresh ids while keeping text/location', () => {
    const previous = [item({ id: 'a', checked: true, text: 'look at cross', templateId: 't1' })]
    let n = 0
    const next = deriveNextChecklist(previous, () => `next-${++n}`)
    expect(next).toEqual([{ id: 'next-1', checked: false, text: 'look at cross', templateId: 't1', location: 'pre' }])
  })
})

describe('persistence round trip against an in-memory store', () => {
  it('a fresh solve with no checks derives the previous solve checklist unchecked', async () => {
    const store = createInMemoryStore()

    const first: NotimerSolveRecord = {
      id: 'solve-1',
      sequence: 0,
      scramble: 'R U R\' U\'',
      puzzleType: '3x3x3',
      solveDateTime: Date.now(),
      solveResult: 0,
      solveModifier: 'OK',
      comment: null
    }
    await store.putSolve(first)

    const items = [item({ id: 'a', checked: true, text: 'Look at F2L pairs', location: 'pre' })]
    await persistChecklist(store, first.id, items)

    const second: NotimerSolveRecord = { ...first, id: 'solve-2', sequence: 1 }

    // matches NotimerPractice's ordering: derive before persisting the new
    // solve, so getLastSolve() still resolves to the true previous solve
    const derived = await loadOrDeriveChecklist(store, second.id)
    await store.putSolve(second)

    expect(derived).toHaveLength(1)
    expect(derived[0].checked).toBe(false)
    expect(derived[0].text).toBe('Look at F2L pairs')
    expect(derived[0].id).not.toBe('a')
  })

  it('persistChecklist does not duplicate a check for a template already recorded on the solve', async () => {
    const store = createInMemoryStore()
    const solve: NotimerSolveRecord = {
      id: 'solve-1',
      sequence: 0,
      scramble: 'scramble',
      puzzleType: '3x3x3',
      solveDateTime: Date.now(),
      solveResult: 0,
      solveModifier: 'OK',
      comment: null
    }
    await store.putSolve(solve)

    const items = [item({ id: 'a', text: 'Same text' })]
    await persistChecklist(store, solve.id, items)
    await persistChecklist(store, solve.id, items)

    const checks = await store.getChecksForSolve(solve.id)
    expect(checks).toHaveLength(1)
  })

  it('parseChecklistItems joins check rows to template text', async () => {
    const store = createInMemoryStore()
    await store.putCheckTemplate({ id: 'template-1', text: 'Breathe' })
    const check: NotimerCheckRecord = {
      id: 'check-1',
      notimerSolveId: 'solve-1',
      checkTemplateId: 'template-1',
      checked: true,
      location: 'post'
    }
    const [parsed] = await parseChecklistItems(store, [check])
    expect(parsed).toEqual({ id: 'check-1', checked: true, text: 'Breathe', templateId: 'template-1', location: 'post' })
  })

  it('getPreviousSolve/getNextSolve walk by sequence, skipping gaps', async () => {
    const store = createInMemoryStore()
    await store.putSolve({ id: 'a', sequence: 0, scramble: '', puzzleType: '3x3x3', solveDateTime: 0, solveResult: 0, solveModifier: 'OK', comment: null })
    await store.putSolve({ id: 'c', sequence: 5, scramble: '', puzzleType: '3x3x3', solveDateTime: 0, solveResult: 0, solveModifier: 'OK', comment: null })

    expect((await store.getPreviousSolve(5))?.id).toBe('a')
    expect((await store.getNextSolve(0))?.id).toBe('c')
  })
})
