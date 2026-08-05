# Execution receipt — 2026-08-03

## Request

- Turn opened with `continue the development`.
- Mid-turn correction: instructed to redo all the research, since not enough was being extracted from the supplied sources.
- Authority for this turn: research and documentation work inside the repository. No commit, push, deploy, server lifecycle, or hardware action.

## Violations named

1. Continued feature work (trainer catalogue) without first re-reading the research stack that defines what the product must harvest.
2. The existing harvest under-extracts the closed research set: `reco.nz` has no section at all, csTimer/Solved.no coverage is a feature list rather than a reimplementable specification, and no repository was inventoried file-by-file, so "not enough extracted" is accurate rather than a matter of taste.

## Sources read in full this turn

- `~/.claude/CLAUDE.md` (symlink to `~/.awesome-agent/shared/AGENTS.md`) — always-loaded standing rules.
- `~/.claude/skills/get-your-shit-together/references/user-demands.md`, lines 1–273.
- `AGENTS.md` (project scope, closed research set, research standard).
- `docs/HANDOFF_2026-07-31.md`, lines 1–216.
- `docs/feature-status.md`, lines 1–59.
- `docs/product-spec.md`, lines 1–319.
- `docs/research/feature-harvest.md`, lines 1–195.

## Live state checked

- Working directory `/Users/vittayapalotai.tanyawat/code/smartcube-coach`, branch `main`, HEAD `002ac74`.
- `git diff --check` clean.
- No listener on port 5173: the dev runtime described in the previous handoff is gone. Nothing was started.
- No local checkout of the closed research set survived from the previous session; all five repositories were re-cloned into the session scratchpad, outside the project folder.

## Corrected action

Redo the harvest from the actual sources: full-tree inventory per repository, license verified by reading the license file, capability rows carrying `path:line-range` and symbol names, algorithmic detail sufficient to reimplement, plus the missing `reco.nz` study-import research and a deeper Solved.no behavior harvest.

## Work landed after the research pass

1. `docs/research/feature-harvest.md` rewritten from the fresh reads; `docs/research/harvest-refresh-2026-08-03.md` holds the tranche ledger.
2. Trainer catalogue completed: `src/domain/algorithmCatalogue.ts` ships all 57 OLL and 21 PLL cases, `src/domain/lastLayer.ts` classifies a last-layer algorithm by cubie orientation and permutation class modulo AUF, and `src/domain/algorithmCatalogue.test.ts` proves the sets are complete and non-duplicating against real cube state.
3. `planDefaultAlgorithmSync` backfills missing catalogue cases into existing stores and retires the two untouched starter duplicates; `repositories.*.remove` was added for that.
4. Reconstruction completions are now ordered shortest-remaining-first, so the larger catalogue does not bury the closest match.
5. QiYi MAC recovery: `src/device/mac.ts` normalizes an entered MAC and derives the library's documented name candidates; `connectWebCube` feeds an entered MAC through `macAddressProvider` and reports the advertised name plus candidates on failure; Live Solve exposes the field.

## Goal pass — "every feature must work when I connect my cube"

Defects found by running the real pipeline, and what was done:

1. **Solve analysis returned nothing on a real human solve.** `segmentCfop` produced zero stages for reco.nz solve 13444. Two root causes: the reco importer discarded inspection rotations, so the move stream no longer reproduced the solved state; and stage predicates compared against the fixed solved reference, so any cube rotation defeated them. Fixed by keeping rotations in `moves` (with `turnMoves` for counting) and by evaluating predicates against a rotated solved reference across all 24 orientations (`solveProgress`).
2. **The simulator could never exercise analysis.** The only solve source was the inverse of the scramble, which is not a CFOP solve, so captures produced Cross + AUF and nothing else. Added `src/domain/cfopSimulation.ts`, which composes a solution from a cross, four pair inserts, an OLL and a PLL, takes the scramble as its inverse, asserts in `cubing.js` that the solution solves that scramble, and paces it at a realistic ~20 s with per-stage recognition.
3. **Repeat captures overwrote each other.** Only `New scramble` rotated the solve id and lifecycle generation, so a second capture reused the first record. The simulated capture path now rotates the same state.
4. **Stage trends were listed alphabetically**, putting AUF first. `stageTrends` now returns solve order.
5. **Scramble status lied after verification**, still reading `State check pending` once the state was verified. It now distinguishes idle, scrambling and verified.
6. **QiYi MAC recovery was disabled** by a provider stub returning `null` (see above).

