# Reachability audit — every ported module, 2026-08-04

`AGENTS.md` forbids reporting a capability as delivered when nothing imports it. This audit checks by **import statement**, not by filename mention — grepping for the module's name matches the module itself and reads as reachable when it is not.

```bash
for f in $(ls src/domain/*.ts src/domain/ao1k/*.ts src/domain/cubedex/*.ts src/domain/tools/*.ts src/device/cubedex/*.ts | grep -v '\.test\.' | grep -v '\.data\.'); do
  m=$(basename "$f" .ts)
  c=$(grep -rn "from '.*/$m'\|from './$m'" src --include='*.ts' --include='*.tsx' | grep -v '\.test\.' | wc -l | tr -d ' ')
  [ "$c" = "0" ] && echo "DEAD: $f"
done
```

## Made reachable this pass

| Module | Consumer | Evidence |
|---|---|---|
| `domain/algSuggester` | `ReconstructEditor` | Alternative-algorithm row driven by `AlgSuggester.searchByPosition` |
| `domain/ergonomics` | `ReconstructEditor` | Ergonomic score from `AlgSpeedEstimator.calcScore` |
| `domain/cubedex/practiceOptions` | `TrainerHub` | Smart Order / Random Order / Slow First / Prioritize Failed pills, labels taken from cubedex's `PracticeView` |
| `domain/cubedex/newAlgAuthoring` | `TrainerHub` | Quick-category chips, subset field, live move preview, draft validation |
| `domain/drillEngine` | `TrainerHub` | Drives case selection, advance and scoring |
| `domain/tools/scrambleImage` | `ui/ScramblePreview` → `TodayDashboard`, `LiveSolve` | Verified in-browser: 54 stickers, 6 distinct colours in the Live Solve scramble bar |
| `domain/tools/metronome` | `TurnPacer` → Library route | Verified in-browser: five rate presets, `1000 ms apart` at 60 bpm |
| `domain/moveFrame` | `domain/faceTurnsOnly` | See below |

## `defaultAlgs` — 1,235 cases, and the workaround that had to be undone

All seven ported sets now appear as categories on the Train page: WVLS 27, OLLCP 342, VHLS 32, ZBLL 472, ZBLS 305, L6E-EO 11, L6E-EOLR 46. Each category's records are built and persisted lazily the first time it is selected, so first load is unchanged. Nothing is capped or truncated.

The first implementation stored every ported case with `set: 'OLL'` — a "type-valid bucket" — because `AlgorithmRecord['set']` in `models.ts` was a closed union, and distinguished the real category by an id prefix, with local matching in `TrainerHub` to stop the bucket leaking into the genuine OLL pill. That is a lie in the data model, and it had already leaked into the UI: the hint line read "OLL · no hints revealed" for a ZBLL case, and a display-name override existed solely to paper over it.

It was replaced rather than patched:

- `models.ts` — `AlgorithmRecord['set']` widened to include the seven ported categories, so a record can state what it actually is.
- `TrainerHub` — stores `set: category` and puts cubedex's own subset name in `orientations[0]`, the same field F2L already uses for its slot. `matchesPill` matches on `record.set` like every other category; the id prefix now only keeps cubedex's *duplicate* copies of OLL/PLL/COLL/CMLL from colliding with this app's authoritative catalogues for those five sets.
- `training.ts` — `caseSubset` reads `orientations[0]` for the ported sets instead of trying to parse an `oll-<n>` id shape they never had.
- `algorithmCatalogue.ts` — the `targetMs` map covers the new sets.
- The display-name override in `TrainerHub` was deleted; the UI reads `record.set` directly.

Verified in a browser against a cleared database: 15 category pills; selecting ZBLL loads 472 cases with all 40 of cubedex's real subset names (AS1–AS6, H1–H4, L1–L6, Pi1–Pi6, S1–S6, T1–T6, U1–U6); selecting subset T1 narrows the grid to 12. IndexedDB holds `{id: "cubedex-zbll-zbll-1", set: "ZBLL", subset: "T1"}` and set counts `F2L 167, OLL 60, PLL 21, COLL 40, CMLL 42, ZBLL 472`. Suite 699/699.

## `moveFrame` — a reinvention caught and undone

`faceTurnsOnly` was written this pass to reduce algorithm notation to the face turns a cube can actually report. It was built from scratch on `cubedex/smartcubeParity`, with its own slice and wide expansion table — while `moveFrame`, this project's existing F2LTrainer port, already exposed `decomposeAlgorithmMove`, `expandSliceMove`, `getWideImplicitRotation`, `applyRotationToMove` and `combineRotations`, and was imported by nothing.

`faceTurnsOnly` was rewritten on top of `moveFrame`, deleting the duplicate table. That removed the second implementation and gave `moveFrame` its first consumer.

A convention difference worth recording, because it is silent and produces a plausible wrong answer either way: **`moveFrame.applyRotationToMove` takes the accumulated rotation directly, while `smartcubeParity.remapMoveForPlayer` needs its inverse.** Both directions produce a legal-looking move sequence; only one preserves the cube state. `faceTurnsOnly.test.ts` therefore checks state equivalence against cubing.js for every one of the catalogued algorithms rather than trusting either convention.

## Still unreachable

| Module | Why | Decision |
|---|---|---|
| `domain/ao1k/lessons` | Names one lesson, Edge Orientation, whose content is an Ao1K HTML asset under `public/ao1k/learn/` that was never copied into this repo. | Left unreachable deliberately. Wiring it now would ship a link that 404s. |
| `domain/cubedex/caseStats` | Per-case statistics; `TrainerHub` computes its own. | Adopt or delete once the Train rebuild settles. |
| `domain/cubedex/moveHelpers` | Superseded by `moveFrame` and `smartcubeParity`. | Candidate for deletion. |
| `domain/solveAnalyzer` | smart-cube-timer port, evaluated as a replacement for `segmentCfop` and rejected — it reproduces the naive first-cross-hit anchor, produced a 0-move OLL on `…08-56-22`, and crashes on the reco.nz ground-truth fixture with `Unsupported move: z2`. | Rejected, not merely unused. Delete or keep explicitly as reference. |
| `domain/solveDetection`, `domain/movesetMatcher` | Superseded by the cubedex trackers. | Candidate for deletion. |

Nothing in the first table is claimed as delivered without a named consumer and, where it renders, a browser observation.
