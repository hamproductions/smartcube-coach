# Feature harvest

Rewritten 2026-08-03 from a fresh read of every source in the closed research set (`AGENTS.md`). The previous revision listed capabilities; this revision records the data, encodings, formulas and thresholds needed to reimplement them, plus the licence boundary that governs each one. Working notes and the reading ledger are in `harvest-refresh-2026-08-03.md`.

## Source ledger and licence matrix

| Source | Checkout / access | Licence evidence | Reuse boundary |
|---|---|---|---|
| `Ao1K/Ao1K_site` | re-cloned 2026-08-03 | `LICENSE:1-21` MIT, © 2025 Ao1K | Code **and** the compiled algorithm databases may be reused, including verbatim, if the MIT notice travels with them |
| `poliva/smartcube-web-bluetooth` | re-cloned 2026-08-03 | `LICENSE.txt:1-22` MIT | Direct dependency or fork with notice retained |
| `hakatashi/smart-cube-timer` | re-cloned 2026-08-03 | `LICENSE:1-21` MIT, © 2018 Koki Takahashi | Algorithms and case tables reusable with notice; the 2018 Nuxt UI is not worth porting |
| `cs0x7f/cstimer` | re-cloned 2026-08-03 | `LICENSE` GPL-3.0 (675 lines) | **Behaviour reference only.** No code text, no pruning tables, no case tuples, no key tables. Formulas, WCA conventions, BLE UUIDs and CRC polynomials are facts and may be reimplemented |
| `Dave2ooo/F2LTrainer` | re-cloned 2026-08-03 | **No licence file exists in the repository** — verified by listing the root; MIT is declared only in `package.json` and the README badge | Concepts and structure may be reimplemented with attribution; do not copy case data or code text until a licence text exists |
| `solved.no` | public pages fetched 2026-08-03 | none supplied | Product behaviour inspiration only |
| `reco.nz` | public pages fetched 2026-08-03 | no terms, licence or API policy exists on the site (`/about`, `/faq` read in full) | Keep the single attributed bundled solve; no bulk reuse |

## 1. Ao1K/Ao1K_site — MIT, the richest reusable asset

### 1.1 Shipped data (the reason this source matters)

| Asset | Shape | Contents |
|---|---|---|
| `public/recon/compiled-exact-algs.json` | `{timestamp, step, totalAlgorithms, algorithms[]}` | **5 805** F2L algorithms, each `{alg, hash (26 chars), eoValue (12-bit), step}`, speed-sorted. First record: `{"alg":"R U R'","hash":"ibdaefghcjkljhbodqtwabcdef","eoValue":0}` |
| `public/recon/compiled-oll-algs.json` | same wrapper | **282** OLL algorithms, `{alg, caseIndex 1-57, refPieceMovement 0-3, minMovements[], frequency}`. First record: `{"alg":"R U R' U R U2' R'","caseIndex":27,"frequency":34}` |
| `public/recon/compiled-pll-algs.json` | same wrapper | **126** PLL algorithms, `{alg, caseIndex 1-21, refPieceMovement, minMovements[], frequency}` |
| `public/recon/oll-patterns.json` | `{patterns[]}` | **57** `{caseIndex, name, pattern}` where `pattern` is the canonical base-6 integer, e.g. case 1 → `132231612201978000` |
| `public/recon/pll-patterns.json` | `{patterns[]}` | **21** `{caseIndex, name, pattern}`, e.g. `Aa` → `836671553945855` |
| `utils/algFrequencies.tsx` | arrays | 261 OLL + 86 PLL competition-frequency entries |
| `utils/rawGenericData.json` | 806 KB | 5 805 raw F2L candidates before compilation |

Records live under the `algorithms` / `patterns` key, not at the top level — a loader must unwrap the envelope.

### 1.2 Algorithms worth reimplementing or importing

