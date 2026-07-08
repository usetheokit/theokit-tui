# Review — M17 renderer-skeleton (2026-07-08)

**Build under test:** `develop` @ f63ed81 (3 M17 commits atop v0.17.0) + review-fix commit.
**Method:** 5 independent specialist reviewers spawned in parallel (fresh context each): architecture, test-quality, wiring-depth, cross-validation, domain (react-reconciler/Ink/CSI).

## Per-agent verdicts (initial)

| Reviewer | Verdict | Key finding |
|---|---|---|
| Architecture | READY_TO_MERGE | Clean DIP/island/SRP/LSP; `maySuspendCommit` provenance nit (MEDIUM) |
| Test-quality | READY_TO_MERGE | Real screen-state oracles; coalescing determinism latent (MEDIUM); uncovered defensive branches (LOW) |
| Wiring-depth | **NEEDS_FIXES** | D2 observability metric populated but not reachable through the public seam → `fullRedrawCount` a dead field (MEDIUM) |
| Cross-validation | **NEEDS_FIXES** | **BLOCKER:** `pnpm gates` fails on `prettier --check` (5 committed files unformatted); `Text` barrel drift (LOW) |
| Domain (reconciler) | READY_TO_MERGE | Faithful 0.33 host + pi ladder; nested-box/newline row mis-assembly reachable but documented-M18 (MEDIUM); teardown SYNC_END imbalance (LOW) |

**Consolidated verdict (initial): NEEDS_FIXES** — 1 BLOCKER, 0 HIGH, 3 actionable MEDIUM.

## Fixes applied (this review-fix commit)

| Finding | Severity | Fix |
|---|---|---|
| `pnpm gates` fails on prettier | **BLOCKER** | `prettier --write` on all 5 files; the real `pnpm gates` (format:check→lint→typecheck→test→build) now exits 0. Root cause: per-task gates ran the sub-commands individually and skipped `format:check`. |
| D2 metric unreachable / `fullRedrawCount` dead field | MEDIUM (wiring) | Added `Renderer.stats(): RendererStats` exposing `fullRedrawCount` + `lastRedrawReason` through the public seam; new test `stats_exposes_full_redraw_metrics_through_public_seam` drives it via a width-change. `fullRedrawCount` is no longer dead. |
| Nested-box / newline-in-row mis-assembly reachable | MEDIUM (domain) | Documented the two specific reachable cases (+ over-viewport windowing) in `m17-parity-report.md` with `⚠️ reachable today; renders inline, no error → M18` verdicts. Scope is honest, not silent. No throwing guard added (KISS — a skeleton that throws on valid JSX is worse UX; M18 Yoga fixes it properly). |
| Swallowed commit-phase throw on Offscreen/Suspense reveal | INFO (domain) | Added `hideInstance`/`unhideInstance`/`hideTextInstance`/`unhideTextInstance` no-op stubs. |
| `maySuspendCommit` diverges from Ink (`false` vs `true`) | MEDIUM (arch) | Documented the deliberate divergence in-code (text-only skeleton has no suspendable resources; revisit at M21 images). |
| Uncovered `?? "row"` default branch | LOW (test) | Added `box_without_flex_direction_defaults_to_row`. (The `??`-right operand stays a defensive branch — unreachable through Ink's Box, which always sets `flexDirection`; line coverage remains 100%.) |

## Findings accepted as-is (documented, not fixed)

- **Coalescing test uses `setTimeout(0)` to flush the microtask (test MEDIUM).** Deterministic under Node (microtasks drain before any macrotask); no active flake. A `whenPainted()` promise is a possible M18 defense-in-depth, not required.
- **`renderer.ts` grew 110 → 119 LoC.** The `stats()` accessor is reviewed new scope (wiring M-1). The pre-review ≤110 AC was for the original T2.1 surface; the observability accessor legitimately grows it. Documented here rather than squeezing comments for a vanity number.
- **`Text` not re-exported from the renderer barrel (LOW).** No AC required it; consumers use Ink's `Box`/`Text` as JSX intrinsic sources (as the example/tests do). Left to M18 API-surface pass.
- **teardown emits a lone `\x1b[?2026l` (domain LOW).** No-op on conforming terminals; every render path is balanced. M18 windowing cleanup.

## Final state

`pnpm gates` exits 0 (prettier + lint + typecheck + **599 tests** + build). Renderer modules: output-engine 100% all axes; host-config + renderer 100% lines. Byte-parity gate green; 29.2× bytes win documented.

**Verdict: READY_TO_MERGE** — BLOCKER resolved, both blocking-adjacent MEDIUMs fixed, remaining findings documented and scoped to M18. No BLOCKER, 0 HIGH.
