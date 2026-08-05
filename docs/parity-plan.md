# Reference parity plan

What the reference set ships versus what this app ships, and the order it gets built. Sources: `docs/research/feature-harvest.md`, `docs/research/harvest-refresh-2026-08-03.md`, `docs/research/reference-findings-2026-08-03.md`, plus the shipped UIs of acubemy, cubedex, csTimer and solved.no inspected in a browser on 2026-08-03.

Rule for this file: a row moves to **shipped** only when it has been driven in a running browser and a test pins the behaviour. Code existing is not shipping. `docs/feature-status.md` stays the honest per-capability record; this file is the work queue.

## Tier −1 — the smart cube, which outranks everything below

The main feature. Every row here was reported by the user against his own QiYi captures, and every one is reproducible from `src/device/fixtures/user-sessions/` without hardware.

| Capability | State |
|---|---|
| Cube state stays in sync with the rendered cube through a real scramble and solve | **broken** — reported: cube state diverges from the rendered cube during a live session |
| Resync recovers a divergence instead of worsening it | **broken** — reported: resyncing made the divergence worse, not better |
| Timer auto-starts on the real first solve move and runs | **broken** — reported: timer does not auto-start and does not advance |
| Solve duration is a sane number from a trustworthy clock | **broken** — reported: recorded solve duration is a random, untrustworthy value |
| Scramble verification does not false-alarm on a correctly scrambled cube | **broken** — reported: scramble verification repeatedly false-alarms as wrong/diverging on a correctly scrambled cube |
| A real solve segments into correct CFOP stages | **broken** — reported: solve is not segmented/divided into stages correctly |
| Internal reconciliation state stays out of the user's face | **broken** — reported: internal reconciliation status is surfaced to the user as unexplained noise |
| Cube connection is global across every route, not owned by Live Solve | **not implemented** — reported: cube disconnects on navigating away; connection should be global and usable on every page |
| Cube movement renders smoothly | **broken** — reported: cube movement rendering is not smooth |
| `R`+`L'` recovered to `M'`, slice notation in reconstructions | **not implemented** — requested 2026-07-30, twice: that `R L'` resolve to `M'` and that this handling be done properly. Reference solves it at `MoveSequence.js:107-215`. Almost certainly the cause of the solve-segmentation defect above. |
| Rotation calculation is gyro-independent | **not implemented** — requested: rotation calculation must be gyro-independent, rejecting orientation-normalized notation reduced to a stream of raw `L`/`D`-style moves |
| Interactive 3D cube | asked 2026-07-30 — requested an interactive 3D cube; none was visible in the running app |
| Real-time solution optimiser / slow-solve help, one move at a time | partial (`guidedSolve`) — requested real-time slow-solve assistance: an efficient-solution optimizer/solver presented one move at a time |
| Trainer as a state-agnostic remote controller | shipped (`RemoteTrainerController`) — requested the trainer act as a remote controller that responds to any turn without regard to current cube state; reference `f2l-trainer.top` was never inspected |

## Tier 0 — the app is not a timer without these

| Capability | Reference | State |
|---|---|---|
| Keyboard timer: hold Space to arm, release to start, any key to stop | csTimer, acubemy, solved.no | **shipped** — driven in a browser: armed → running → stopped → persisted |
| WCA inspection countdown with the +2 / DNF rule applied at the transition | csTimer `timer.js` | code complete; countdown tick defect fixed, not yet re-verified in a browser |
| Sessions: named, switchable, every solve belongs to one | csTimer, acubemy | **shipped** — verified in IndexedDB (`sessionId: default`) |
| ao50 / ao100 / ao1000 alongside ao5 / ao12 | acubemy stat rail | code complete, ao1000 row added |
| NOW versus BEST columns for every average | acubemy | **shipped** — verified in browser |
| Times list for the active session, newest first | csTimer left rail | **shipped** — verified in browser |
| Per-solve comment | csTimer, solved.no | code complete, unverified in browser |
| Per-solve inspection time recorded | solved.no | code complete, unverified in browser |
| Personal-best threshold: what the next solve must beat | csTimer `stats.js` | code complete — `personalBestTarget`, pinned by a boundary test |
| csTimer CSV import and export | csTimer, solved.no | code complete — `src/domain/csTimerFormat.ts`, 19 tests verified by me, covering quoted delimiters, CRLF, missing trailing newline, absent Comment column, `DNF(12.34)` and `12.34+`, and malformed rows reported rather than dropped. Reachable from the Local data panel since the dead-code sweep caught it having no UI entry point. Not yet exercised in a browser. |
| Analysis on a solve with no captured moves (attach a typed reconstruction) | this app — unblocks coaching without a smart cube | code complete, 12 tests verified by me. A typed solution is state-checked against the solve's own scramble and rejected outright if it does not solve it; on acceptance it runs the SAME `segmentCfop` path as a captured solve, yielding real stages, OLL/PLL identity and cross/pair route comparison. Per-move timing is absent by construction and must never be fabricated. Findings and prescriptions still do NOT run from an attached-only solve — they need metric samples that only real timing can produce. Not yet exercised in a browser. |

## Tier 1 — trainer breadth

