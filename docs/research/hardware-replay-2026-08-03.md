# Hardware replay diagnosis — 2026-08-03

Source of truth: seven real QiYi `QY-QYSC-S-23C0` capture files the user recorded today, copied verbatim into
`src/device/fixtures/user-sessions/`. Driven through the real production pipeline in
`src/device/userSessionReplay.test.ts` — `parseDeviceSession` → `sessionSource` (the exact replay path
`LiveSolve.importDeviceSession` uses) → `FaceletReconciler` → `LiveCubeState` → `CaptureSession` (clock fit +
scramble verification) → `segmentCfop`. No parallel/simplified reimplementation. Run:

```
bunx vitest run src/device/userSessionReplay.test.ts --pool=threads --maxWorkers=2
```

All 8 assertions pass — the test documents current (broken) behavior, it does not assert the desired behavior.
`bun run typecheck` is clean.

## Per-file findings

| file | scramble recorded | move pkts | facelet pkts | facelet mismatches | scramble reached `ready` | final status | captures | penalty |
|---|---|---|---|---|---|---|---|---|
| `...T06-59-08` | none | 298 | 302 | 0 | n/a | idle | 0 | — |
| `...T06-59-11` | none | 298 | 302 | 0 | n/a | idle | 0 | — |
| `...T08-23-59` | none | 195 | 196 | 0 | n/a | idle | 0 | — |
| `...T08-31-36` | `F2 L2 U' L'...` (25 moves) | 302 | 304 | 0 | yes, at move 218 | complete | 1 | **dnf** |
| `...T08-43-11` | `B U2 F2 D2 F...` (25 moves) | 150 | 152 | 0 | **never** | **scrambling (stuck)** | 0 | — |
| `...T08-56-22` | `D' F2 R2 U2 B'...` (25 moves) | 102 | 104 | 0 | yes, at move 37 | complete | 1 | **dnf** |
| `...T09-56-18` | `B' U R' F2 R'...` (25 moves) | 116 | 118 | 0 | yes, at move 36 | complete | 1 | **dnf** |

### Defect 3 — timer does not auto-start / solve timestamp is unreliable — REPRODUCES, root cause found

Every single completed capture (3 of 3) came out **DNF**, even though each was a real, completed, plausible
CFOP solve (`08-31-36`: 84 solve moves / 25.6 s; `08-56-22`: 65 moves / 23.0 s; `09-56-18`: 80 moves / 20.2 s).

```
08-31-36: inspectionBeginDateNow=1785768354289 solvingTransition={"startedAt":1785768424826,"inspectionPenalty":"dnf","gapFromInspectionBeginMs":70537}
08-56-22: inspectionBeginDateNow=1785768355028 solvingTransition={"startedAt":1785768383548,"inspectionPenalty":"dnf","gapFromInspectionBeginMs":28520}
09-56-18: inspectionBeginDateNow=1785768355134 solvingTransition={"startedAt":1785768382086,"inspectionPenalty":"dnf","gapFromInspectionBeginMs":26952}
```

Root cause: `src/components/LiveSolve.tsx:655`

```ts
if (record.scramble && session.snapshot.status === 'ready') session.beginInspection(Date.now())
```

fires **real wall-clock `Date.now()`** the instant scramble verification completes during replay. `CaptureSession.handleMove`
(`src/device/capture.ts:145-151`) then computes the DNF/`+2`/`none` penalty as:

```ts
this.state.inspectionPenalty = inspectionPenalty(correctedTimestamp - (this.state.inspectionStartedAt ?? correctedTimestamp))
```

`correctedTimestamp` comes from `fitCubeTimestamp` (`src/device/capture.ts:36-45`), a regression fit over the
cube's own `cubeTimestamp` clock mapped onto the *replayed* `hostTimestamp` axis. `sessionSource`
(`src/device/sources.ts:38-70`) only shifts every packet's `timestamp`/`localTimestamp` by one constant
`offset = Date.now() - first.timestamp`; it preserves the original real-world inter-packet spacing. Replay itself
runs near-instantaneously (no `delayMs`), so `correctedTimestamp` for the first solving move still reflects the
user's *actual original* multi-second physical inspection pause, while `inspectionStartedAt` is stamped at
replay speed. Subtracting the two mixes two different clocks and produces the observed 27–70 s "inspection
overrun," always past the 17 000 ms DNF cutoff in `inspectionPenalty` (`src/device/capture.ts:30-34`). This is
deterministic — it will DNF **every** replayed solve, 100% of the time, regardless of how the solve actually
went. This bug is specific to the *replay* path: a live physical-cube session never calls `beginInspection`
automatically, so `inspectionStartedAt` is always set from the same `correctedTimestamp` axis
(`src/device/capture.ts:147`, `if (this.state.status === 'ready') this.state.inspectionStartedAt = correctedTimestamp`),
giving a legitimate `0 ms` gap.

