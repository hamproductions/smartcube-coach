# Documentation index

Read this first. It says which document answers which question and which ones are historical. Anything not listed here is stale by definition.

## Start here

| Question | Document |
|---|---|
| What is this product meant to be? | `product-spec.md` |
| What actually works right now, and how was it proved? | `feature-status.md` — the honest per-capability record. A row is only "Working" if it was exercised through its real runtime path. |
| What is still missing versus the reference apps, and in what order is it being built? | `parity-plan.md` — the work queue, with a tier per priority. |
| How must the interface look and behave? | `design-system.md` — binding tokens, per-surface layout grammar, and the rule that this app mimics the reference tool grammar rather than inventing one. |
| What behaviour was copied from which reference, and where does it live in this code? | `research/reference-findings-2026-08-03.md` — source of truth for anything copied from cstimer, smart-cube-timer, F2LTrainer or Cubedex. |

The rules that bind an agent working here live in `../AGENTS.md`: scope, machine hygiene, the interface standard and the research standard.

## Research and evidence

| Document | What it holds |
|---|---|
| `research/reference-findings-2026-08-03.md` | Per-reference behavioural findings with file and symbol, and where each is applied in this app. |
| `research/feature-harvest.md`, `research/harvest-refresh-2026-08-03.md` | The full harvested feature inventory of the reference set. Input to `parity-plan.md`. |
| `research/dogfood-2026-08-03.md` | Dogfood pass: TPS window defect, phantom stages, rejected state request, dead controls. |
| `research/dogfood-2026-08-03-ui-rebuild.md` | Dogfood pass on the UI rebuild and keyboard timer, including the provenance display defect that labelled keyboard solves as simulator. |
| `evidence/` | Captured artefacts. |

## Execution receipts

Written when work drifted from the standing instructions and had to be re-grounded. Newest first; each records the violation, what was read, the correction and the verification artefact.

| Receipt | Subject |
|---|---|
| `research/execution-receipt-2026-08-03-gyst-5.md` | Abandoned browser sessions filled the disk and bricked the machine. Machine-hygiene rules written. |
| `research/execution-receipt-2026-08-03-gyst-4.md` | UI was authored from imagination instead of the references; full reference inspection and rebuild. |
| `research/execution-receipt-2026-08-03-gyst-3.md` | Reference findings lived only in chat; dead-code claimed as a feature. |
| `research/execution-receipt-2026-08-03-gyst-2.md`, `research/execution-receipt-2026-08-03-gyst.md`, `research/execution-receipt-2026-08-03.md`, `research/execution-receipt-2026-07-30.md` | Earlier rounds. |

## Handoffs (historical)

These are point-in-time snapshots. They are **not** the current state — use `feature-status.md` and `parity-plan.md` for that. Newest first: `HANDOFF_2026-08-03-input-abstraction.md`, `HANDOFF_2026-08-03.md`, `HANDOFF_2026-07-31.md`, `HANDOFF_2026-07-30.md`.

## Standing rules for these documents

- A capability is not shipped because code exists. It ships when it has been driven through its real runtime path and the evidence is written down.
- Never state a verification layer you did not reach. Unit tests, source inspection and logs do not substitute for runtime proof of UI behaviour.
- When code and a document disagree, the code wins and the document gets corrected the same day.