| Capability | Evidence | Behaviour | Destination | Caveat |
|---|---|---|---|---|
| 26-character state hash | `composables/recon/SimpleCubeInterpreter.tsx:1637-1841`, `docs/hash-system.md` | 12 edge chars + 8 corner chars + 6 centre chars; solved = `abcdefghijklehkbnqtwabcdef`. Rotation recovered from U and F centre colours via a 24-entry map, colours remapped into that frame, each piece encoded as slot+orientation (`location*3+axis` for corners) | `src/domain/faceletReconciliation.ts` as an O(26) equality key instead of full facelet diffing | Fixed to 3×3 and to the repository's solved-state string |
| Positional inverted index for algorithm lookup | `composables/recon/ExactAlgSuggester.tsx:32-191` | `Map<position 0..25, Map<char, Set<algId>>>` built from every algorithm's hash; query supplies `must`/`may`/`not` per position, intersect–union–subtract, score `100 × musts + 1 × mays`, sort, limit | Upgrade for `suggestReconstructionCompletions`, which today only matches literal typed prefixes | Requires the hash above; index build is O(algs × 26) |
| Rotation-invariant OLL/PLL recognition | `composables/recon/LLinterpreter.tsx:6-324` | Build a 5×5 last-layer colour grid, apply a step mask, remap PLL through a spiral index so an AUF becomes an array rotation, encode base-6, take the **minimum across the four U rotations** as the canonical key, look it up in the pattern JSON | `src/domain/lastLayer.ts` already derives the same invariant from cubie orientation/permutation classes; the sticker-grid form is what a camera or facelet packet gives us | Only OLL and PLL populated; ZBLL/EO/CP maps are scaffolding |
| AUF optimisation | `composables/recon/LLsuggester.tsx:12-169` | OLL: `preAUF = (4 + algMove − caseMove) % 4`, preference order `[0,1,3,2]`. PLL: brute-force all 16 pre/post pairs against cost table `[0,1,2,1]`, tie-break by the same preference order; trailing rotations rewritten to F/F'/F2 | Trainer case presentation and reconstruction alternatives | Assumes the green-white edge as reference piece |
| Ergonomics score | `composables/recon/AlgSpeedEstimator.tsx:6-75` | `score = Σ(base[face] × modifier) × 1.2^distinct-move-types × (1.5 if EO-affecting) / 10`, base U=1, R=1, D=1.05, L=1.05, B=1.3, M=1.3, F=1.5, E=3.0; modifier plain 1, prime 1, double 1.6 | Ranking alternatives before personal execution data exists | The author labels the constants uncalibrated |
| Alg database compiler | `utils/AlgCompiler.tsx:31-1123` | Parse → combine → expand F2L angle variants (`y`, `U`) → filter known-inefficient endings → dedup by normalised form → stamp hash + `eoValue` by inverse-applying to a solved cube → stamp `caseIndex`/AUF/frequency for LL → sort by speed | Build script if we generate our own corpus | 1 100 lines, heuristic filters |
| Ghost-text completion UX | `docs/suggestion-system.md`, `components/recon/SuggestionManager.tsx`, `MovesTextEditor.tsx` | Completion rendered outside the contentEditable, anchored by a caret rectangle measured in a layout effect (not `useEffect`, to avoid one-frame jitter); Tab accepts, Escape dismisses; the ghost never enters the serialized text or URL | `src/components/ReconstructEditor.tsx` | Documented jitter gotcha |
| Move-text parser | `composables/recon/validateTextInput.tsx:8-320` | Tokenises comments, hashtags, nested parentheses, bounded repetitions, painted HTML, and 66 legal move strings | Editor validation | Syntax only, no legality checks |
| Adaptive replay tempo | `components/recon/TwistyPlayer.tsx:61-67,680-782` | `tempoScale = 1.5^(speed/15) − 0.6`; single-move diffs use `experimentalAddMove` instead of a re-render; queue backlog accelerates tempo; 2 s safety timeout | `src/components/CubePlayback.tsx` for live BLE-driven playback | Hardcoded timeout |
| Untimed practice with pre/post-solve checklists | `app/notimer/page.tsx`, `composables/notimer/db.tsx` | Dexie stores solves plus checklist items whose state is inherited from the previous solve; checks are placed pre- or post-solve | A pre-solve routine drill we do not have | Author flags unfinished delete/scroll paths |
| EO lesson content | `components/learn/postContent/eo.tsx:1-265` | Good/bad edge definition through RLUD-solvability, sticker-orbit model, y-rotation flip rule, pair-selection strategy | Teaching copy for the edge-orientation drill | Content, not algorithm |
| Rotation simplification | `composables/recon/simplifyRotations.tsx:19-149` | Multiplies rotation matrices, returns an equivalent sequence of at most two rotations | Reconstruction cleanup | Assumes valid space-delimited input |

