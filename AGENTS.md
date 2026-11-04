# Smart Cube Coach

## Scope

Build a web smart-cube coaching application for a 20–30 second 3×3 solver aiming toward sub-10.

## Closed research set

- https://github.com/Ao1K/Ao1K_site
- https://github.com/poliva/smartcube-web-bluetooth
- https://github.com/hakatashi/smart-cube-timer
- https://github.com/cs0x7f/cstimer
- https://github.com/Dave2ooo/F2LTrainer
- https://www.solved.no/
- https://reco.nz/ for public reconstruction-study integration only

Do not enumerate or inspect Ham’s GitHub organization, sibling repositories, or unrelated local workspaces. The list above is exhaustive and closed unless Ham explicitly expands it.

## Product requirements

- Web-first smart-cube capture
- Timer and complete solve history
- Automatic reconstruction and move autocomplete
- CFOP phase timing and pause/recognition analysis
- Evidence-based coaching, weakness detection, and assigned drills
- Algorithm, F2L, and recognition training
- Scramble generation and real-time scramble verification
- Blindfold solving tools
- Local-first operation with explicit export/import
- Reuse proven features and algorithms from the closed research set when licenses permit; otherwise reimplement behavior cleanly

## The smart cube is the product, and it is testable without hardware

The smart-cube path is the main feature. Everything else — trainers, timer, statistics, UI — is secondary to a cube that connects, stays in sync, times a solve and segments it correctly.

**Never ask for a physical cube.** The service must be designed so every part of it is testable without one, and it already is: `Export device session` writes every received packet with its timing, and `Replay session file` feeds one back through the identical live pipeline. Real captures from the user's own QiYi cube live in `src/device/fixtures/user-sessions/`. Any smart-cube change is proved by replaying those, in a capped test run, before anything is reported as working.

If a capability cannot be exercised from a recorded session, that is a design defect in the capability, not a reason to request hardware.

A connection failure must reach the screen with the library's own message: `CubeConnection.connect` writes it to the status and the header shows it. Diagnose a real device failure from that text, never from a guessed cause. GAN, QiYi and MoYu32 encryption needs the cube's MAC. The library reads it from the advertisement first; when the browser delivers none, `webBluetooth.ts` uses the MAC remembered for that cube name after a verified connect, and asks once only if none is remembered. That matches acubemy's provider in bundle chunk 7839, which looks up the saved device by name.

**Read the reference implementations' source, every line, before writing device code.** `node_modules/smartcube-web-bluetooth/src/` is vendored locally with full TypeScript sources and tests — it is the authority for protocol decoding, state representation and timestamps. `hakatashi/smart-cube-timer` is the authority for auto-starting the timer, scramble verification and stage segmentation. Behaviour copied from them is recorded in `docs/research/reference-findings-2026-08-03.md`. Inventing a device behaviour that a reference already solves has produced three rounds of failure in this project.

## Machine hygiene

Binding on every agent working in this repo. On 2026-08-03 seventeen abandoned `agent-browser` sessions filled the disk to 233 MB free and killed the dev server mid-session; closing them recovered 20 GB.

- Run `agent-browser session list` **before** starting browser work and **again before finishing**. Close what you opened. Never leave a session behind, and never accumulate per-scenario sessions — use one named session for the whole task.
- **`--session <name>` is NOT isolation.** On 2026-08-03 a named session twice attached to an already-running Chrome and surfaced the user's other local project (`127.0.0.1:3000`), after a click had already been dispatched into it. Before trusting any browser step, run `agent-browser get url` and confirm it is this app's origin. If it is not, stop immediately, shut the browser down, and report — do not note it and continue.
- Real-page verification is not optional just because it is awkward: the keyboard timer recorded every solve after the first as 0.01 s, and no unit test caught it. Only driving the running page found it.
- Kill every server and background process you start. Do not restart a dev server that died — report why it died.
- Check `df -h` before running builds or the full test suite. Do not run heavy work on a full volume.
- Always cap test parallelism: `bun run test -- --pool=threads --maxWorkers=2`.
- Before blaming the user's data for a resource problem, enumerate what you started first.

## Reference code may be copied

The owner has instructed that reference implementations be copied directly rather than reinvented. This project is personal and non-commercial. Copy the code; put an attribution header on each ported file naming the upstream repo and the exact source path.

Sources are cloned at `/tmp/refs/`: `cubedex`, `ao1k`, `smart-cube-timer` (MIT), `f2ltrainer`, `smartcube-web-bluetooth` (no licence declared), `cstimer` (GPL), plus acubemy's production bundles (closed source — read behaviour, do not lift code, it is minified and not useful to copy anyway).

This supersedes any earlier instruction in this file or in `docs/` to reimplement F2LTrainer or `smartcube-web-bluetooth` behaviour rather than copy it.

## Copy the reference. Do not invent.

Nothing in this app is a novel problem. Timers, scramble tracking, state sync, slice recovery, stage segmentation and trainer weighting are all solved in the closed research set, and several are already transcribed with file and symbol in `docs/research/reference-findings-2026-08-03.md` and `docs/research/feature-harvest.md`.

