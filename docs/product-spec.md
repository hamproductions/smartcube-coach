# Smart Cube Coach — product specification

## Mission

Turn raw smart-cube telemetry into an evidence-backed loop that moves a realistic 20–30 second 3×3 solver toward sub-10:

1. capture a valid solve,
2. reconstruct exactly what happened,
3. identify the highest-leverage weakness,
4. prescribe a focused drill,
5. measure transfer back into full solves,
6. repeat.

This is not another timer with an AI chat box. Measurements are deterministic. Language generation may explain verified findings but may not invent them.

## Product loop

### 1. Prepare

- Connect a supported smart cube through `smartcube-web-bluetooth`.
- Generate a legal scramble with a versioned generator.
- Verify each physical move and final state in real time.
- Recover from wrong moves with explicit undo guidance.
- Begin inspection only when the target scramble state is confirmed.

### 2. Capture

- Start on the first solve move and stop on solved state.
- Persist both cube and host timestamps, raw packets, normalized moves, facelet snapshots, device identity/capabilities and analysis version.
- Never discard raw telemetry when derived reconstruction changes.

### 3. Reconstruct

- Segment CFOP into Cross, F2L pairs, OLL, PLL and AUF.
- Preserve adapters for Roux, ZZ, APB and block methods rather than hard-coding CFOP into storage.
- Produce editable line-based reconstruction with Ao1K-style autocomplete, named OLL/PLL suggestions, split annotations and share formats.
- Track rotations, cancellations, regrips inferred from timing, pauses, move count and TPS.

### 4. Diagnose

Each finding must have:

- metric,
- observed value,
- confidence,
- raw evidence range,
- baseline comparison,
- target,
- likely cost in seconds or moves,
- drill that can measure the same weakness.

Priority score:

`impact × recurrence × confidence × trainability`

No “roast” statement ships without a linked finding. Example:

> Your second F2L pair stalled for 1.14 s before the first move. That is your largest repeatable pause in 7 of the last 12 solves. The assigned pair-prediction drill targets this exact boundary.

### 5. Prescribe

The coach creates a short session, not a generic list:

- one planning drill,
- one recognition/lookahead drill,
- one execution drill,
- a transfer block of full solves,
- a measurable pass condition.

Assignments draw from:

- Cross/xCross/EO inspection,
- F2L case execution,
- free-pair preservation,
- piece tracking,
- pair prediction,
- color inference,
- OLL/PLL/two-sided recognition,
- algorithm time attack,
- metronome/TPS control,
- BLD memo/cycle drills.

### 6. Verify transfer

Drill improvement is not enough. A prescription completes only when the corresponding full-solve metric improves over a defined sample. The product compares rolling baseline and post-training windows and reports confidence, not certainty.

## Target ladder

Targets are configurable coaching envelopes, not claims about every solver.

| Stage | 20–30 s baseline focus | Intermediate gate | Sub-10 envelope |
|---|---|---|---|
| Inspection/Cross | plan complete cross; eliminate mid-cross search | consistent cross plan and low first-pair delay | cross execution near 1–1.5 s with first-pair awareness |
| F2L | remove pauses and unnecessary rotations before raw TPS | stable pair recognition and efficient solutions | roughly 5–6.5 s total with continuous lookahead |
| OLL | identify case without U-spam | reliable repertoire and sub-second recognition | roughly 1–1.5 s combined recognition/execution |
| PLL/AUF | reduce recognition hesitation and AUF indecision | reliable two-sided recognition | roughly 1.5–2 s combined recognition/execution/AUF |
| Whole solve | stable Ao100, not lucky singles | 15 → 12 second gates | sustainable sub-10 average |

The system learns personal thresholds from captured solves and moves gates gradually; it does not begin by demanding world-class splits.

## Surfaces

### Today

- current baseline and goal trajectory,
- one primary diagnosed constraint,
- prescribed session with pass condition,
- transfer-test status,
- connection and data-quality health.

### Live Solve

- Bluetooth/device status and battery,
- scramble with current move/error correction,
- inspection state,
- timer,
- live cube and move stream,
- data-quality warnings.

### Solve Report

- playback and editable reconstruction,
- stage strip with time/moves/TPS/pauses,
- event timeline,
- deterministic findings,
- alternative route/algorithm suggestions,
- “roast me” rendering of the same findings,
- add-to-drill action.

### Train

- coach assignment,
- Drill/Learn/Review modes,
- state-success and exact-algorithm modes,
- progressive hints,
- recognition/execution splits,
- incorrect/redo queue,
- session and case statistics.

### Library

- F2L, OLL, PLL and extended sets,
- personal algorithms per side/orientation,
- case images and setup scrambles,
- mastery, due date and target time,
- import/export/share.

### Reconstruct

- manual scramble/reconstruction editor,
- autocomplete and named case suggestions,
- method and color orientation,
- advanced solver-backed search,
- copy link/text/image/GIF.

### Progress

- Ao5/Ao12/Ao100 and distribution,
- stage trends,
- pause/rotation/move-efficiency trends,
- case weaknesses,
- assignment adherence,
- drill-to-full-solve transfer.

