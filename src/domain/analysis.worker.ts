import { segmentCfop, type TimestampedMove } from './reconstruction'
import type { StageRecord } from './models'

/**
 * The CFOP analysis, off the main thread.
 *
 * Segmenting a solve searches for optimal cross-plus-pair solutions and recognises the last
 * layer, and it ran on the main thread the instant a solve finished — a single block long
 * enough to drop frames and to stall the very event loop that receives the next turns. The
 * work is pure: a scramble, a move stream, an id in; stage records out.
 */
export type AnalysisRequest = {
  id: number
  scramble: string
  events: TimestampedMove[]
  solveId: string
}

export type AnalysisResponse =
  | { id: number; ok: true; stages: StageRecord[] }
  | { id: number; ok: false; error: string }

self.addEventListener('message', (event: MessageEvent<AnalysisRequest>) => {
  const { id, scramble, events, solveId } = event.data
  void segmentCfop(scramble, events, solveId)
    .then((stages) => { self.postMessage({ id, ok: true, stages } satisfies AnalysisResponse) })
    .catch((error: unknown) => {
      self.postMessage({ id, ok: false, error: error instanceof Error ? error.message : String(error) } satisfies AnalysisResponse)
    })
})
