# Review — M21 premium-capabilities (2026-07-08)

**Build under test:** `develop` (4 M21 feature commits atop v0.21.0 + a review-fix commit).
**Method:** 2 independent specialist reviewers in parallel (image/renderer integration; editor + fuzzy/@ cross-validation), adversarial, with throwaway emulator + reducer probes. Gates green (859 tests).

## Per-agent verdicts (initial)

| Reviewer | Verdict | Headline |
|---|---|---|
| Image / renderer | **NEEDS_FIXES** | HIGH: kitty image-ID leak (deleteKittyImage never called); HIGH: full-image re-transmission when a line above it changes (+ suspected duplicate kitty placement). The M20-B1-analog regression does NOT reproduce (the 1×1 PNG is genuinely 20 rows — the test is real). |
| Editor / fuzzy cross-val | **NEEDS_FIXES** | **BLOCKER B1:** yank-pop corrupts the buffer when not immediately after a yank (data loss). Undo coalescing / @-race / ADR-C3 / file-search bounds all verified correct. |

**Consolidated initial verdict: NEEDS_FIXES** — 1 BLOCKER, 2 HIGH, 2 MEDIUM, ~3 LOW.

## Fixes applied (review-fix commit 3cc73b2)

| Finding | Sev | Fix + evidence |
|---|---|---|
| B1 — yank-pop buffer corruption after a cursor move / typing | **BLOCKER** | Added `lastYank` to `EditorState`; set on yank/yank-pop, cleared on every other action; `applyYankPop` is a no-op unless `lastYank`. Regression tests: yank→move→yank-pop and yank→type→yank-pop leave the buffer untouched; yank→yank-pop still cycles. composer-editor 100% lines. |
| kitty image-ID leak | HIGH | `<Image>` frees the uploaded kitty image on unmount (`deleteKittyImage` via the `useStdout` write seam — no-op under Ink / for iTerm2). Test asserts the `a=d,d=I` delete escape on unmount. |
| image re-transmission within a changed span | HIGH | `changedSpanBody` no longer re-emits an UNCHANGED row inside a changed span (empty string + the `\r\n` advance) — the image escape is not re-blasted when a sibling row changes, and no duplicate kitty placement is stacked. Test: span crossing an image → escape on the wire exactly once. |
| dedup test never exercised dedup; cap branches uncovered | MEDIUM (M2) | Threaded state so the dedup test is real; added genuine history-cap (130 entries) + undo-cap (130 non-coalescing edits) tests + a direct `editorActionForChord` test → composer-editor 100%. |
| `isImageLine` orphan export | LOW | Removed (the general unchanged-row skip supersedes wiring it). |

## Findings accepted as-is (documented, non-blocking)

- **iTerm2 cursor accounting + tall-image scroll are untestable on @xterm/headless** — the emulator implements neither the kitty nor the iTerm2 graphics protocol, so the cursor-advance-by-height (the point of the `moveUp` prefix) and an update to a row that scrolled above a taller-than-terminal image cannot be asserted on the emulator oracle. The structural logic was traced and reads correct; a real-terminal (kitty + iTerm2) dogfood is the follow-up before any production image claim.
- **M1 "100% lines"** — now accurate for the new pure modules (composer-editor / fuzzy / file-search / mention-menu all 100%); text-buffer (extended, not new) is ~96%, above the 90% gate.
- **L1** PTY e2e drives C-w/C-y (the rest verified in-process); **L2** `examples/editor.tsx` not created (the editor is default-on in the chat example + `examples/images.tsx`); **L3** inline `fileSearch` prop re-fires (the default is stable) — all minor, disclosed.
- **INFO verified correct:** undo coalescing (fish-style), `@` async race-safety (AbortController), menu/history priority chain, ADR-C3 (`/` menu untouched — zero diff since M15), `findMentionToken` edges, file-search bounds/abort/never-throws, and genuine wiring (Image exported, editor driven by the composer, `@` provider reaches real async search).

## Final state

`pnpm gates` green (859 tests). The BLOCKER (yank-pop data loss) is fixed with a guard + regression tests and no other behavior change. Both image HIGHs are fixed (unmount free + span re-emit skip) with tests. The editor reducer is 100% lines; the dedup/cap tests are now genuine. Remaining items are emulator-oracle limitations (documented, dogfood follow-up) and minor disclosed nits.

**Verdict: READY_TO_MERGE** — BLOCKER fixed (yank-pop guard + tests), both HIGH image issues fixed (leak + re-transmission), MEDIUM test-quality gaps closed. No open BLOCKER, 0 open HIGH.
