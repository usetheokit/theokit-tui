# Review: m7-stream-adapter

**Date:** 2026-07-07
**Verdict:** READY_TO_MERGE
**Plan:** `.claude/knowledge-base/plans/m7-stream-adapter-plan.md` (SHIPPABLE 98.8)
**Implementation:** `.claude/knowledge-base/implementations/m7-stream-adapter-implementation.md` (IMPLEMENTATION_COMPLETE; validation exit 0; code-quality PASS)
**Scope:** commits `ced0618..e7b5464` (union, reducer, hook, reconnect, tripwire, wiring, coverage, bench evidence, review fix batch)

## Panel provenance (honest)

Six reviewer roles; four ran as INDEPENDENT subagents, two were re-executed
INLINE by the conductor after the original subagents died on a session limit
mid-run (their partial work discarded; inline re-execution used mechanizable
commands + hand-traces documented below):

| Role | Mode | Verdict |
|---|---|---|
| architecture | subagent | FINDINGS (1 MEDIUM, 3 LOW, 2 INFO) |
| test-auditor | subagent | FINDINGS (2 LOW, 2 INFO) |
| wiring-validator | subagent | PASS (0 findings; triad verified in depth) |
| domain-frontend | subagent | FINDINGS (1 HIGH, 1 MEDIUM, 2 LOW) |
| cross-validation | inline (session limit) | PASS — mechanizable checks below |
| domain-testing | inline (session limit) | covered: RED-before-GREEN per task verified in git; fold-sequence traces (independently CONVERGED with domain-frontend's HIGH) |

## Severity matrix (post-fix-batch)

| Severity | Found | Fixed | Accepted/documented |
|---|---|---|---|
| BLOCKER | 0 | — | — |
| HIGH | 1 | 1 (F-1) | 0 open |
| MEDIUM | 2 | 2 (F-2 code, F-3 doc) | 0 open |
| LOW | 6 | 5 (F-4..F-9) | 1 (INFO-grade, below) |
| INFO | 4 | 1 (F-10 doc) | 3 recorded, no action |

## Findings and dispositions (fix batch commit `e7b5464`)

- **F-1 [HIGH] buried-live-anchor** (domain-frontend + conductor trace,
  independent convergence) — thinking graduation appended a `think-*` event
  BEHIND an open live message; the next text-delta then tail-replaced a
  NON-tail event, violating the M3 only-the-tail contract (frozen `<Static>`
  scrollback under windowing). **Fixed:** `graduateThought` now closes the
  live anchor first (close-on-effectful-fold extends to graduation);
  regression test `thinking_between_deltas_closes_live_message` pins
  `[msg-1, think-2, msg-3]` + boundary oracle.
- **F-2 [MEDIUM] hook-reset-action-injectable** (architecture) — a producer
  emitting `{type: "__reset__"}` reached the hook's internal reset branch and
  wiped folded state. **Fixed:** internal action is now a structural envelope
  (`{kind: "fold"|"reset"}`); negative test `producer_reset_event_is_a_noop`.
- **F-3 [MEDIUM] graduated-tool-replace-invisible** (domain-frontend) — the
  reducer comment claimed "never a frozen spinner" unconditionally, but a
  tool graduated into `<Static>` scrollback will not repaint on terminal
  fail. **Fixed (documentation):** comment now states the known limit
  honestly, citing the plan's accepted-v0 Drawback; status-aware windowing
  recorded as a future ADR candidate — not a hotfix.
- **F-4 [LOW] iterator-return-unhandled-rejection** (domain-frontend) —
  teardown/cancel `iterator.return()` rejections could kill the consumer CLI.
  **Fixed:** `swallowTeardown` catches at the only place it can be handled;
  test `rejecting_iterator_return_never_escapes`.
- **F-5 [LOW] tool-upsert-lookup-asymmetry** (architecture) — divergent
  predicates could silently overwrite a non-tool event on id collision.
  **Fixed:** single `findIndex` with the full kind+id predicate — a collision
  now appends and fails loud at the M3 duplicate-id boundary.
- **F-6 [LOW] tool-upsert-drops-prior-content** (architecture) — a
  result-less late update (e.g. status-only error after completed) discarded
  folded shell/output. **Fixed:** `resolveToolContent` inherits existing
  content; test `late_resultless_update_preserves_folded_content`.
- **F-7 [LOW] exports-beyond-adr-d8** (architecture) — accessory type exports
  lacked rationale. **Fixed:** arch-5-precedent comment in `src/index.ts`.
- **F-8 [LOW] ref-identity-claimed-not-asserted** (test-auditor) — comments
  claimed referential invariants tests didn't pin. **Fixed:** `toBe`/
  `not.toBe` asserts (tail is a NEW object; graduated prefix passes by
  reference).
- **F-9 [LOW] multi-behavior-test** (test-auditor) — cancel test bundled 3
  behaviors. **Fixed:** split into `second_cancel_is_noop` +
  `post_cancel_resolves_are_dropped`.
- **F-10 [LOW] raw-iterable-strictmode-instant-done** (domain-frontend) —
  **Fixed (documentation):** `AgentStreamSource` doc now tells StrictMode
  consumers to pass a factory.
- **Accepted (INFO-grade):** reducer `import type` of `ToolCallStatus` from a
  component module (M3 precedent, runtime-erased); non-tail replace tension
  on terminal folds (plan-documented v0); vacuous branch in the
  environment-robust StrictMode test (by design, DV-1); pre-existing 50ms
  sleeps in the composer scene (out of M7 scope).

## Cross-validation (inline, mechanizable evidence)

- Backward compat: `git diff --name-only <m7-base>..HEAD -- 'src/*.test.*' 'tests/*'`
  lists ONLY new files + the two extended contract suites (export-surface,
  public-api) + their snapshot file — pre-M7 suites unmodified, 430/430 green (gates run post-fix-batch).
- Snapshot budget: 1 new snapshot (`stream-adapter-scene`), insertions-only.
- dts leak: `grep -c "@theokit/sdk" dist/index.d.ts` → 0. Build green.
- Spawn budget: 9 `execFileSync` suite-wide (≤ 12).
- Manifest pins: sdk in devDependencies only (`^2.19.0`), asserted by test.
- Task→commit mapping: 6/6 tasks committed gates-gated (ledger in the
  implementation log); Coverage Matrix 13/13 spot-checked (rows 1, 3, 5, 6,
  13); deviations DV-1/DV-2 logged, no silent divergence.
- RED-before-GREEN: every task's test file enters the tree in the same commit
  as (or before) its implementation, with RED confirmed in-session per the
  halt-loop protocol; the bench-baseline contract tests catching the
  color-env-invalid round (discarded + re-run) is live evidence the
  evidence-gates bite.

## Hard gates (cycle-review § Hard gates)

- Tests green on branch: 430/430 on the post-fix-batch gates run; a later ad-hoc count run hit 2 spawnSync ETIMEDOUT in the M6 degrade-matrix under 1-min load 91 (unrelated shared-machine burst — known contention class, not weakened; the gates run is the verdict evidence).
- No new secrets: scope inspected — none.
- No commits to `main`; no Co-Authored-By trailers in slice commits.
- CHANGELOG updated per task under `[Unreleased]` (Added ×5 grouped + Fixed ×1).

**READY_TO_MERGE.**
