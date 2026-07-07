---
slug: m10-react19-ink7
milestone_id: M10
created_at: 2026-07-07
question: What exactly breaks (API, behavior, reconciler, test harnesses, companions) when @theokit/tui moves from ink5/react18 to ink7/react19, mapped onto OUR real consumption surface?
---

# Discovery Plan: m10-react19-ink7

## Context

M10 upgrades the foundation: ink ^5.2 → ^7, react peer ^18.2 → ^19 (DoD
revised pre-lock: every ink ≥ 6 is react-19-only, registry-verified — dual
peer impossible). Our REAL ink surface (grep-inventoried): `Box` ×35,
`Text` ×21, `render` ×10, `useApp` ×3, `Static` ×2, `useStdout`,
`useInput`, `useFocus` ×1 each; companions `ink-testing-library@3→4?`,
`ink-spinner@5`. 455 tests, 6 committed bench baselines, a degrade matrix
and an ANSI-sensitive snapshot budget ride on ink's render behavior. The
`references/ink` clone is ALREADY 7.1.0 (HEAD) — the primary source.

## Objective

A blueprint that lets the M10 plan enumerate every required change
task-by-task with zero surprises: breaking-change map scoped to our
surface, react-19/StrictMode consequences (M7 DV-1 revisited), companion
version matrix, harness deltas (our `renderAtColumns` getter-shadow,
`debug: true` semantics), and the bench-rebaseline protocol.

## In-Scope / Out-of-Scope

**In:** ink 5→7 breaking changes ON OUR SURFACE; react 19 reconciler
behavior (strict effects, hook timing); ink-testing-library/ink-spinner
compatibility; our test-harness idioms under ink 7; bench/degrade re-baseline
protocol; publish/peer consequences.
**Out:** new ink 7 features we don't consume (adopting them = future
milestones); react 19 features (compiler, actions) — the lib only needs
compat; ink 8 speculation.

## ADRs

### D1 — Upgrade in ONE slice, absorb renames task-by-task (preliminary)

**Decision shape:** a single milestone branch bumps ink+react together
(they are coupled by the peer), with per-surface tasks (render/Static/
measure/harness) rather than a big-bang commit.
**Rationale:** ink7 requires react19 — no incremental path exists.
**Alternatives:** ink6 stepping stone (rejected: same react-19 wall, double
migration); forked ink (rejected outright).
**Consequences:** the plan's task list mirrors the Q1 breaking-change map.

### D2 — Never-weaken test discipline under migration (preliminary)

**Decision shape:** every failing test post-bump is classified: (a) ink
behavior change → assert the NEW correct behavior with a citation; (b) our
bug exposed → fix code; (c) harness API change → port the harness. No
deletions, no loosened oracles.
**Rationale:** the suite is the migration's safety net; weakening it blinds
the re-baseline.
**Consequences:** Q3/Q4 must pre-map the expected failure classes.

### D3 — Re-baseline protocol for benches + snapshots (preliminary)

**Decision shape:** benches re-run load-gated on the NEW stack and committed
as new baselines with an ADVERSE-only comparison table vs v0.10.0 recorded
(deltas expected — ink 7 render engine differs; the table documents, the
gate is "no unexplained catastrophic regression"); snapshots regenerated
ONLY where ink's output legitimately changed, each diff reviewed.
**Rationale:** baselines are stack-relative; comparing across stacks without
recording the jump would poison future regression detection.
**Consequences:** Q6 defines the exact protocol + acceptance wording.

## Research Questions

