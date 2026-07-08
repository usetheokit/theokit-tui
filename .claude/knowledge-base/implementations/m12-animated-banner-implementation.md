# Implementation: m12-animated-banner

**Date:** 2026-07-08
**Plan:** `plans/m12-animated-banner-plan.md` (SHIPPABLE 98.8)
**Blueprint:** `discoveries/blueprints/m12-animated-banner-blueprint.md` (SHIPPABLE_WITH_CAVEATS)
**Verdict:** IMPLEMENTATION_COMPLETE · validation exit 0 · code-quality PASS (100) · 480/480 tests

## Task ledger

| Task | Commit | Delivered |
|---|---|---|
| T1.1 reveal | `7b7a950` | `animated?: boolean` — gate stack frozen at mount (`isRevealEligible` pure fn: TTY + rows ≥ 15 + cols ≥ 44 + non-monochrome + `THEOKIT_TUI_NO_MOTION` unset), bounded `useRevealPhase` driver (12 × 80 ms, self-clearing), structural byte-identity via shared `staticBannerTree`; oracles a–g (fake timers + getter-shadow) |
| T2.1 wiring | `58edec6` | `examples/banner.tsx` opts in (`animated` + TTY-aware exit delay 1500/50 ms); pipe smoke pins static-scene-once (oracle h); the ONE anchored mid-reveal snapshot; smoke 3× green |
| T2.2 bench | `49b8815` | OWN bench (M9 flip condition fired) — reveal mode real timers + static rerender mode; baseline committed + contract test (`tests/bench-banner-baseline.test.ts`) |
| validation fixes | `7d3730a`-range | animated suite split to `src/welcome-banner.animated.test.tsx` (500-line file budget; snapshot migrated byte-identical); mini-review artifact path |

## Wiring triad

- **Caller:** `examples/banner.tsx` (`pnpm example:banner`) passes `animated` —
  interactive terminals run the reveal; piped runs degrade to the static path
  by the TTY gate (deterministic smoke by construction).
- **Integration tests:** pipe smoke (static scene exactly once + full
  content) + degrade-matrix scenes untouched (gate closed everywhere there).
- **Runtime observability:** the reveal is the observable (frames on
  stdout); the bench pins wall duration; gate-closed paths render the exact
  static tree (byte-equality asserted live in oracles a/b/g).

## Bench evidence (OWN bench — plan D3)

First full run read load 4.04 (gate < 4) — DISCARDED by discipline; re-run
at load 1.67 is THE baseline (numbers matched the discarded round —
confirming cleanliness, but only the conforming round is recorded):

| Mode · metric | Value | Reading |
|---|---|---|
| reveal mean ms/frame | 80.430 ± 0.141 | tick-dominated (80 ms interval) — the engine renders each phase well inside the tick |
| reveal peak ms/frame | 120.276 ± 0.402 | first-frame layout cost, stable |
| reveal wall (mount→convergence) | **967.570 ± 2.118 ms** | < 2000 ms DoD — measured under real timers, asserted in-bench AND by the baseline contract test |
| static mean ms/frame | 10.715 ± 0.337 | gate-closed rerender cost every pre-M12 consumer pays (child-counter driven, 150 steps) |
| static peak ms/frame | 17.159 ± 3.315 | — |

Baseline: `docs/benchmarks/m12-welcome-banner-baseline.json` (stack
provenance ink 7.1.0 / react 19.2.7 / itl 4.0.0, FORCE_COLOR=1, 1 warmup +
5 measured, population std dev).

## Empirical mutation testing (design is load-bearing)

| Mutant | Change | Outcome |
|---|---|---|
| A | gate re-evaluated per render (drop `useRef`) | SURVIVED the original oracle g (final frames converge either way) → oracle g STRENGTHENED with a post-shrink mid-flight assert → **KILLED** |
| B | drop `clearInterval` cleanup | **KILLED** by `unmount_mid_reveal_leaves_no_timers` |

The mutant-A survival → test-strengthening loop is the M12 counterpart of
M11's mutation pass: the freeze semantics are pinned by a discriminating
assert, not by convergence coincidence.

## Deviations (logged)

- **DV-1 — T2.1 commit landed with a red format gate.** The mini-review
  artifact was written to the repo-root `knowledge-base/` (prettier-checked)
  instead of `.claude/knowledge-base/` (ignored); the gates failure was in
  a chained command so the commit executed anyway. Fixed in the immediate
  next commit (artifact moved, gates green). Lesson: never chain
  `gates; git commit` — gate exit must guard the commit.
- **DV-2 — file-budget split post-hoc.** `src/welcome-banner.test.tsx` hit
  504 lines (> 500 AC); the animated suite moved to
  `src/welcome-banner.animated.test.tsx` with the snapshot migrated
  byte-identically. Caught by `run_validation.py` acceptance-criteria gate,
  as designed.

## Review outcome

(recorded post-review in `reviews/m12-animated-banner-review-2026-07-08.md`)