### Defect 4 — scramble verification falsely reports a mismatch/divergence — REPRODUCES, root cause found, one file loses the entire solve

`08-31-36`: `wrongMoveFlashCount: 216` out of 302 move packets (72%). First flash at move 2:
`expected: "F2", actual: "U"` — the device recorded a lone `F` quarter (partial progress toward the scrambled
`F2`) before the *next* face turn came in, which is legal notation-agnostic progress but the raw
per-move comparator flags it as wrong immediately.

`08-43-11` is worse: `wrongMoveFlashCount: 125` out of 150 move packets, and the session **never reaches
`ready`** — `finalSessionStatus: scrambling` forever, 0 captures. Traced exactly:

```
moves[0..23]  (24 quarter-turns) match the 25-token scramble "B U2 F2 D2 F R' F2 R' U' L' U2 L' F2 L' B L2 F L B' D F2 U' B' L2 U'" through target index 17 ('L').
moves[24] = "L'"   <- device recorded the L face turned counter-clockwise
target[17] = "L"   <- scramble notation calls for a plain clockwise L
```

Root cause: `nextExpectedMove` (`src/domain/scramble.ts:51-76`):

```ts
applied = (applied + quarterTurns(move)) % 4
const needed = quarterTurns(target) % 4
if (applied === needed) { index += 1; applied = 0; continue }
if (applied === 0) return { index, expected: target, actual: move, complete: false }
```

`L'` gives `applied = 3`, `needed (for "L") = 1`. `applied !== needed` and `applied !== 0`, so the function
neither advances `index` nor returns "wrong" — it silently loops to the next move still expecting the same
`target[17] = "L"`. Every subsequent move (`B'` at move 25, then the rest of the real physical solve) is compared
against that same frozen, already-wrong target and immediately flagged `wrongMove` (face mismatch), forever —
there is no recovery path once a single wrong-direction quarter-turn on the *correct* face desyncs the counter.
`evaluateScramble` (state-based, independent of `nextExpectedMove`) is still checked every move and is the only
thing that can flip `status` to `ready`, but here it never did within the captured 150 moves — the entire real
solve that followed the mis-turned `L'` was captured as more (spuriously flagged) "scrambling" moves and is
permanently unrecoverable: **0 completed captures for a session the user says they solved.**

`08-56-22` and `09-56-18` show `wrongMoveFlashCount: 0` — clean scrambles, no bug triggered — confirming the
defect is conditional on a wrong-direction (or reordered) quarter-turn appearing in the raw device stream, not a
universal failure.

### Defect 5 — solve is not segmented/divided into stages correctly — partially reproduces