### BLD Lab

- lettering scheme and buffer setup,
- memo extraction and validation,
- cycle/parity/twist/flip-constrained drills,
- memo accuracy and speed,
- generated state reproducibility.

## Core data model

```ts
type RawCubeEvent = {
  id: string
  solveId: string
  sequence: number
  type: 'move' | 'facelets' | 'gyro' | 'battery' | 'hardware' | 'disconnect'
  cubeTimestamp?: number
  hostTimestamp: number
  payload: unknown
}

type Solve = {
  id: string
  sessionId: string
  puzzle: '3x3x3'
  scramble: string
  scrambleGenerator: string
  startedAt: number
  endedAt: number
  penalty: 'none' | '+2' | 'dnf'
  deviceId?: string
  analysisVersion: string
  rawEventIds: string[]
}

type Stage = {
  id: string
  solveId: string
  method: string
  name: string
  startEvent: number
  firstMoveEvent: number
  endEvent: number
  recognitionMs: number
  executionMs: number
  moveCount: number
  rotationCount: number
  pauseCount: number
  tps: number
  caseId?: string
  confidence: number
}

type Finding = {
  id: string
  solveIds: string[]
  metric: string
  observed: number
  baseline: number
  target: number
  confidence: number
  impactMs: number
  recurrence: number
  evidence: Array<{ solveId: string; fromEvent: number; toEvent: number }>
  prescriptionId?: string
}

type TrainerAttempt = {
  id: string
  trainerId: string
  caseId: string
  mode: 'state-success' | 'algorithm-rehearsal' | 'recognition' | 'prediction' | 'inspection'
  setupSeed: string
  startedAt: number
  recognitionMs?: number
  executionMs?: number
  success: boolean
  hintCount: number
  wrongMoves: number
  rawEventIds: string[]
}
```

## Architecture

### Client

- React 19 + TypeScript + Vite.
- `cubing.js` for puzzle state, notation and rendering.
- `smartcube-web-bluetooth` for device protocols and event streams.
- IndexedDB through a small repository layer for raw events, solves, attempts and migrations.
- Web Worker for reconstruction, solver/generator and statistical recomputation.
- Service worker/PWA shell for offline training and solve capture.

### Domain modules

- `device`: protocol connection, capability negotiation, timestamp correction.
- `scramble`: generation, sequence/state verification, correction plan.
- `capture`: solve lifecycle and immutable event ingestion.
- `reconstruction`: notation, line model, stage adapters and autocomplete.
- `analysis`: pauses, stage metrics, cases, inefficiencies and findings.
- `coach`: priority scoring, prescription construction and transfer checks.
- `training`: case definitions, scheduler, target predicates, attempt events.
- `library`: algorithms, variants, mirrors, case imagery and mastery.
- `storage`: versioned IndexedDB, import/export and optional sync boundary.

### Optional server

The core product works without an account. A server may later provide encrypted sync, public reconstruction links, coach sharing and leaderboards. It is not required for Bluetooth capture, analysis or training.

## Reuse and licensing

| Source | Use |
|---|---|
| Ao1K (MIT) | Adapt reconstruction line model, suggestion pipeline, split interpretation and export patterns with attribution. |
| smartcube-web-bluetooth (MIT) | Direct dependency/fork with attribution; preserve fixtures and timestamp model. |
| smart-cube-timer (MIT) | Adapt solve lifecycle, phase analysis concepts and raw-data migration strategy with attribution. |
| csTimer (GPL-3.0) | Capability/behavior reference only unless the entire product is intentionally GPL-compatible. Use independent permissive solver/generator implementations. |
| F2LTrainer | Package metadata says MIT but no license file exists in checkout; request/verify license text before copying. Reimplement behavior meanwhile. |
| Solved.no | UX/product inspiration only; no source license supplied. |

## Delivery sequence

### Slice 1 — Coach cockpit

Executable Today/Solve Report surface using deterministic sample telemetry. It proves the product hierarchy, finding evidence, prescription flow and responsive layout.

### Slice 2 — Real capture

Bluetooth connection, capability diagnostics, raw event persistence, scramble verification, auto start/stop and replay fixtures.

### Slice 3 — Reconstruction

CFOP segmentation, editable lines, Ao1K-style autocomplete, split metrics, pause/rotation analysis and exports.

### Slice 4 — Prescribed training

F2L state-success and algorithm-rehearsal modes, progressive hints, recognition/execution timing and weak-case scheduler.

### Slice 5 — Transfer and breadth

Full-solve transfer checks, OLL/PLL/inspection/prediction trainers, BLD lab, optional sync and daily prescriptions.

## Acceptance gates

- Every metric traces to raw events.
- Scramble verification checks final state and provides correction guidance.
- Timer uses corrected event clocks and remains stable through delayed packets.
- Reconstruction is editable and recomputable without losing source telemetry.
- A coach assignment names the metric, target, sample and pass condition.
- Drill results and full-solve transfer are reported separately.
- Core capture/training works offline without login.
- Import/export round-trips all local data with schema and analysis versions.
- Browser workflows have real desktop/mobile evidence and zero unhandled console errors.