Second pass — the cube-connected path itself:

7. **The connected-cube path had never been executed.** Added `src/device/replayCube.ts`, a development-only harness that installs the library's recorded GATT traffic behind `navigator.bluetooth` when the page is opened with `?replayCube=qiyi`, so the application's own `Connect cube` and `Connect controller` buttons run the real handshake against real captured bytes. `src/device/connectedCube.test.ts` does the same in vitest through `connectWebCube`.
8. **The harness exposed a crash that blanked the whole application.** Replacing `navigator` with a prototype-shim broke `navigator.userAgent`, taking down `CubePlayback` and `PwaStatus`. The harness now defines an own writable `bluetooth` property on the real navigator instead of substituting the object.
9. **The trainer controller disconnected the cube after every completed case.** `RemoteTrainerController` tore down the connection in the effect keyed on the target algorithm, so a finished pass dropped the cube and forced a reconnect. The connection now lives for the component's lifetime and only the pass state resets; the three regression tests that encoded the old behaviour were rewritten to the new contract, including turns applying to the replacement target.
10. **Address probing ran even when a MAC was supplied.** `enableAddressSearch` is now disabled whenever an entered MAC is available, which is both faster and the only way a supplied MAC is honoured first.

Third pass — the failure modes a real cube produces:

11. **A dropped cube left the user stranded.** `DISCONNECT` reset everything and stopped. The app now auto-reconnects, bounded to three attempts inside a 30-second window with per-attempt back-off, then says `Cube keeps dropping · reconnect manually`. The first implementation reconnected forever — caught in the browser and fixed before it shipped. Policy extracted to `src/device/reconnect.ts` with tests.
12. **The MAC had to be retyped every session.** It is now persisted in settings and restored on load, and supplying it disables address probing.
13. **Only three exact device names produced MAC candidates.** Padded, lower-case and near-miss QiYi names now fall back to prefix plus trailing hex, so `QY-QYSC-S-A0E6       ` and `QY-QYSC-X-23C0` resolve instead of failing.
14. **Latency, jitter and loss were never exercised.** `src/device/resilience.test.ts` drives recorded traffic with ±45 ms host jitter (fitted timestamps stay within 110 ms and monotonic), a dropped facelet packet (still reconciles), a dropped move (explicit `mismatch`, no silent corruption), and a session reset mid-solve (no stale solve published).

Fourth pass — acting on the offer of real data instead of asking for a copied error line:

15. **There was no way to hand over a real session.** Live Solve now records every packet with its relative timestamp, the device identity, capabilities and any connection error, and exports it as a JSON file. `Replay session file` feeds such a file back through the same live pipeline, so a real hardware capture becomes a reproducible fixture for tests and for the running app.
16. **A replayed session did not light up the live surface**, because facelet and live-state text were gated on an active connection object. Both now accept a replayed session; the browser shows `Replayed QY-QYSC-S-A0E6 · 65 packets`, `Facelet reconciliation verified` and `Live sticker state synchronized`.
17. **An unrecognized cube could not even be selected.** `Show all devices` switches the picker to any-device selection so the driver can be resolved from the GATT profile rather than the advertised name.
18. **The device toolbar collapsed** once these controls were added; it now wraps instead of squeezing the status text into a column.

Fifth pass — the two remaining software-provable gaps:

