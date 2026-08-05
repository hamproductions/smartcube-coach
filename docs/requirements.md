# Requirement ledger

Every requirement stated for this project, with its real status. Requirements are recorded as technical statements. Conversation stays in the conversation — this file does not quote it, and it must never carry credentials, tokens or webhook URLs.

Status: **DONE** (evidence recorded) · **PARTIAL** · **BROKEN** (reproduced failing) · **OPEN** (never built) · **UNVERIFIED** (built, never proven).

## Tier −1 — the smart cube. The product.

| # | Requirement | Status |
|---|---|---|
| R1 | `R`+`L'` resolves to `M'`; reconstructions use slice notation | **DONE** — `src/domain/sliceRecovery.ts`, algorithm from smart-cube-timer `MoveSequence.js:107-180` + `utils.js:16-33`. Rule table verified against `cubing/alg` state, not assumed: `R L'`→`M`(+x), `L R'`→`M'`(+x'), `U D'`→`E`(+y), `D U'`→`E'`(+y'), `F B'`→`S'`(+z), `B F'`→`S`(+z'). Non-adjacent and same-sign pairs untouched. Attached to `StageRecord.notation`. **Verified on all 7 real captures: 1 461 raw moves, 22 slice collapses, state equivalence held on every session.** Two of three axis signs were wrong on first derivation and only real cube-state ground truth caught it. |
| R2 | Rotation calculation is gyro-independent; reconstructions are not a wall of L/D moves | **DONE** — two parts. Slice recovery folds each implied rotation into a running orientation read purely from the move stream, never a gyro. Ao1K's `simplifyRotations` (copied byte-identical, MIT) collapses any rotation run to at most two moves and is wired into `segmentCfop`; rotation counts now report simplified rotations, matching what the user sees. State equivalence pinned by test, including a 5-rotation run and a run that cancels to identity. |
| R3 | Interactive 3D cube | PARTIAL — renders, interaction unverified |
| R4 | Live cube state and sticker reset | PARTIAL — exists; resync worsens divergence (R11) |
| R5 | QiYi MAC resolution works | PARTIAL — manual entry added |
| R6 | Gyro handled correctly | PARTIAL — persisted, never validated on hardware |
| R7 | Cube state stays in sync with the rendered cube | BROKEN — not reproduced from recordings; live-BLE paths untested |
| R8 | Timer auto-starts and runs on a real solve | BROKEN — C1, C4, C5 |
| R9 | Solve durations are sane | BROKEN — C1 |
| R10 | Scramble verification does not false-alarm | BROKEN — C2, reproduced |
| R11 | Resync repairs divergence rather than worsening it | BROKEN — path unreachable from recordings, needs a mocked BLE transport |
| R12 | Real solves segment into correct CFOP stages | BROKEN — suspicious boundaries, one solve never segmented |
| R13 | Reconciliation state never surfaces as user-facing noise | BROKEN — C3 |
| R14 | Cube connection is global across every route | OPEN — in flight |
| R15 | Cube movement renders smoothly | **root cause found, fix in flight** — mining acubemy's bundles showed its BLE→UI path is a flat synchronous re-emit with no await, no persistence and no solver work before the renderer sees the move. This app instead serialises every move through a promise chain that awaits an IndexedDB write *and* an async kpuzzle scramble evaluation before the twisty player is told the move happened, so every physical turn waits on disk I/O and solver work before it renders (`LiveSolve.tsx:352-483`). Fix: render synchronously first, persist and analyse after, without dropping or reordering anything. |

## Tier 0 — process requirements, treated as hard rules

| # | Requirement | Status |
|---|---|---|
| R16 | The service is fully testable without a physical cube; hardware is never requested | DONE — 7 real captures are fixtures; rule in `AGENTS.md` |
| R17 | Provided session exports are the test corpus | DONE — replay harness drives all 7 |
| R18 | Reference implementations are read in full and copied rather than reinvented | IN PROGRESS — vendored driver and `smart-cube-timer` read; `f2l-trainer.top` not inspected |
| R19 | Everything works before hardware is involved | OPEN |
| R20 | UI verified by looking at screenshots against the reference | DONE — rule in `design-system.md` |
| R21 | Work continues without stopping | STANDING |
| R22 | Requirements tracked, agents monitored, course corrected continuously | STANDING — this file |
| R23 | Conversation content stays in the conversation; never copied into repo files; never any credential | STANDING — this file was rewritten to comply |

