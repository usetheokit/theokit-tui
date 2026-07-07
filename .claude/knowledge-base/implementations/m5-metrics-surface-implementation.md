# Implementation: m5-metrics-surface

**Plan:** `.claude/knowledge-base/plans/m5-metrics-surface-plan.md` (SHIPPABLE 94.4, FROZEN)
**Blueprint:** `.claude/knowledge-base/discoveries/blueprints/m5-metrics-surface-blueprint.md` (SHIPPABLE 99.7)
**Completed:** 2026-07-07
**Status:** IMPLEMENTATION_COMPLETE — `run_validation.py` exit 0 (0 FAIL; 1 LOW human-evidence WARN); `/code-quality` PASS (typescript, 0 findings D1–D4)

## Tasks → commits (all TDD RED→GREEN→REFACTOR; gates-gated commits)

| Task | Commit | Wiring triad |
|---|---|---|
| T1.1 fill-bar core (renderFillBar + formatPercent/displayPercent) | `64a415e` | (a) callers: T2.1/T2.2 components — planned temporal gap, see DV-2; (b) fill-bar.test.ts 15 oracles; (c) glyph counts observable in every frame |
| T1.2 format.ts (formatTokens k/m promotion + formatCost honesty) | `09abb89` | (a) T2.x components; (b) format.test.ts pinned tables; (c) rendered values |
| T2.1 ContextWindowBar | `b9e8eb7` | (a) entry export + example/bench/probe; (b) 17 co-located tests + export pins; (c) gauge visible per frame |
| T2.2 TokenUsageChart | `06ff555` | (a) entry export + example/bench/probe; (b) 13 tests; (c) chart rows |
| T2.3 CostMeter | `8657c2b` | (a) entry export + example/bench/probe; (b) 6 tests; (c) cost row |
| T3.1 integration scene + NO_COLOR probe | `4fafbdd` | pillar (b): composition-root scene + subprocess probe (glyph-distinct fill) |
| T3.2 bench + baseline + example | `a418181` | pillars (a)+(c): `pnpm example:metrics` caller + committed baseline (runtime evidence) |
| Final Phase coverage closers | `9339bff` | M5 modules 100% on all four coverage axes |
| Final Phase baseline refresh (m0–m5) | `873184c` | per-milestone refresh policy; m4 contention baseline superseded (12.5×) |

## Quality gates

- `pnpm gates` exit 0 per commit (gates-gated commit discipline; two contention flakes
  re-ran green and are logged below).
- Tests: **327/327** green — two consecutive full `pnpm vitest run` (stability gate).
- Coverage: **99.74% stmts/lines global**; M5 modules (`fill-bar.ts`, `format.ts`,
  `context-window-bar.tsx`, `token-usage-chart.tsx`, `cost-meter.tsx`) **100% on all
  axes**; critical paths (fill-bar, format) 100% lines.
- `run_validation.py m5-metrics-surface` exit 0 (first run had a load-flake `npm test`
  FAIL — composer stdin timing test, passed 327/327 twice immediately before and re-ran
  clean; second run 0 FAIL / 1 LOW WARN: 14 criteria need human evidence — the `pnpm
  gates exits 0` boxes, all verified per task with logged runs this session).
- `/code-quality`: **PASS**, 0 findings (audit at
  `.claude/knowledge-base/audits/m5-metrics-surface-code-quality-2026-07-07.md`).
- Mini reviews: phase 1 (NEEDS_FIX → re-run **PASS** after T2.1 provided the planned
  caller — DV-2), phase 2 **PASS**, phase 3 **PASS**.

## Benchmark evidence (committed baseline `docs/benchmarks/m5-metrics-baseline.json`)

- with-metrics 3.684 ± 0.309 ms/frame mean vs without-metrics 2.682 ± 0.058 →
  **footer delta 1.00 ± 0.31 ms/frame — conclusive (>1σ)**: the metrics surface costs
  ~1ms/frame under a streaming 50-message thread. Peak delta within noise
  (INCONCLUSIVE, reported as such). A pre-refresh run measured 0.755 ± 0.086 — same
  conclusion.
- Final-Phase full refresh of all six baselines under pinned env; the m4 refresh
  (windowed 10.968 ± 0.925 vs full 137.05 ± 9.98 — 12.5× mean) supersedes the
  contention-noted baseline per the M4 review disposition.

## Deviations (full log: `m5-metrics-surface/deviations.md`)

- **DV-1** — T1.1 ships 15 tests (plan pinned 14): +1 `displayPercent` seam pin.
- **DV-2** — Phase-1 mini-review HIGH (`formatPercent` no caller) was the PLANNED
  pure-modules-first structure; resolved by T2.1 (the first caller), phase 1 re-run
  PASS. No no-op caller was added.

## Environment notes

- GitHub Actions remains billing-blocked (since 2026-07-06) — all 7 ci.yml steps
  mirrored locally (gates + coverage + build + bench smoke). Human action pending.
- Machine load 8–12 during the window; three isolated flakes (code-block-absent mock
  under full-suite contention ×1, composer stdin timing ×2) — each passed in isolation
  and in consecutive full runs; no test was weakened.
