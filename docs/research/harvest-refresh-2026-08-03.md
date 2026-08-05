# Harvest refresh ledger — 2026-08-03

Durable tranche notes taken while redoing the closed-set research. Written during reading, not reconstructed afterwards.

## Method

1. Re-clone every repository in the closed research set (`AGENTS.md`) into the session scratchpad, outside the project folder, because no checkout from the previous research pass survived.
2. Verify each license by opening the license file, not by trusting metadata.
3. Read each repository tree file by file and extract capability rows carrying `path:line-range`, symbol names, algorithmic behavior, integration destination and caveats.
4. Fetch the two live products (`solved.no`, `reco.nz`) and record only what was actually retrieved.
5. Rewrite `docs/research/feature-harvest.md` from those tranches.

## Tranche 0 — clone and license verification (self-performed)

| Repository | Clone path (scratchpad) | License file present | Note |
|---|---|---|---|
| `Ao1K/Ao1K_site` | `research/Ao1K_site` | `LICENSE` present | Next.js app, `docs/` contains design notes |
| `poliva/smartcube-web-bluetooth` | `research/smartcube-web-bluetooth` | `LICENSE.txt` present | `captures/` holds recorded BLE traffic |
| `hakatashi/smart-cube-timer` | `research/smart-cube-timer` | `LICENSE` present | Nuxt 2 era app, logic in `lib/` |
| `Dave2ooo/F2LTrainer` | `research/F2LTrainer` | **No `LICENSE` file** — confirmed by listing the repository root | Direct copy remains license-text pending; ships `smartcube-web-bluetooth-4.0.0.tgz` as a vendored dependency |
| `cs0x7f/cstimer` | `research/cstimer` | `LICENSE` present (GPL-3.0) | Behavior reference only |

## Tranche 1 — project state re-read (self-performed)

- Current implementation surface: 5 692 lines across `src/**` and `server/**`; domain modules listed in `docs/HANDOFF_2026-07-31.md` §2.
- `src/integrations/reco.ts:29-103` already parses reco.nz solve pages from static HTML with `linkedom`: URL normalization is restricted to `https://reco.nz/solve/<digits>`, the scramble is taken from the `alg.cubing.net` link `setup` parameter with the first reconstruction line as fallback, stage labels come from `//` comments, and `#solvestats` is parsed into a nested map. The public build can only use the bundled solve because the fetch itself needs the local Bun proxy.
- Dev server from the previous handoff (port 5173, PID 67495) is gone. Nothing was started this turn.

## Tranche 2 — `hakatashi/smart-cube-timer` deep read

Delegated exhaustive read (27 source files, all read); findings folded into `feature-harvest.md`. Decisive new material the previous harvest did not carry:

- `lib/data.js` holds four complete recognition tables, not just "OLL/PLL data": OLL 57, PLL 21, **CLL 43**, **LSEO 9**, each encoded as `[name, algdbId, pattern]`. OLL pattern is `[CO1..CO4, EO1..EO4]` laid out clockwise per the diagram at `lib/data.js:6-13`; PLL is `[CP1..CP4, EP1..EP4]`; CLL is `[CP…, CO…]`; LSEO is `[bottomMisorientedCount, EO1..EO4]`.
- The state→case mapping is `lib/utils.js:674-723` (`getFaceOrientations`, `getFacePermutations`) projecting cubie arrays onto a per-face 4-slot ordering (`facePiecesMap`, `utils.js:64-113`), then `getOll/getPll/getCll/getLseo` (`utils.js:541-629`) rotate/shift and compare. Both lookups `assert(false)` when nothing matches — a crash path, not a fallback.
- Recognition/execution split is exactly `inspection = firstNonTrivialMove.time - previousStageTime`, `execution = stageEnd - firstNonTrivialMove.time` (`utils.js:967-973`), where "first non-trivial move" is a fixed-point cancellation over the stage sequence that also skips a single leading up-face turn (`MoveSequence.js:231-280`).
- Migration v4 (`lib/db.js:139-261`) re-runs `SolveAnalyzer` over stored raw turns to regenerate every derived field and rebuilds the aggregate case tables from scratch — the durable-truth pattern this project already claims but has never exercised as a real migration.
- Confirmed bug not to copy: `lib/db.js:299-312` reads the PLL running-stat record keyed by `ollCase`.
- Detection gaps to beat: F2L progress is counted (`≥N pairs solved`), never identified per slot (`utils.js:725-827`); X-cross is a zero-move heuristic (`SolveAnalyzer.js:224-228`); LSEO ignores centre orientation (`utils.js:909`).