Before writing any behaviour, find it in a reference and read that source — the real file, not a summary, not a README. Reimplement its behaviour cleanly in this project's style where the licence requires it (cstimer is GPL: behaviour only, never pasted source), and cite the file and symbol you copied from in your report and in the findings note.

Inventing an alternative to a solved problem has failed here repeatedly and expensively: a bespoke CSS cube instead of the twisty player the references use; a hand-rolled timer state machine instead of csTimer's single-`status` machine with its `lastStop` guard; an index-based scramble comparator instead of cstimer's state-probing `scrHinter.checkInSeq`, which froze on one wrong-direction turn and destroyed a real user solve. Each cost a full round and shipped a defect the reference does not have.

If a reference genuinely does not cover something, say so explicitly and explain why, before building it.

## Deliverables live in this repository

Never use a vendor artifact store, hosted workspace, scratchpad or chat-side surface for anything this project needs — no Claude Artifacts, no browser-hosted workspaces, no `/tmp` as a final home. Code, docs, plans, design boards, evidence and handoffs are created in this repository from the start. A deliverable that only exists in a chat session or a vendor URL does not exist.

Design direction lives in `docs/design/moodboard.md` with its captures in `docs/design/reference/`, alongside `docs/design-system.md`.

## Conversation stays in the conversation

Never quote chat messages verbatim in any file in this repository — not in docs, receipts, research notes, commit messages or code comments. Record the requirement or the defect as a neutral technical statement and keep every engineering detail: file paths, line numbers, packet indices, measured values, verdicts. Repository files are committed, shared and permanent; a conversation is not.

Never write a credential into this repo or into a scratch file. Chat messages routinely contain tokens and webhook URLs — on 2026-08-03 a history extraction to `/tmp` captured a Sentry token and a Slack webhook URL and had to be purged. If you mine history, delete the extraction as soon as it is used, and grep anything you wrote for token, key and webhook patterns before finishing.

## No unreachable features

A capability that no component imports is not a feature, it is dead code, and reporting it as delivered has happened here more than once — a 164-case F2L catalogue imported by nothing, a complete csTimer CSV implementation with no UI entry point, and 82 state-verified COLL/CMLL cases exported to nobody. Before reporting any capability as delivered, prove a user can reach it:

```
grep -rl "<exportName>" src --include='*.ts' --include='*.tsx' | grep -v '\.test\.'
```

One hit means only the defining file — the feature is unreachable. Trace the chain to a component, or state plainly in `feature-status.md` that it is not yet reachable.

## Styling stack: Panda CSS + Park UI

**This is settled and is not to be re-asked.** The owner's established front-end styling stack is Panda CSS with Park UI. Hand-written global CSS is not the convention here; it was written by mistake and `src/styles.css` is being migrated out.

- Style with Panda: recipes, tokens and `styled` props. Do not add new rules to `src/styles.css`, and do not invent class names.
- Take components from Park UI rather than hand-rolling buttons, dialogs, tabs, selects and the rest.
- Design tokens live in the Panda config — colours, spacing, radii, shadows — and `docs/design-system.md` describes them. The config is the implementation of that document, not a parallel system.
- Park UI upgrades are disruptive and require a real migration; do not bump it casually.

This was stated by the owner more than once before it was recorded here. It was not written down, so it was asked again, which wasted his time. Any convention he states in conversation goes into this file the same turn.

## Interface standard

`docs/design-system.md` is binding for every UI change: tokens, layout grammar per surface, and the rule that this app mimics the tool grammar of the reference set rather than inventing one. Look at the reference in a browser before designing a screen, and verify your own screen by screenshot before calling it done.

## Research standard

Every adopted capability must identify its source file, symbol or page, behavior, license status, integration destination, and caveats. README-only summaries are insufficient.

## Interface structure

The legacy `src/styles.css` sheet is gone; every surface is styled with Panda tokens (`docs/design-system.md`). Navigation is Solve, Train, Stats, Study, Settings on hash routes (`src/app/route.ts`). Train is a hub grouped by solve stage; each trainer is one view file in `src/components/train/views/` that follows its written flow in `docs/redesign/trainer-flows.md`. A new trainer gets a flow written there first, a view file, an entry in `src/components/train/trainers.ts`, and a browser check at 1440x900 and 390x844.

Every full-size 3D cube is `Cube3D` over the three.js renderer in `src/components/cube/CubeRenderer.ts`; each one holds a WebGL context, so it is not for grids. Case thumbnails in grids stay `CasePreview` (twisty stickering masks for F2L-style sets, SVG `LastLayerDiagram` for last-layer sets). A scramble shown while the tracked cube is not solved is routed from the app's own tracked pattern (`newSharedScramble`); FACELETS still never seed that pattern.

## Opening the app for the owner

This is a personal project: open it in Chrome `Profile 2` (hamzaabamboo@gmail.com) with `open -na "Google Chrome" --args --profile-directory="Profile 2" <url>`, never the work profiles (`Profile 1`, `Profile 3`).
