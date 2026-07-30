# Acceptance receipt — 2026-07-30

Source of truth: `docs/product-spec.md`, lines 308–318.

## Gate results

| Gate | Result | Implementation and evidence |
| --- | --- | --- |
| Every metric traces to raw events | Pass | `LiveSolve` persists immutable phase-labelled raw events, solve-only `rawEventIds`, metric samples, findings, and evidence ranges. `LiveSolve.test.tsx` asserts solve/event identity. |
| Scramble verification checks final state and provides correction guidance | Pass | `src/domain/scramble.ts` evaluates canonical 3×3 state and returns the expected move/correction. Browser simulator reached the exact `ready` state only after canonical verification. |
| Timer uses corrected event clocks and remains stable through delayed packets | Pass, software harness | `src/device/capture.ts` fits cube timestamps to host time and retains immutable source timestamps. Capture tests cover clock fitting. Simulator records epoch-based timestamps. Physical packet behavior remains hardware-uncertified. |
| Reconstruction is editable and recomputable without losing source telemetry | Pass | `ReconstructEditor` saves versioned revisions linked to solve-phase source-event IDs. Test and browser IndexedDB readback verified 21 retained links. |
| A coach assignment names the metric, target, sample and pass condition | Pass | `src/domain/coach.ts` creates persisted prescriptions with metric, target, sample requirements, and explicit transfer gate. History renders these coaching contracts. |
| Drill results and full-solve transfer are reported separately | Pass | Trainer attempts, prescriptions, metric samples, and transfer evaluations use separate stores and models. Transfer requires a minimum baseline/post sample instead of treating drill success as solve transfer. |
| Core capture/training works offline without login | Pass, simulator | IndexedDB requires no account. `vector-shell-v2` precaches production HTML, JS, CSS, manifest, and icons. The app reloaded after the production server was stopped. Physical Bluetooth itself remains browser/hardware-dependent. |
| Import/export round-trips all local data with schema and analysis versions | Pass | IndexedDB schema version 4 and `smartcube-coach-backup` cover solves, raw events, stages, revisions, metrics, findings, attempts, algorithms, prescriptions, transfer evaluations, studies, and key/value state. `transfer.test.ts` passes. |
| Browser workflows have desktop/mobile evidence and zero unhandled console errors | Pass | `agent-browser` verified Live Solve, History, reconstruction revisions, trainer persistence, reco.nz study, Progress, responsive mobile layouts, and production offline restart. Evidence is indexed in `docs/evidence/README.md`. |

## Automated verification

- `bun run test`: 14 files passed, 21 tests passed.
- `bun run typecheck`: passed.
- `bun run build`: passed with Vite 8.1.5; 562 modules transformed.
- Build warning: cubing.js 3D/WASM chunks exceed 500 kB. This is a performance optimization item, not a correctness failure.

## Browser verification

- Desktop: 1440 × 1000.
- Mobile: 390 × 844.
- Mobile document width: 375; positive horizontal overflow: 0.
- Live public reco.nz import: solve 13444.
- Production service-worker cache included the hashed application JS and CSS.
- Cold reload succeeded after the production server was terminated.

## External certification boundary

The software acceptance gates pass. Physical Bluetooth compatibility cannot be certified without a supported cube and target browser/device. Simulator results must not be presented as evidence of GATT pairing, physical packet integrity, battery reports, gyro reports, or reconnect behavior.
