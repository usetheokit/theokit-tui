# Implementation: m11-chatthread-header-slot

**Date:** 2026-07-08
**Plan:** `plans/m11-chatthread-header-slot-plan.md` (SHIPPABLE 100.0)
**Blueprint:** `discoveries/blueprints/m11-chatthread-header-slot-blueprint.md` (SHIPPABLE)
**Verdict:** IMPLEMENTATION_COMPLETE · validation exit 0 · code-quality PASS · 471/471 tests

## Task ledger

| Task | Commit | Delivered |
|---|---|---|
| T1.1 ChatThread | `5687150` | `header?: ReactElement` — MOUNT-FREEZE (`useRef(header).current`) + sentinel Symbol as first `<Static>` item; reserved key `"__theokit_tui_header__"` rejected at `assertUniqueIds` (TypeError, validated BEFORE hooks for the direct-call idiom); 5 oracles incl. the same-length shrink+grow trap |
| T1.2 AgentTimeline | `9199f99` | Exact mirror (imports `HEADER_SENTINEL_KEY`); 4 mirror oracles + 1 snapshot (`timeline-header-scene` — the milestone's single new snapshot, budget ≤1 held); M10 re-record guard refined to deletions-only via `numstat` |
| T1.3 wiring | (folded into T2.1) | — |
| T2.1 evidence | `9eb78ef` | Banner in `examples/chat.tsx` header slot (+3 smoke asserts: contain/order/print-once), `no-color-probe` fixture banner moved INTO the ChatThread slot, headerless bench re-run (below) |
| review batch | (this commit) | F-1 this file; F-2 timeline header caller in `examples/stream.tsx` (+2 smoke asserts); F-3 smoke anchor → 1-line row; F-1(rev2) console.error spy kills the drop-key mutant; F-2(rev2) percent-width prop-doc note |

## Wiring triad

- **Caller:** `examples/chat.tsx` (`<ChatThread header={<WelcomeBanner .../>}>`) + `examples/stream.tsx` (`<AgentTimeline header=.../>`) — human-runnable production paths.
- **Integration tests:** `tests/example-chat.integration.test.ts` (contain + order-above-history + print-once), `tests/example-stream.integration.test.ts` (contain + order), 3 degrade-matrix scenes exercise header-in-Static via the fixture slot for free.
- **Runtime observability:** the header is static output — its presence/order IS the observable (asserted byte-level in smokes); TypeError on sentinel-key collision is the fail-fast signal.

## Bench evidence — headerless re-run (M9 flip condition FIRED: chat-thread.tsx is a benched file)

Two rounds; the first was DISCARDED by the load gate discipline, not by the numbers:

| Round | Load (1-min) | Verdict | Note |
|---|---|---|---|
| 1 | **3.41** (rising, other suites running) | DISCARDED | plain mean 121.4 read ADVERSE vs M10 — contention noise, not signal (M7 precedent `4a7bf1d`) |
| 2 | **1.58** (idle) | KEPT — clean | table below |

Round 2 vs M10 baseline (same stack ink 7.1.0 / react 19.2.7 / itl 4.0.0, same workload 500 msgs / 300 tokens / w8+4, FORCE_COLOR=1, 1 warmup + 5 measured):

| Mode · metric | M10 (2026-07-07) | M11 headerless re-run (2026-07-08) | Δ | Reading |
|---|---|---|---|---|
| plain mean ms/frame | 113.098 ± 7.477 | **112.951 ± 2.338** | −0.1% | within noise — union/ternary added zero headerless cost |
| plain peak ms/frame | 243.930 ± 62.678 | **164.047 ± 2.834** | −33% | > 1σ — FAVORABLE outlier: the M10 run's peak carried a 62.7 std-dev (one contended run); M11's tight 2.8 std-dev is the honest peak. Improvement direction requires no gate action (only ADVERSE deltas demand a citable cause), logged for regression-tracking honesty. |
| windowed mean ms/frame | 14.912 ± 0.655 | **15.385 ± 0.252** | +3.2% | within run-to-run noise (< 1σ of M10's own spread across sessions) |
| windowed peak ms/frame | 23.274 ± 3.954 | **24.489 ± 2.966** | +5.2% | within 1σ — noise |

Gate: zero ADVERSE beyond noise; the header path itself adds no per-frame
work by design (prints once into Static). Flip-to-bench-mode condition
stands: if the header ever gains a per-frame path, it gets its own bench
mode.

## Deviations

- **DV-1 — T1.3 folded into T2.1.** The wiring task had no independent code
  surface (caller + smoke land together with the example edit); progress
  file maps both to `9eb78ef`. 1-task-1-commit held for T1.1/T1.2.
- (none else — plan executed as written; no scope drift)

## Review outcome

2026-07-08, 2 triple-role reviewers (arch+wiring+cross / tests+frontend
incl. empirical mutation testing — mutant A `useRef` removal KILLED by 2
tests). 1 MEDIUM (this file) + 3 LOW + 2 INFO — all addressed in the batch
commit. Report: `reviews/m11-chatthread-header-slot-review-2026-07-08.md`.
