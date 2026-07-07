# Implementation — m3-agent-surface (M3)

**Date:** 2026-07-06 · **Promise:** IMPLEMENTATION_COMPLETE · **Validation:** exit 0 (0 FAIL, 1 WARN human-evidence)

## Tasks → commits

| Task | Commit(s) | Wiring triad |
|---|---|---|
| T1.1 AgentEvent + dispatch + boundary validation | 8a71a7e | (a) example/bench/probe · (b) 13-test dispatch suite · (c) baseline |
| T1.2 windowed Static + memo rows | c49d3a9 (+c445691 SEPA p1 batch) | windowing oracles (spy counts, frozen prefix) |
| T2.1 AgentStreaming + formatElapsed | c6207e3 | (a) example ticker · (b) 14-test suite · (c) baseline |
| T3.1 turn snapshot + integration + NO_COLOR | 83fed51 | integration closure (DoD-2/DoD-3) |
| T3.2 bench + baseline + example | 83a12d5 (+coverage follow-up) | pillars (a)+(c) closure |

## Gates

- `pnpm gates` exit 0 · 188/188 tests (2× consecutive) · coverage 100/98.81/100/100
- `run_validation.py` exit 0 — checkpoint↔git, wiring re-verified, AC gate, test obligations, code-quality PASS
- Mini reviews: phase 1/2/3 = PHASE_REVIEW_PASS
- SEPA phase-1 (TIGHT): 8 findings — F1 maxLines boundary guard, F2 output→children normalization, F3 styled thinking oracle, F4-F6 polish applied; F7 (unionMessage rule-of-3) logged followup; F8 verified-clean
- Edge-case batch EC-1..EC-14 absorbed at plan time (D8 full boundary validation)

## Benchmark evidence (pinned env, 5 runs/mode — post-review regeneration)

- ORIGINAL committed numbers were VOID (review BLOCKER DV-5: the 500-line item never
  rendered — matrix measured identical workloads). After the fix (tall item appended
  mid-loop): bounded mean 3.668 ± 0.135 ms/frame (peak 9.194 ± 1.833); unbounded mean
  5.768 ± 0.596 (peak **51.054 ± 9.246**) — the tall-item graduation cost is ~5.5× on
  peak, CONCLUSIVE (>> 1σ); peak is the risk-1 metric as planned
- m0/m1/m2 baselines refreshed same run
