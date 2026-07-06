# Review: m0-walking-skeleton

**Date:** 2026-07-06
**Reviewers (spawned agents):** 6 — architecture, tests, wiring, cross-validation, domain-frontend (TUI), domain-testing
**Findings:** 33 total (BLOCKER: 0, HIGH: 0, MEDIUM: 6 consolidated, LOW: 14, INFO: 13)
**Verdict:** **READY_TO_MERGE**

## BLOCKER findings

(none)

## HIGH findings

(none)

## MEDIUM findings (all fixed in the review batch OR explicitly dispositioned)

### F-1 (arch-1 ≡ dom-frontend-1): Theme context value re-created per provider render
- Found by: architecture + domain-frontend (independent duplicate)
- File: `src/theme.tsx:73` — **FIXED**: `useMemo(() => mergeTheme(theme), [theme])`;
  benchmark baseline regenerated after the fix (mean 11.246 ± 0.358 ms/frame).

### F-2 (dom-frontend-2): Missing `eslint-plugin-react-hooks` in a React component library
- **FIXED**: `recommended-latest` config added; guard-first EC-1 pattern passes rules-of-hooks
  cleanly (no inline disable needed). New devDep logged in CHANGELOG § Changed.

### F-3 (dom-testing-1): Benchmark color env unpinned — baseline comparability risk
- **FIXED**: `benchmarks/run.ts` pins `FORCE_COLOR=1 / NO_COLOR="" / CI=""` in the spawn env;
  baseline JSON now records `color_env`; methodology updated; baseline regenerated once.

### F-4 (arch-2): NO_COLOR test-mechanism deviation not formally recorded outside code/SEPA logs
- **FIXED**: implementation summary (`m0-walking-skeleton-implementation.md § SEPA resolutions`
  + § Final state) is the formal record: plan's `vitest.stubEnv` mechanism was unimplementable
  (chalk pins color level at import); subprocess fixture supersedes it, AC selector satisfied.

### F-5 (xval-1): Plan `#### TDD` blocks edited after /implement start (commit 2c20402)
- **DISPOSITION (process, not code):** the edit was provably non-semantic (prose → executable
  assertion shapes to satisfy the pre-loop `check_tdd_shape.py` hard gate; no name/AC/task/ADR
  changed) and openly logged in the commit. ADR-style dismissal: the frozen-plan invariant is
  about the CONTRACT (tasks/ACs/scope), which never changed; the shape upgrade is the same
  content in executable form. **Process rule for future runs:** run `check_tdd_shape.py` during
  `/plan-confidence` and commit shape upgrades BEFORE the halt-loop's first task commit.