19. **Only QiYi had ever been driven through the application.** A per-vendor GATT replay of all six protocols through `connectWebCube` was attempted and abandoned honestly: the mock enforces byte-exact writes against a session recorded with the library's own command order, so a mismatch measures harness fidelity, not our code. Replaced with `src/device/capabilityMatrix.test.ts`, which drives all twelve captures across six vendors through recorder, reconciliation, clock fitting and scramble verification — the parts that actually differ per cube.
20. **A session file could not reproduce a whole capture.** A recorded session now carries its scramble target, so replaying it re-runs the full flow: set scramble, verify, inspect, solve, analyse. Verified in the browser with a 100-packet session containing a scramble and a 20-second CFOP solve: capture reached `complete` at `20.136`, the solve was saved, and all eight stages persisted with recognition and execution splits (`Cross 0/1176 ms … PLL 1408/4116 ms`), 33 metric samples and 100 raw device events.

Sixth pass — the first-pairing experience itself:

21. **Browser pairing failures surfaced as raw DOM exceptions.** Closing the picker produced `User cancelled the requestDevice() chooser.`, which reads like a fault. `src/device/connectionErrors.ts` now turns each failure into an instruction — closed picker, no matching device (points at `Show all devices`), blocked permission, GATT drop during setup, unresolvable QiYi MAC with its derived candidates, and a cube that connects but stays silent. Unknown errors pass through untouched.
22. **Live Solve was unusable on a phone.** At 390 px the device controls left a tall dead column beside the status text. The toolbar now stacks full-width; a full session replay on a 390 px viewport captured a 20-second solve, saved it and rendered the stage table with no console errors.

Seventh pass — dogfooding every remaining surface in the browser:

23. Cognitive drills exercised end to end: edge orientation, colour inference, piece tracking and pair tracking each graded a submitted answer, revealed the correct one and generated a fresh prompt.
24. **Free-pair options rendered as `A: LB: RCheck free pair`** — two option buttons and the submit button jammed together with no separation or selected state. They are now a labelled choice row with an `aria-pressed` selection; the regression test was updated to the new label.
25. Cross inspection accepted a state-valid plan (`Cross solved by your plan.`) and rolled to a new scramble; the BLD lab validated a memo and reported the expected letter pairs rather than silently accepting.
26. Library: the reconstruction editor lists catalogue completions, and importing the bundled reco.nz study rendered `Yiheng Wang · 3.45`, the competition line, attribution, stats table and a 3D player.
27. A fresh pass over all six surfaces on a clean load produced no console errors.

Eighth pass — saved-solve paths:

28. **A replayed session saved the solve at 1970-01-01**, because a session file carries relative timestamps and they were persisted verbatim. The importer now shifts the whole stream onto the current clock, so a real exported session lands at a sane time.
29. **The saved-solve stage strip listed AUF first** (store order). It is now ordered by the solve timeline.
30. **Penalties were cosmetic.** A `+2` still displayed the raw time and a DNF counted as an ordinary solve in every average. `effectiveSolveMs` now adds two seconds to a `+2` and removes a DNF; history shows `22.14s (+2)` and `DNF (20.14s)`; `averageOf` counts a `+2` at its penalised time, tolerates exactly one DNF inside an ao5 trim and returns nothing for a mean of three containing one. Covered by `src/domain/penalties.test.ts`.
31. Today with real data renders the latest solve, move count, linked raw events, the evidence gate and the ordered stage strip.

Ninth pass — the backup round trip, exercised through the UI rather than through unit tests:

32. **The backup import control had no accessible name**, so a screen reader announced only the label text and automation could not reach it. It now carries `aria-label="Import backup file"`, resets its value after use so the same file can be re-imported, and uses the same overlay styling as the session import.
33. Round trip verified with real data: exported the whole store (75 483 bytes, `smartcube-coach-backup`, schema 4), wiped IndexedDB, reloaded, imported the file, and the database came back with 1 solve, 8 stages, 100 raw events and 33 metric samples. The restored solve renders in history with its replay and stage strip; the panel reports `Backup imported and analysis data restored.` No console errors.

Tenth pass — `$dogfood` on coaching depth, answering "is the coach complete deep inside solves?":

