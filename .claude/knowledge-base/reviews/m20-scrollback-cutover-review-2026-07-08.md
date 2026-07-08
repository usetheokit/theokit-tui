# Review — M20 scrollback-cutover (2026-07-08)

**Build under test:** `develop` (3 M20 feature commits atop v0.20.0 + a review-fix commit).
**Method:** 2 independent specialist reviewers in parallel (engine/port-fidelity; cross-validation/DoD-auditor), adversarial. Code-quality: gates green (751 tests, prettier + lint + typecheck + build).

## Per-agent verdicts (initial)

| Reviewer | Verdict | Headline finding |
|---|---|---|
| Engine / port-fidelity | **NEEDS_FIXES** | **BLOCKER B1:** absolute-positioning scrollback corrupts the live frame once static+live exceeds terminal height (the chat steady state) — a differential patch lands on the wrong row after the terminal scrolls. Empirically reproduced. |
| Cross-validation / DoD | **NEEDS_FIXES** | **HIGH:** DoD-1 overclaimed — the M11 header/windowing oracles were not re-run on the new renderer, and the print-once oracle was vacuous (3 msgs vs windowSize 8 → nothing graduated). |

**Consolidated initial verdict: NEEDS_FIXES** — 1 BLOCKER, 3 HIGH, 4 MEDIUM, 3 LOW.

## Fixes applied (review-fix commit 52845e6)

| Finding | Sev | Fix + evidence |
|---|---|---|
| B1 — scrollback corrupts after terminal scroll | **BLOCKER** | Rewrote the engine to position the live frame RELATIVE to a tracked cursor row (scroll-invariant), not absolute screen rows. Regression test `patches_the_live_frame_correctly_after_static_overflows_the_screen` (3 static + 4 live on a 5-row terminal) now green; was corrupt (`Bx` on the wrong row). Zero M17/M18 regression (751/751). |
| H1(r1) — resize destroys scrollback | HIGH | Resize keeps native scrollback (dropped `\x1b[3J`) + re-anchors the live frame; `fullStaticOutput` re-emit documented as the tracked follow-up (code + ADR). |
| H1/H2(r2) — DoD-1 overclaim + vacuous oracle | HIGH | M11 oracles rewritten to GENUINELY graduate (grow the thread 6→12→20): header-slot (header once, above ordered history), windowing (bounded live tail, oldest scrolled off), print-once — all through `createRenderer`. |
| M2(r1) — Tab/Shift+Tab on priority channel | MEDIUM | Moved Tab/Shift+Tab to the REGULAR input channel; only ESC stays priority — matches Ink's App ordering exactly. |
| M1(r1) — parity gate ≥90% but claimed 100% | MEDIUM | Gate pinned to 0 divergences (`expect(failed).toEqual([])`). |
| M2(r2) — 2 exported components omitted | MEDIUM | Added `ToolCall` + `ToolResult` scenes → 16/16 (was 14). |
| L1(r1) — bench ms timing asymmetry | LOW | Symmetrized (both engines mount before the timer). Honest result: **~20× fewer BYTES, ms/frame at PARITY** (the earlier "13% faster" was the asymmetry over-crediting V4). Reports/CHANGELOG/ADR corrected. |
| L2 — unqualified perf claim in CHANGELOG | LOW | Qualified ("~20× fewer bytes on a streaming ChatThread; ms at parity"). |

## Findings accepted as-is (documented, non-blocking)

- **M1(r2):** the new hooks (`useFocus`/`FocusProvider`) are wired only via the test adapter, not a shipped `src/` component (the composer still imports Ink's) — this is the deferred Ink-drop import swap, disclosed in ADR 0004 + plan Unresolved Questions. `useStdout` IS wired for real via `createRenderer`.
- **M3(r1):** `itl-adapter.lastFrame()` reads the emulator viewport; content scrolled into native scrollback isn't included. With B1 fixed the live frame is correct; the off-viewport concatenation is a readback limit, fine within a viewport-sized scene.
- **L1(r2)/L2(r2):** plan file-table lists a `static.tsx` that was (soundly) not created — Ink's `<Static>` reused (parsimony); the adapter concat is proven via a raw `<Static>` not a graduated ChatThread. Documentation nits.

## Final state

`pnpm gates` green (751 tests, 2 consecutive full runs). B1 fixed with a regression test and no M17/M18 regression. DoD-1 oracles are now genuine (graduation actually occurs). Component parity is honestly 16/16 with the gate pinned. The focus arbiter matches Ink's channel ordering. The comparative bench is symmetric and honestly reported (~20× bytes, ms parity). The cutover ADR reserves the drop-Ink decision for the owner.

**Verdict: READY_TO_MERGE** — BLOCKER fixed (relative positioning + regression test), all actionable HIGH/MEDIUM/LOW fixed, remaining items disclosed and scoped. No open BLOCKER, 0 open HIGH.