**Decision.** Import the MIT OLL/PLL corpora and the pattern tables with the notice retained, and keep our state-verified generator (`src/domain/lastLayer.ts`) as the acceptance test for anything imported. Adopt the hash + inverted index before writing any more hand-authored case data.

## 2. poliva/smartcube-web-bluetooth — MIT hardware layer

Drivers present in `src/smartcube/protocols/`: `gan.ts`, `giiker.ts`, `gocube.ts`, `moyu-mhc.ts`, `moyu-v1.ts`, `moyu32.ts`, `qiyi.ts`, each with replay or unit tests beside it, behind `connectSmartCube()` (`src/smartcube/connect.ts`).

### 2.1 QiYi — the exact reason our pairing fails

Read directly this turn, because `Unable to determine QiYi cube MAC address` is the live blocker:

- The protocol needs the six-byte BLE MAC as message content, not as a key: `QiYiConnection` splits the MAC and appends the six bytes in reverse order to every hello frame (`src/smartcube/protocols/qiyi.ts:133-167`).
- Transport: service `0000fff0-…`, characteristic `0000fff6-…`, AES-128-**ECB** with the fixed key `[87,177,249,171,205,90,232,167,156,185,140,231,87,140,81,8]`, frame `0xFE, length, content…, CRC-16/Modbus (poly 0xA001) little-endian`, zero-padded to a 16-byte block (`src/smartcube/attachment/mac-probe-qiyi.ts:1-50`).
- MAC resolution order (`qiyi.ts:404-461`): advertisement manufacturer data → cached MAC for the device → `macProvider(device, false)` → manufacturer data read again → **name-derived candidates** → optional cryptographic address search over those candidates → `macProvider(device, true)` → throw.
- Name-derived candidates (`src/smartcube/attachment/mac-candidates.ts`) accept only three exact patterns: `QY-QYSC-A-XXXX` → `CC:A2:00:00:XX:XX`; `QY-QYSC-S-XXXX` → `CC:A3:00:00:XX:XX` and `CC:A3:00:01:XX:XX`; `XMD-TornadoV4-i-XXXX` → `CC:A6:00:00:XX:XX`. The regexes are anchored and require exactly four hex characters.
- Scan filters accept only `QY-QYSC` and `XMD-TornadoV4-i` name prefixes (`qiyi.ts:469-478`).

Consequence for us: the failure means the browser supplied no manufacturer data and the advertised name did not match those anchored patterns. The correct next moves are (a) surface the exact advertised name — already done in `src/device/webBluetooth.ts` — and (b) expose a **user-entered MAC** through the existing `macProvider` hook rather than inventing a candidate. No MAC may be guessed.

### 2.2 Protocol breadth and delivery guarantees

The dependency is already `github:poliva/smartcube-web-bluetooth#44f1f09` (`package.json:22`) and `src/device/webBluetooth.ts` imports its source entry point, so **all** drivers — GAN gen1–4, Giiker, GoCube, MoYu MHC, MoYu v1, MoYu32 and QiYi — are reachable today; only QiYi has been exercised in our UI. Reported by the protocol read and not independently re-verified here: GAN gen3/gen4 support a move FIFO with history requests, QiYi carries an eleven-slot embedded move history, and MoYu32 only logs on loss with no recovery. Our capture layer treats every protocol identically, so that asymmetry is currently invisible to `src/device/capture.ts`.

The capability list from the previous harvest revision (multi-vendor connection, typed event stream, capability-gated commands, drift-corrected move timing via linear regression, cubie-to-facelet conversion, GAN Smart Timer states, recorded-traffic replay tests) remains accurate and is retained below.