34. Verdict: **no**. `caseId` was declared on every stage and never populated — `casesDetected: 0` — so a solve report said `OLL 1247 ms` without ever naming the case, and no per-case weakness ranking could exist.
35. **Last-layer case recognition added.** `src/domain/caseRecognition.ts` classifies the state entering the OLL and PLL stages against the full 57+21 catalogue by cubie orientation and permutation class modulo AUF, cached per process, verified against the known algorithm of each simulated solve. Reports now read `OLL · OLL 25 Anti-Bowtie` and `PLL · Ab Perm`; an already-solved layer is labelled `OLL skip` / `PLL skip` rather than guessed.
36. **F2L slot identity added.** The engine counted pairs and never said which one. Each pair stage now names the slot it completed (`F2L 1 · BL`), taken from the same rotated reference frame the progress search chose, so it survives inspection rotations. Verified against the real human reconstruction: `FL → FR → BL → BR`, each slot exactly once.
37. **Per-slot and per-case metrics** are emitted and ranked independently, so findings now read `slot_transition_pause · FR slot · 1136 ms` and `case_recognition · <case>`, instead of a single aggregate F2L number.
38. **Phantom AUF stage removed.** Every solve carried an `AUF` row with zero moves at the same event as `PLL`, rendered before it. AUF is only emitted when it consumed a move, and tied stages sort by canonical CFOP order.
39. Remaining depth gaps, recorded honestly rather than fixed: pause location inside a stage, rotation/regrip cost, route comparison against an efficient solution, prescriptions for findings other than `pair_transition_pause`, and personal rather than absolute thresholds.

Eleventh pass — closing the coaching loop rather than asking which gap to close:

40. **Only `pair_transition_pause` produced a drill**, so every other finding dead-ended. `buildPrescription` now carries a plan per metric — slot-specific F2L rescue, named-case recognition, stage TPS, stage efficiency and full-solve consolidation — each parameterised by the finding's scope (slot, case name, stage) and each closing with a full-solve transfer block. Live Solve assigns the highest-priority unassigned finding of any type; the browser produced `Execution turn speed` and `Full-solve consolidation` from real captures.
41. **The coaching text was metric-agnostic** and told the user "you are pausing" about a turns-per-second finding, with the gate printed without units. It now states direction and unit correctly (`landed below the 4 TPS gate`, `above the 500 ms gate`) and gives a verdict matched to the metric.

Twelfth pass — route comparison, and a deliberate stop:

42. **Optimal cross length now exists.** `src/domain/crossSolver.ts` derives edge move tables from `cubing.js` once, then breadth-first searches the 190 080-state cross space; a lookup answers any position in constant time. Verified: solved = 0, `D` = 1, `R2 D` = 2, `R U R' D2` = 1, real scrambles land within the known 8-move worst case, and last-layer algorithms leave the cross at 0.
43. **The comparison was wrong for rotated solves and is now correct.** It first produced `cross actual 5, optimal 7`, which is impossible. Two canonicalisation attempts (`pattern.applyAlg(frame)` and its inverse) made segmentation worse, so they were reverted. A direct probe settled it: the frame transform must be **left** multiplication — `solved.applyAlg(frame⁻¹).applyTransformation(pattern)` — and the rotations executed inside the stage must be applied to the start state first. With that, frame `x2 y'` reports optimal 5 against 5 actual and frame `x2 y2` reports 6 against the human's 7, both consistent. The predicate was never wrong: two different-colour crosses genuinely complete in that solve, and the detector takes the earlier one.
44. **Wasted cross moves are now coached.** `cross_waste` is emitted per solve as `moveCount − optimalMoveCount`, ranked by the recurrence gate, and carries its own `Cross planning` prescription. Tests assert the optimum is never below the moves actually used across simulated captures and that a fully optimal history raises nothing.

Thirteenth pass — the last two depth gaps that were software-reachable:

