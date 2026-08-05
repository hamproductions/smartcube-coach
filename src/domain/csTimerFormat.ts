import { createId } from './ids'
import { ANALYSIS_VERSION, type SolveRecord } from './models'

const DELIMITER = ';'
const HEADER = ['No.', 'Time', 'Comment', 'Scramble', 'Date', 'P.1']

export type CsTimerImportSkip = { line: number; reason: string }

export type CsTimerImportResult = {
  solves: SolveRecord[]
  skipped: CsTimerImportSkip[]
}

function escapeField(value: string) {
  if (value.includes(DELIMITER) || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function splitFields(line: string) {
  const fields: string[] = []
  let current = ''
  let inQuotes = false
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    if (inQuotes) {
      if (char === '"') {
        if (line[index + 1] === '"') {
          current += '"'
          index += 1
        } else {
          inQuotes = false
        }
      } else {
        current += char
      }
    } else if (char === '"') {
      inQuotes = true
    } else if (char === DELIMITER) {
      fields.push(current)
      current = ''
    } else {
      current += char
    }
  }
  fields.push(current)
  return fields
}

function splitLines(text: string) {
  const lines = text.split(/\r\n|\r|\n/)
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop()
  return lines
}

function formatSeconds(ms: number) {
  return (ms / 1000).toFixed(2)
}

function formatTimeField(solve: SolveRecord) {
  const rawMs = solve.endedAt - solve.startedAt
  if (solve.penalty === 'dnf') return `DNF(${formatSeconds(rawMs)})`
  if (solve.penalty === '+2') return `${formatSeconds(rawMs + 2_000)}+`
  return formatSeconds(rawMs)
}

function parseTimeField(raw: string): { rawMs: number; penalty: SolveRecord['penalty'] } | undefined {
  const trimmed = raw.trim()
  const dnfMatch = trimmed.match(/^DNF\(([0-9.]+)\)$/)
  if (dnfMatch) {
    const seconds = Number(dnfMatch[1])
    if (!Number.isFinite(seconds)) return undefined
    return { rawMs: Math.round(seconds * 1000), penalty: 'dnf' }
  }
  if (trimmed.endsWith('+')) {
    const seconds = Number(trimmed.slice(0, -1))
    if (!Number.isFinite(seconds)) return undefined
    return { rawMs: Math.round(seconds * 1000) - 2_000, penalty: '+2' }
  }
  const seconds = Number(trimmed)
  if (!Number.isFinite(seconds)) return undefined
  return { rawMs: Math.round(seconds * 1000), penalty: 'none' }
}

export function exportCsTimerCsv(solves: SolveRecord[]) {
  const rows = solves.map((solve, index) => [
    String(index + 1),
    formatTimeField(solve),
    solve.comment ?? '',
    solve.scramble,
    String(Math.round(solve.endedAt / 1000)),
    ''
  ].map(escapeField).join(DELIMITER))
  return [HEADER.join(DELIMITER), ...rows].join('\r\n')
}

export function importCsTimerCsv(text: string, sessionId: string): CsTimerImportResult {
  const lines = splitLines(text)
  const solves: SolveRecord[] = []
  const skipped: CsTimerImportSkip[] = []

  if (lines.length === 0) return { solves, skipped }

  const header = splitFields(lines[0]).map((field) => field.trim().toLowerCase())
  const timeIdx = header.indexOf('time')
  const scrambleIdx = header.indexOf('scramble')
  const dateIdx = header.indexOf('date')
  const commentIdx = header.indexOf('comment')

  if (timeIdx === -1 || scrambleIdx === -1 || dateIdx === -1) {
    skipped.push({ line: 1, reason: 'header is missing required Time, Scramble or Date column' })
    return { solves, skipped }
  }

  for (let rowIndex = 1; rowIndex < lines.length; rowIndex += 1) {
    const line = lines[rowIndex]
    const lineNumber = rowIndex + 1
    if (line.trim() === '') continue

    const fields = splitFields(line)
    const requiredMax = Math.max(timeIdx, scrambleIdx, dateIdx)
    if (fields.length <= requiredMax) {
      skipped.push({ line: lineNumber, reason: `expected at least ${requiredMax + 1} columns, found ${fields.length}` })
      continue
    }

    const parsedTime = parseTimeField(fields[timeIdx])
    if (!parsedTime) {
      skipped.push({ line: lineNumber, reason: `unparseable Time field: "${fields[timeIdx]}"` })
      continue
    }

    const dateSeconds = Number(fields[dateIdx].trim())
    if (!Number.isFinite(dateSeconds)) {
      skipped.push({ line: lineNumber, reason: `unparseable Date field: "${fields[dateIdx]}"` })
      continue
    }

    const endedAt = Math.round(dateSeconds * 1000)
    const startedAt = endedAt - parsedTime.rawMs
    const comment = commentIdx === -1 ? undefined : (fields[commentIdx] || undefined)

    solves.push({
      id: createId(),
      sessionId,
      puzzle: '3x3x3',
      scramble: fields[scrambleIdx],
      scrambleGenerator: 'cstimer-import',
      startedAt,
      endedAt,
      penalty: parsedTime.penalty,
      analysisVersion: ANALYSIS_VERSION,
      rawEventIds: [],
      moves: [],
      source: 'keyboard',
      stateVerified: false,
      verificationDetail: 'imported from csTimer CSV, no move stream available',
      comment
    })
  }

  return { solves, skipped }
}