| Capability | Evidence | Behaviour | Destination | Caveat |
|---|---|---|---|---|
| Unified multi-vendor connection | `README.md:34-85`, `src/smartcube/index.ts:2-36` | GAN, Giiker, GoCube, MoYu MHC/WRM, MoYu32 and QiYi drivers behind one entry point | `src/device/webBluetooth.ts` | Capability varies per device |
| Typed event stream | `src/smartcube/types.ts:4-55` | MOVE, FACELETS, GYRO, BATTERY, HARDWARE, DISCONNECT with host timestamps; moves also carry local and cube clocks | `src/device/capture.ts` | Several fields nullable |
| Capability-gated commands | `src/smartcube/types.ts:57-79` | request-facelets, battery, hardware, reset plus per-connection capability flags | Connection diagnostics | Never assume a command exists |
| Drift-corrected move timing | `README.md:176-183`, `src/utils.ts:16-78` | Linear regression fits the cube clock to the host clock and interpolates missing cube timestamps | Stage and pause metrics | Missing timestamps imputed at ±50 ms; keep provenance |
| Clock-skew diagnostic | `src/utils.ts:80-89` | Reports cube/host skew as a percentage | Device health panel | Needs enough timestamped moves |
| Cubie→facelet conversion | `src/utils.ts:91-158` | Corner/edge permutation and orientation to a Kociemba facelet string | Shared state representation | Fixed URFDLB ordering |
| Recorded-traffic replay tests | `src/test/fixtures/types.ts:1-45`, `src/test/helpers/fixture-replay.ts:1-10`, `protocols/*.replay.test.ts` | Captured service discovery, reads, writes, notifications and expected events replayed deterministically | Hardware regression suite without every physical cube | Proves parsing, not radio behaviour |

## 3. hakatashi/smart-cube-timer — MIT, solve analysis

| Capability | Evidence | Behaviour | Destination | Caveat |
|---|---|---|---|---|
| Four recognition datasets | `lib/data.js:16-175` | OLL 57, PLL 21, **CLL 43**, **LSEO 9**, each `[name, algdbId, pattern]`. OLL pattern `[CO1..CO4, EO1..EO4]` clockwise per the diagram at `lib/data.js:6-13`; PLL `[CP1..CP4, EP1..EP4]`; CLL `[CP…, CO…]`; LSEO `[bottomMisorientedCount, EO1..EO4]` | Case metadata and Roux support | Provenance of the tables is not documented upstream |
| State → case mapping | `lib/utils.js:64-113` (`facePiecesMap`), `674-723` (`getFaceOrientations`, `getFacePermutations`), `541-629` (`getOll`, `getPll`, `getCll`, `getLseo`) | Project cubie arrays onto a per-face four-slot ordering, then rotate (OLL/LSEO) or rotate **and** modularly shift (PLL/CLL) and compare | Recognition for captured solves | Both lookups `assert(false)` when nothing matches — a crash, not a fallback |
| Recognition vs execution split | `lib/utils.js:967-973`, `lib/MoveSequence.js:231-280` | `inspection = firstNonTrivialMove.time − previousStageTime`, `execution = stageEnd − firstNonTrivialMove.time`; "first non-trivial move" is a fixed-point same-face cancellation that also skips a single leading up-face turn | `src/domain/reconstruction.ts` stage metrics | TODO in source: slice/commuting cancellation such as `U D U' D'` is unhandled |
| Stage state machine | `lib/SolveAnalyzer.js:74-162` | Mirror each move onto a cube, probe `findCross`/`findRouxBlock` while the method is unknown, then advance one stage per satisfied predicate, recording the move timestamp as stage completion | `src/domain/reconstruction.ts` | F2L progress is "≥ N pairs solved" (`utils.js:725-827`), never per slot |
| Cross detection | `lib/utils.js:528-539` | For each of six faces, all four touching edges must satisfy `eo === 0 && ep === index` | Segmentation | Complete cross only, no partial scoring |
| Roux block detection | `lib/utils.js:496-526`, `831-940` | Search six candidate side faces × four rotations for two stacked 2×2 blocks, then walk `block2 → cll → lseo → lsep` | A Roux adapter we do not have | Source comment at `utils.js:909`: LSEO detection ignores centre orientation |
| Two-look detection | `lib/SolveAnalyzer.js:146-157` | `isOll2Look` fires when an edge-oriented-but-unsolved OLL state appears after a check where edges were unoriented; `pllLooks` counts distinct PLL cases seen while still in the PLL stage | Weakness detection | Runs the predicate on every move |
| Slice recovery and notation | `lib/MoveSequence.js:107-215` | Opposite-face opposite-sign adjacent pairs collapse into M/E/S, with the implied cube rotation folded into a running orientation so subsequent moves stay readable | Reconstruction display | Stateful and fragile; the Roux branch asserts an orientation assumption |
| Move accumulation modes | `lib/MoveSequence.js:70-99`, `282-356` | `reduction` cancels opposite turns to zero (used to consume a scramble); `addition` merges same-sign turns and splits overflow beyond ±2 (used to accumulate a live solve) | Capture and scramble verification | Keep the two modes distinct |
| Migration by replay | `lib/db.js:139-261` | Schema v4 re-runs `SolveAnalyzer` over stored raw turns to regenerate every derived field and rebuilds the aggregate case tables | Our migration policy, which claims raw-event primacy but has never exercised it | — |
| Per-case aggregates | `lib/db.js:265-315` | Running `{count, times, inspectionTimes, executionTimes}` per case | Weak-case ranking | **Bug not to copy:** `lib/db.js:299-312` reads the PLL record keyed by `ollCase` |
| Export | `lib/db.js:346-363` | `"time";"scramble";"iso date"` text plus a full JSON dump | Backup parity | Import was never implemented upstream |

