import type { CubeEvent } from './inputSource'
import { FaceletReconciler, isSolvedFacelets } from '../domain/faceletReconciliation'

export type CheckStatus = 'pass' | 'fail' | 'pending' | 'unsupported'

export type ConnectionCheck = {
  id: string
  label: string
  status: CheckStatus
  detail: string
}

export type SelfTestInput = {
  supportsWebBluetooth: boolean
  secureContext: boolean
  adapterAvailable?: boolean
  origin?: string
  capabilities?: { facelets?: boolean; battery?: boolean; hardware?: boolean; gyro?: boolean }
  events: CubeEvent[]
}

const latencies = (events: CubeEvent[]) => {
  const moves = events.filter((event): event is Extract<CubeEvent, { type: 'MOVE' }> => event.type === 'MOVE')
  const gaps = moves.slice(1).map((event, index) => event.timestamp - moves[index].timestamp).filter((gap) => gap > 0)
  return gaps.sort((left, right) => left - right)
}

export function runConnectionSelfTest(input: SelfTestInput): ConnectionCheck[] {
  const checks: ConnectionCheck[] = []
  const moves = input.events.filter((event) => event.type === 'MOVE')
  const facelets = input.events.filter((event): event is Extract<CubeEvent, { type: 'FACELETS' }> => event.type === 'FACELETS')

  checks.push({
    id: 'browser',
    label: 'Browser support',
    status: input.supportsWebBluetooth ? 'pass' : 'fail',
    detail: input.supportsWebBluetooth
      ? 'Web Bluetooth is available'
      : input.secureContext
        ? 'This browser has no Web Bluetooth. Use Chrome, Edge or another Chromium browser on desktop or Android.'
        : 'Web Bluetooth is hidden because this page is not a secure origin — see the next check.'
  })

  checks.push({
    id: 'secure',
    label: 'Secure context',
    status: input.secureContext ? 'pass' : 'fail',
    detail: input.secureContext
      ? 'Page is https or localhost'
      : `Bluetooth needs https or localhost. ${input.origin ?? 'This origin'} is plain http, so no cube can be selected. Open the app on localhost, deploy it over https, or allow this exact origin under chrome://flags/#unsafely-treat-insecure-origin-as-secure.`
  })

  if (input.supportsWebBluetooth) {
    checks.push({
      id: 'adapter',
      label: 'Bluetooth adapter',
      status: input.adapterAvailable === undefined ? 'pending' : input.adapterAvailable ? 'pass' : 'fail',
      detail: input.adapterAvailable === undefined
        ? 'Adapter availability not checked yet'
        : input.adapterAvailable
          ? 'The browser reports a usable Bluetooth adapter'
          : 'The browser sees no usable adapter — switch Bluetooth on in system settings, then run this again'
    })
  }

  checks.push({
    id: 'moves',
    label: 'Move packets',
    status: moves.length ? 'pass' : 'pending',
    detail: moves.length ? `${moves.length} turns received` : 'Turn a face to send the first move'
  })

  if (!input.capabilities?.facelets) {
    checks.push({ id: 'facelets', label: 'Sticker state', status: 'unsupported', detail: 'This cube does not report facelets' })
  } else if (!facelets.length) {
    checks.push({ id: 'facelets', label: 'Sticker state', status: 'pending', detail: 'Waiting for the first facelet packet' })
  } else {
    const reconciler = new FaceletReconciler()
    let mismatch = false
    for (const event of input.events) {
      if (event.type === 'MOVE') reconciler.recordMove(event.move)
      if (event.type === 'FACELETS') {
        const status = reconciler.reconcile(event.facelets).status
        if (status !== 'baseline' && status !== 'verified') mismatch = true
      }
    }
    checks.push({
      id: 'facelets',
      label: 'Sticker state',
      status: mismatch ? 'fail' : 'pass',
      detail: mismatch
        ? 'Stickers disagreed with the move stream — resync with the cube solved'
        : `${facelets.length} snapshots agreed with every turn`
    })
    checks.push({
      id: 'solved',
      label: 'Solved detection',
      status: facelets.some((event) => isSolvedFacelets(event.facelets)) ? 'pass' : 'pending',
      detail: facelets.some((event) => isSolvedFacelets(event.facelets)) ? 'Recognised a solved cube' : 'Solve the cube once to confirm detection'
    })
  }

  const gaps = latencies(input.events)
  checks.push({
    id: 'latency',
    label: 'Packet latency',
    status: gaps.length < 3 ? 'pending' : gaps[Math.floor(gaps.length / 2)] < 1_000 ? 'pass' : 'fail',
    detail: gaps.length < 3
      ? 'Turn a few faces quickly to measure delivery'
      : `median ${Math.round(gaps[Math.floor(gaps.length / 2)])} ms between turns, slowest ${Math.round(gaps.at(-1)!)} ms`
  })

  checks.push({
    id: 'battery',
    label: 'Battery',
    status: !input.capabilities?.battery ? 'unsupported' : input.events.some((event) => event.type === 'BATTERY') ? 'pass' : 'pending',
    detail: !input.capabilities?.battery ? 'This cube does not report battery' : input.events.some((event) => event.type === 'BATTERY') ? 'Battery packet received' : 'Waiting for a battery packet'
  })

  checks.push({
    id: 'gyro',
    label: 'Gyroscope',
    status: !input.capabilities?.gyro ? 'unsupported' : input.events.some((event) => event.type === 'GYRO') ? 'pass' : 'pending',
    detail: !input.capabilities?.gyro ? 'This cube has no gyroscope — analysis never depends on it' : 'Orientation packets received'
  })

  return checks
}

export type SelfTestRecord = {
  ranAt: number
  device: string
  protocol: string
  verdict: 'pass' | 'fail' | 'pending'
  simulated: boolean
  checks: ConnectionCheck[]
}

export function diagnosticsText(input: {
  device?: { name: string; mac: string; protocol: string }
  capabilities?: Record<string, unknown>
  checks: ConnectionCheck[]
  packets?: { moves: number; facelets: number; total: number }
  diagnostics?: string[]
  origin?: string
  simulated?: boolean
}) {
  const lines = [
    'Smart Cube Coach diagnostics',
    `origin: ${input.origin ?? 'unknown'}${input.simulated ? ' (recorded device, not hardware)' : ''}`,
    input.device
      ? `device: ${input.device.name.trim() || 'unnamed'} · ${input.device.protocol} · MAC ${input.device.mac || 'not reported'}`
      : 'device: none connected',
    `capabilities: ${input.capabilities ? Object.entries(input.capabilities).filter(([, value]) => typeof value === 'boolean').map(([key, value]) => `${key}=${value ? 'yes' : 'no'}`).join(' ') || 'none reported' : 'unknown'}`,
    input.packets ? `packets: ${input.packets.total} total, ${input.packets.moves} moves, ${input.packets.facelets} facelets` : 'packets: none recorded',
    `verdict: ${selfTestVerdict(input.checks)}`,
    ...input.checks.map((check) => `  ${check.status.toUpperCase().padEnd(11)} ${check.label} — ${check.detail}`)
  ]
  if (input.diagnostics?.length) lines.push('errors:', ...input.diagnostics.map((entry) => `  ${entry}`))
  return lines.join('\n')
}

export function selfTestVerdict(checks: ConnectionCheck[]) {
  if (checks.some((check) => check.status === 'fail')) return 'fail' as const
  if (checks.some((check) => check.status === 'pending')) return 'pending' as const
  return 'pass' as const
}