## Tranche 6 — QiYi MAC path, read directly (self-performed)

Read because it is the live hardware blocker, not delegated:

- `src/smartcube/protocols/qiyi.ts:133-167` — the MAC is appended, reversed, into every hello frame; it is message content, so the connection cannot start without it.
- `src/smartcube/attachment/mac-probe-qiyi.ts:1-50` — service `0000fff0`, characteristic `0000fff6`, AES-128-ECB with a fixed 16-byte key, frame `0xFE | length | content | CRC-16/Modbus`, zero-padded to 16 bytes.
- `qiyi.ts:404-461` — resolution order: advertisement manufacturer data, cached MAC, `macProvider(device,false)`, manufacturer data re-read, name-derived candidates, optional cryptographic address search, `macProvider(device,true)`, then throw.
- `src/smartcube/attachment/mac-candidates.ts` — only `QY-QYSC-A-XXXX`, `QY-QYSC-S-XXXX` and `XMD-TornadoV4-i-XXXX` produce candidates, anchored, exactly four hex digits.

Conclusion for our failure: no manufacturer data and a name outside those anchored patterns. The supported fix is a user-entered MAC through the existing `macProvider` hook. Guessing a MAC stays forbidden.

## Tranche 4 — `Ao1K/Ao1K_site` deep read

Material the previous harvest missed entirely:

- The repository ships **production algorithm databases under MIT**: `public/recon/compiled-exact-algs.json` (5 805 F2L records, each `{alg, 26-char state hash, 12-bit eoValue}`, 792 KB), `compiled-oll-algs.json` (282 records with `caseIndex`, `refPieceMovement`, `minMovements`, competition `frequency`), `compiled-pll-algs.json` (126 records), plus the recognition tables `oll-patterns.json` (57) and `pll-patterns.json` (21). `utils/algFrequencies.tsx` carries 261 OLL and 86 PLL frequency entries. This is the licensed corpus that would replace hand-authored case data.
- The 26-character state hash (`composables/recon/SimpleCubeInterpreter.tsx:1637-1841`, `docs/hash-system.md`): 12 edge chars + 8 corner chars + 6 centre chars, solved is `abcdefghijklehkbnqtwabcdef`; rotation is recovered from the U and F centre colours through a 24-entry map, colours are remapped into that frame, and each piece encodes slot plus orientation (`location*3+axis` for corners).
- Case recognition (`LLinterpreter.tsx:6-324`) builds a 5×5 last-layer colour grid, applies a step mask, remaps PLL through a spiral index so an AUF is an array rotation, then takes the **minimum base-6 integer across the four U rotations** as a canonical key. Our own `src/domain/lastLayer.ts` reached the same invariant from cubie orientation/permutation classes.
- AUF selection (`LLsuggester.tsx:12-169`): OLL uses `preAUF = (4 + algMove - caseMove) % 4` with preference order `[0,1,3,2]`; PLL brute-forces all 16 pre/post pairs against cost table `[0,1,2,1]`.
- `ExactAlgSuggester.tsx:32-191` is a positional inverted index `Map<position 0..25, Map<char, Set<algId>>>` queried with `must`/`may`/`not` constraints, scored `100 × musts + 1 × mays` — a state-aware alternative to our literal-prefix completion.
- `AlgSpeedEstimator.tsx:6-75` scores ergonomics by per-face base speed (U=1, R=1, F=1.5, B=1.3, M=1.3, E=3.0), modifier weight (plain 1, prime 1, double 1.6), a `1.2^distinct-move-types` generator penalty and a 1.5 EO penalty.

## Tranche 5 — `Dave2ooo/F2LTrainer` deep read