## 4. cs0x7f/csTimer — GPL-3.0, behaviour reference only

### 4.1 The 3×3 trainer subset checklist

Registered in `src/js/scramble/scramble_333_edit.js:1109-1150` (verified by reading the registration block): `333`, `333fm`, `edges`, `corners`, `333custom`, `ll`, `lsll2`, `f2l`, `zbll`, `zzll`, `zbls`, `ttll`, `eols`, `wvls`, `vls`, `lse`, `cmll`, plus `cll`, `coll`, `ell`, `2gll`, the Mehta family (`mt3qb`, `mteole`, `mttdr`, `mt6cp`, `mtl5ep`, `mtcdrll`), the restricted-generator sets (`2gen`, `2genl`, `3gen_F`, `3gen_L`, `RrU`, `half`, `333drud`), and the planning sets (`easyc`, `easyxc`, `eoline`, `eocross`). Each registration may carry a filter, a probability table and an image generator — that triple is the shape a trainer catalogue needs. **We currently ship none of these subsets**; this list is the roadmap.

### 4.2 Statistics definitions (facts, safe to reimplement)

- Solve record: `[[penalty, base, phaseEnd…], scramble, comment, timestampSeconds, extension?]` with `penalty ∈ {0, 2000, −1}` so `+2` adds directly and `−1` is the DNF sentinel (`src/js/stats/stats.js:4`, `951-960`).
- Trim rule (`src/js/stats/timestat.js:12-31`, read directly): `p<N>` trims `ceil(n × N/100)`, `m` trims `n >> 1`, otherwise a fixed count; when `triml + trimr === n` both decrement by one. `ao` trims, `mo` does not.
- DNF invalidation (`timestat.js:145-156`): the average is DNF when `dnfCount ≥ size − rightTrim`.
- Personal-best threshold (`timestat.js:214-254`): `tgt = bestAvg × nEff − (keptSum − valueLeavingWindow)`, returning −1 for impossible and −2 for always-breaks.
- Reconstruction metrics (`src/js/stats/recons.js:79-162`, `218/230/238`): per step `inspection = firstMove − stepStart`, `execution = stepEnd − firstMove`, `TPS = moves / (inspection + execution)`.
- Inspection penalty, applied identically by every timer input (`src/js/timer/virtual.js:29`, verified): `> 17 000 ms → DNF`, `> 15 000 ms → +2`, else none.
- Period bucketing (`src/js/stats/dlystat.js:42-96`) and histogram binning (`distribution.js:28-57`).

### 4.3 Techniques to reimplement independently

Random-state-then-inverse-solve scrambling; constrained sampling for case subsets; coordinate + pruning-table IDA* for step solvers (`tools/cross.js:14-101`, `tools/roux1.js:8-87`, `tools/eoline.js:7-70`); Thistlethwaite staging with NISS (`tools/thistlethwaite.js:6-137`); BLD cycle enumeration and constrained state sampling (`tools/bldhelper.js:6-255`) plus buffer-cycle memo encode/decode (`265-394`); pattern probability as `matchingStates / 43 252 003 274 489 856 000` (`tools/pat3x3gen.js:124-142`); live scramble hinting (`tools/bluetoothutil.js:11-102`); swapped-move detection by bounded DFS (`302-321`); device-clock least-squares fit (`407-435`); an order-statistics tree for O(log n) rolling averages (`timestat.js`).

