import { segmentCfop, type TimestampedMove } from './reconstruction'
import type { StageRecord } from './models'
import type { AnalysisRequest, AnalysisResponse } from './analysis.worker'

/**
 * Runs the CFOP analysis in a worker, falling back to this thread where workers do not exist
 * (tests, and any browser that refuses one). The fallback is the same function, so behaviour
 * is identical either way — only the thread it occupies changes.
 */
let worker: Worker | undefined
let nextId = 1
const pending = new Map<number, { resolve: (stages: StageRecord[]) => void; reject: (reason: Error) => void }>()

function ensureWorker() {
  if (worker !== undefined) return worker
  if (typeof Worker === 'undefined') return undefined
  try {
    worker = new Worker(new URL('./analysis.worker.ts', import.meta.url), { type: 'module' })
    worker.addEventListener('message', (event: MessageEvent<AnalysisResponse>) => {
      const waiting = pending.get(event.data.id)
      if (!waiting) return
      pending.delete(event.data.id)
      if (event.data.ok) waiting.resolve(event.data.stages)
      else waiting.reject(new Error(event.data.error))
    })
    // A worker that dies must not leave the caller waiting forever: every request in flight
    // falls back to this thread rather than losing the solve's analysis.
    worker.addEventListener('error', () => {
      for (const [id, waiting] of pending) {
        pending.delete(id)
        waiting.reject(new Error('analysis worker failed'))
      }
      worker = undefined
    })
    return worker
  } catch {
    return undefined
  }
}

export async function analyseSolve(scramble: string, events: TimestampedMove[], solveId: string): Promise<StageRecord[]> {
  const active = ensureWorker()
  if (!active) return segmentCfop(scramble, events, solveId)

  const id = nextId++
  try {
    return await new Promise<StageRecord[]>((resolve, reject) => {
      pending.set(id, { resolve, reject })
      active.postMessage({ id, scramble, events, solveId } satisfies AnalysisRequest)
    })
  } catch {
    return segmentCfop(scramble, events, solveId)
  }
}

export function warmAnalysis() {
  void analyseSolve('R', [{ move: "R'", timestamp: 0 }], 'warm-up').catch(() => undefined)
}
