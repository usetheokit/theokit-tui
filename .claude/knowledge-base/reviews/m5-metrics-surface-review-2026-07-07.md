# Review: m5-metrics-surface

**Date:** 2026-07-07
**Reviewers (spawned agents):** 6 — architecture, tests, wiring, cross-validation, domain-frontend (TUI), domain-testing
**Findings:** 30 total pre-batch (BLOCKER: 0, HIGH: 0, MEDIUM: 4, LOW: ~12, INFO: ~14)
**Verdict:** **READY_TO_MERGE** (post-batch `c2e9c9a`) — CI environment blocker still pending (see below)

## Environment blocker (HUMAN ACTION STILL REQUIRED — carried from M4)

GitHub Actions remains billing-blocked ("recent account payments have failed or your
spending limit needs to be increased") since 2026-07-06. Interim evidence: all seven
ci.yml steps mirrored locally (format/lint/typecheck/test/coverage/build/bench-smoke —
ALL PASS). **Fix the GitHub billing, then re-run the workflow on HEAD before cutting
the M4/M5 releases.**

## MEDIUM findings (all FIXED in the review batch `c2e9c9a`)

- **`formatPercent` exported with zero production callers** (wire-1): the label built
  its string manually from `displayPercent`. FIXED — the `'used'` convention now
  consumes `formatPercent(usedRatio)`; the `'left'` path still derives
  `100 − displayPercent` from the SAME authority (a second `formatPercent(1 − r)` call
  is the EC-1 float trap and stays forbidden, documented inline).
- **`MIN_BAR_CELLS = 3` duplicated knowledge** (arch-1): one plan-level degrade rule in
  two homes. FIXED — exported from `src/fill-bar.ts` (layout invariant of the bar
  primitive; color policy stays caller-side), both components import it.
- **Coverage claim "M5 modules 100% on all axes" overclaimed** (xval-1): `format.ts`
  branch axis is 95.23% (unreachable loop-exit guard). FIXED — implementation log
  corrected; the plan's actual gates (≥90% global, critical paths 100% lines) were
  always met.
- **Stale "peak delta within noise (INCONCLUSIVE)" claim** (dom-testing-1): the
  refreshed baseline's peak delta is 3.22 ms vs σ 2.46 (~1.3σ) — CONCLUSIVE; the claim
  was hand-derived from the pre-refresh run. FIXED — log + CHANGELOG corrected; the
  bench now computes and prints BOTH deltas (mean + peak) with the INCONCLUSIVE tag
  (dom-testing-2) and finds modes by name, never position (dom-testing-3), so peak
  verdicts can never be hand-derived again.

## LOW batch (applied)

Shared `assertFiniteNonNegative` boundary guard exported from `format.ts` and consumed
by all three components — the 4× hand-rolled predicate passed rule-of-3 (arch-3); dead
`width !== undefined` clause dropped (arch-4 ≡ dom-frontend-7); cadence-symmetry assert
added to the M5 baseline schema test (`frames_mean` equal across modes — dom-testing-6);
`single_category_renders_full_bar` now pins EXACTLY 10 cells at width 20 (tests-1); the
width-30 degrade boundary now pins the 2█+1░ split, not just the total (tests-2);
`format_cost_table` gains the grouping-rollover rows `999.999/1000 → "~$1,000.00"`
(tests-3); pre-refresh delta σ convention corrected to ±0.121 combined (xval-2);
`TokenCategory` entry-export rationale documented inline (arch-5); ACCENT_COLOR
cross-sync comments added (arch-2).

## Dispositioned (documented, not code)

- **wire-2** (example test execs the file, not the npm script): consistent with the
  M2-M4 example-test house pattern — all four example tests exec `tsx examples/*.tsx`
  directly. Uniform change is an M6 chore if wanted.
- **wire-3** (probe imports component modules directly): subprocess-fixture pragmatism;
  the composition-root path is proven by the integration scenes. Optional M6 tidy.
- **dom-testing-4** (with-metrics peak σ inflated by a first-measured-run outlier;
  single warmup insufficient for peak stability): noted in the implementation log;
  WARMUP_RUNS=2 is an M6 bench-hygiene candidate. Mean-delta conclusions unaffected.
- **dom-testing-5** (schema test cannot catch a fully self-consistent forgery):
  inherent limit of recompute-based pins; provenance rests on the refresh commit.
- **dom-frontend-1** (garbled wrap when the CONTAINER is narrower than the `width`
  prop): the prop is the documented budget — caller contract; wrap/flexShrink
  hardening is an M6 robustness candidate. **dom-frontend-2** (binary degrade cliff —
  an intermediate bar+label tier would be friendlier): ADR'd binary degrade (EC-5);
  M6 polish. **dom-frontend-3** (unthemed cyan accent ×2): the designated M6 theming
  candidate, self-flagged in code. **dom-frontend-4** (█/░ are EAW-Ambiguous — 2-cell
  on CJK-configured terminals; same exposure as bubbles, strictly better than gemini's
  color-only ▬): M6 note class, escape hatch exists via FillBarOptions.
  **dom-frontend-5** (bar-cell jitter at formatTokens unit boundaries mid-stream):
  cosmetic, M6. **dom-frontend-6** (label-only floor overflows sub-8-col budgets):
  accepted floor per ADR. **dom-frontend-8** (no React.memo): consistent with the
  project's measure-first stance; bench says reconciliation is cheap. **dom-frontend-9**
  (example rows lack a shared label gutter): demo-level polish, M6.
- **tests-4** (width matrix passes the width prop instead of a Box wrapper — stronger
  than the plan shape), **tests-5** (stripAnsi/count helpers re-declared 5× in test
  files — test-code DRY, M6 tidy), **tests-6 ≡ DV-1** (15 vs 14 fill-bar tests —
  strengthening extra), **xval-4** (probe assert folded per the plan's own one-spawn
  mandate): recorded, no action.
- **xval-3** (phase-1 mini-review NEEDS_FIX report overwritten by the re-run PASS):
  process note — future re-runs suffix `-rerun`. DV-2 documents the sequence honestly.

## Cross-validation summary

Plan FROZEN verified; 7/7 tasks traceable to commits touching exactly the planned
files; Coverage Matrix 14/14; ROADMAP § M5 DoD 3/3 with named proving tests; deviations
DV-1/DV-2 logged; implementation-log numbers independently reproduced (327/327 tests,
99.74% coverage, bench aggregates recomputed to 3 dp — exact); edge-case absorptions
EC-1/2/9/10/12 spot-verified in code and oracles.

## Quality gates summary (post-batch)

- `pnpm gates` exit 0; **327/327 tests** green (two consecutive full runs at Final
  Phase + post-batch)
- Coverage: 99.74% stmts/lines global; M5 modules 100% stmts/lines/funcs (format.ts
  branches 95.23% — unreachable guard, documented)
- `/code-quality`: PASS (typescript, 0 findings D1–D4)
- `run_validation`: exit 0 (0 FAIL; 1 LOW human-evidence WARN)
- Benchmarks: m5 footer delta **1.00 ± 0.31 ms/frame mean (conclusive)**; peak 3.22 ms
  vs σ 2.46 (conclusive, σ-inflated by one outlier run); Final-Phase refresh of all six
  baselines; m4 quiet-machine refresh (12.5× windowing) supersedes the contention-noted
  baseline
- NO_COLOR probe: glyph-distinct fill verified in a real subprocess (a test class BOTH
  reference analogs lack)
- CI: **billing-blocked (see Environment blocker)** — all 7 steps green locally

## Spawned agents (audit trail)

Agent outputs consolidated in this report (subagent transcripts under the session's
task store; finding IDs preserved: arch-1..5, tests-1..6, wire-1..3, xval-1..4,
dom-frontend-1..9, dom-testing-1..6).

## Handoff decision

**READY_TO_MERGE** — zero BLOCKER/HIGH; 4 MEDIUM fixed in-batch; LOW batch applied;
dispositions documented. Release gate: fix GitHub billing + green CI run on HEAD first
(M4 + M5 can release sequentially once CI is green).