**Boundary restated.** Do not copy pruning tables, case tuples, probability weights, key tables, or any function body. BLE UUIDs, CRC polynomials, WCA conventions and the formulas above are not csTimer's expression.

## 5. Dave2ooo/F2LTrainer — licence text absent, reimplement

### 5.1 Case model, counted from the data

| Group | Cases | Categories | Algorithm strings | Scramble strings | AUF |
|---|---|---|---|---|---|
| `basic` | 41 | 11 | 279 | 338 | ignored for 37–41 |
| `basicBack` | 41 | 11 | 82 | 809 | ignored for 37–41 |
| `advanced` | 60 | 9 | 132 | 768 | ignored for 55–60 |
| `expert` | 33 | 6 | 119 | 340 | ignored for all |

Total **175 cases** (`src/lib/types/group.ts:4-428`). A second orthogonal taxonomy in `src/lib/types/caseAttributes.ts:19-1149` tags every case with corner position (`top`/`bottom_correct`/`bottom_wrong`), corner orientation (`up_down`/`front_back`/`side`), edge position (`top`/`solved_slot`/`wrong_slot`) and edge orientation, which drives the filter UI. Case records also carry `pieceToHide` for the free-slot groups and an alias table for advanced cases 43–60.

### 5.2 Mechanisms

| Capability | Evidence | Behaviour |
|---|---|---|
| Smart weighting | `src/lib/trainCases.ts:81-191` | `solveWeight = 1 + min(2, (maxSolves − solves)/3)`, `timeWeight = 1 + min(2, max(0, caseAverage − overallAverage)/100)` over the last five timed solves, `weight = round(min(3, max(...)))`, candidates pushed `weight` times then shuffled once. Recap mode forces weight 1 |
| Queue and history | `src/lib/trainCaseQueue.svelte.ts:27-268` | Regenerates a whole batch when the index runs off the end; history navigation rebuilds a case from the stored solve so the replayed prompt is identical |
| State predicates | `src/lib/utils/checkF2LState.ts:31-176` | KPattern slots `fr {edge 8, corner 4}`, `fl {9,5}`, `br {10,7}`, `bl {11,6}`; cross edges `[4,5,6,7]`; a slot is solved when `pieces[i] === i && orientation[i] === 0`; the trained slot is excluded and mirrored for the left side; `entireF2LSolved` is computed separately |
| Smart-cube move matching | `src/lib/utils/moveValidator.ts:104-615`, `TrainClassicSmart.svelte:292-591` | Transform the absolute frame into the algorithm frame through a cumulative rotation; auto-apply rotations in the expected algorithm; map a wide move to its opposite single layer and **prepend** the implied rotation; likewise for slice moves (M→x', E→y', S→z); match against a five-move lookahead trying every slice expansion; defer the wrong-move verdict while a buffered turn could still be half of a double or slice move; on a real mismatch build an undo stack the user must clear |
| Hint ladder | `src/lib/utils/hintManager.svelte.ts:34-139` | `step`, `allAtOnce` (revealed but blurred until the first physical move), `always`, `hidden` (no algorithm validation at all) |
| Drill loop | `TrainDrill.svelte:66-423` | `stopped → countdown (3 × 500 ms) → solving → executing → transitioning`, with give-up, redo and resume paths; completion is decided by the state predicate, never by move identity |
| Recognition boundary | `TrainDrill.svelte:132-164` | Recognition ends on the first non-U move, so AUF time counts as recognition — a deliberate choice we must either match or document as different |
| URL sharing | `src/lib/utils/urlSave.ts:38-420` | Learning states encoded base-3 per case → BigInt → Base62; custom algorithms tokenised against a closed 57-symbol alphabet, unknown tokens silently dropped |
| Statistics | `src/lib/utils/statistics.ts:16-146` | Best, mean, Ao5/Ao12 and rolling variants; recognition and execution get no rolling statistics |

## 6. solved.no — behaviour reference

Trainer pages are server-rendered enough to read modes and settings; `/trainers` and `/algs` are client-rendered, so the trainer card grid and the algorithm database itself could not be verified.

