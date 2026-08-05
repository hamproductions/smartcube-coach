/**
 * Ported from Ao1K/Ao1K_site (https://github.com/Ao1K/Ao1K_site).
 * Source: composables/notimer/db.tsx, composables/notimer/dbUtils.tsx,
 * app/notimer/page.tsx (deriveChecksFromLastSolve, createNextChecks,
 * isAllUnchecked, parseDbChecks, saveLatestChecks logic).
 *
 * MIT License
 * Copyright (c) 2025 Ao1K
 *
 * Adaptation notes: the original stores solves/checks/templates in a
 * dedicated Dexie database with autoincrement numeric ids, and derives
 * "previous solve" by walking id-1, id-2, ... This project keys every
 * record with a string id (see src/domain/models.ts) and has no
 * autoincrement primitive, so this port keeps a monotonic `sequence`
 * field to reproduce the same "walk to the nearest earlier/later solve"
 * behaviour, and expresses persistence through the NotimerChecklistStore
 * interface below instead of writing to src/storage/database.ts, which
 * this module does not own. See the storage-need comment at the bottom
 * of this file for exactly what an owner of that file must add.
 */

export type ChecklistLocation = 'pre' | 'post'

export type ChecklistItem = {
  id: string
  checked: boolean
  text: string
  templateId: string
  location: ChecklistLocation
}

export type NotimerSolveModifier = 'OK' | '+2' | 'DNF'

export type NotimerSolveRecord = {
  id: string
  sequence: number
  scramble: string
  puzzleType: '3x3x3'
  solveDateTime: number
  solveResult: number
  solveModifier: NotimerSolveModifier
  comment: string | null
}

export type NotimerCheckRecord = {
  id: string
  notimerSolveId: string
  checkTemplateId: string
  checked: boolean
  location: ChecklistLocation
}

export type NotimerCheckTemplateRecord = {
  id: string
  text: string
}

/**
 * Storage contract this domain module depends on. The owner of
 * src/storage/database.ts implements this against IndexedDB (three new
 * object stores, see the bottom of this file); tests can implement it
 * in-memory (see notimerChecklist.test.ts pattern in this project's
 * other domain tests).
 */
export interface NotimerChecklistStore {
  getLastSolve(): Promise<NotimerSolveRecord | undefined>
  getPreviousSolve(beforeSequence: number): Promise<NotimerSolveRecord | undefined>
  getNextSolve(afterSequence: number): Promise<NotimerSolveRecord | undefined>
  putSolve(solve: NotimerSolveRecord): Promise<void>
  getChecksForSolve(solveId: string): Promise<NotimerCheckRecord[]>
  addCheck(check: NotimerCheckRecord): Promise<void>
  updateCheck(check: NotimerCheckRecord): Promise<void>
  deleteCheck(id: string): Promise<void>
  getCheckTemplateById(id: string): Promise<NotimerCheckTemplateRecord | undefined>
  getCheckTemplateByText(text: string): Promise<NotimerCheckTemplateRecord | undefined>
  putCheckTemplate(template: NotimerCheckTemplateRecord): Promise<void>
  nextId(): string
}

const MAX_CHECK_TEXT_LENGTH = 500

/**
 * Ported from NoTimeSolveBox.tsx sanitizeConf. The original used
 * `sanitize-html`, which is not a dependency of this project; this
 * reimplements the same allow-list (b, i, u, br, div) with a small regex
 * pass instead of adding a new dependency.
 */
export function sanitizeChecklistText(html: string): string {
  const allowed = new Set(['b', 'i', 'u', 'br', 'div'])
  const withoutScripts = html.replace(/<(script|style|textarea|option|xmp)[^>]*>[\s\S]*?<\/\1>/gi, '')
  const stripped = withoutScripts.replace(/<\/?([a-zA-Z0-9]+)([^>]*)>/g, (match, tag: string) => {
    const lower = tag.toLowerCase()
    if (!allowed.has(lower)) return ''
    return match.startsWith('</') ? `</${lower}>` : `<${lower}>`
  })
  return stripped.slice(0, MAX_CHECK_TEXT_LENGTH)
}

export function filterByLocation(items: ChecklistItem[], location: ChecklistLocation): ChecklistItem[] {
  return items.filter((item) => item.location === location)
}

export function isAllUnchecked(items: ChecklistItem[]): boolean {
  return items.every((item) => !item.checked)
}

export function toggleChecklistItem(items: ChecklistItem[], id: string): ChecklistItem[] {
  return items.map((item) => (item.id === id ? { ...item, checked: !item.checked } : item))
}

export function updateChecklistItemText(items: ChecklistItem[], id: string, text: string): ChecklistItem[] {
  const sanitized = sanitizeChecklistText(text)
  return items.map((item) => (item.id === id ? { ...item, text: sanitized } : item))
}

export function removeChecklistItem(items: ChecklistItem[], id: string): ChecklistItem[] {
  return items.filter((item) => item.id !== id)
}

export function addChecklistItem(
  items: ChecklistItem[],
  location: ChecklistLocation,
  makeId: () => string
): ChecklistItem[] {
  const newItem: ChecklistItem = { id: makeId(), checked: false, text: '', templateId: makeId(), location }
  return [...items, newItem]
}