| Capability | Reference | State |
|---|---|---|
| F2L full catalogue (4 slots, 164 cases) | F2LTrainer, cubedex | wired, needs browser proof |
| OLL 57 / PLL 21 | everyone | shipped |
| Case library grid with category, subset and learning-state filters | cubedex | in progress |
| Per-case mean, best single, ao5, ao12, attempt count, success rate | solved.no | shipped — `caseAverages` reuses `averageOf` unchanged so the trim rules stay shared; a case without enough attempts renders an em dash, never a zero. ao100 still absent. |
| Practice a chosen selection of cases | cubedex "Practice Selected" | shipped — restricts the existing weighted picker to the selection, and states what it needs when nothing is selected rather than sitting inert |
| 2-Look PLL subset | cubedex | shipped — Aa/Ab corner permutation ∪ H/Ua/Ub/Z edge permutation, 6 of 21, derived from real catalogue ids |
| OCLL subset | cubedex, solved.no | shipped — exactly OLL 21-27, pinned by id list |
| 2-Look OLL (the full 10-algorithm method) | cubedex | agent in flight. A first attempt defined it as 8 zero-edges-oriented full-OLL cases ∪ OCLL = 15 and was **rejected as a domain error**: 2-look OLL is 3 edge-orientation algorithms plus the 7 OCLL. The catalogue had no edge-orientation-only entries, so the honest interim was to ship OCLL alone; the 3 EOLL cases are now being added with the same state verification the 57 OLL cases already carry. |
| COLL catalogue | solved.no, cubedex | **40 cases state-verified**, not 42. The agent refused to pad the count: speedcubedb and CubeSkills both list 40 distinct non-mirrored COLL cases, and inventing two to hit a round number would have been fabrication. Verification applies setup then algorithm on a real `kpuzzle` and asserts the cube ends solved with F2L intact throughout. Now seeded and exposed as a COLL pill with 7 corner-orientation families. |
| CMLL catalogue | solved.no, cubedex | **42 cases state-verified**, with first-two-blocks intact and the M slice deliberately disregarded (M-slice edge indices confirmed by probe, not assumed). One case carried a transcription error that the distinctness check caught — a duplicate state signature — and was corrected against the source. Now seeded and exposed as a CMLL pill with 8 corner-orientation families. |
| WV, ZBLS, 2GLL, ZBLL, LSE catalogues | solved.no, cubedex | not started |
| Recap / Weighted / Learn drill modes | solved.no | Learn and Drill only |
| Weighted case selection by solve-count and time deficit | F2LTrainer `trainCases.ts` | shipped (`chooseTrainingCase`) |
| Two-sided recognition | solved.no | shipped — `deriveTwoSidedRecognitionView` applies the case's real setup through a KPuzzle, reorients, and reads exactly the six stickers a solver can see on the front and right top rows. Nothing else is shown: no U face, no hidden layers, and the 3D player is hidden in this mode so the answer cannot be read off it. Offered only for last-layer sets, since two-sided recognition is a last-layer concept. Attempts persist as `recognition`/`typed-answer` using existing enum values. |
| Time Attack with per-case targets and ordering | solved.no | shipped — selection order is the run order with reorder controls, per-case target defaults to the case's real `targetMs`, current card is marked, and the run summary is counted from persisted attempts with a real `targetSatisfied`, never a fabricated tally. |
| Predictors: pair, OLL, PLL, ZBLL | solved.no | not started |
| Time Attack with per-case targets | solved.no | not started |
| Follow the Moves | solved.no | not started |
| Mirror / rotate / AUF-as-distinct-case toggles | solved.no, F2LTrainer | not started |
| Learning state shared by URL | F2LTrainer base-62 encoding | not started |
| Hint ladder: step / all-at-once / always / hidden | F2LTrainer | partial (3-level hint) |

## Tier 2 — analysis and reconstruction

| Capability | Reference | State |
|---|---|---|
| CFOP stage split with recognition / execution per stage | smart-cube-timer, csTimer | shipped |
| OLL / PLL case identity inside a solve | smart-cube-timer | shipped |
| Cross and pair route comparison against optimal | this app's own IDA*/BFS | shipped |
| Split %, ETM and ETPS columns | reco.nz stats table | code complete — `src/domain/solveMetrics.ts`, 23 tests. STM counts a slice as 1, ETM counts it as 2, a whole-cube rotation counts 0 in both, and a wide move counts as a plain face turn; each rule has its own test. STM and ETM are real for every stage. **Split %, STPS and ETPS render as an em dash for most individual stages** because reco.nz reports timing at a coarser grouping (F2L / LL / OLS) than the reconstruction's per-stage list, and backfilling per-stage durations would mean inventing data. Debt: the table wrapper uses an inline `overflowX` style instead of a class, contrary to `design-system.md`. Not yet exercised in a browser. |
| Ghost-text completion anchored to the caret | Ao1K | partial (literal prefix only) |
| State-search move suggestions | Ao1K, solved.no | partial |
| Sticker editor for manual state entry | solved.no | not started |
| Advanced criteria algorithm search | Ao1K positional index | not started |
| Roux / ZZ stage detection | smart-cube-timer | not started (selector exists, no engine) |

## Tier 3 — deliberately out of scope

Accounts, cloud sync, 1v1 matches, tournaments, daily puzzles, points and streaks, Discord. This app is local-first with no account, per `AGENTS.md`. Revisit only if the product requirement changes.

## Known dishonesty to clear

- `docs/feature-status.md` still calls the F2L trainer "three independently authored starter cases" while `TrainerHub.tsx` builds the full catalogue. Reconcile once the catalogue is proved in the browser.