| Area | Behaviour captured (URL evidence) |
|---|---|
| Alg trainers | `/trainers/3x3/algs/{F2L,OLL,PLL,COLL,WV,2GLL,ZBLS,ZBLL,LXS}` share one engine with Drill (Normal / Recap / Weighted), Learn and Review modes; per-case mean, best single, best/worst pre-AUF, ao5/ao12/ao100 and count, filtered by Today/24h/7d/30d/All/Custom |
| Recap parameters | repeat count, instant, repeat goal in seconds, in-order or random, quick mode, verify wait time |
| Weighted parameters | strength Weak/Medium/Strong/Extreme |
| Learn mode | login-gated: goal seconds, criteria over a mean of N, 1–5 cases at once, 30 % new-case chance |
| F2L specifics | mirror/rotate toggle, "consider each AUF its own case", per-case pre-AUF allow list |
| Smart cube | connect/disconnect with battery percentage, timer start on case shown / first move / cooldown end, Bluetooth-stats-only mode, reset gyro per case, neutrality fixed / single-y / dual-x2y / colour neutral, finish when step solved or cube solved |
| Import/export | selective export of times, selected cases, mode settings, learnt cases and learn settings; merge for times and learnt cases, replace for configuration; reset and delete undoable until the modal closes |
| Inspection trainer | categories Cross, EOCross, EOLine, XCross, Pseudo XCross, XXCross, First Block, CPLine, CPFB; solution length 1–7; timer off / one-phase inspection / one-phase execution / two-phase; slot selection; short scrambles; force front; bottom-half-moves-only; allow one F move; reveal one move at a time; hint levels 1/5/10/25/all; batch generation with copy and record-times list; saved scrambles with comments and category tags |
| Predicters | Pair/OLL/PLL/ZBLL with pair/corner/edge targets, "don't place pairs in slots", force one correct, force orientation only, and per-set sub-modes such as force-2GLL or force-EPLL; editable algorithm presets; history with accuracy and streak |
| Two-sided recognition | pre-AUF, select-by-name, verification-confirm and verification-predict (about half the rounds show a deliberately wrong result); sets F2L/OLL/PLL/2GLL/COLL/ZBLL/ZBLS/WV plus ZBLL angle subsets; Baum-Harris pre-AUF coding |
| Other drills | Track the Piece (corner/edge/pair, 1–20 moves or F2L solutions, moving sticker target, colour-coded grading), Guess the Colour (1×1 and 3×3 hidden-corner modes, neutrality and corner-position locks, remappable keys), Free Pair (presets, rows with a single valid answer auto-ignored, five redo-incorrect queue modes), Follow the Moves (per-session trigger sets, repeat chance, best-TPS-paced highlighting), Time Attack (per-case target times, reorderable cards, current-card indicator) |
| Timer and reconstructor | multi-session with comp-sim, scramble alerts, csTimer CSV import, per-solve inspection/penalty/comment/written solution/copy-reconstruct; reconstructor with ghost text, state-search suggestions from the current position, advanced criteria search with a known-vs-all algorithm scope, sticker editor and share links |
| Daily puzzles | three tiers, attempt limits, streaks, 100 points per puzzle, +25 all tried, +75 perfect day, +50 at a 7-day streak, +100 at 30 days, occasional multipliers; explicitly labelled work in progress |
| Blind settings | click-to-set target letters per sticker with uniqueness enforcement, and target-priority lists used only to break permutation cycles |

## 7. reco.nz — study import