45. **Pause location.** Each stage now records its longest inter-move gap, the move it stalled before and the move it stalled after, including the gap leading into the stage. Findings name the exact boundary: `F2L 4 before U2 · 1094 ms`, `OLL before R · 1285 ms`.
46. **Rotation cost.** Time spent on `x`/`y`/`z` moves is summed per stage and charged only to stages that actually rotated (the leading-gap bug that reported 0 ms for a stage starting on a rotation was caught by a test and fixed). `rotation_cost` has its own finding and a `Rotation economy` prescription.
47. **Findings no longer fire on a good median.** The engine raised `F2L 1 before U · 294 ms` against a 700 ms gate because *some* samples failed while the median passed. A finding now requires the median itself to fail, so a single bad solve cannot produce a coaching claim.

Fourteenth pass — F2L route comparison, the last item that was called out of reach:

48. **Cross-plus-pair optimum implemented.** `src/domain/pairSolver.ts` searches with IDA* over the combined state of the four cross edges plus one corner-edge pair, guided by two admissible tables: the existing cross depth table and a 576-state pair table built by breadth-first search. Verified against known lengths (`R U R'` = 3, `U R U' R'` = 4, solved = 0) and answered in about a millisecond after the tables exist.
49. **Wired into every F2L stage.** The entry state is transformed into the solver's own frame first, and a figure is withheld whenever it is impossible (below one move, or above the moves actually used) rather than shipped wrong — two pairs of the real human solve legitimately fall into that gap and report nothing. Live captures report `F2L 4 (FR) 15 moves vs 6 optimal`.
50. **Wasted pair moves are coached.** `pair_waste` is emitted per pair stage and carries an `FR solution choice` prescription: name both pieces, choose the shorter insert, execute only that insert, then prove it in full solves.

Fifteenth pass — last-layer route comparison against the repertoire the app already ships:

51. Each recognised OLL/PLL stage now carries the move count of the catalogue algorithm for that case, so the report reads `OLL 15 Squeegee · 24 moves vs 10` when the execution wandered, and `OLL 2 Zamboni · 11 vs 11` when it did not. Wasted moves become `alg_waste` with an execution prescription (find the AUF early, name the algorithm before turning, execute exactly as trained).
52. The claim is deliberately narrow and stated as such: it compares against **the user's own algorithm for that case**, not against a proven optimum, and a skipped last layer reports nothing. A test pins the reported number to the catalogue entry so it cannot drift.

Sixteenth pass — direct user request, verbatim: `MUST HAVE AN OPTION TO REDO THE F2L IN THAT SPECIFIC STATE, FROM CURRENT CUBE STATE, OPTIMIZED ALGORITHM`:

53. The IDA* pair search now returns the **solution**, not only its length, and `src/domain/pairRedo.ts` rebuilds the exact state a pair started from (scramble plus every move before that stage), transforms it into the frame that stage was solved in, and returns your route, the optimal route, and the moves saved.
54. The solve report shows a `Redo <slot> pair` button per pair. In the browser: `You used 15 moves; the optimal route from that state is 5 — 10 fewer. Optimal: R2 U R' U' R2`, with a 3D player of the optimal solution set up from that exact state.
55. The first implementation reported `optimal 0` because the pair's rotation frame was not carried on the stage record; the frame is now stored and used, and a route is withheld rather than shown when it comes back empty. A test replays the returned route from the rebuilt state and asserts the pair ends placed and oriented with the cross still intact.

Seventeenth pass — the two extensions of that request, built rather than offered:

56. **Last-layer redo.** `src/domain/lastLayerRedo.ts` rebuilds the state a recognised OLL/PLL stage started from, searches the four pre-AUFs for the one that makes the trained catalogue algorithm complete the stage, and returns your route beside it. Browser: `Z Perm from that exact state — you used 9 moves; your trained algorithm needs 10 — no moves wasted. Pre-AUF: none.` A test replays the returned algorithm and asserts the last layer is genuinely oriented (OLL) or solved up to AUF (PLL).
57. **Redo into the trainer.** Both panels offer `Send … to trainer`, storing the exact state as the case setup and the optimal or trained route as the algorithm. Verified in the browser: the PLL trainer went from 21 to 22 cases and lists the saved redo.