| # | Question | Corner | Reference project(s) | Fase A (broad — map hotspots) | Fase B (deep — Read at each hotspot) | Expected answer shape |
|---|---|---|---|---|---|---|
| Q1 | Breaking-change map ink 5.2 → 7.1 scoped to OUR surface: `render()` options/instance API, `Box` props (borderStyle/width/padding semantics), `Text` (wrap/truncate, nested squash), `<Static>` (items contract, single-consumer behavior), `useStdout`/`useInput`/`useFocus`/`useApp` signatures, measure/layout — NOT yoga (same ~3.2.1 both versions, EC-2): the MEASURE-DEP MAJORS are the risk (string-width ^7→^8, wrap-ansi ^9→^10, slice-ansi ^7→^9, cli-truncate ^4→^6, cli-boxes ^3→^4, ansi-tokenize ^0.1→^0.3 — mass width off-by-one threat to ANSI snapshots), debug mode, exit/unmount semantics; PIPE-MODE CONTRACT (EC-1): ink7 resolves interactive = !isInCi && stdout.isTTY and when non-interactive writes ONLY the final frame at unmount (`.claude/knowledge-base/references/ink/src/ink.tsx:257-271,350-353` + `.claude/knowledge-base/references/ink/src/write-synchronized.ts:1-16`) — map what each degrade/example probe captures now; INPUT PIPELINE rewrite (EC-5): `.claude/knowledge-base/references/ink/src/input-parser.ts`, `.claude/knowledge-base/references/ink/src/parse-keypress.ts`, `.claude/knowledge-base/references/ink/src/hooks/use-paste.ts` vs our raw-escape stdin writes + the SYNC throw pin (src/chat-composer.test.tsx:170) | techniques | `.claude/knowledge-base/references/ink/src/ink.tsx`, `.claude/knowledge-base/references/ink/src/render.ts`, `.claude/knowledge-base/references/ink/src/components/Box.tsx`, `.claude/knowledge-base/references/ink/src/components/Text.tsx`, `.claude/knowledge-base/references/ink/src/components/Static.tsx`, `.claude/knowledge-base/references/ink/src/components/App.tsx`, `.claude/knowledge-base/references/ink/src/hooks/`, `.claude/knowledge-base/references/ink/src/reconciler.ts`, `.claude/knowledge-base/references/ink/readme.md`, `.claude/knowledge-base/references/ink/src/measure-text.ts`, `.claude/knowledge-base/references/ink/src/get-max-width.ts`, `.claude/knowledge-base/references/ink/src/wrap-text.ts`, `.claude/knowledge-base/references/ink/src/write-synchronized.ts`, `.claude/knowledge-base/references/ink/src/input-parser.ts` (7.1.0 source — verified paths) vs `node_modules/ink/build` (5.2.1 installed) + the dep-diff table of the two package.json files — DIFF the two; OUR consumption sites (`src/*.tsx`, `tests/helpers.tsx`) | Grep our 8 consumed symbols across the 7.1.0 source; `wc -l` + read the changed modules | Read both versions of each consumed module; build the per-symbol delta table (unchanged / renamed / behavior-changed / removed) | Per-symbol migration table with file:line citations from BOTH versions |
| Q2 | React 19 consequences: which react-reconciler does ink 7 pin, does it enable StrictMode strict effects (M7 DV-1 revisited — our probe showed ink5 does NOT double-invoke), hook timing changes (useEffect flush, cleanup-after-unmount tick our tests pin), `ReactCurrentOwner`-class internals removals that bit the M8 rehearsal | techniques | `.claude/knowledge-base/references/ink/package.json` + `.claude/knowledge-base/references/ink/src/reconciler.ts` + `.claude/knowledge-base/references/ink/src/ink.tsx` (createContainer at :432 — the flags live at the CALL site, EC-8) + `.claude/knowledge-base/references/ink/src/hooks/use-stdout.ts` + `.claude/knowledge-base/references/ink/src/components/StdoutContext.ts`; our `src/use-agent-stream.test.tsx` (DV-1 pins: cleanup-one-tick-after-unmount, no-double-invoke assumptions) | Grep `react-reconciler\|strictMode\|StrictEffects\|createContainer` in ink 7 source | Read the reconciler bootstrap; map each DV-1-era assumption to keep/flip | StrictMode/timing verdict + the exact test files whose assumptions flip |
| Q3 | OUR failure-class pre-map: for each consumed idiom (renderAtColumns getter-shadow on ink-testing-library Stdout, `debug: true` frame capture, `lastFrame()` semantics, `instance.rerender` key-remount, unmount timing pins, `▏` cursor cell via useFocus/inverse), what does ink 7 + itl 4 change? | tests | `node_modules/ink-testing-library` (4.0.0 ALREADY installed — EC-3; peers: only optional @types/react>=18, devDep ink ^5 — NEVER author-validated on ink7) read fully vs `.claude/knowledge-base/references/ink/src/render.ts` RenderOptions + the non-interactive/debug path (`.claude/knowledge-base/references/ink/src/ink.tsx:860-866` — itl's fake Stdout has no isTTY ⇒ ink7 resolves NON-interactive in-process, mitigated by debug:true writing every render); our `src/welcome-banner.test.tsx:29-56`, `tests/helpers.tsx`, `src/chat-composer.test.tsx` focus/cursor pins | Grep itl4 for `columns\|Stdout\|lastFrame\|rerender` | Read itl4 source fully (tiny); replay each harness idiom mentally against it | Harness-delta table: keep / port / rewrite per idiom |
| Q4 | Companion matrix: ink-spinner@5 (peer ink>=4 react>=18 — is it ink7-clean in practice? its cli-spinners usage), ink-testing-library@4 exact peers, react floor is >=19.2.0 (NOT ^19 loosely — `.claude/knowledge-base/references/ink/package.json:107-110`, EC-6; our @types/react ^18.3 also bumps to >=19.2); @types/react@19 impact on our strict TS (exactOptionalPropertyTypes with react19 types), tsx/vitest interplay with react 19 ESM | deps | registry metadata (npm view) + `node_modules/ink-spinner` source (tiny) + our `tsconfig.json` strict flags | npm view each; grep ink-spinner for ink APIs it touches | Read ink-spinner source vs ink7 Text/hooks it uses | Version matrix + any pin/patch decision with evidence |
| Q5 | Ecosystem migration evidence: how did gemini-cli ride ink 6/7 (its fork `@jrichman/ink@6.6.9` — WHY forked? what did they patch?), what do ink 7 release notes/readme flag as breaking vs 5.x | deps | `.claude/knowledge-base/references/gemini-cli/packages/cli/package.json:52` (the fork) + gemini's ink-version history in its lockfile/docs; `.claude/knowledge-base/references/ink/readme.md` + `.claude/knowledge-base/references/ink/src/components/AccessibilityContext.ts`/`.claude/knowledge-base/references/ink/src/components/CursorContext.ts` (NEW ink7 context surfaces absent in 5 — breaking-adjacent additions to check) | Grep gemini for `@jrichman\|ink@` rationale comments/issues refs | Read the fork's declared diff if discoverable; read ink 7 readme breaking notes | Fork-rationale note (adopt/ignore) + official breaking list cross-checked against Q1 |
| Q6 | Evidence protocol: bench re-baseline wording (ADVERSE-only vs cross-stack jump table), snapshot-regeneration review procedure (each diff justified by a Q1 delta), rehearsal AC (fresh react-19 install), and the publish consequence line (0.11.0 minor? or 0.11.0 with prominent react-19 note — semver: peer NARROWING is breaking-ish → decide major-vs-minor with evidence from semver practice on peer bumps; ENGINES NARROWING (EC-4): ink7 requires node>=22 vs our >=20 + CI 20.x leg — bump engines, drop the 20.x leg, weigh in the version decision; THROTTLE default (EC-7): ink7 throttles renders except debug/screen-reader (`.claude/knowledge-base/references/ink/src/ink.tsx:357`) — citable cause for bench re-baseline deltas) | tools | our `docs/benchmarks/*.json` (baseline schema), `.claude/knowledge-base/implementations/m7-stream-adapter-implementation.md` (ADVERSE-only precedent), semver spec + npm docs on peer changes (registry docs page — allowlisted web if needed) | Map baseline schema fields that encode stack (node_version etc.) | Write the protocol + the semver decision memo | Evidence protocol + version-number ADR input |

## Coverage Matrix

| Corner | Questions mapped | Status |
|---|---|---|
| Integration tests | Q3 | Covered |
| Dependencies | Q4, Q5 | Covered |
| Tools | Q6 | Covered |
| Techniques | Q1, Q2 | Covered |

**Coverage: 4/4 corners covered (100%)**

## Edge cases absorbed (from /discover-edge-cases 2026-07-07)

- **EC-1 (MUST-FIX → Q1):** ink7 pipe-mode contract — non-interactive
  (`!isInCi && stdout.isTTY`) writes ONLY the final frame at unmount
  (`.claude/knowledge-base/references/ink/src/ink.tsx:257-271,350-353`); every degrade/example probe's
  captured output changes shape.
- **EC-2 (MUST-FIX → Q1):** yoga premise FALSE (~3.2.1 both) — the real
  mass-snapshot threat is the measure-dep majors (string-width 8, wrap-ansi
  10, slice-ansi 9, cli-truncate 6, cli-boxes 4, ansi-tokenize 0.3).
- **EC-3 (MUST-FIX → Q3):** itl@4.0.0 ALREADY installed; no ink peer — never
  author-validated on ink7; its fake Stdout lacks isTTY ⇒ non-interactive
  in-process, saved by debug:true (`.claude/knowledge-base/references/ink/src/ink.tsx:860-866`).
- **EC-4 (MUST-FIX → Q6):** engines narrowing node>=22
  (`.claude/knowledge-base/references/ink/package.json:17-19`) vs our >=20 + CI 20.x leg.
- **EC-5 (SHOULD → Q1/Q3):** input pipeline rewrite (input-parser/kitty/
  use-paste) vs our raw-escape stdin writes + the sync-throw pin.
- **EC-6 (SHOULD → Q4/Q6):** react floor >=19.2.0 exactly.
- **EC-7 (SHOULD → Q6):** render throttling default (except debug) — citable
  re-baseline cause.
- **EC-8 (SHOULD → Q2):** reconciler flags live at the createContainer call
  site (`.claude/knowledge-base/references/ink/src/ink.tsx:432`), not only reconciler.ts.

**Confirmed by the review (no plan change):** chalk stays (^5.6.2 — degrade
canary intact; ink itself reads no color env, only is-in-ci); ink-spinner@5
peers satisfied; gemini fork stays Q5-grade context; exports/ESM unchanged
(engines is the only packaging delta); renderAtColumns survives in principle
(`.claude/knowledge-base/references/ink/src/utils.ts:11-20` still reads stdout.columns).

## Halt-loop Checkpoints

- After Q1/Q2: the per-symbol migration table + StrictMode verdict exist with
  dual-version citations.
- After Q3/Q4/Q5: harness-delta + companion matrix + fork rationale done.
- Blueprint assembled: 4 corners, ADRs finalized, citation density ≥ 1.0.

## Acceptance Criteria

- Every question `done` (or `blocked` with reason) in the blueprint.
- Every citation resolves via `Path.exists()`.
- Blueprint ≥ SHIPPABLE_WITH_CAVEATS on `/discover-confidence`.

## Global Definition of Done

- Blueprint at `.claude/knowledge-base/discoveries/blueprints/m10-react19-ink7-blueprint.md`
  with the migration table the M10 plan consumes task-by-task.
