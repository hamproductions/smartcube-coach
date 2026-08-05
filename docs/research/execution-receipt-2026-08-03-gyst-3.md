# GYST execution receipt 3 — 2026-08-03

## Exact latest request

`/get-your-shit-together` + `/un-dumb-yourself`, with an explicit instruction to read both skills line by line and execute every step before continuing anything, after the user stated the work was not matching what was wanted or how it was wanted, demanded a proper 3D viewer, and required studying how other services implement it.

## Rules violated

1. **Durable learnings must live in project files, never chat or a vendor scratchpad.** Every reference finding (cstimer rules, smart-cube-timer stage model, F2LTrainer slot indices, Cubedex bundle) existed only in conversation and `/private/tmp/claude-*`. Now written to `docs/research/reference-findings-2026-08-03.md`.
2. **Invented instead of taking working code.** Wrote a bespoke CSS-3D cube rather than checking how the references render. The shipped Cubedex bundle uses cubing.js twisty — the library already in this repo — driven through `experimentalModel.experimentalAddMove`. My jank was caused by rebuilding the setup alg per move.
3. **Proxy completion.** Reported a "164-case F2L catalogue" while `buildF2lCases` is imported by nothing. Dead code reported as a feature.
4. **Chat style.** Profile mandates terse caveman-full; I wrote long prose all session.
5. **Did not check what the user was actually running.** Spent hours saying "nothing committed" without noticing the deployed site at `hamproductions.github.io/smartcube-coach/` serves `002ac74` — none of today's work.

## Read in full this round

- `~/.claude/skills/un-dumb-yourself/SKILL.md` (5.5K)
- `~/.awesome-agent/shared/core_profile.md` (22K)
- `~/.claude/skills/get-your-shit-together/references/user-demands.md` (26K, earlier this session)
- `AGENTS.md` (project), reference bundles and repos listed in the findings note

## Conflict resolution

Latest raw user message beats everything. "Look at other services" outranks my own design instinct; the Cubedex bundle is the authority for viewer behaviour.

## Source of truth

The four reference repos + the shipped Cubedex bundle, and the user's four exported QiYi sessions.

## Corrected immediate action

1. Durable findings written to the repo (done).
2. Wire `buildF2lCases` into the trainer — remove the dead-code claim.
3. Verify the viewer animates turns, by looking at it.

## Verification artifact

`bun run test -- --pool=threads --maxWorkers=2`, plus a browser screenshot of the live viewer mid-turn.

## Explicitly unverified

Physical cube over Bluetooth. Deployed site still on `002ac74` — commit/deploy needs the user's word.