### F-6 (tests-1): EC-1 negative case via direct function invocation (refactor-fragile)
- **DISPOSITION (accepted with guard):** the double assertion (TypeError + exact message) is the
  operative protection; direct invocation is the only honest way to assert the typed error
  (Ink's ErrorBoundary swallows render-path throws — SEPA initial brief finding 1). react-hooks
  lint (F-2 fix) now mechanically enforces the guard-before-hook ordering the test depends on.

## LOW findings — fixed in batch

- VERSION drift risk (arch-5 ≡ wire-3 ≡ dom-frontend-5): export-surface test now asserts
  `VERSION === package.json.version` (single source of truth).
- Manifest fields uncovered (arch-3, arch-4): contract test extended — `main`/`types` pinned +
  gate-chain script keys asserted.
- Nested-provider semantics implicit (arch-6 ≡ dom-frontend-3): JSDoc note + pinning test
  (`nested_provider_resets_to_default_plus_own_override`).
- Mutable `defaultTheme` (dom-frontend-4): deep-frozen via `Object.freeze`.
- `theme={undefined}` untested (tests-2): test added.
- Empty-children snapshot missing (tests-3): snapshot added (`chat-message-empty`).
- Shared mutable `captured` (tests-4): reset moved to `beforeEach`.
- Bench schema self-consistency (dom-testing-2): recomputed-mean epsilon + `std_dev >= 0` asserted.
- Coverage threshold not continuously enforced (dom-testing-5 ≡ arch-9): `coverage` step added
  to CI (7th step).
- Stale CHANGELOG bench numbers (xval-2): entry now points at the authoritative JSON.
- languages.txt header vs parser format (xval-3): header comment fixed (issue #4 tracks upstream).
- Implementation summary not finalized (xval-4): task table + final state backfilled.
- Integration-test convention undocumented (wire-1): documented in `rules/testing.md § 5`.

## LOW/INFO — dispositioned (not code changes)

- wire-1/wire-2 kit tooling (pillar-b dir convention; pillar-a scanning references/): **issue #5**.
- dom-frontend-6 (assistant glyph ✦ EAW-ambiguous on CJK terminals): M6 terminal-adaptive backlog.
- dom-testing-4 (theme-override runtime validation for JS consumers): M1/M6 theme work, matches
  plan EC-6 accepted risk.
- wire-4 (integration test imports src, not packed dist): M8 publint + pack-smoke, per roadmap.
- xval-5 (kit fix bundled in product commit 1b5503a): noted; prefer separate chore commits.
- tests INFO: NO_COLOR subprocess cost (~1.1s), NO_COLOR-ignored Node warning (cosmetic; canary
  guards the pin), ADR D2 double-assertion wording vs T2.1 operative contract.

## Edge-case coverage report

- Test-shaped edge cases from the plan: **13/13 covered** after batch (EC-1 typed role error,
  EC-2 isFinite + zero-frame guard, EC-3 narrow-width wrap, EC-4 empty override, EC-5 env pins +
  canary, NO_COLOR subprocess probe, empty children incl. snapshot, `theme={undefined}`,
  provider-less fallback, partial-override leaf preservation, nested-provider reset, both-roles
  composition, non-TTY example smoke).
- The script's remaining "missing" items are command-gate criteria (`pnpm lint` zero warnings
  etc.) — machine-enforced by `pnpm gates` + CI steps, not test-searchable.

## Cross-validation summary

- Plan tasks: 9 (8 + Final Phase) — fully implemented: 9; partial: 0; missing: 0; diverged: 0.
- Acceptance criteria: 31/31 satisfied (1 oracle superseded and recorded — xval-3).
- ADRs D1–D9: 9/9 respected; all deviations pre-logged (SEPA trail) and verified.

## Quality gates summary (re-run at review time)

- `pnpm gates` (format → lint → typecheck → test → build): PASS, exit 0
- Tests: 28/28 green (6 files); snapshots stable (3 committed, incl. new empty-children)
- Coverage: 100% statements / branches / functions / lines on `src/**` (thresholds ≥ 90 enforced
  in config + CI step)
- Lint: 0 warnings (now including react-hooks recommended)
- `/code-quality`: PASS 100 (typescript; 0 findings D1–D4)
- run_validation: PARTIAL exit 0 (8 PASS, 0 FAIL, 1 LOW WARN — human evidence herein)
- Wiring triad: pillar (a) 5/5 value exports with functionally-necessary callers (independently
  re-verified); pillar (b) integration test via public entry; pillar (c) committed benchmark
  baseline (provenance verified against git history by the wiring agent)
- Benchmark baseline (pinned env): 300 frames/run, mean **11.246 ± 0.358 ms/frame**,
  peak **29.982 ± 4.747 ms**, 5 measured runs + warmup — `docs/benchmarks/m0-chat-message-baseline.json`
- CI: green on node 20.x + 22.x (pre-batch HEAD; post-batch run verified before merge)

## Spawned agents (audit trail)

- `.claude/agents/review-m0-walking-skeleton-2026-07-06/{architecture,tests,wiring,cross-validation,domain-frontend,domain-testing}.md`
- Findings: `.claude/agents/review-m0-walking-skeleton-2026-07-06/findings/*.md`

## Handoff decision

**READY_TO_MERGE** — zero BLOCKER/HIGH; all 6 MEDIUMs fixed in the review batch or explicitly
dispositioned with rationale above; LOW batch applied; kit issues #1–#5 filed for upstream.
Next: `/release` opens the `develop → main` PR (human approves the merge). Post-merge: archive
the plan to `plans/completed/` and flip ROADMAP M0 via the release cycle.
