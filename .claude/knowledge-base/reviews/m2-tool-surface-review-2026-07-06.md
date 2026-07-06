# Review: m2-tool-surface

**Date:** 2026-07-06
**Reviewers (spawned agents):** 6 — architecture, tests, wiring, cross-validation, domain-frontend (TUI), domain-testing
**Findings:** 40 total pre-batch (BLOCKER: 0, HIGH: 1, MEDIUM: 7 dedup, LOW: ~14, INFO: ~11)
**Verdict:** **READY_TO_MERGE** (post-batch `de0504f`)

## BLOCKER findings

(none)

## HIGH findings (FIXED in the review batch)

### H-1 (dom-testing-1 ≡ wire-1 ≡ xval-2): EC-15 bench guard was dead code
- `framesAtMount` read the sampler's internal count (always 0 at creation), so the
  memoization-swallow guard reduced to `frames <= 0` — unreachable after `finish()`'s EC-2
  exit. The committed baseline's methodology advertised a protection that did not exist.
  **FIXED:** guard now compares STDOUT frame counts (mount vs post-transitions) and throws;
  methodology string reworded (end-of-run check — Ink throttling batches steps); weaker-than-
  plan-wording per-step strictness rejected as flaky by construction and logged as **DV-4**.
  Baseline regenerated: mean 11.548 ± 2.384 ms/frame, peak 35.247 ± 11.696 ms.

## MEDIUM findings (all FIXED)

- **sampling.ts extraction incomplete + false CHANGELOG claim** (arch-1 ≡ dom-testing-2):
  M0/M1 benches migrated to the shared helpers (identical frame-delta heuristic); `finish()`
  now throws instead of `process.exit` (arch-5); all three baselines regenerated WITH cause
  (code migration + methodology change — addresses dom-testing-5's churn concern).
- **NO_COLOR asserts vacuous for 3 of 4 statuses** (tests-1 ≡ wire-3): line-anchored
  `/^o\s+queued-tool/m`, `/^x\s+broken-tool/m` + dots-frame-anchored running row added.
- **EC-10 test proved nothing about interval reset** (tests-2): now captures the spinner cell
  before/after the same-props rerender and asserts mid-cycle continuity (≠ frame[0]).
- **`execFileSync` hang hazard** (tests-3): child-killing `timeout` option added to both
  subprocess tests (it-level timeout cannot interrupt a sync call); example-tools env
  minimized to the example-chat pattern (dom-testing-3).
- **DV-3 stderr-label truncation** (dom-frontend-1 + arch-4): label now PINNED outside the
  truncation budget (badge idiom) — EC-13's color-independent marker survives tight budgets;
  fully-capped stderr renders `stderr: (capped)`; pinning tests updated. DV-3 marked RESOLVED.
- **Example non-TTY dishonesty** (dom-frontend-2 + dom-frontend-9): piped runs render the
  final scene statically (no ANSI erase spray); TTY runs animate 1.2s → exit 2.5s.
- **Header wraps as parallel columns on narrow terminals** (dom-frontend-3 + dom-frontend-4):
  `wrap="truncate-end"` on name/summary/indicator Texts (gemini ToolGroupDisplay idiom).

## LOW findings — fixed in batch

- Presence pairing on absence-only oracles (tests-4/5); typed-error message asserts for
  −2/2.5 (tests-6); `exited -1` verbatim oracle (tests-7).
- `ChatThread` + `ToolCallCard` composition scene inside the test gate (wire-4).
- M2 baseline oracle: `workload.max_lines` + `frames_mean` recompute (wire-5 ≡ dom-testing-6).
- `STATUS_VISUALS` single map per status — glyph+color+bold in one place (arch-2); F10
  guard-ordering comments at both definition sites (arch-3); bench `exitCode` ternary (arch-6).
- esbuild GHSA-g7r4-m6w7-qqqr (LOW, transitive devDep via tsup) — pnpm override `>=0.28.1`,
  `pnpm audit` clean (xval-1); CHANGELOG § Security entry.

## Dispositioned (documented, not code)

- `MAX_RESULT_CHARS` orphan public export (wire-2): plan-sanctioned ("exported for
  visibility" — risk register); no consumer beyond the contract test by design.
- Status glyph accessibility `o`/`x` under NO_COLOR (dom-frontend-5): matches gemini idiom;
  summary-on-failure modeled in the example; themable glyphs queued for M6.
- `✓` East-Asian-Ambiguous width (dom-frontend-6): same exposure as gemini; M6 theming note.
- Spinner timer hygiene VERIFIED clean (dom-frontend-7); N-running-cards interval fan-out and
  full-scene reflow (dom-frontend-8): plan risk register + M3+ height-budget candidate.
- Bench CV ~25% is structural (spinner wall-clock rerenders — dom-testing-4): documented
  limitation; regression comparisons should use ≥ 2σ deltas.
- Merged no_color tests (xval-3) logged as DV-5; implementation-summary count fixed (xval-4);
  plan-internal count drift (xval-5) → /to-plan template feedback; CI verified via `gh run`
  (xval-6 environment limitation).

## Cross-validation summary

- Plan FROZEN verified; 6/6 tasks traceable to task-tagged commits; Coverage Matrix 10/10;
  ROADMAP § M2 DoD 3/3; deviations DV-1..DV-5 logged (DV-3 resolved in batch); **0 false
  claims** (one count inaccuracy corrected).

## Quality gates summary (post-batch)

- `pnpm gates` exit 0; **143/143 tests** green (2× consecutive runs)
- Coverage: **100% stmts/lines/funcs; 99.48% branches**
- `/code-quality`: PASS (typescript, 0 findings D1–D4)
- `run_validation`: exit 0 (0 FAIL; 1 LOW human-evidence WARN)
- `pnpm audit`: no known vulnerabilities (post-override)
- Benchmarks: 3 baselines fresh under pinned env; m2 tool-cards mean **11.548 ± 2.384
  ms/frame** (100 msgs + 50 cards + 150 transitions + 500-line truncated output)
- CI: node 20 + 22 verified green on the pre-batch HEAD; batch HEAD run pending at report
  time (checked below before release)

## Spawned agents (audit trail)

`.claude/agents/review-m2-tool-surface-2026-07-06/` (findings/).

## Handoff decision

**READY_TO_MERGE** — zero BLOCKER; 1 HIGH and 7 MEDIUM fixed in-batch (RED-first where
applicable); LOW batch applied; dispositions documented. Next: `/release` (develop → main PR,
human-approved) flips ROADMAP M2.
