# Execution receipt — 2026-08-05, GYST inside `un-dumb-yourself before`

## Request

Finish the remaining ordered work in `docs/HANDOFF_2026-08-05-coaching.md` §11 without mistakes, then preserve state before context compression.

## Rules violated, and what it cost

**`AGENTS.md` → "Copy the reference. Do not invent."** F2L case recognition was designed and written before reading this repository's own reference notes. `docs/research/acubemy-solve-2026-08-04.md` §82 already records how acubemy identifies an F2L case per slot, including a lookahead fallback, and §84 already records that this app has no equivalent. The recogniser that landed matched the reference's canonical-key idea by accident and was missing the fallback the note names.

Corrected in the same session: `f2lCaseOfStage()` in `src/domain/reconstruction.ts` now scans forward through the stage's own moves when the entry position is not one of the 41 catalogued cases, cited to §82, and is pinned by a test that buries the pair out of the top layer and proves the case is still named.

Not a violation but worth recording: `src/domain/f2lRecognition.ts`'s slot table (`FR {corner 4, edge 8}`, `FL {5,9}`, `BL {6,11}`, `BR {7,10}`) is the same table `reference-findings-2026-08-03.md` line 37 transcribes from F2LTrainer `src/lib/utils/checkF2LState.ts`. That file was read this session: it only answers "is the slot solved", not "which case is this", so it is not prior art for recognition.

## Read in full this session

- `~/.claude/CLAUDE.md` (symlink to `~/.awesome-agent/shared/AGENTS.md`).
- `~/.claude/skills/get-your-shit-together/references/user-demands.md`, 26 KB, all 20 sections.
- This repository's `AGENTS.md`, all 135 lines.
- `docs/HANDOFF_2026-08-05-coaching.md`, all sections.
- `docs/research/reference-findings-2026-08-03.md` (F2L and F2LTrainer entries), `docs/research/feature-harvest.md` (recognition rows), `docs/research/acubemy-solve-2026-08-04.md` (F2L and recognition sections).
- `/tmp/refs/f2ltrainer/src/lib/utils/checkF2LState.ts`, all 203 lines.
- `src/domain/reconstruction.ts`, `pairSolver.ts`, `crossSolver.ts`, `caseRecognition.ts`, `f2lCases.ts`, `f2lCatalogue.ts`, `betterAlgorithm.ts`, `cubeHold.ts`, `guidedSolve.ts`, `attachReconstruction.ts`, `storage/preferences.ts`; `src/components/solve/SolveAnalysis.tsx`, `SolveRoute.tsx`, `Cube3D.tsx`, `settings/DiagnosticsPanel.tsx`, `ReconstructEditor.tsx`, `RecoStudy.tsx`.

No history or log mining was requested, so none was performed and no extraction exists to purge.

## Conflict resolution

The handoff's §11 ordering was followed. Where the handoff's live-state facts had gone stale, live state won: the dev server is PID 46939, not the 93874 the handoff records, and the `cube` session it lists as open no longer existed. Both were corrected in the handoff rather than worked around.

## Corrected work delivered

| Item | State |
|---|---|
| Playback cube follows the seek | Browser-proven; the earlier inconclusive result was a wrongly guessed crop region |
| Playback cube in the configured hold | Implemented in `SolveAnalysis`, browser-proven both directions |
| F2L case identification | `src/domain/f2lRecognition.ts` plus the acubemy lookahead in `reconstruction.ts` |
| Coaching visible on a real solve | Browser-proven on the reco.nz solve seeded through the app's own segmenter |
| Empty accordion panel on rows with no advice | Found by using the app; fixed |

## Verification artifacts

- `bunx vitest run --pool=threads --maxWorkers=2` → 102 files, 765 tests passing.
- `bun run build` → clean.
- `grep -rl "recognizeF2l" src --include='*.ts' --include='*.tsx' | grep -v '\.test\.'` → `f2lRecognition.ts` and `reconstruction.ts`, i.e. reachable, not dead code.
- Browser at `http://localhost:5173/`, origin confirmed with `agent-browser get url`; console free of errors; screenshots in `docs/evidence/coaching-2026-08-05-*.png`.
- `agent-browser session list` → no active sessions at the end; no Chromium processes; disk 9.8 GB free.

## Explicitly unverified

- Anything against the owner's physical cube.
- The multi-auditor dogfooding council (§11 item 5) — this session had no authority to spawn subagents, so a single-operator dogfood ran instead.
- Whether F2L 3 and F2L 4 of the reco.nz solve *should* be nameable: their pair pieces sit in other bottom-layer slots for the whole stage, which the 41-case set does not describe, so they stay unnamed by design rather than by failure.
