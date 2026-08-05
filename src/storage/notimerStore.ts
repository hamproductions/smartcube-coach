import { createId } from '../domain/ids'
import { repositories } from './database'
import type {
  NotimerCheckRecord,
  NotimerCheckTemplateRecord,
  NotimerChecklistStore,
  NotimerSolveRecord
} from '../domain/ao1k/notimerChecklist'

// notimerChecklist.ts asks its owner for three IndexedDB object stores. Adding
// stores means a schema version bump and a migration for every existing user's
// database, which this feature does not justify on its own — the checklist is a
// small, self-contained list keyed by solve. It is persisted instead as three
// documents in the existing key-value `settings` store, which already survives
// export/import. The contract is unchanged, so a later move to real object stores
// is a swap of this file with no caller touched.
type Bucket = {
  solves: NotimerSolveRecord[]
  checks: NotimerCheckRecord[]
  templates: NotimerCheckTemplateRecord[]
}

const KEY = 'ao1k-notimer-checklist'
const EMPTY: Bucket = { solves: [], checks: [], templates: [] }

let writeQueue: Promise<unknown> = Promise.resolve()

async function readRow(): Promise<Bucket> {
  const record = await repositories.settings.get(KEY)
  const value = record?.value as Partial<Bucket> | undefined
  return {
    solves: value?.solves ?? [],
    checks: value?.checks ?? [],
    templates: value?.templates ?? []
  }
}

// Reads go through the same queue as writes. notimerChecklist.persistChecklist
// decides which checks are missing by reading first and then adding, and its caller
// does not await between toggles — so an unqueued read could observe a snapshot
// taken before an earlier toggle's insert had landed and re-add the same template,
// leaving two records for one checkbox. Queuing the read makes it observe every
// write already accepted.
async function read(): Promise<Bucket> {
  const next = writeQueue.then(readRow)
  writeQueue = next.catch(() => undefined)
  return next
}

// All three collections share one row, so a read-modify-write cycle is only safe
// against itself. The checklist fires its onChange handlers un-awaited, so ticking
// two boxes in quick succession starts a second cycle before the first has written
// back — both read the same bucket and the later write drops the earlier tick. Every
// mutation goes through this queue so the cycles run strictly one after another.


function mutate(change: (bucket: Bucket) => Bucket): Promise<void> {
  const next = writeQueue.then(async () => {
    const bucket = await readRow()
    await repositories.settings.put({ key: KEY, value: change(bucket) })
  })
  writeQueue = next.catch(() => undefined)
  return next
}

export function createNotimerChecklistStore(): NotimerChecklistStore {
  return {
    async getLastSolve() {
      const { solves } = await read()
      return [...solves].sort((a, b) => b.sequence - a.sequence)[0]
    },
    async getPreviousSolve(beforeSequence) {
      const { solves } = await read()
      return solves.filter((solve) => solve.sequence < beforeSequence).sort((a, b) => b.sequence - a.sequence)[0]
    },
    async getNextSolve(afterSequence) {
      const { solves } = await read()
      return solves.filter((solve) => solve.sequence > afterSequence).sort((a, b) => a.sequence - b.sequence)[0]
    },
    async putSolve(solve) {
      await mutate((bucket) => ({ ...bucket, solves: [...bucket.solves.filter((entry) => entry.id !== solve.id), solve] }))
    },
    async getChecksForSolve(solveId) {
      const { checks } = await read()
      return checks.filter((check) => check.notimerSolveId === solveId)
    },
    async addCheck(check) {
      // Idempotent on (solve, template). persistChecklist reads to decide what is
      // missing and then adds it, and its caller fires it without awaiting, so two
      // overlapping cycles can both read before either writes and both conclude the
      // same template is absent. Queuing the read cannot close that window — only the
      // decision and the write being one atomic step can, which is what this is.
      await mutate((bucket) => bucket.checks.some((entry) => entry.notimerSolveId === check.notimerSolveId && entry.checkTemplateId === check.checkTemplateId && entry.location === check.location)
        ? bucket
        : { ...bucket, checks: [...bucket.checks, check] })
    },
    async updateCheck(check) {
      await mutate((bucket) => ({ ...bucket, checks: bucket.checks.map((entry) => entry.id === check.id ? check : entry) }))
    },
    async deleteCheck(id) {
      await mutate((bucket) => ({ ...bucket, checks: bucket.checks.filter((check) => check.id !== id) }))
    },
    async getCheckTemplateById(id) {
      const { templates } = await read()
      return templates.find((template) => template.id === id)
    },
    async getCheckTemplateByText(text) {
      const { templates } = await read()
      return templates.find((template) => template.text === text)
    },
    async putCheckTemplate(template) {
      await mutate((bucket) => ({ ...bucket, templates: [...bucket.templates.filter((entry) => entry.id !== template.id), template] }))
    },
    nextId() {
      return createId()
    }
  }
}

export const EMPTY_NOTIMER_BUCKET = EMPTY
