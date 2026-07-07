# Implementation: m6-theme-robustness

**Plan:** `.claude/knowledge-base/plans/m6-theme-robustness-plan.md` (SHIPPABLE 92.8, FROZEN)
**Blueprint:** `.claude/knowledge-base/discoveries/blueprints/m6-theme-robustness-blueprint.md` (SHIPPABLE 98.7)
**Completed:** 2026-07-07
**Status:** IMPLEMENTATION_COMPLETE (pending `run_validation.py` — § below)

## Tasks → commits (all TDD RED→GREEN→REFACTOR; gates-gated commits)

| Task | Commit | Wiring triad |
|---|---|---|
| T1.1 TheoTheme growth (name/accent/code/toolStatus, byte-identical defaults) | `b7dfc0a` | (a) provider + every useTheoTheme consumer; (b) 8 structural/merge tests; (c) tokens observable in every colored frame |
| T1.2 built-ins dark/light/no-color + union prop + NO_COLOR swap | `3089710` | (a) entry exports `themes` + resolution in the production provider; (b) 13 resolution tests + surface pins; (c) NO_COLOR probe end-to-end |
| CHANGELOG structure fix (Added/Changed restored) | `6e99db4` | docs-only |
| T2.1 STATUS_VISUALS → toolStatus tokens (+ spinner color) | `6940910` | byte-identical swap; token-driven override tests |
| T2.2 HLJS_COLOR_MAP → code.* buckets | `7f98950` | byte-identical swap; highlighted-override test; 3 ladder call sites updated |
| T2.3 ACCENT_COLOR ×2 → accent token (chart gains useTheoTheme) | `887f5a5` | byte-identical swap; accent-override tests ×2 |
| T3.1 composer visible cursor under no-color (`▏` marker) | `bd240bc` | theme.name-driven production render fix; 3 in-process tests |
| T3.2 degrade matrix + invariance + light snapshot + canary + themes demo | `3be6b79` | pillars a (example:themes) + b (matrix/invariance/scenes) + c (canary + probe) |
| Final Phase: pair-form base-default branch test | `6e8df1e` | coverage closer |
| Final Phase: 6-bench regression re-run | `caba183` | runtime evidence (§ below) |

## Quality gates

- `pnpm gates` exit 0 per commit; **364/364 tests** green.
- Coverage: **99.76% stmts/lines global**; `theme.tsx` 100% lines/stmts/funcs (branches
  98.14 → the pair-form default branch closed at Final Phase).
- **Snapshot budget (D5/D6): 1 new snapshot** (`light-theme-scene`) — budget was ≤ 3;
  **ZERO existing snapshots changed** across the entire constants→tokens migration
  (the byte-identical criterion held: any diff would have been a regression finding).
- Mini reviews: phases 1, 2, 3 — all **PHASE_REVIEW_PASS** on first run.
- Machine-load note: two gates runs flaked under load 26-34 (post-boot/contention —
  subprocess 30s timeouts, composer stdin timing); each re-ran green on load < 9;
  no test weakened.

## The decisive robustness findings (recorded)

- **NO_COLOR was handled NOWHERE in the installed chain** (chalk 5.6.2 vendored
  supports-color — grep + empirically verified). The DoD promise is implemented BY US
  as a theme-layer swap (provider memo, once per mount — never per frame). The old
  probe passed vacuously via pipe-level-0; the probe now proves OUR swap end-to-end
  (the `▏` composer marker is the only-our-swap-can-produce oracle).
- **Composer cursor was invisible at level 0** (inverse is an attribute; level 0
  collapses the whole visual channel) — fixed via the theme-name-driven marker.
  Honest scope: TERM=dumb/bare-pipe with a colored theme keeps the invisible inverse
  (cursor is an interactive affordance; NO_COLOR is the standard opt-out) — plan
  Drawbacks row.
