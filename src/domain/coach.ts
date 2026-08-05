import type { Finding } from './analyzeSolve'
import { buildPrescription, type PrescriptionScope } from './prescribe'
import type { MetricSample, PrescriptionRecord, TransferEvaluation } from './models'
import { createId } from './ids'

const median = (values: number[]) => {
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

const seedRandom = (seed: string) => {
  let state = [...seed].reduce((value, character) => Math.imul(value ^ character.charCodeAt(0), 16777619), 2166136261) >>> 0
  return () => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    return (state >>> 0) / 2 ** 32
  }
}

export function createPrescriptionRecord(finding: Finding, createdAt = Date.now(), scope: PrescriptionScope = {}): PrescriptionRecord {
  const prescription = buildPrescription(finding, scope)
  return {
    id: createId(),
    findingId: finding.id,
    metric: prescription.passCondition.metric,
    target: prescription.passCondition.target,
    sampleSize: prescription.passCondition.fullSolveSample,
    status: 'assigned',
    title: prescription.title,
    blocks: prescription.blocks.map((block, index) => ({
      id: `${finding.id}:block-${index + 1}`,
      kind: block.kind === 'tracking' ? 'planning' : block.kind === 'prediction' ? 'recognition' : block.kind,
      title: block.label,
      dose: block.dose,
      passCondition: block.target,
      evidenceIds: []
    })),
    transfer: {
      direction: 'lower',
      baselineSampleSize: prescription.passCondition.fullSolveSample,
      postSampleSize: prescription.passCondition.fullSolveSample,
      minimumConfidence: 0.8,
      minimumDataQuality: 0.8
    },
    createdAt
  }
}

function completePrescriptionBlock(record: PrescriptionRecord, blockId: string, evidenceIds: string[], completedAt = Date.now()): PrescriptionRecord {
  const blocks = record.blocks.map((block) => block.id === blockId ? { ...block, completedAt, evidenceIds } : block)
  const transferReady = blocks.filter((block) => block.kind !== 'transfer').every((block) => block.completedAt)
  return { ...record, blocks, status: transferReady ? 'transfer' : 'training' }
}

export function evaluatePrescriptionTransfer(record: PrescriptionRecord, samples: MetricSample[]): TransferEvaluation {
  const eligible = samples
    .filter((sample) => sample.metric === record.metric && sample.confidence >= record.transfer.minimumDataQuality)
    .sort((left, right) => left.occurredAt - right.occurredAt)
  const baseline = eligible.filter((sample) => sample.occurredAt < record.createdAt).slice(-record.transfer.baselineSampleSize)
  const post = eligible.filter((sample) => sample.occurredAt >= record.createdAt).slice(0, record.transfer.postSampleSize)
  const baselineMedian = baseline.length ? median(baseline.map((sample) => sample.value)) : 0
  const postMedian = post.length ? median(post.map((sample) => sample.value)) : undefined
  const effect = postMedian === undefined ? undefined : record.transfer.direction === 'lower' ? baselineMedian - postMedian : postMedian - baselineMedian
  let confidence: number | undefined

  if (baseline.length === record.transfer.baselineSampleSize && post.length === record.transfer.postSampleSize) {
    const random = seedRandom(record.id)
    let wins = 0
    const iterations = 1000
    for (let iteration = 0; iteration < iterations; iteration += 1) {
      const baselineSample = Array.from({ length: baseline.length }, () => baseline[Math.floor(random() * baseline.length)].value)
      const postSample = Array.from({ length: post.length }, () => post[Math.floor(random() * post.length)].value)
      const delta = record.transfer.direction === 'lower' ? median(baselineSample) - median(postSample) : median(postSample) - median(baselineSample)
      if (delta > 0) wins += 1
    }
    confidence = wins / iterations
  }

  const targetReached = postMedian !== undefined && (record.transfer.direction === 'lower' ? postMedian <= record.target : postMedian >= record.target)
  const complete = post.length === record.transfer.postSampleSize && baseline.length === record.transfer.baselineSampleSize
  const status = !complete
    ? 'collecting'
    : targetReached && (confidence ?? 0) >= record.transfer.minimumConfidence
      ? 'passed'
      : 'not-demonstrated'

  return {
    id: createId(),
    prescriptionId: record.id,
    evaluatedAt: Date.now(),
    evaluatorVersion: '1',
    status,
    baselineSourceIds: baseline.map((sample) => sample.sourceId),
    postSourceIds: post.map((sample) => sample.sourceId),
    baselineMedian,
    postMedian,
    effect,
    confidence
  }
}