Numbers the previous harvest never carried, now counted from the data files:

- **175 distinct F2L cases** across four groups: `basic` 41, `basicBack` 41, `advanced` 60, `expert` 33 (`src/lib/types/group.ts:4-428`). Categories per group are enumerated (Basic has 11, Advanced 9, Expert 6), and `ignoreAUF` is per case (all 33 expert cases ignore AUF).
- Algorithm pools: 279 / 82 / 132 / 119 strings for the four groups; scramble pools: 338 / 809 / 768 / 340. Notation includes bracket grouping and repetition suffixes such as `(U' R' U R)3`.
- A second orthogonal taxonomy, `CASE_ATTRIBUTES` (`src/lib/types/caseAttributes.ts:19-1149`), tags every case with corner position/orientation and edge position/orientation, driving the filter UI. The project duplicates facts between this and `edgeState`.
- Smart weighting is explicit: `solveWeight = 1 + min(2, (maxSolves - solves)/3)`, `timeWeight = 1 + min(2, max(0, caseAverage - overallAverage)/100)`, `weight = round(min(3, max(...)))`, applied over the last five timed solves, then the weighted array is shuffled once (`src/lib/trainCases.ts:81-191`).
- State predicates use fixed KPattern indices — F2L slots `fr {edge 8, corner 4}`, `fl {9,5}`, `br {10,7}`, `bl {11,6}`, cross edges `[4,5,6,7]` (`src/lib/utils/checkF2LState.ts:31-127`) — and the drill completes purely on state, never on move identity.
- The smart-cube matcher (`src/lib/utils/moveValidator.ts`, `TrainClassicSmart.svelte:292-591`) is the piece worth stealing: it transforms the absolute move frame into the algorithm frame through a cumulative rotation, folds wide moves into an implicit rotation, **prepends** slice-move rotations (M→x', E→y', S→z), defers a wrong-move verdict while a buffered turn could still be half of a double or slice move, and on a genuine mismatch builds an undo stack the user must clear.
- Recognition ends on the first non-U move by design, so AUF time is counted as recognition (`TrainDrill.svelte:132-164`).
- License: still **no license file in the repository**; MIT is declared only in `package.json` and the README badge.

## Tranche 3 — live products `solved.no` and `reco.nz`

- Solved.no trainer pages are server-rendered enough to read modes and settings verbatim, but `/trainers` and `/algs` are client-rendered: the trainer card grid and the algorithm database are **not** verifiable from static fetches. Case pools per trainer are therefore unverified.
- Newly captured detail the previous harvest lacked: Drill has Normal/Recap/Weighted with explicit Recap parameters (repeat count, instant, repeat goal, order, quick mode, verify wait) and Weighted strength tiers; Learn is login-gated with goal seconds, criteria over a mean of N, 1–5 cases at once, 30% new-case chance; inspection categories extend to First Block, CPLine and CPFB with 1–7 solution length, one-phase/two-phase timing, batch generation and saved scrambles with comments; two-sided recognition has four modes including a verification-predict mode that shows a wrong result about half the time, plus Baum-Harris pre-AUF coding; smart-cube trainer settings include timer-start trigger choice, neutrality mode and "finish when step solved vs cube solved".
- reco.nz: PHP-rendered HTML, no JSON API (`/api`, `/api/solve/13444`, `/solve/13444.json` all 404), no `robots.txt`, and **no `Access-Control-Allow-Origin` header** — confirming from the wire why the static build cannot import arbitrary solves. Solve pages expose solver, result, competition line, reconstructor credit, phase-labelled solution with `//` comments, a stats table (Total/F2L/LL/Cross+1/OLS/PLL × Time/Split%/STM/STPS/ETM/ETPS), the other solves in the average, and a YouTube embed. The index at `https://reco.nz/solve/index` filters by official/unofficial, puzzle, method (CFOP/Roux/ZB/ZZ/Petrus/Yau/Redux/Lin/Vandenbergh) and solver.
- No licence, terms-of-use or reuse grant exists anywhere on reco.nz (`/about`, `/faq` read in full). Attribution is informal per page. The conservative single-bundled-solve posture stays.