/**
 * Ported from app/notimer/page.tsx: deriveChecksFromLastSolve /
 * createNextChecks. A new untimed-practice solve inherits the previous
 * solve's checklist items, unchecked, with fresh ids — the "state
 * inherited from the previous solve" behaviour the task calls out.
 */
export function deriveNextChecklist(previousItems: ChecklistItem[], makeId: () => string): ChecklistItem[] {
  return previousItems.map((item) => ({ ...item, id: makeId(), checked: false }))
}

async function resolveTemplate(
  store: NotimerChecklistStore,
  text: string
): Promise<NotimerCheckTemplateRecord> {
  const existing = await store.getCheckTemplateByText(text)
  if (existing) return existing
  const template: NotimerCheckTemplateRecord = { id: store.nextId(), text }
  await store.putCheckTemplate(template)
  return template
}

/**
 * Ported from dbUtils.tsx parseDbChecks (via app/notimer/page.tsx). Joins
 * check rows to their template text.
 */
export async function parseChecklistItems(
  store: NotimerChecklistStore,
  checks: NotimerCheckRecord[]
): Promise<ChecklistItem[]> {
  const items: ChecklistItem[] = []
  for (const check of checks) {
    const template = await store.getCheckTemplateById(check.checkTemplateId)
    items.push({
      id: check.id,
      checked: check.checked,
      text: template?.text ?? '',
      templateId: check.checkTemplateId,
      location: check.location
    })
  }
  return items
}

/**
 * Ported from app/notimer/page.tsx saveLatestChecks: upserts a template
 * per unique check text and a check row per template that doesn't
 * already have one on this solve.
 */
export async function persistChecklist(
  store: NotimerChecklistStore,
  solveId: string,
  items: ChecklistItem[]
): Promise<void> {
  const existing = await store.getChecksForSolve(solveId)
  for (const item of items) {
    const template = await resolveTemplate(store, item.text)
    // Upstream skips an item whose template already has a row on this solve, which
    // means the very first save wins and every later toggle is discarded — ticking a
    // box then reloading the solve shows it unticked. Persist the new state instead.
    // Scoped by location as well as template. Templates are deliberately shared by
    // text upstream, so a pre-solve and a post-solve item that read the same — two
    // freshly added blank ones, for instance — resolve to one template; keying only on
    // that made the second item collapse into the first and never persist.
    const alreadyExists = existing.find((check) => check.checkTemplateId === template.id && check.location === item.location)
    if (alreadyExists) {
      if (alreadyExists.checked !== item.checked || alreadyExists.location !== item.location) {
        await store.updateCheck({ ...alreadyExists, checked: item.checked, location: item.location })
      }
      continue
    }
    await store.addCheck({
      id: store.nextId(),
      notimerSolveId: solveId,
      checkTemplateId: template.id,
      checked: item.checked,
      location: item.location
    })
  }
}

/**
 * Loads (or derives from the previous solve) the checklist for a solve
 * that has no persisted checks yet. Ported from
 * app/notimer/page.tsx createCardData.
 */
export async function loadOrDeriveChecklist(
  store: NotimerChecklistStore,
  solveId: string
): Promise<ChecklistItem[]> {
  const existing = await store.getChecksForSolve(solveId)
  if (existing.length > 0) {
    return parseChecklistItems(store, existing)
  }

  const lastSolve = await store.getLastSolve()
  if (!lastSolve) return []

  const lastChecks = await store.getChecksForSolve(lastSolve.id)
  if (lastChecks.length === 0) return []

  const parsed = await parseChecklistItems(store, lastChecks)
  return deriveNextChecklist(parsed, () => store.nextId())
}

/*
 * STORAGE NEED for whoever owns src/storage/database.ts:
 *
 * Add three object stores to SmartCubeCoachDatabase, bump the schema
 * version, and add an upgrade branch:
 *
 *   notimerSolves: { key: string; value: NotimerSolveRecord; indexes: { 'by-sequence': number } }
 *   notimerChecks: { key: string; value: NotimerCheckRecord; indexes: { 'by-solve': string } }
 *   notimerCheckTemplates: { key: string; value: NotimerCheckTemplateRecord; indexes: { 'by-text': string } }
 *
 *   const notimerSolves = database.createObjectStore('notimerSolves', { keyPath: 'id' })
 *   notimerSolves.createIndex('by-sequence', 'sequence')
 *   const notimerChecks = database.createObjectStore('notimerChecks', { keyPath: 'id' })
 *   notimerChecks.createIndex('by-solve', 'notimerSolveId')
 *   const notimerCheckTemplates = database.createObjectStore('notimerCheckTemplates', { keyPath: 'id' })
 *   notimerCheckTemplates.createIndex('by-text', 'text')
 *
 * Then export a NotimerChecklistStore implementation (src/storage/ao1kNotimerStore.ts
 * or similar) backed by `store<T>()` the same way `repositories.settings` is
 * built, plus getPreviousSolve/getNextSolve walking the by-sequence index,
 * and getLastSolve via `.orderBy('by-sequence').last()`-equivalent idb call.
 */
