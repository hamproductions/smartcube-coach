import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseDeviceSession, type DeviceSessionRecord } from './deviceRecorder'
import type { CubeEvent } from './inputSource'
import { sessionSource } from './sources'
import { FaceletReconciler } from '../domain/faceletReconciliation'
import { LiveCubeState } from '../domain/liveCubeState'
import { CaptureSession, type CompletedCapture } from './capture'
import { segmentCfop } from '../domain/reconstruction'
import { toEpochMs } from '../domain/ids'
import type { StageRecord } from '../domain/models'

const fixturesDir = join(__dirname, 'fixtures', 'user-sessions')
const fixtureFiles = readdirSync(fixturesDir).filter((name) => name.endsWith('.json')).sort()

type Mismatch = { packetIndex: number; expected: string; actual: string; pendingMoves: string[] }

type ReplayResult = {
  moveCount: number
  faceletCount: number
  firstMismatch?: Mismatch
  mismatchCount: number
  invalidFaceletCount: number
  unsupportedCount: number
  finalReconcileStatus?: string
  liveDisagreementCount: number
  firstLiveDisagreement?: { afterMoveIndex: number; expected: string; actual: string }
  scrambleReachedReady: boolean
  scrambleReadyAtMoveIndex?: number
  finalSessionStatus: string
  captures: CompletedCapture[]
  stagesByCaptureIndex: StageRecord[][]
  segmentCfopErrors: string[]
  inspectionBeginDateNow?: number
  solvingTransition?: { startedAt: number; inspectionPenalty?: string; gapFromInspectionBeginMs: number }
  wrongMoveFlashCount: number
  firstWrongMoveFlash?: { moveIndex: number; expected: string; actual: string }
  scrambleTargetLength?: number
}

// Mirrors LiveSolve.tsx's recordEvent (MOVE/FACELETS branches) plus importDeviceSession's
// post-event beginInspection check, driven through the real sessionSource replay path.
async function replayFixtureThroughRealPipeline(record: DeviceSessionRecord): Promise<ReplayResult> {
  const captures: CompletedCapture[] = []
  const session = new CaptureSession((capture) => { captures.push(capture) })
  const faceletReconciler = new FaceletReconciler()
  const liveCube = new LiveCubeState()

  let moveCount = 0
  let faceletCount = 0
  let firstMismatch: Mismatch | undefined
  let mismatchCount = 0
  let invalidFaceletCount = 0
  let unsupportedCount = 0
  let liveDisagreementCount = 0
  let firstLiveDisagreement: { afterMoveIndex: number; expected: string; actual: string } | undefined
  let scrambleReachedReady = false
  let scrambleReadyAtMoveIndex: number | undefined
  let packetIndex = -1
  let inspectionBeginDateNow: number | undefined
  let solvingTransition: { startedAt: number; inspectionPenalty?: string; gapFromInspectionBeginMs: number } | undefined
  let previousStatus = 'idle'
  let wrongMoveFlashCount = 0
  let firstWrongMoveFlash: { moveIndex: number; expected: string; actual: string } | undefined

  if (record.scramble) await session.setScramble(record.scramble)

  const handle = await sessionSource(record, { delayMs: 0 }).start(
    async (event: CubeEvent) => {
      packetIndex += 1

      if (event.type === 'MOVE') {
        moveCount += 1
        faceletReconciler.recordMove(event.move)
        liveCube.applyMove(event.move)
        await session.handleMove(event.move, event.cubeTimestamp ?? null, toEpochMs(event.timestamp))
        const snapshot = session.snapshot
        if (snapshot.wrongMove) {
          wrongMoveFlashCount += 1
          if (!firstWrongMoveFlash) firstWrongMoveFlash = { moveIndex: moveCount, expected: snapshot.expectedMove ?? '', actual: snapshot.wrongMove }
        }
        if (!scrambleReachedReady && snapshot.status === 'ready') {
          scrambleReachedReady = true
          scrambleReadyAtMoveIndex = moveCount
        }
        if (previousStatus !== 'solving' && snapshot.status === 'solving') {
          solvingTransition = {
            startedAt: snapshot.startedAt ?? -1,
            inspectionPenalty: snapshot.inspectionPenalty,
            gapFromInspectionBeginMs: inspectionBeginDateNow === undefined ? Number.NaN : (snapshot.startedAt ?? 0) - inspectionBeginDateNow
          }
        }
        previousStatus = snapshot.status
      }

      if (event.type === 'FACELETS') {
        faceletCount += 1
        let reconciliation = faceletReconciler.reconcile(event.facelets)
        if (reconciliation.status === 'mismatch') {
          mismatchCount += 1
          if (!firstMismatch) {
            firstMismatch = {
              packetIndex,
              expected: reconciliation.expected ?? '',
              actual: reconciliation.actual ?? '',
              pendingMoves: reconciliation.pendingMoves
            }
          }
          faceletReconciler.resync(event.facelets)
          reconciliation = { status: 'baseline', pendingMoves: [] }
        }
        if (reconciliation.status === 'invalid') invalidFaceletCount += 1
        if (reconciliation.status === 'unsupported') unsupportedCount += 1

        const before = liveCube.snapshot.lastDisagreement
        const adopted = liveCube.adopt(event.facelets)
        if (adopted.lastDisagreement && adopted.lastDisagreement !== before) {
          liveDisagreementCount += 1
          if (!firstLiveDisagreement) {
            firstLiveDisagreement = { afterMoveIndex: moveCount, expected: adopted.lastDisagreement.expected, actual: adopted.lastDisagreement.actual }
          }
        }
      }

      if (record.scramble && session.snapshot.status === 'ready') {
        inspectionBeginDateNow = Date.now()
        session.beginInspection(inspectionBeginDateNow)
      }
    },
    () => undefined
  )
  await handle.done

  const stagesByCaptureIndex: StageRecord[][] = []
  const segmentCfopErrors: string[] = []
  for (const [captureIndex, capture] of captures.entries()) {
    try {
      stagesByCaptureIndex.push(await segmentCfop(capture.scramble, capture.events, `${captureIndex}`))
    } catch (error) {
      segmentCfopErrors.push(error instanceof Error ? error.message : String(error))
      stagesByCaptureIndex.push([])
    }
  }

  return {
    moveCount,
    faceletCount,
    firstMismatch,
    mismatchCount,
    invalidFaceletCount,
    unsupportedCount,
    finalReconcileStatus: faceletReconciler.reconcileStatus,
    liveDisagreementCount,
    firstLiveDisagreement,
    scrambleReachedReady,
    scrambleReadyAtMoveIndex,
    finalSessionStatus: session.snapshot.status,
    captures,
    stagesByCaptureIndex,
    segmentCfopErrors,
    inspectionBeginDateNow,
    solvingTransition,
    wrongMoveFlashCount,
    firstWrongMoveFlash,
    scrambleTargetLength: record.scramble ? record.scramble.split(/\s+/).filter(Boolean).length : undefined
  }
}

