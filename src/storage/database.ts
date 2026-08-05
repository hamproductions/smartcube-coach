import { deleteDB, openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type {
  AlgorithmRecord,
  FindingRecord,
  KeyValueRecord,
  MetricSample,
  PrescriptionRecord,
  RawCubeEvent,
  ReconstructionRevision,
  SessionRecord,
  SolveRecord,
  StageRecord,
  StudyRecord,
  TrainerAttempt,
  TransferEvaluation
} from '../domain/models'
import { createDefaultSession, solveIdsNeedingMigration } from '../domain/sessions'

interface SmartCubeCoachDatabase extends DBSchema {
  rawEvents: { key: string; value: RawCubeEvent; indexes: { 'by-solve': string } }
  solves: { key: string; value: SolveRecord; indexes: { 'by-ended': number } }
  stages: { key: string; value: StageRecord; indexes: { 'by-solve': string } }
  findings: { key: string; value: FindingRecord }
  attempts: { key: string; value: TrainerAttempt; indexes: { 'by-family': string } }
  algorithms: { key: string; value: AlgorithmRecord; indexes: { 'by-set': string } }
  studies: { key: string; value: StudyRecord }
  revisions: { key: string; value: ReconstructionRevision; indexes: { 'by-solve': string } }
  metrics: { key: string; value: MetricSample; indexes: { 'by-metric': string } }
  prescriptions: { key: string; value: PrescriptionRecord; indexes: { 'by-status': string } }
  transfers: { key: string; value: TransferEvaluation; indexes: { 'by-prescription': string } }
  settings: { key: string; value: KeyValueRecord }
  meta: { key: string; value: KeyValueRecord }
  sessions: { key: string; value: SessionRecord; indexes: { 'by-created': number } }
}

const databaseName = 'smart-cube-coach'
let databasePromise: Promise<IDBPDatabase<SmartCubeCoachDatabase>> | undefined

function getDatabase() {
  databasePromise ??= openDB<SmartCubeCoachDatabase>(databaseName, 5, {
    upgrade(database, oldVersion, _newVersion, transaction) {
      if (oldVersion < 1) {
        const rawEvents = database.createObjectStore('rawEvents', { keyPath: 'id' })
        rawEvents.createIndex('by-solve', 'solveId')
        const solves = database.createObjectStore('solves', { keyPath: 'id' })
        solves.createIndex('by-ended', 'endedAt')
        const stages = database.createObjectStore('stages', { keyPath: 'id' })
        stages.createIndex('by-solve', 'solveId')
        database.createObjectStore('findings', { keyPath: 'id' })
        const attempts = database.createObjectStore('attempts', { keyPath: 'id' })
        attempts.createIndex('by-family', 'family')
        const algorithms = database.createObjectStore('algorithms', { keyPath: 'id' })
        algorithms.createIndex('by-set', 'set')
        database.createObjectStore('studies', { keyPath: 'id' })
      }
      if (oldVersion >= 1 && oldVersion < 2) {
        const attempts = transaction.objectStore('attempts')
        if (attempts.indexNames.contains('by-trainer' as never)) attempts.deleteIndex('by-trainer' as never)
        if (!attempts.indexNames.contains('by-family')) attempts.createIndex('by-family', 'family')
      }
      if (oldVersion < 2) {
        const revisions = database.createObjectStore('revisions', { keyPath: 'id' })
        revisions.createIndex('by-solve', 'solveId')
        const metrics = database.createObjectStore('metrics', { keyPath: 'id' })
        metrics.createIndex('by-metric', 'metric')
      }
      if (oldVersion < 3) {
        database.createObjectStore('settings', { keyPath: 'key' })
        database.createObjectStore('meta', { keyPath: 'key' })
      }
      if (oldVersion < 4) {
        const prescriptions = database.createObjectStore('prescriptions', { keyPath: 'id' })
        prescriptions.createIndex('by-status', 'status')
        const transfers = database.createObjectStore('transfers', { keyPath: 'id' })
        transfers.createIndex('by-prescription', 'prescriptionId')
      }
      if (oldVersion < 5) {
        const sessions = database.createObjectStore('sessions', { keyPath: 'id' })
        sessions.createIndex('by-created', 'createdAt')
        transaction.objectStore('meta').put({ key: 'needsSessionMigration', value: true })
      }
      transaction.objectStore('meta').put({ key: 'schemaVersion', value: 5 })
      transaction.objectStore('meta').put({ key: 'analysisVersion', value: '1' })
    }
  }).then(async (database) => {
    const flag = await database.get('meta', 'needsSessionMigration')
    if (flag?.value) {
      await migrateDefaultSession(database)
      await database.put('meta', { key: 'needsSessionMigration', value: false })
    }
    return database
  })
  return databasePromise
}

async function migrateDefaultSession(database: IDBPDatabase<SmartCubeCoachDatabase>) {
  const existingSessions = await database.getAll('sessions')
  const defaultSession = existingSessions.find((session) => session.id === 'default') ?? createDefaultSession(Date.now())
  await database.put('sessions', defaultSession)
  const knownSessionIds = new Set([...existingSessions.map((session) => session.id), defaultSession.id])
  const solves = await database.getAll('solves')
  const migratedIds = new Set(solveIdsNeedingMigration(solves, knownSessionIds))
  await Promise.all(
    solves
      .filter((solve) => migratedIds.has(solve.id))
      .map((solve) => database.put('solves', { ...solve, sessionId: defaultSession.id }))
  )
}

type StoreName = keyof SmartCubeCoachDatabase & string

type Repository<T> = {
  get(id: string): Promise<T | undefined>
  put(value: T): Promise<T>
  all(): Promise<T[]>
  remove(id: string): Promise<void>
  clear(): Promise<void>
}

const store = <T>(name: StoreName): Repository<T> => ({
  async get(id: string) {
    return (await (await getDatabase()).get(name as never, id as never)) as T | undefined
  },
  async put(value: T) {
    await (await getDatabase()).put(name as never, value as never)
    return value
  },
  async all() {
    return (await (await getDatabase()).getAll(name as never)) as T[]
  },
  async remove(id: string) {
    await (await getDatabase()).delete(name as never, id as never)
  },
  async clear() {
    await (await getDatabase()).clear(name as never)
  }
})

const rawEvents = {
  ...store<RawCubeEvent>('rawEvents'),
  async forSolve(solveId: string) {
    return (await getDatabase()).getAllFromIndex('rawEvents', 'by-solve', solveId)
  }
}

const stages = {
  ...store<StageRecord>('stages'),
  async forSolve(solveId: string) {
    return (await getDatabase()).getAllFromIndex('stages', 'by-solve', solveId)
  }
}

export const repositories = {
  rawEvents,
  solves: store<SolveRecord>('solves'),
  stages,
  findings: store<FindingRecord>('findings'),
  attempts: store<TrainerAttempt>('attempts'),
  algorithms: store<AlgorithmRecord>('algorithms'),
  studies: store<StudyRecord>('studies'),
  revisions: store<ReconstructionRevision>('revisions'),
  metrics: store<MetricSample>('metrics'),
  prescriptions: store<PrescriptionRecord>('prescriptions'),
  transfers: store<TransferEvaluation>('transfers'),
  settings: store<KeyValueRecord>('settings'),
  meta: store<KeyValueRecord>('meta'),
  sessions: store<SessionRecord>('sessions')
}

export async function clearDatabase() {
  if (databasePromise) (await databasePromise).close()
  databasePromise = undefined
  await deleteDB(databaseName)
}