Eighteenth pass — making the first real pairing self-diagnosing:

58. `src/device/selfTest.ts` runs a check matrix against the live event stream: browser support, secure context, move packets, facelet agreement replayed through the reconciler, solved detection, packet latency (median and worst inter-turn gap), battery and gyroscope. A capability the cube lacks reports `N/A`, an idle cube reports `WAIT` with the action needed, and only a real contradiction reports `FAIL`.
59. Verified both ways in the browser: with no cube it reports `more turns needed` and names each blocker; against the recorded QiYi device it reports `all checks passed · 60 turns received · 63 snapshots agreed with every turn · median 120 ms between turns, slowest 867 ms`. Tests cover the healthy session, a corrupted move stream (sticker check fails), a browser with no Bluetooth, an idle cube and a cube without facelets.

Nineteenth pass — a blocker that would have made the first pairing useless for a whole cube class:

60. **A cube without facelet reporting could never start a solve.** `createScramble` refused while `liveStateReady` was false, and that flag only becomes true once a facelet packet arrives — so for a cube whose capabilities exclude facelets, `New scramble` was permanently blocked behind a resync instruction the cube could never satisfy. The gate now applies only to cubes that actually report stickers; a non-facelet cube is told plainly that the scramble is verified from the move stream alone. The remaining message distinguishes "waiting for the first snapshot" from "solve the cube, then resync".

Twentieth pass — connecting every vendor class through the real UI:

61. Six of the eight shipped captures pair through the application's own `Connect cube` button and report correctly: `QY-QYSC-S-A0E6 · QiYi`, `Giiker i3SE · Giiker`, `GoCube`, `Rubiks Connected · GoCube`, `WCU_MY32_A388 · MoYu32` (gyro detected), `GANi4_A26E · GAN Gen4` (gyro detected). Two — QiYi Tornado and GAN gen2 — fail inside the strict byte-exact mock.
62. Rather than assume that was harness fidelity, both were tested at the driver level: each decodes 30 turns from its own capture. `src/device/vendorDecoding.test.ts` now pins that for every vendor, asserting turns decode and facelets agree with the move stream; GAN gen4 asserts protocol negotiation only, because its capture consumes move traffic during init, and that limitation is written into the assertion message rather than hidden by a loosened expectation.

Twenty-first pass — making the hardware claim self-evidencing:

63. The self-test now persists its verdict with the device name, protocol, timestamp and a `simulated` flag, and Live Solve renders it on load. A recorded device is labelled `recorded device, not hardware`, so no fixture run can ever be mistaken for a physical pairing — in the browser: `Last connection check: Giiker i3SE · Giiker · pass · recorded device, not hardware`, surviving a reload.
64. This closes the evidence loop for the outstanding hardware gap: when a real cube is paired, the same line records `physical device` and the project has its first hardware evidence without anyone having to take a claim on trust.

Twenty-second pass — the blocker between the user and a real pairing:

65. Checking how the app behaves on a LAN address, which is how anyone would open it from a phone, found **a blank page**. `crypto.randomUUID` is unavailable outside a secure context and twenty-one call sites used it, so `LiveSolve` threw during render. All ids now come from `src/domain/ids.ts`, which falls back to `crypto.getRandomValues` and then to `Math.random`, producing a valid v4 id in every context.
66. With the app rendering, the diagnosis is now correct and actionable: the browser check says Web Bluetooth is hidden *because the origin is insecure* rather than blaming the browser, and the secure-context check names the exact origin and the three ways out — localhost, https, or the Chrome insecure-origin allowance.
67. Practical consequence for the hardware handoff: **pairing cannot happen over a plain LAN address.** It must be desktop Chrome on `http://127.0.0.1:5173`, an https deployment, or the Chrome flag for that exact origin.

Twenty-third pass — the same failure class as the silent service worker, found on the storage layer:

