# Implementation — m2-tool-surface (M2)

**Date:** 2026-07-06 · **Promise:** IMPLEMENTATION_COMPLETE · **Validation:** exit 0 (0 FAIL, 1 WARN human-evidence)

## Tasks → commits

| Task | Commit(s) | Wiring triad |
|---|---|---|
| T1.1 ToolCall + status + ink-spinner | 3665d32 | (a) example/bench/probe callers · (b) export-surface + snapshots · (c) baseline JSON |
| T1.2 ToolCallCard | d27ee6e (+7b80e78 style) | (a) example/bench · (b) card suite + integration scene · (c) baseline |
| T2.1 truncateLines + ToolResult | d71c8b7 (+bd6f136 SEPA p1 batch) | (a) example/bench · (b) 19-test suite · (c) baseline |
| T2.2 shell envelope | 975bb4f (+537747c SEPA p2 batch) | (a) example/probe · (b) 12-test shell describe (14 added across the task) · (c) baseline |
| T3.1 animation/transition/integration/NO_COLOR | be48595 | integration closure |
| T3.2 bench + baseline + example | e1303c9 | pillar (a)+(c) closure |

## Gates

- `pnpm gates` exit 0 · 141/141 tests (2× consecutive) · coverage 100/99.46/100/100
- `run_validation.py` exit 0 — checkpoint schema, checkpoint↔git, wiring re-verified per symbol, AC gate (post kit-fix, issue #3 comment), test obligations, code-quality PASS 100
- Mini reviews: phase 1/2/3 = PHASE_REVIEW_PASS
- SEPA consulted per phase (TIGHT): phase-1 batch (10 findings → fixed/dispositioned), phase-2 batch (10 findings → F1-F9 fixed, F6 pinned + DV-3 logged)
- Deviations logged: DV-1 (T2.2 protection-suite), DV-2 (atomic-commit slips), DV-3 (stderr-label truncation follow-up)

## Benchmark evidence (pinned env, 5 runs)

- m2 tool-cards: mean 11.981 ± 3.035 ms/frame, peak 36.127 ± 13.359 ms (100 msgs + 50 cards + 150 transitions + 500-line truncated card)
- m0/m1 baselines refreshed same run (windowed thread 2.097 ± 0.141 vs plain 71.054 ± 5.244 ms/frame — ~34×)
