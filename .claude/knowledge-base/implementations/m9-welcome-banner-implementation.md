# Implementation: m9-welcome-banner

**Date:** 2026-07-07
**Plan:** `.claude/knowledge-base/plans/m9-welcome-banner-plan.md` (SHIPPABLE 92.4, zero caps)
**Blueprint:** `.claude/knowledge-base/discoveries/blueprints/m9-welcome-banner-blueprint.md` (SHIPPABLE 98.2)
**Verdict:** IMPLEMENTATION_COMPLETE
**Validation gate:** `run_validation.py m9-welcome-banner` → exit 0 (8 PASS / 0 FAIL / 1 WARN advisory / 1 SKIP / 1 N/A)
**Code-quality:** PASS (audit `.claude/knowledge-base/audits/m9-welcome-banner-code-quality-2026-07-07.md`, 0 hard caps)

## Task ledger (3/3 committed, gates-gated)

| Task | Commit | Delivered |
|---|---|---|
| T1.1 component | `881a1ff` | `src/welcome-banner.tsx` (113 LoC ≤ 250 budget) — accent-bordered box, width clamp `min(columns ?? 60, 60)`, 24-col floor with plain-text final rung, theme-data border branch (`single` monochrome / `round` otherwise), nested-Text name+version line (truncates as ONE unit), tagline `\n` split, hints block with conditional margin, children slot, fail-fast typed validation; 15-test suite incl. the `renderAtColumns` harness (instance-getter shadow + rerender — ink-testing-library hard-codes columns=100) |
| T2.1 wiring | `d4fb751` | entry export + export-surface pin; composed scene + 1 anchored snapshot (public-api); degrade fixture `<WelcomeBanner>` + per-scene border policy asserts (┌ only under NO_COLOR; ╭ under dumb/pipe — theme-DATA-driven) + M6 byte-equality 4-corner normalization |
| T2.2 example | `a1eb64b` | `examples/banner.tsx` (house unmount shape) + non-TTY subprocess smoke (EC-2 by construction) + `example:banner` script |

## Wiring triad

- **(a) Caller:** `examples/banner.tsx` (`pnpm example:banner`) + composed public-api scene via entry.
- **(b) Integration test:** composed scene + snapshot; degrade-matrix 3 scenes inherit the banner (zero new spawns); export-surface pin.
- **(c) Runtime evidence:** smoke asserts the RENDERED output (name, real `v0.x`, no `vundefined`, hint, round border under pipe-fallback width, children row); exit 0.

## Suite state

- 448/448 tests (430 pre-M9 + 18 new); two consecutive full runs green,
  byte-identical snapshots. Snapshot budget: **2 new files, 25 insertions,
  zero existing changed** (unit default+floor batched, 1 public-api scene).
- Coverage 99.63% all-files; `src/welcome-banner.tsx` **100% lines** (93.1%
  branches — the two uncovered arms are the `?? MAX_WIDTH` stdout-absent
  fallback exercised by the SUBPROCESS smoke, not in-process, and a floor
  ternary arm; critical-path 100%-lines criterion met).
- `pnpm build` green; `grep -c WelcomeBanner dist/index.d.ts` = 3.
- Spawn count: 10 (≤ 11 budget). Backward compat: `git diff --name-only
  <m9-base>..HEAD -- 'src/*.test.*'` lists ONLY the new banner suite +
  its snapshot file; pre-M9 suites unmodified.

## Deviations (logged, honest)

- **DV-1 — `renderAtColumns` harness simpler than planned.** The plan (EC-2)
  specified calling ink's own `render` with a fake stdout; the first
  implementation attempt showed ink's debug-mode write path + immediate
  unmount is race-prone. Shipped mechanism: ink-testing-library render, then
  `Object.defineProperty(instance.stdout, "columns", …)` (own-property getter
  shadows the library's prototype getter) + `rerender` with a fresh key —
  same oracle power, fewer moving parts. No test weakened (15 vs 14+ planned).
- **DV-2 — throw asserts use the house direct-call idiom.** `expect(() =>
  WelcomeBanner(props)).toThrow(…)` (context-window-bar precedent) instead of
  render-wrapped — validation runs BEFORE hooks by design, so the direct call
  is the exact boundary under test.

## Bench evidence decision (per plan Final Phase)

**No re-run — M9 is purely ADDITIVE:** `git diff --name-only <m9-base>..HEAD
-- src/` lists ONLY `src/welcome-banner.tsx`, `src/welcome-banner.test.tsx`,
`src/index.ts` (exports appended) — zero benched render-path files modified;
T2.1's other touches are tests/fixtures. The flip-condition guard in the plan
("if any OTHER src/ file modified → full load-gated re-run") did not trigger.
No-new-bench justification + flip condition per blueprint Corner 3 (banner
renders once at startup; a bench would measure process startup noise).

## Follow-ups

- Review guards (from D1): no layout props, no `<Static>`, no gradient dep — for `/review` to verify.