describe('real hardware capture replay', () => {
  it('has all eight fixture files', () => {
    expect(fixtureFiles.length).toBe(8)
  })

  for (const file of fixtureFiles) {
    it(`replays ${file} through the real capture pipeline`, async () => {
      const text = readFileSync(join(fixturesDir, file), 'utf8')
      const record = parseDeviceSession(text)

      expect(record.device.protocol).toBe('QiYi')
      expect(record.events.length).toBeGreaterThan(0)

      const result = await replayFixtureThroughRealPipeline(record)

      console.log(`\n=== ${file} ===`)
      console.log('scramble:', record.scramble ?? '(none recorded)')
      console.log('moveCount:', result.moveCount, 'faceletCount:', result.faceletCount)
      console.log('firstMismatch:', JSON.stringify(result.firstMismatch))
      console.log('mismatchCount:', result.mismatchCount, 'invalidFaceletCount:', result.invalidFaceletCount, 'unsupportedCount:', result.unsupportedCount)
      console.log('finalReconcileStatus:', result.finalReconcileStatus)
      console.log('liveDisagreementCount:', result.liveDisagreementCount, 'firstLiveDisagreement:', JSON.stringify(result.firstLiveDisagreement))
      console.log('scrambleReachedReady:', result.scrambleReachedReady, 'atMoveIndex:', result.scrambleReadyAtMoveIndex, 'scrambleTargetLength:', result.scrambleTargetLength)
      console.log('wrongMoveFlashCount:', result.wrongMoveFlashCount, 'firstWrongMoveFlash:', JSON.stringify(result.firstWrongMoveFlash))
      console.log('inspectionBeginDateNow:', result.inspectionBeginDateNow, 'solvingTransition:', JSON.stringify(result.solvingTransition))
      console.log('finalSessionStatus:', result.finalSessionStatus)
      console.log('captures:', result.captures.length)
      for (const [index, capture] of result.captures.entries()) {
        console.log(`  capture[${index}] moves=${capture.moves.length} startedAt=${capture.startedAt} endedAt=${capture.endedAt} durationMs=${capture.endedAt - capture.startedAt} penalty=${capture.penalty}`)
        const stages = result.stagesByCaptureIndex[index]
        console.log(`  capture[${index}] stages=${stages.map((stage) => `${stage.name}:${stage.moveCount}mv/conf${stage.confidence}`).join(' | ')}`)
      }
      if (result.segmentCfopErrors.length) console.log('segmentCfopErrors:', result.segmentCfopErrors)

      expect(record.events.length).toBeGreaterThan(0)
    }, 60_000)
  }
})
