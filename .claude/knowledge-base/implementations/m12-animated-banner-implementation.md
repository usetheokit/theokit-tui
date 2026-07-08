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
| validation fixes | `95a624c`, `08c6a05`, `5c6a949` | mini-review artifact path (95a624c); progress checkpoint (08c6a05); animated suite split to `src/welcome-banner.animated.test.tsx` — 500-line file budget, snapshot migrated byte-identical (5c6a949) |

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

First full run read load 4.04 (gate < 4) — DISCARDED by discipline; the
committed baseline is the review-batch re-run at load 1.47 (recorded IN
the JSON as `load_1min_at_start` — review F-5; the intermediate load-1.67
round matched within noise):

| Mode · metric | Value | Reading |
|---|---|---|
| reveal mean ms/frame | 80.557 ± 0.140 | tick-dominated (80 ms interval) — the engine renders each phase well inside the tick |
| reveal peak ms/frame | 120.920 ± 0.526 | first-frame layout cost, stable |
| reveal wall (mount→convergence) | **969.511 ± 1.702 ms** | < 2000 ms DoD — measured under real timers, asserted in-bench AND by the baseline contract test |
| static mean ms/frame | 10.620 ± 0.353 | gate-closed rerender cost every pre-M12 consumer pays (child-counter driven, 150 steps) |
| static peak ms/frame | 17.727 ± 2.837 | — |

Baseline: `docs/benchmarks/m12-welcome-banner-baseline.json` (stack
provenance ink 7.1.0 / react 19.2.7 / itl 4.0.0, FORCE_COLOR=1, 1 warmup +
5 measured, population std dev).

## Empirical mutation testing (design is load-bearing)

| Mutant | Change | Outcome |
|---|---|---|
| A | gate re-evaluated per render (drop `useRef`) | SURVIVED the original oracle g (final frames converge either way) → oracle g STRENGTHENED with a post-shrink mid-flight assert → **KILLED** |
| B | drop `clearInterval` cleanup | **KILLED** by `unmount_mid_reveal_leaves_no_timers` |
| review 1–4 | rows→0, phases→1, non-converging `revealing`, drop NO_MOTION check | **ALL KILLED** (reviewer-run, empirical) |
| review 5 | drop `columns >= 44` leg | SURVIVED at review → `below_min_columns_renders_static_immediately` added in the batch → **KILLED** (re-verified) |
| review 6 | drop `!monochrome` leg | SURVIVED at review → `monochrome_theme_forces_static_path` added in the batch → **KILLED** (re-verified) |

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
- **DV-3 — T1.1 LoC AC breached silently (226 > 220).** `run_validation.py`
  surfaced the criterion only as human-evidence (LOW), not a mechanized
  check; caught by review (F-3). Trimmed to 220 in the review batch.
- **DV-2 — file-budget split post-hoc.** `src/welcome-banner.test.tsx` hit
  504 lines (> 500 AC); the animated suite moved to
  `src/welcome-banner.animated.test.tsx` with the snapshot migrated
  byte-identically. Caught by `run_validation.py` acceptance-criteria gate,
  as designed.

## Review outcome

(recorded post-review in `reviews/m12-animated-banner-review-2026-07-08.md`)