`segmentCfop` ran without throwing on all 3 completed captures and produced a full Cross→F2L×4→OLL→PLL breakdown
(all stages `confidence: 1`, i.e. `plausibleCfop`'s own Cross-length gate never triggered a downgrade):

```
08-31-36: Cross:8 | F2L1:12 | F2L2:7 | F2L3:10 | F2L4:12 | OLL:17 | PLL:18   (84 moves total)
08-56-22: Cross:8 | F2L1:12 | F2L2:12 | F2L3:10 | F2L4:9  | OLL:1  | PLL:13  (65 moves total)
09-56-18: Cross:7 | F2L1:16 | F2L2:4  | F2L3:18 | F2L4:10 | OLL:9  | PLL:16  (80 moves total)
```

`08-56-22`'s `OLL:1` (a single-move "OLL" stage) and `09-56-18`'s `F2L2:4`-move pair and `F2L3:18`-move pair are
suspicious — a 1-move OLL is only plausible as an OLL skip absorbing a stray rotation/AUF move, and an 18-move
F2L pair is far above a normal F2L insertion (typically ≤10-12 moves even with recognition slack), suggesting a
slot/pair boundary was misdetected. This needs case-by-case move-list inspection to confirm (not done in this
pass — flagged for the fix pass). Since `08-43-11` never produced a capture at all (see Defect 4), its solve was
never segmented — the most severe form of "not divided properly" is that it isn't divided at all.

### Defect 6 — internal cube/app reconciliation state surfaced as user-facing noise — confirmed by code inspection

Not a replay-behavior question — directly visible in `src/components/LiveSolve.tsx:316-337`. Internal
reconciliation state (`FaceletReconciliation['status']` — `'baseline' | 'verified' | 'mismatch' | 'invalid' |
'unsupported'`) is rendered verbatim as user-facing copy: `'Your stickers disagree with the turns we recorded'`,
`'Sticker checking paused — your cube sent a turn we cannot model'`, `'Your cube reported an impossible sticker
layout'`. These strings fire from `faceletReconciliation`/`liveStateStatus` regardless of whether the solve
itself succeeded, and are always visible in the device drawer summary line (`faceletStatus` is concatenated into
the summary `<small>` at line 994-1004) — there is no gating on whether the user needs to see or act on this,
confirming the complaint that internal reconciliation plumbing leaks straight to the UI as unexplained warnings.

### Defects 1 & 2 — cube state not in sync with the rendered cube / resync makes the divergence worse — DO NOT reproduce on this data (negative finding)

Across all 7 files: `mismatchCount: 0`, `invalidFaceletCount: 0`, `unsupportedCount: 0`, `liveDisagreementCount: 0`
for both `FaceletReconciler.reconcile` and `LiveCubeState.adopt`. Every FACELETS packet in every file reconciles
cleanly against the accumulated move stream — `finalReconcileStatus: verified` in all cases that reached a
baseline. This is a genuine negative result, not evidence the bug doesn't exist:

- These are *complete, in-order, already-recorded* JSON event streams. A live BLE connection can reorder or
  drop packets outright (a dropped `MOVE` packet leaves `FaceletReconciler`'s `pending` array missing a move,
  which — if the next `FACELETS` packet arrives before enough compensating drift — could produce exactly the
  false-mismatch class the user describes). That failure mode cannot be reproduced from a file that already
  captured the clean, complete sequence the device eventually settled on.
  See `src/device/webBluetooth.ts` (BLE notification handling) as the place to look for drop/reorder, not
  covered by this pass.
  - `resyncFacelets()` (`src/components/LiveSolve.tsx:685-695`) calls `connection.requestState()`, which is a
  live-BLE-only round trip (`sessionSource`'s `requestState` is the no-op `idle`, `src/device/sources.ts:65`).
  This code path is **structurally unreachable** from a recorded-session replay and was not exercised by this
  test at all — it needs either a live rig or a mocked BLE transport to test.

Recorded here as: not reproduced, not ruled out, and the two specific code paths (BLE packet loss/reorder,
`requestState` round trip) that would need coverage to actually investigate it.

## A structural finding beyond the six reported defects

Three of seven real captures (`06-59-08`, `06-59-11`, `08-23-59`) have **no `scramble` field at all**
(`"scramble" in record === false`). Replaying them is a complete no-op: `CaptureSession` never leaves `idle`,
so all 298/298/195 move packets and 302/302/196 facelet packets are silently consumed with zero timer
activity, zero captures, and no error surfaced to the user. Root cause:
`DeviceRecorder.target(scramble)` (`src/device/deviceRecorder.ts:27-29`) is invoked from exactly one call site,
`createScramble()` in `src/components/LiveSolve.tsx:521-522`. `DeviceRecorder` is never reset
(`recorder.current.reset()` has zero call sites in `LiveSolve.tsx`) between scramble cycles, and `target()`
overwrites a single `scramble: string` field rather than tagging it per solve — so a session recorded without
ever pressing "New scramble" in-app (or one spanning more than one scramble/solve cycle before export) produces
an exported JSON that `importDeviceSession` cannot time at all. This reproduces the "timer does not advance" defect for 3 of
the user's 7 real capture files (43%), silently, with no diagnostic emitted.

## Summary of reproduced defects

| # | user complaint | reproduces on real data | root cause file:line |
|---|---|---|---|
| 1 | cube state not in sync | not reproduced (see caveats) | untested: `src/device/webBluetooth.ts` BLE drop/reorder; `LiveSolve.tsx:685` `resyncFacelets` |
| 2 | resync makes it worse | not reproduced (see caveats) | same as above |
| 3 | timer doesn't move / random timestamp | **yes, 3/3 completed captures** | `src/components/LiveSolve.tsx:655` mixing `Date.now()` with cube-clock-fitted time in `src/device/capture.ts:148` |
| 4 | scramble verification falsely reports a mismatch | **yes, 2/4 scramble-bearing captures, 1 total data loss** | `src/domain/scramble.ts:51-76` `nextExpectedMove` has no recovery from a single wrong-direction quarter-turn |
| 5 | solve not formatted/divided properly | **yes, suspicious stage boundaries in 2/3 completed captures, plus 1/4 solves never segmented at all** | `src/domain/reconstruction.ts` segment boundary detection (needs move-list-level follow-up) |
| 6 | internal reconciliation surfaced as noise | **yes, by direct code inspection** | `src/components/LiveSolve.tsx:316-337` |
| — | 3/7 captures never had a scramble recorded, replay is a silent no-op | **yes, structural** | `src/device/deviceRecorder.ts:27-29`, no reset between cycles, single-scramble-field export format |
