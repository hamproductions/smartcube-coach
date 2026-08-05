import type { SmartCubeCoachBackup } from '../domain/models'
import { exportCsTimerCsv, importCsTimerCsv } from '../domain/csTimerFormat'
import { clearDatabase, repositories } from './database'

export async function exportAllData(): Promise<SmartCubeCoachBackup> {
  const [
    rawEvents,
    solves,
    stages,
    findings,
    attempts,
    algorithms,
    studies,
    revisions,
    metrics,
    prescriptions,
    transfers,
    settings,
    meta
  ] = await Promise.all([
    repositories.rawEvents.all(),
    repositories.solves.all(),
    repositories.stages.all(),
    repositories.findings.all(),
    repositories.attempts.all(),
    repositories.algorithms.all(),
    repositories.studies.all(),
    repositories.revisions.all(),
    repositories.metrics.all(),
    repositories.prescriptions.all(),
    repositories.transfers.all(),
    repositories.settings.all(),
    repositories.meta.all()
  ])

  return {
    format: 'smartcube-coach-backup',
    exportVersion: 1,
    schemaVersion: 4,
    analysisVersion: '1',
    exportedAt: Date.now(),
    rawEvents,
    solves,
    stages,
    findings,
    attempts,
    algorithms,
    studies,
    revisions,
    metrics,
    prescriptions,
    transfers,
    settings,
    meta
  }
}

export async function importAllData(backup: SmartCubeCoachBackup) {
  if (backup.format !== 'smartcube-coach-backup' || backup.exportVersion !== 1 || backup.schemaVersion !== 4 || backup.analysisVersion !== '1') {
    throw new Error('Unsupported Smart Cube Coach backup version')
  }

  await clearDatabase()
  await Promise.all([
    ...backup.rawEvents.map(repositories.rawEvents.put),
    ...backup.solves.map(repositories.solves.put),
    ...backup.stages.map(repositories.stages.put),
    ...backup.findings.map(repositories.findings.put),
    ...backup.attempts.map(repositories.attempts.put),
    ...backup.algorithms.map(repositories.algorithms.put),
    ...backup.studies.map(repositories.studies.put),
    ...backup.revisions.map(repositories.revisions.put),
    ...backup.metrics.map(repositories.metrics.put),
    ...backup.prescriptions.map(repositories.prescriptions.put),
    ...backup.transfers.map(repositories.transfers.put),
    ...backup.settings.map(repositories.settings.put),
    ...backup.meta.map(repositories.meta.put)
  ])
}

export function downloadBackup(backup: SmartCubeCoachBackup) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `smart-cube-coach-backup-${new Date(backup.exportedAt).toISOString().slice(0, 10)}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}

export async function exportSessionAsCsTimerCsv(sessionId: string) {
  const solves = (await repositories.solves.all()).filter((solve) => solve.sessionId === sessionId)
  return exportCsTimerCsv(solves)
}

export async function importSessionFromCsTimerCsv(text: string, sessionId: string) {
  const result = importCsTimerCsv(text, sessionId)
  await Promise.all(result.solves.map(repositories.solves.put))
  return result
}

export function downloadCsTimerCsv(csv: string, sessionId: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `smart-cube-coach-${sessionId}-cstimer.csv`
  anchor.click()
  URL.revokeObjectURL(url)
}