68. `HistoryProgress` and `TrainerHub` loaded persisted data inside an unhandled async effect, so a storage failure rendered a normal empty state: `0 immutable captures` and a trainer with no cases, indistinguishable from a fresh install. Both now catch and report `Local storage is unavailable: <reason>`, stating that nothing shown is a real record and that attempts will not be saved. `TodayDashboard` already behaved this way; the three surfaces are now consistent, and a test mocks every repository read to reject and asserts both messages appear.

Twenty-fourth pass — behaviour when a cube emits notation the app does not expect:

69. Probed the capture path and the reconciler with slice, wide, rotation and malformed turns (`M`, `u'`, `x`, `R3`). Neither throws: capture keeps accepting turns and reconciliation reports `unsupported`, so a vendor that emits slice or rotation notation degrades instead of breaking.
70. The wording, however, collided: `Facelet reconciliation unsupported` read the same whether the **cube** could not report stickers or the **app** could not model a turn it received. The two now read differently, and `mismatch` and `invalid` state what they actually mean rather than leaving the reader to guess.

Twenty-fifth pass — what a cube drop costs the user:

71. Tracing what happens to a solve in progress when the cube drops exposed that **`connect()` resets the capture session before connecting**, so every connect *and every auto-reconnect* silently discarded an in-flight scramble or solve. After a mid-solve drop the automatic reconnect wiped the capture and the surface simply showed `idle`, with no statement that anything had been lost.
72. The app now reports the loss at its source and names its size — `Connecting discarded an in-progress capture of N solve moves — an incomplete move stream cannot be analysed. Generate a new scramble.` — and clears the notice when a new scramble starts. Verified in the browser and unit-tested.

Twenty-sixth pass — the provenance of a saved solve:

73. A `SolveRecord` carried **no record of whether its move stream had been verified**. A capture taken while facelet reconciliation reported `mismatch` — a dropped packet — was stored and analysed identically to a clean one, so coaching numbers from a lossy solve were indistinguishable from trustworthy ones. Records now carry `source`, `stateVerified` and a detail string read from the reconciler at save time, and the history line states it plainly.
74. Implementing that exposed a **stale-closure bug**: `saveCapture` is created on the first render and handed to `CaptureSession`, so every piece of component state it read was frozen at mount. A replayed capture was therefore labelled `simulator`. The values it needs are now refs, and the replay path marks provenance before it feeds any packet.

Twenty-seventh pass — correcting a claim I had been repeating:

75. I had been saying the hardware gap exists because this machine has no Bluetooth radio. That is false. `system_profiler SPBluetoothDataType` reports a controller at `6C:7E:67:BE:26:75`, state On, chipset BCM_4388, with GATT among its supported services. The accurate statement is that the machine has a radio and no cube: its entire Bluetooth inventory is one pair of AirPods, with no QiYi, GAN, Giiker, GoCube, MoYu or Tornado name present. The handoff has been corrected.

Twenty-eighth pass — what the browser can actually see:

76. `navigator.bluetooth.getAvailability()` returns **true** in Chrome on this machine, confirming from inside the browser what `system_profiler` showed: the adapter is usable and the Web Bluetooth path is live. `getDevices()` is not exposed in this build, so previously-granted devices cannot be enumerated.
77. That produced a real product check. The self-test previously only asked whether the Web Bluetooth API existed; it now also asks whether an adapter is available, so a user with Bluetooth switched off is told `switch Bluetooth on in system settings` instead of being handed an empty device picker. On this machine the check reads `The browser reports a usable Bluetooth adapter`.

Twenty-ninth pass — an actual radio scan rather than an assumption:

78. Drove Chrome's device chooser through the CDP `DeviceAccess` domain from the running app page: `DeviceAccess.enable`, a user-gesture `requestDevice({acceptAllDevices: true})` with the QiYi, Giiker, GoCube and Xiaomi service UUIDs as optional services, and a listener for `deviceRequestPrompted`. Result: **no BLE device is advertising within range of this machine at all** — not a cube, not anything. The prompt was cancelled and the throwaway browser session closed; nothing was left blocking.
79. This settles the hardware question as far as it can be settled from here. The adapter exists, the browser reports it usable, the scan path works, and there is simply no cube in the room. The pairing requires the physical object and nothing else.

