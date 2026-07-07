# Review: m4-code-surface

**Date:** 2026-07-07
**Reviewers (spawned agents):** 6 — architecture, tests, wiring, cross-validation, domain-frontend (TUI), domain-testing
**Findings:** 51 total pre-batch (BLOCKER: 0, HIGH: 0, MEDIUM: 11 dedup, LOW: ~24, INFO: ~16)
**Verdict:** **READY_TO_MERGE** (post-batch `f8dfa42`) — with ONE environment blocker surfaced below

## Environment blocker (HUMAN ACTION REQUIRED)

**GitHub Actions is refusing all jobs since 2026-07-06 22:38 UTC** — "recent account
payments have failed or your spending limit needs to be increased" (billing, not code).
Every M4 implementation commit has a 3-second workflow-level failure. Interim evidence:
ALL SEVEN ci.yml steps mirrored locally on node 22 — format/lint/typecheck/test/coverage/
build/bench-smoke ALL PASS (test step re-verified after a machine-load spike). **Fix the
GitHub billing, then re-run the workflow on HEAD before cutting the release.**

## MEDIUM findings (all FIXED in the review batch)

- **Published consumers had NO highlighter-readiness seam** (dom-frontend-1 ≡ arch-2 ≡
  wire-6): one-shot/static renders captured the PLAIN frame forever; the example dodged it
  by deep-importing an internal module consumers can't reach. FIXED: public
  `preloadHighlighter()` on the entry (logged divergence DV-5, M3 CHAT_ROLES precedent);
  example consumes the public seam; export-surface pins presence + internals absent.
- **Cap trailer counted view ROWS, not source lines** (dom-frontend-2): empirical probe
  showed `+2 more lines` while 7 source lines were hidden (a dropped fold row hid its
  whole run). FIXED: fold rows expand to their hidden count (DV-6); oracle pins `+10`.
- **Bench guards weaker than promised** (wire-1, wire-2 ≡ dom-testing-2): the plan's
  windowing-active mount self-check was missing and the wide-hunk check had no negative
  half. FIXED: both guards added; methodology reworded (dom-testing-4 persistence note).
- **`DiffFold`/`DiffRow` orphan type exports vs plan D10** (wire-3): FIXED — withdrawn
  from the entry (module-internal), absence unpinnable regression closed.
- **lowlight devDependency caret-ranged vs the snapshot-drift mitigation** (wire-4):
  FIXED — exact-pinned 3.3.0.
- **Baseline oracle missed the windowing descriptor** (dom-testing-1): FIXED —
  `workload.windowed` asserted (the parameter the headline claim hinges on).
- **Weak/vacuous oracles** (tests-1..5): plain-first now proven on a fresh module registry
  WITH the highlight path engaged; width matrix gained positive anchors; EC-21/22 names
  asserted + backslash fixture added; fold-at-edges covers head AND tail changes; EC-14
  limitation documented honestly (React 18 removed the warning — smoke, not proof).
- **Audit-trail SHA swap** (xval-1): implementation.md T1.2/T3.1 commits corrected;
  mislabeled docs commit noted (xval-4).
- **Unlogged deviations** (xval-2/xval-3): DV-4 (EC-26 re-pin — Ink trims trailing
  whitespace) and DV-5 (highlightLine export + preloadHighlighter) backfilled.
- **Loader misdiagnosed broken-as-absent** (arch-4): FIXED — ERR_MODULE_NOT_FOUND gets the
  install hint; other failures warn with the actual error. Checked adapter replaces the
  double-cast (arch-5).

## LOW batch (applied)

EC-25 via true rerender (tests-6); ladder stub assert de-vacuoused (tests-7); binary names
(tests-8); contextLines message assert (tests-9); whole-frame numbers-off negative
(tests-10); mixed binary+content model test (tests-11); example smoke highlight-byte
assert (tests-13 ≡ wire-7); probe hunk-header counts (tests-15); full-shape blank-line
asserts (tests-16); example exercises contextLines+maxLines (wire-5); `diff` AgentEvent
variant deferral recorded in CHANGELOG (wire-8); `⋮` gap indents under the gutter
(dom-frontend-4); absence pins for highlightLine/foldDiffLines (arch-3 ≡ wire-9 ≡
tests-14).

## Dispositioned (documented, not code)

- Multi-file spacing DV-3 kept (codex inserts a blank line — M5 revisit noted;
  dom-frontend-7). Per-file gutter width (dom-frontend-3): M5/M6 cosmetic. Fixed hljs
  palette light-terminal legibility + `→`/`…` EAW-Ambiguous widths (dom-frontend-5/6):
  M6 theming notes. Render-path malformed propagation scope (tests-12) documented.
  Baseline-churn process note for M5 (dom-testing-3). No vitest retry (dom-testing-5 —
  flaky = bug; subprocess spawns only). Cap arithmetic stays view-side with rationale
  (arch-1); TAB_WIDTH duplication awaits rule-of-3 (arch-6).
- **Baseline load-contention caveat:** the post-batch m4 baseline was regenerated during a
  machine-load spike (documented) — a clean re-run is queued on a load-watcher; BOTH
  measurements agree the windowing claim is conclusive (clean run: 12.4× mean / 13.4×
  peak; loaded run: ~18×). The committed artifact will be replaced by the clean re-run
  before release if the watcher completes; otherwise the clean pre-batch numbers stand as
  the quoted evidence.

## Cross-validation summary

- Plan FROZEN verified; 5/5 tasks traceable; Coverage Matrix 13/13; ROADMAP § M4 DoD 3/3
  (split-view deferral recorded in CHANGELOG as promised; lowlight-over-cli-highlight is
  ADR-D2-evidenced); deviations DV-1..DV-6 logged; implementation-log numbers
  independently re-verified (bench aggregates recomputed to 3 dp).

## Quality gates summary (post-batch)

- `pnpm gates` exit 0; **263/263 tests** green (2× consecutive)
- Coverage: **100% stmts/lines/funcs; 98.05% branches** (critical paths 100% lines)
- `/code-quality`: PASS (typescript, 0 findings D1–D4)
- `run_validation`: exit 0 (0 FAIL; 1 LOW human-evidence WARN)
- Benchmarks: m4 diff-viewer windowing **~12× mean / ~13× peak (clean run: windowed
  9.204 ± 0.957 vs full 114.105 ± 4.938 ms/frame)** — conclusive
- CI: **billing-blocked (see Environment blocker)** — all 7 steps green locally

## Spawned agents (audit trail)

`.claude/agents/review-m4-code-surface-2026-07-07/` (findings/).

## Handoff decision

**READY_TO_MERGE** — zero BLOCKER/HIGH; 11 MEDIUM fixed in-batch; LOW batch applied;
dispositions documented. Release gate: fix GitHub billing + green CI run on HEAD first.
