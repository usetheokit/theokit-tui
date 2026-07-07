# Implementation — m4-code-surface (M4)

**Date:** 2026-07-07 · **Promise:** IMPLEMENTATION_COMPLETE · **Validation:** exit 0 (0 FAIL, 1 WARN human-evidence)

## Tasks → commits

| Task | Commit(s) | Wiring triad |
|---|---|---|
| T1.1 diff-model + parse-diff | fb91832 | (a) example/bench · (b) 20-test parser suite · (c) baseline |
| T1.2 DiffViewer | c08d6e4 (+64d1b0a/a12b919 complexity, +526efad SEPA batch F1-F6) | 22-test renderer suite |
| T2.1 CodeBlock + lowlight optional peer | d8d6751 | (a) example · (b) 20+1 tests incl. module-absent · (c) baseline |
| T3.1 integration + NO_COLOR | eb26ed9 | composition scene + probe diff |
| T3.2 bench + baseline + example | eba9cac (+d0c0f08 coverage closure) | pillars (a)+(c) |

## Gates

- `pnpm gates` exit 0 · 261/261 tests (re-verified post machine-load spike: 11 subprocess/timing flakes at load-average 46 all pass at normal load) · coverage 100/98.05/100/100 (critical paths diff-model + code-block 100% lines)
- `run_validation.py` exit 0 · Mini reviews: phases 1/2/3 PASS
- SEPA phase-1 (TIGHT): F1 MAJOR — spurious `⋮` inside contiguous hunks (per-side counters fix + regression test); F2/F3 oracle strengthening; F4→DV-3; F5 DV-2 amendment; F6 blank-row coverage
- Deviations DV-1..DV-3 logged (parse-diff stripped names; parse-before-hooks vs EC-12; multi-file spacing none-by-design)
- Bench self-check caught its own wide-hunk off-by-one before any measurement shipped (fail-fast working as designed)

## Benchmark evidence (pinned env, 5 runs/mode)

- m4 diff-viewer: windowed mean 9.204 ± 0.957 ms/frame (peak 16.074 ± 1.87) vs full mean 114.105 ± 4.938 (peak 216.023 ± 28.162) — **windowing ~12× on mean, ~13× on peak; conclusive (>> 1σ)** — the roadmap "large diffs" claim with real numbers
- m0-m3 baselines refreshed same run (per-milestone refresh policy)