- URL scheme `https://reco.nz/solve/{id}`; index at `https://reco.nz/solve/index`; algorithm pages at `/algs/oll` and `/algs/pll`. Low ids 404, so ids are sparse.
- A solve page carries solver, result, competition line, reconstructor credit, a phase-labelled solution using `//` comments (`inspection`, `cross`, `1st pair` … `OLL(CP)`, `EPLL`), an `alg.cubing.net` link, a stats table with columns Total/F2L/LL/Cross+1/OLS/PLL over rows Time, Split %, STM, STPS, ETM, ETPS, the other solves in the average, and a YouTube embed. No WCA scramble string is published on the page.
- Server-rendered PHP. **No JSON API** (`/api`, `/api/solve/13444`, `/solve/13444.json` all 404), no `robots.txt`, and **no `Access-Control-Allow-Origin` header**, which is the wire-level reason the static build cannot import arbitrary solves and needs the local Bun proxy.
- The index filters by official/unofficial, puzzle, method (CFOP, Roux, ZB, ZZ, Petrus, Yau, Redux, Lin, Vandenbergh) and solver name.
- No terms of use, licence or attribution policy exists on the site. Keep exactly one attributed bundled solve; do not crawl.
- Our parser (`src/integrations/reco.ts:29-103`) already matches this structure: it restricts URLs to `https://reco.nz/solve/<digits>`, prefers the `alg.cubing.net` `setup` parameter for the scramble, splits stage labels on `//`, and folds `#solvestats` into a nested map.

## 8. Gap register against the current implementation

Ranked by coaching value. "Have" refers to this repository on 2026-08-03.

| # | Gap | Evidence in the sources | Have today |
|---|---|---|---|
| 1 | Case-subset scramble generation (OLL, PLL, COLL, ZBLL, CMLL, F2L, EOLine, Mehta, restricted generators) | csTimer registry §4.1 | Only a 25-move axis-safe training scramble (`src/domain/scramble.ts`) |
| 2 | Licensed algorithm corpus with case index, AUF data and competition frequency | Ao1K §1.1 | 57 OLL + 21 PLL hand-authored and state-verified (`src/domain/algorithmCatalogue.ts`), 3 F2L starters |
| 3 | Full F2L case taxonomy (175 cases, two orthogonal attribute axes) | F2LTrainer §5.1 | 3 F2L cases |
| 4 | Smart-cube move matching with rotation, wide and slice compensation plus undo guidance | F2LTrainer §5.2 | State-agnostic controller only (`src/domain/remoteController.ts`) |
| 5 | Per-slot F2L identification instead of a solved-pair count | smart-cube-timer §3 gap, F2LTrainer predicates | `segmentCfop` counts stages, not slots |
| 6 | Per-step TPS and inspection/execution split on captured solves | csTimer §4.2, smart-cube-timer §3 | Stage metrics exist; TPS and the non-trivial-move boundary do not |
| 7 | Personal-best threshold, rolling averages, distribution and period trends | csTimer §4.2 | Basic statistics only (`src/domain/statistics.ts`) |
| 8 | Recognition datasets for CLL and LSEO (Roux) | smart-cube-timer §3 | None |
| 9 | State-aware suggestion (hash + inverted index) instead of literal prefix completion | Ao1K §1.2 | Literal prefix, now shortest-completion-first |
| 10 | Prediction, two-sided recognition and time-attack drills | solved.no §6 | Absent (`docs/feature-status.md` already says so) |
| 11 | Device-clock regression and swapped-move detection during capture | csTimer §4.3, smartcube-web-bluetooth | Facelet reconciliation only |
| 12 | Pre-solve checklist routine | Ao1K notimer §1.2 | Absent |

## 9. Adoption decisions

1. The MIT sources are the supply chain: Ao1K for algorithm data, recognition keys and suggestion machinery; `smartcube-web-bluetooth` for hardware; smart-cube-timer for stage analysis and the replay-based migration policy. csTimer stays a specification, never a dependency. F2LTrainer stays a design reference until a licence text exists.
2. Anything imported must pass our own state verification. `src/domain/lastLayer.ts` classifies a last-layer algorithm by cubie orientation and permutation classes modulo AUF, and `src/domain/algorithmCatalogue.test.ts` requires 57 distinct OLL orientation classes and 21 distinct PLL permutation classes with the first two layers intact. Imported data must satisfy the same test before it ships.
3. Keep two trainer contracts separate: state-success drills accept any solution that reaches the target predicate; algorithm rehearsal enforces a chosen sequence and guides undo. The current controller mode is a third, explicitly state-agnostic route and must stay labelled as such.
4. Record recognition boundaries explicitly. F2LTrainer counts AUF as recognition; smart-cube-timer strips a leading up-face turn before measuring. Whichever we choose must be stored with the attempt so old data stays interpretable.
5. Raw telemetry stays the only durable truth; every derived metric must be regenerable by replaying stored events, as smart-cube-timer's v4 migration demonstrates.