## Tier 1 — product features

| # | Requirement | Status |
|---|---|---|
| R24 | Trainer usable as a state-agnostic remote controller | DONE |
| R25 | Slow-solve help: efficient solutions, autocomplete/solver, one move at a time | PARTIAL |
| R26 | Coach analyses a solve and identifies improvement; real-time optimiser | PARTIAL — blocked on R1/R12 |
| R27 | Trainer is genuinely useful | PARTIAL — 9 case sets, usefulness unproven |
| R28 | Feature parity with acubemy and the wider reference set | tracked in `parity-plan.md` |
| R29 | UI is not templated slop and mimics the reference tool grammar | PARTIAL |

## Root causes established 2026‑08‑03

Evidence: `docs/research/hardware-replay-2026-08-03.md`, from replaying the seven real captures through the production pipeline.

**C1 — corrupted timing.** QiYi batches moves into one BLE notification; all share a host timestamp and only the last carries a non-null `localTimestamp`, which the vendor driver documents as meaning the others have no meaningful host anchor. `LiveSolve.tsx:378` passes the batch timestamp for every move and `capture.ts:117-125` feeds them all into a least-squares clock fit, corrupting every later timestamp. The reference times from host time only.

**C2 — false scramble divergence.** `nextExpectedMove` (`scramble.ts:51-76`) cannot recover from one wrong-direction quarter turn on the correct face: the pointer freezes and every later move is flagged. In capture `08-43-11` this flagged 125 of 150 moves and the session never left `scrambling` — an entire real solve was lost. Its output is also rendered with an error class, while the correct full-state check is the real gate.

**C3 — reconciliation noise.** For QiYi, only opcodes `0x2` and `0x4` carry real device state; the FACELETS event after every MOVE is synthesised by the driver using the same `CubieCube` maths this app imports. Reconciliation therefore compares our arithmetic against identical arithmetic, and any internal pipeline hiccup is shown to the user as a sticker disagreement (`LiveSolve.tsx:316-337`).

**C4 — silent pipeline stall.** `evaluateScramble` in `handleMove` has no try/catch; one unparseable token rejects the promise, `enqueueEvent` swallows it, and the UI freezes with no error.

**C5 — replayed solves always DNF.** `LiveSolve.tsx:655` stamps `beginInspection(Date.now())` on the wall clock while the penalty is computed against clock-fitted cube time, producing 27–70 s phantom inspection overruns. Every replayed solve DNFs, deterministically.

**C6 — 3 of 7 captures carry no scramble field.** `DeviceRecorder.target()` is called only from `createScramble()` and the recorder is never reset between cycles, so a session recorded without pressing New scramble exports a file that cannot be timed at all. Replaying it is a silent no-op — no timer, no capture, no error.

## Reference sources on disk

All cloned to `/tmp/refs/` on 2026-08-04 and being copied from directly, with an attribution header on every ported file. The project is personal and non-commercial and the owner has instructed that reference code be copied rather than reinvented.

| Source | Local path | What is being taken |
|---|---|---|
| poliva/cubedex | `/tmp/refs/cubedex` | Smart-cube connection, scramble tracking, solve detection, move representation |
| Ao1K/Ao1K_site | `/tmp/refs/ao1k` | `simplifyRotations`, ergonomics scoring, positional alg index, replay queue tempo — first three copied byte-identical |
| hakatashi/smart-cube-timer | `/tmp/refs/smart-cube-timer` | `MoveSequence` (slice recovery, reduction/addition), `SolveAnalyzer` (stage machine), `utils` (cross detection, stage predicates, first-non-trivial-move) |
| Dave2ooo/F2LTrainer | `/tmp/refs/f2ltrainer` | Frame/wide/slice compensation, move buffering, drill state machine, hint ladder, queue and history, case attribute taxonomy |
| cs0x7f/cstimer | `/tmp/refs/cstimer` | Timer state machine and `lastStop` guard (already applied), scramble-progress-by-state |
| poliva/smartcube-web-bluetooth | `/tmp/refs/smartcube-web-bluetooth` + `node_modules` | Protocol decoding, cubie state, timestamp contract |
| acubemy | `/tmp/refs/acubemy` (34 production chunks) | Closed source — observed behaviour only, no code taken |

## Rule for this file

Update it when a requirement changes. Change a status only on evidence. A subagent's report is not evidence until independently checked.
