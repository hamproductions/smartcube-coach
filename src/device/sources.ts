import type { CubeEvent } from './inputSource'
import { simulateCfopSolve, type SimulatedSolve } from '../domain/cfopSimulation'
import type { CubeInputHandle, CubeInputSource } from './inputSource'
import type { DeviceSessionRecord } from './deviceRecorder'
import { connectWebCube } from './webBluetooth'
import { installRecordedCube, replayRecordedEvents, requestedRecording } from './replayCube'

const idle = async () => undefined

export function bluetoothSource(options: { manualMac?: string; anyDevice?: boolean; requestInitialState?: boolean; fixture?: string } = {}): CubeInputSource {
  return {
    id: 'bluetooth',
    label: 'Smart cube over Bluetooth',
    async start(onEvent, onStatus) {
      const recording = options.fixture ?? requestedRecording()
      const recorded = recording ? await installRecordedCube(recording) : undefined
      const cube = await connectWebCube(onEvent, onStatus, {
        ...options,
        manualMac: recorded?.mac ?? options.manualMac,
        requestInitialState: recorded ? false : options.requestInitialState
      })
      const done = recorded ? replayRecordedEvents(recorded, onEvent) : undefined
      return {
        done,
        name: cube.name,
        protocol: cube.protocol,
        mac: cube.mac,
        capabilities: cube.capabilities as CubeInputHandle['capabilities'],
        provenance: 'cube',
        requestState: () => cube.requestFacelets(),
        resetToSolved: () => cube.resetToSolved(),
        stop: () => cube.disconnect()
      }
    }
  }
}

export function sessionSource(record: DeviceSessionRecord, options: { delayMs?: number } = {}): CubeInputSource {
  return {
    id: 'session',
    label: `Recorded session · ${record.device.name || 'device'}`,
    async start(onEvent, onStatus) {
      let stopped = false
      onStatus(`Replaying ${record.device.name || 'recorded device'} · ${record.events.length} packets`)
      const first = record.events.find((entry) => typeof (entry.event as { timestamp?: number }).timestamp === 'number')
      const offset = first ? Date.now() - (first.event as { timestamp: number }).timestamp : 0
      const done = (async () => {
        for (const entry of record.events) {
          if (stopped) return
          const shifted = { ...entry.event } as { timestamp?: number; localTimestamp?: number }
          if (typeof shifted.timestamp === 'number') shifted.timestamp += offset
          if (typeof shifted.localTimestamp === 'number') shifted.localTimestamp += offset
          await onEvent(shifted as CubeEvent)
          if (options.delayMs) await new Promise((resolve) => { setTimeout(resolve, options.delayMs) })
        }
        onStatus(`Replayed ${record.device.name || 'recorded device'} · ${record.events.length} packets`)
      })()
      return {
        name: record.device.name,
        protocol: record.device.protocol,
        mac: record.device.mac,
        capabilities: record.capabilities as CubeInputHandle['capabilities'],
        provenance: 'replay',
        done,
        requestState: idle,
        stop: async () => { stopped = true }
      }
    }
  }
}

/**
 * Emits an explicit list of moves through the normal event path.
 *
 * Used to perform the app's own current scramble and a real solution for it, so the whole
 * chain — scramble tracking, solve detection, timing, segmentation — can be exercised
 * without a physical cube. Every capability in this app has to be reachable from software.
 */
export function scriptedSource(moves: string[], options: { gapMs?: number } = {}): CubeInputSource {
  const gap = options.gapMs ?? 120
  return {
    id: 'scripted',
    label: 'Scripted moves',
    async start(onEvent, onStatus) {
      let stopped = false
      const faces = 'URFDLB'
      onStatus(`Performing ${moves.length} moves`)
      const done = (async () => {
        let timestamp = Date.now()
        for (const move of moves) {
          if (stopped) return
          timestamp += gap
          await onEvent({
            type: 'MOVE',
            face: Math.max(0, faces.indexOf(move[0])),
            direction: move.includes("'") ? -1 : 1,
            move,
            localTimestamp: timestamp,
            cubeTimestamp: timestamp,
            timestamp
          } as CubeEvent)
          // Emit at the pace the timestamps claim. Firing every move in a millisecond while
          // stamping them 120ms apart made the stream impossible to watch and gave the
          // capture a wall-clock duration that disagreed with its own move timestamps.
          await new Promise((resolve) => { setTimeout(resolve, gap) })
        }
        onStatus('Scripted moves complete')
      })()
      return {
        name: 'Scripted',
        protocol: 'software',
        mac: '',
        capabilities: { facelets: false, battery: false, gyro: false },
        provenance: 'simulator',
        done,
        requestState: idle,
        stop: async () => { stopped = true }
      }
    }
  }
}

export function simulatorSource(options: { seed?: string; delayMs?: number; solve?: SimulatedSolve; onScrambled?: () => boolean | Promise<boolean> } = {}): CubeInputSource {
  return {
    id: 'simulator',
    label: 'Software simulator',
    async start(onEvent, onStatus) {
      let stopped = false
      const simulated = options.solve ?? await simulateCfopSolve(options.seed ?? 'source')
      onStatus(`Simulating a ${(simulated.totalMs / 1000).toFixed(1)} s CFOP solve`)
      const faces = 'URFDLB'
      const emit = async (move: string, timestamp: number) => {
        await onEvent({
          type: 'MOVE',
          face: Math.max(0, faces.indexOf(move[0])),
          direction: move.includes("'") ? -1 : 1,
          move,
          localTimestamp: timestamp,
          cubeTimestamp: timestamp,
          timestamp
        } as CubeEvent)
      }
      const done = (async () => {
        let timestamp = Date.now()
        for (const move of simulated.scramble.split(/\s+/).filter(Boolean)) {
          if (stopped) return
          timestamp += 40
          await emit(move, timestamp)
        }
        // Awaited: a consumer buffering moves (the slice-pair window in
        // device/cubedex/moveTracker.ts) has not seen the last scramble move yet when
        // this fires, so a synchronous check reads a stale status and aborts the solve.
        if (options.onScrambled && !(await options.onScrambled())) return
        const solveStart = timestamp + 1_500
        for (const event of simulated.events) {
          if (stopped) return
          await emit(event.move, solveStart + event.timestamp)
          if (options.delayMs) await new Promise((resolve) => { setTimeout(resolve, options.delayMs) })
        }
        onStatus('Simulated solve complete')
      })()
      return {
        name: 'Simulator',
        protocol: 'software',
        mac: '',
        capabilities: { facelets: false, battery: false, gyro: false },
        provenance: 'simulator',
        done,
        requestState: idle,
        stop: async () => { stopped = true }
      }
    }
  }
}

const scrambleOf = (record: DeviceSessionRecord) => record.scramble
