# Implementation: m14-status-bar

**Date:** 2026-07-08
**Plan:** `plans/m14-status-bar-plan.md` (SHIPPABLE 98.8)
**Blueprint:** `discoveries/blueprints/m14-status-bar-blueprint.md` (SHIPPABLE)
**Verdict:** IMPLEMENTATION_COMPLETE · validation exit 0 · code-quality PASS · 527/527 tests

## Task ledger

| Task | Commit | Delivered |
|---|---|---|
| T1.1 hook | `9d8b21b` | `useTurnElapsed(active)` — 1 Hz, 0-when-inactive, RESET on re-activation, leak-free toggle; **TRUE RED executed** (vitest exit 1 before the module existed — M13 F-7 closed); 100% lines, 29 LoC |
| T1.2 bar | `c46b9b6` | `AppStatusBar` — 4 fixed slots, present-slots-only `·` separators, tildeified truncate-start cwd, formatTokens compaction, typed negatives; 2 anchored snapshots; TRUE RED executed; the `gates && commit` discipline BLOCKED one red-format commit (worked as designed) |
| T2.1 example | `fba0c77` | chat example: AppStatusBar under the thread + `AgentStreaming elapsedSeconds={useTurnElapsed(streaming)}`; smoke pins bar order + separators, 3× green |
| T2.2 bench | `f48de8a` | OWN bench (ticking + static) + committed baseline + contract test; TRUE RED (ENOENT) first |

## Wiring triad

- **Caller:** `examples/chat.tsx` — bar + elapsed through the REAL hook.
- **Integration tests:** smoke (bar below thread, ≥ 2 separators);
  export-surface asserts; degrade scenes untouched (bar is theme-driven).
- **Runtime observability:** the bar IS the observable; bench pins both
  the ticking and the presence cost.

## Bench evidence (OWN bench — M9 flip condition)

Load **1.95** (`load_1min_at_start` in the JSON), FORCE_COLOR=1, 1 warmup
+ 3 measured per mode:

| Mode | mean ms/frame | Reading |
|---|---|---|
| ticking | 1002.041 ± 0.107 | ≈ 1 frame/s — the metric reflects the 1 s tick INTERVAL (frame-delta sampler distributes wall across frames), not render cost; the PEAK (~1500/1338 ± 230) is quantization from the 500 ms sample cadence, not a render stall (r1-F5); wall 10020.4 ± 1.1 ms for 10 ticks (plan AC 9000–12000 ✓) |
| static | 14.404 ± 0.091 (peak 24.9 ± 1.7) | the presence cost per unrelated repaint under a 30-message thread |

## Deviations (logged)

- (none — 4/4 tasks ran executed REDs; every commit gates-guarded via
  `&&`; no scope drift; all budgets met: hook 29 ≤ 70, bar 115 ≤ 150 (log initially wrote 113 — corrected at review r1-F2),
  2/2 snapshots)

## Empirical mutation (review r2, 6 mutants + batch re-kills)

| Mutant | Outcome |
|---|---|
| M1 reset-on-deactivate / M3 cleanup / M4 separator index | KILLED at review |
| M2 active-branch reset | equivalent (defensive redundancy — noted in-code, r2-F9) |
| M5 cwd flexShrink | SURVIVED at review → width-fit oracle added → **KILLED** (re-verified) |
| M6 limit<=0 guard | SURVIVED at review → per-axis negative oracles added → **KILLED** (re-verified) |

## Review outcome

(recorded post-review in `reviews/m14-status-bar-review-2026-07-08.md`)