- **Degrade matrix:** NO_COLOR and TERM=dumb renders are BYTE-EQUAL modulo the marker
  (asserted); bare-pipe proves detection with no env at all; the downsample canary
  pins the installed chalk's `#ff8800 → 38;5;214` rounding at the deterministic
  `TERM=dumb + FORCE_COLOR=2` recipe (immune to GH Actions' forced level 3).

## Bench regression evidence (D7 — no new bench, justification recorded)

**Why no new bench:** M6 adds zero per-frame work — token reads are the SAME memoized
`useContext` as M0-M5; base+override merge and the NO_COLOR env read run inside the
provider `useMemo` (once per mount/prop-change). A themed-vs-default bench would
measure the same context read on both sides — reporting ±noise as "theming cost" is
benchmark theatre. The honest guard is the full re-run below (the migration touched
five components' render paths).

**Full 6-bench re-run (quiet machine, load < 9), M6 vs the M5 recorded numbers
(mean ± population σ, ms/frame; verdict OK = delta ≤ 1 max-σ):**

| bench | mode | metric | M5 | M6 | delta | max σ | verdict |
|---|---|---|---|---|---|---|---|
| m0-chat-message | default | mean | 15.621±0.312 | 15.117±0.696 | −0.504 | 0.696 | OK |
| m0-chat-message | default | peak | 34.646±2.191 | 32.347±4.171 | −2.299 | 4.171 | OK |
| m1-chat-thread | plain | mean | 76.912±2.714 | 82.839±20.190 | +5.927 | 20.190 | OK |
| m1-chat-thread | plain | peak | 131.005±17.802 | 160.986±47.049 | +29.981 | 47.049 | OK |
| m1-chat-thread | windowed | mean | 2.384±0.116 | 2.015±0.090 | −0.369 | 0.116 | OK |
| m1-chat-thread | windowed | peak | 4.626±1.230 | 5.535±1.564 | +0.909 | 1.564 | OK |
| m2-tool-cards | default | mean | 12.422±0.594 | 13.013±2.828 | +0.591 | 2.828 | OK |
| m2-tool-cards | default | peak | 27.040±2.625 | 29.721±6.302 | +2.681 | 6.302 | OK |
| m3-agent-timeline | bounded | mean | 2.979±0.296 | 3.032±0.619 | +0.053 | 0.619 | OK |
| m3-agent-timeline | bounded | peak | 6.816±0.979 | 6.906±1.748 | +0.090 | 1.748 | OK |
| m3-agent-timeline | unbounded | mean | 5.598±0.393 | 5.545±0.264 | −0.053 | 0.393 | OK |
| m3-agent-timeline | unbounded | peak | 48.836±3.111 | 48.292±4.361 | −0.544 | 4.361 | OK |
| m4-diff-viewer | windowed | mean | 10.968±0.925 | 13.539±1.301 | +2.571 | 1.301 | WATCH |
| m4-diff-viewer | windowed | peak | 21.392±2.974 | 23.487±5.688 | +2.095 | 5.688 | OK |
| m4-diff-viewer | full | mean | 137.050±9.980 | 106.686±21.301 | −30.364 | 21.301 | OK |
| m4-diff-viewer | full | peak | 272.381±34.444 | 184.158±25.284 | −88.223 | 34.444 | OK |
| m5-metrics | with-metrics | mean | 3.684±0.309 | 3.391±0.292 | −0.293 | 0.309 | OK |
| m5-metrics | with-metrics | peak | 6.813±2.457 | 6.011±1.168 | −0.802 | 2.457 | OK |
| m5-metrics | without-metrics | mean | 2.682±0.058 | 2.612±0.084 | −0.070 | 0.084 | OK |
| m5-metrics | without-metrics | peak | 3.597±0.062 | 4.178±0.296 | +0.581 | 0.296 | WATCH |

**Verdict: NO M6-caused regression — 18/20 within 1σ; the 2 WATCH rows (1-2σ) sit on
paths M6 did NOT touch:** `git diff c036ef8..HEAD -- src/diff-viewer.tsx
src/diff-model.ts src/chat-thread.tsx src/chat-message.tsx` is EMPTY (diff-viewer's
windowed +2.6ms coexists with its own FULL mode IMPROVING 22% in the same run;
m5-without-metrics is the footer-ABSENT mode — pure ChatThread). Both are cross-run
machine variance, not code. The themed components' own benches (m2 tool-cards, m5
with-metrics) are dead flat — the token indirection cost is unmeasurable, as D7
predicted.

## Deviations

(none — all seven tasks landed as planned; the only plan-text ambiguity found at
implement time was resolved WITHIN plan bounds: `toolStatus.running` typed color-only
per D1's own resolution note.)

## Environment notes

- GitHub Actions remains billing-blocked (since 2026-07-06) — all 7 ci.yml steps
  mirrored locally. Human action pending.