Thirtieth pass — removing the friction from the hardware handoff:

80. Sending a session file is the richest handoff but not the easiest. `Copy diagnostics` now produces a plain-text summary — origin and whether the device was a recording, device name, protocol and MAC, capability flags, packet counts, verdict and every check line, plus recorded connection errors — and copies it to the clipboard. The automation context blocks clipboard writes, which surfaced the need for a fallback: the same text renders in a selectable block rather than the action silently failing.

Hand-over procedure for a real cube session: open Live Solve, enter the MAC if the cube needs one, tick `Show all devices` if the cube is not offered, press `Connect cube`, turn the cube for a while and do one solve, then press `Export device session` and send the JSON. If pairing fails, export anyway — the file carries the advertised name and the exact error.

Browser evidence, session `coach-live` against `http://127.0.0.1:5173/`:

- Seven captures at 17.13 s – 22.10 s persisted with full stage splits; Progress renders Cross → F2L 1-4 → OLL → PLL → AUF with recognition, execution, TPS, moves, rotations and pauses.
- 207 metric samples, 14 recurring findings and one prescription produced through the shipped gate of five compatible samples.
- Train shows 57 unlearned OLL cases and 21 unlearned PLL cases.
- Zero console errors.

Connected-cube evidence, fresh session `coach-fresh` at `http://127.0.0.1:5173/?replayCube=qiyi`:

- `Connect cube` produced `QY-QYSC-S-A0E6 · QiYi`, `Gyro unsupported by cube`, `Facelet reconciliation verified`, `Live sticker state synchronized`, with zero console errors on a clean load.
- Raw events persisted from the device stream: 1 294 moves, 97 facelet snapshots, 1 battery, 1 hardware packet.
- `Connect controller` in Train advanced the target to 4 / 4 from the cube's own turns (`U R' U' R' F R R U' R' …`), reported `Controller pass complete`, kept the cube connected for the next case, and persisted twelve `smart-cube` algorithm-rehearsal attempts.
- `bun run test -- src/device/connectedCube.test.ts` pairs the recorded QiYi through `connectWebCube`, checks protocol, name, MAC and capabilities, and drives capture, reconciliation and CFOP segmentation from the connected stream.
- With `?replayDrop=1` the device stream ends in a `DISCONNECT`: the toolbar walked `QY-QYSC-S-A0E6 · QiYi → Cube dropped · reconnecting (1/3) → … (2/3) → … (3/3) → Cube keeps dropping · reconnect manually`, with no console errors.
- An entered MAC (`CC:A3:00:00:A0:E6`) connected, persisted to settings and was restored after a reload.

## Verification artifact

- `bun run test -- --pool=threads --maxWorkers=2`: 34 files, 137 tests, exit 0.
- `bun run typecheck`: exit 0.
- `VITE_BASE_PATH=/smartcube-coach/ bun run build`: succeeded, chunk-size warning only.
- `git diff --check`: clean.
- `docs/research/feature-harvest.md` and this receipt read back after writing.

## Explicitly unverified

- Physical smart-cube behavior: no cube paired this turn. The MAC-entry path is unit-tested and rendered, but no QiYi packet has been decoded from live hardware, and no live radio, reconnect, battery or gyro reading has been observed.
- The dev server on port 5173 was started this turn to obtain browser evidence, because the one named in the previous handoff was gone.
- What real hardware data would settle: a capture of the advertised device name exactly as the browser picker shows it, plus one paired session producing MOVE and FACELETS packets during a normal solve, and one disconnect/reconnect. That is the only remaining input the software cannot produce for itself.
- Solved.no `/trainers` and `/algs` are client-rendered, so trainer card copy and the algorithm database could not be read; Learn mode and daily puzzles are login-gated.
- Protocol-level packet-loss behaviour per vendor is reported from the delegated read of `smartcube-web-bluetooth`, not re-verified line by line here.
- No commit, push, or deploy was made.
