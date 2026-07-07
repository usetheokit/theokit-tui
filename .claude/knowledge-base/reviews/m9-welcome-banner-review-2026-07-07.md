# Review: m9-welcome-banner

**Date:** 2026-07-07
**Verdict:** READY_TO_MERGE
**Plan:** `.claude/knowledge-base/plans/m9-welcome-banner-plan.md` (SHIPPABLE 92.4)
**Implementation:** `.claude/knowledge-base/implementations/m9-welcome-banner-implementation.md` (IMPLEMENTATION_COMPLETE; validation exit 0; code-quality PASS)
**Scope:** commits `881a1ff..5a0157a` (component, wiring, example/smoke, review fix batch)

## Panel

Six INDEPENDENT subagent reviewers (all completed):

| Role | Verdict |
|---|---|
| architecture | FINDINGS (1 LOW, 1 INFO) |
| test-auditor | FINDINGS (2 LOW, 1 INFO) |
| wiring-validator | PASS (ran the suites itself — 14/14 green) |
| cross-validation | PASS (ran all mechanizable ACs — every one green; 1 INFO) |
| domain-frontend | FINDINGS (1 MEDIUM, 1 LOW, 1 INFO) — traced against real ink 5.2.1 source |
| domain-testing | FINDINGS (1 MEDIUM, 1 LOW, 1 INFO) — hypothetical-mutant traces |

## Severity matrix (post-fix-batch `5a0157a`)

| Severity | Found | Fixed | Accepted/documented |
|---|---|---|---|
| BLOCKER / HIGH | 0 | — | — |
| MEDIUM | 2 | 2 | 0 open |
| LOW | 4 | 4 | 0 open |
| INFO | 4 | 1 | 3 recorded |

## Findings and dispositions

- **[MEDIUM] F-1 resize-stale-width** (domain-frontend) — ADR D3's auxiliary
  claim "ink re-renders on resize" is FALSE in ink 5.2.1 (resize handler =
  yoga re-layout + repaint only; `useStdout` is a stable context value):
  width and the floor decision freeze at render. **Fixed (honesty):**
  width-contract comment in the component + ADR errata; accepted for a
  startup-moment banner; flip condition = `useTerminalSize` hook (gemini
  pattern) on live-resize demand. Sweep confirmed: the banner is the only
  `columns` reader in src/.
- **[MEDIUM] F1 margin-gap snapshot-only** (domain-testing) — removing
  `marginTop={1}` survived every behavioral assert (only snapshots caught
  it). **Fixed:** behavioral oracle — exactly one border-only blank row
  between tagline and first hint.
- **[LOW] F2 floor-rung-truncate-untested** — **Fixed:** long-name floor
  case (1 line, length ≤ 23).
- **[LOW] F-2 empty-version-dangling-v** — **Fixed:** `normalizeVersion`
  (whitespace → absent) + `empty_version_renders_as_absent` test.
- **[LOW] tests-1 D4 comment vs assert** — **Fixed:** real module-source pin
  (`not.toMatch(import { … Static … })`).
- **[LOW] tests-2 / arch-m9-1 hint-empty negative + strengthening unlogged**
  — **Fixed:** `hints: [""]` negative + version error-message assert; the
  hints strictness (empty entries throw — stricter than D5's letter)
  recorded in the implementation log as a deliberate Rule-8 strengthening.
- **[INFO] F3 scene-negative-asymmetry** — **Fixed** (cheap): `not.toContain("┌")`
  mirrored in the dumb/pipe scenes.
- **Accepted (INFO):** `stdout?.` defensive chain (unreachable under ink's
  default context — kept as host-injection armor); EC-8 nonEmptyLines asserts
  redundant with the byte-equality (documentation value); ROADMAP DoD-1 lists
  `version` unmarked vs implemented `version?` (superset, both paths tested).

## Mechanizable evidence (cross-validation, re-run post-fix)

448→455 tests green (7 new oracle asserts in the batch); module 100% lines;
`wc -l src/welcome-banner.tsx` = 129 ≤ 250; spawns 10 ≤ 11; snapshots: 2 new
files insertions-only; dts exports 3 hits; backward compat clean (only new
test files); zero new deps (manifest gained only the `example:banner`
script); D1 guards hold (no layout props, no `<Static>` import — now
source-pinned, no gradient dep).

## Hard gates

- Tests green on branch (gates run post-fix-batch); no new secrets; no
  commits to `main`; no Co-Authored-By in slice commits; CHANGELOG updated
  (Added grouped + Fixed).

**READY_TO_MERGE.**
