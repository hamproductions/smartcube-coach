# Feature status

Verified on 2026-07-30 against the production GitHub Pages artifact locally served at the `/smartcube-coach/` subpath. Status is based on runtime behavior, persisted data, tests, and the availability of required hardware or server infrastructure.

## Status definitions

- **Working**: exercised through its canonical runtime path and persisted or rendered output was inspected.
- **Partial**: a functional foundation exists, but coverage, quality, infrastructure, or the complete product loop is missing.
- **Unverified**: implementation exists but the required physical environment has not been tested.
- **Not implemented**: planned capability is absent or a non-functional surface was removed.

## Capability matrix

| Capability | Status | Evidence and limitation |
| --- | --- | --- |
| Honest first-run state | Working | Fresh IndexedDB rendered zero solves, attempts, studies, and findings. No sample AO12, device, findings, or prescriptions are bundled. |
| 3×3 training scramble generation | Working | Production browser generated a 25-move sequence without consecutive axes. This is a random-move training scramble, not WCA random-state generation. |
| Simulator capture pipeline | Working | Production browser persisted one solve, 50 phase-separated raw events, solve-only event links, and replay state. It proves software behavior only. |
| Web Bluetooth support detection | Working | Chromium runtime detected Web Bluetooth and enabled the connect action. Unsupported browsers disable it. |
| Physical smart-cube pairing and capture | Unverified | Device protocols and connection boundary exist, but no physical cube/model/browser combination has been paired and tested. |
| Physical battery, facelets, timestamps, disconnect, and recovery | Unverified | Event handlers exist. No hardware evidence exists. |
| Real-time scramble verification | Partial | Canonical state verification works through simulated and unit-tested move streams. Physical-cube verification is unverified. |
| Timer and immutable solve persistence | Partial | Simulator timing and persistence work. Physical cube clock fitting and timing accuracy are unverified. |
| Solve history and penalties | Working | Persisted solves render with replay and none/+2/DNF controls. |
| IndexedDB local ownership | Working | Captures, events, stages, attempts, studies, revisions, findings, metrics, prescriptions, transfers, settings, and metadata have versioned stores. |
| Versioned backup export/import | Working | Full schema-v4 round-trip is covered by tests. Browser download and file input surfaces exist. |
| Canonical 3D playback | Working | Captured solves and imported reconstructions render through `twisty-player` with seeking and stage controls. |
| Manual reconstruction editor | Working | Starts blank, parses entered notation, saves revisions, retains immutable source-event links, and exports share URLs. |
| Reconstruction autocomplete | Partial | A small local algorithm-name matcher exists. State-aware Ao1K-style autocomplete is not implemented. |
| Automatic reconstruction | Partial | Captured move streams are replayable and an initial CFOP predicate segmenter exists. It is not a robust method-aware reconstruction engine. |
| CFOP stage timing | Partial | Epoch-domain defect and empty-stage emission were fixed and regression-tested. Stage detection remains heuristic and has not been validated against a real CFOP solve corpus. |
| Pause, recognition, execution, TPS, moves, rotations | Partial | Deterministic metric code exists. Rotation inference and stage boundaries need real capture validation; simulator inverse solves are not coaching evidence. |
| Recurring-error detection | Partial | Requires five compatible persisted samples and is unit-tested. It has not been validated against a real personal solve corpus. |
| Evidence-backed roasts | Partial | Text derives from stored findings rather than an LLM guess. No real-corpus coaching-quality validation exists. |
| Prescriptions and transfer evaluation | Partial | Deterministic records and tests exist. The complete real solve → drill → improved full-solve loop has not been demonstrated. |
| F2L trainer | Partial | Three independently authored starter cases support queueing, hints, typed grading, mastery, and persisted attempts. Full F2L coverage is absent. |
| OLL trainer | Partial | Small starter set only. Full 57-case coverage is absent. |
| PLL trainer | Partial | Small starter set only. Full 21-case coverage is absent. |
| Recognition/execution separation | Working | Recognition boundary, typed answer, timing, hints, and persisted outcomes work. Hidden drill cases no longer render the target algorithm before recognition. |
| Cognitive drill engine | Not implemented | Static mock controls were removed. No prompt generator, grading engine, or persistence exists yet. |
| BLD assistance | Partial | Seeded target-cycle generation, parity flag, and memo validation work. Full corners/edges execution, twist/flip handling, lettering configuration, and solve workflow are absent. |
| reco.nz solve 13444 study | Working | Bundled attributed public record supports 3D playback, stages, private notes, bookmarks, and source link on static hosting. |
| Arbitrary reco.nz URL import | Partial | Works with the local Bun server. GitHub Pages cannot run that server and supports only bundled solve 13444. |
| Offline application shell | Partial | Service-worker shell caching exists. The corrected build still requires a final offline regression pass after deployment. Network-backed imports are not generally offline. |
| PWA installation | Partial | Manifest and scoped service worker exist. Installation has not been verified across target desktop/mobile browsers. |
| Complete csTimer solver/scrambler/generator breadth | Not implemented | Only application-specific 3×3 state handling and training scramble generation are integrated. |
| Complete Solved.no-style trainer catalogue | Not implemented | Current trainers are starter workflows, not catalogue parity. |
| Measurable 20–30s to sub-10 coaching program | Not implemented | Data primitives and partial coaching logic exist, but no complete validated curriculum or longitudinal transfer evidence exists. |

## Current release claim

The current application is a functional local-first prototype with working storage, simulator capture, replay, basic reconstruction editing, small typed-answer trainers, a seeded BLD memo exercise, and one attributed reco.nz study.

It is not a completed smart-cube coaching product and must not be represented as one until physical capture, robust reconstruction, full trainer coverage, coaching-quality validation, and longitudinal transfer are demonstrated.
