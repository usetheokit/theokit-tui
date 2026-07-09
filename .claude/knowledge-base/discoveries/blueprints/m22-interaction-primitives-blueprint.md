# BLUEPRINT — M22: Renderer V4 Interaction Primitives (SelectList · Overlay/Modal · Pager)

**Slug:** `m22-interaction-primitives` · **Type:** DISCOVER blueprint · **Date:** 2026-07-08 · **Deps:** M20 (focus + Static), M19 (input), M21 (fuzzy), M15 (slash-menu-model)

## Executive summary

M22 ships the three interaction primitives every peer (7/7) provides and that all app-level pickers/dialogs compose from. Each primitive separates a PURE state model (window/scroll/selection math) from the render — mirroring our M15/M21 precedent (`slash-menu-model.ts` pure + `SlashMenuList` dumb renderer).

1. **SelectList generalizes `slash-menu-model.ts`** — extract windowing/clamp/overflow/counter into a reusable pure model adding (a) generic item type, (b) multi-select via a `Set<value>`, (c) fuzzy filter via `src/fuzzy.ts`. Slash + mention menus become thin adapters over it. **Keep M15's EXACT trailing-window math** (`slash-menu-model.ts:75-78`) or snapshots break.
2. **Overlay uses the M20 FocusProvider** — a stack; pushing disables background focus (`disableFocus`), the overlay owns focus; Esc-dismiss interplays with the M20 priority ESC-blur arbiter via the composer's "take focus back on the same ESC" pattern (`chat-composer.tsx:401-409`).
3. **Pager = pure scroll-model + full-screen overlay** — `viewport` reducer (offset/height/total → visible slice + clamp + percent), reads terminal `rows` from `useStdout`.

Scope: model/theme/session/permission selectors are APP compositions and OUT (`ROADMAP.md:510`, parity matrix). M22 ships primitives; M23 ships agent decision surfaces that consume them.

## A. SelectList — windowed fuzzy list, single + multi-select

**Prior art:** pi `select-list.ts:60-107` (center-window, `→`, `(i/n)`); ink-ui `use-multi-select-state.ts:158-179` (multi via Set, space toggle — the multi-select reference); gemini `BaseSelectionList.tsx:203-211` (edge-triggered); bubbles `list.go` (page-based); codex `scroll_state.rs:124-141` (`ensure_visible`) + `list_selection_view.rs:470-474` (filtered_indices). Our M15 is a **bottom-anchored trailing window** (fifth variant).

**Approach:** `src/select-list-model.ts` — pure, ink-free superset of slash/mention models:
- `SelectListItem { value; label; description?; disabled? }`; `SelectListState { open, filter, matches, clampedIndex, windowStart, overflowUp/Down, selected: Set<number> }`.
- Windowing: reuse the EXACT M15 trailing-window clamp (default), `window` a param (M15 hardcodes 5).
- Filtering: `prefix` (M15 command contract) | `fuzzy` (`fuzzyRank` from fuzzy.ts) — strategy param, not a fork.
- Multi-select: `Set<value>` (NOT index — fuzzy re-orders matches), toggle on space; single-select uses Enter on clampedIndex.
- Navigation: wrap-around (codex `move_up_wrap`).

**Render:** `SelectList` component generalizing `SlashMenuList` (`chat-composer.tsx:230-269`): `❯` marker, ▲/▼ overflow, `(i/n)` counter, + multi-select checkbox column (`◉`/`◯`). name `flexShrink=0`, description `wrap="truncate-end"`.

**Integration (the DRY proof):** after `select-list-model.ts` lands, `deriveSlashMenu`/`deriveMentionMenu` become thin adapters (their trigger logic stays; they delegate windowing) → the existing M15/M21 snapshots are the regression harness. Today the window math is duplicated verbatim across `slash-menu-model.ts:69-87` + `mention-menu-model.ts:67-83`; M22 collapses them.

**ADRs:** A1 keep M15 trailing-window (not pi center / codex edge — behavior-preserving + stateless pure derivation). A2 multi-select by value (`Set<string>`), not index. A3 SelectList component consumes OUR M19/M20 hooks (not ink's — new code, no cutover debt). A4 filter strategy is a param (prefix|fuzzy).

**Edge cases:** empty matches → open:false + filter reported (M15 latch); filter change resets index to 0 but `selected` persists by value; `disabled` items skipped on nav (defer unless M23 needs); window > matches → windowStart 0.

## B. Overlay / Modal layer

**Prior art:** codex `bottom_pane/mod.rs:214,574-619` (view stack + short-circuit `if !stack.empty(){return None}` + Esc-pop); gemini `DialogManager.tsx` (flag-gate); ink `App.tsx` + focus-manager (enable/disableFocus, global ESC); opencode `dialog.tsx:71-137` (mode-stack + binding gate + refocus); pi `tui.ts:799-810,1030-1090` (composite z-index).

**Approach — reuse the M20 FocusProvider:**
- `OverlayProvider` + `useOverlay()` owning `stack: OverlayEntry[]`; push/pop.
- **Focus capture = M20 primitives.** Stack non-empty → `disableFocus()` on the background scope (thread focusables inert); overlay renders in its own focus scope. Stack empties → `enableFocus()`. This IS ink's contract, which our provider exposes (`use-focus.ts:302-321`).
- **Esc-dismiss via the priority ESC arbiter.** M20 arbiter blurs on ESC on the priority channel before component useInput (`use-focus.ts:191-200`). Overlay's own useInput (after the arbiter) pops + restores background focus — mirror of `chat-composer.tsx:401-409`.
- **Why not codex short-circuit?** Codex owns a central dispatcher; we're React/Ink-shaped (per-component useInput gated by isActive). The idiomatic equivalent is `disableFocus()` + `isActive: isFocused` — which we already have.

**Rendering above content (the subtle part):** our renderer has NO absolute positioning/z-index.
- **B-strat-1 (RECOMMENDED):** overlay is part of the LIVE FRAME — renders as normal React nodes at the bottom of the live tree, painted by the existing differential `paint()`. Modal = bordered Box appended; full-screen (pager) sets Yoga height = `terminal.rows`, thread collapses. NO engine change.
- **B-strat-2 (DEFER):** true composite z-index (pi `compositeLineAt`) — needs a new compositing pass; M22 doesn't need floating modals.
- Full-screen overlay stays in the MAIN screen buffer (no alt-screen), unlike codex — consistent with our graduated-scrollback thesis; dismiss restores via `relativeFullRender`.

**ADRs:** B1 overlay focus = M20 disableFocus/enableFocus (not a new modal flag — DRY, it IS our short-circuit). B2 in-band render (not composited z-index). B3 main-buffer full-screen (no alt-screen). B4 dismiss reuses the composer's ESC-refocus pattern.

**RISK F-HIGH-1 (#1 design risk):** `isFocusEnabled` is a BOOLEAN not a ref-count (`use-focus.ts:114`). Nested overlays (push→push→pop) re-enable background focus one pop too early. **Must resolve in PLAN** — depth-counted overlay-open guard at the OverlayProvider level, not per-overlay `isFocusEnabled` toggling.

**Edge cases:** ESC when both overlay + composer want it (overlay must be active focus so its useInput consumes ESC, no fall-through); nested overlays (only top captures; depth guard); resize while open (recompute rows from live useStdout getters); overlay unmount must enableFocus + restore focus (useEffect cleanup — leaking disableFocus kills the UI); raw-mode ref-counted (safe).

## C. Pager — full-screen scrollable viewport

**Prior art:** bubbles `viewport.go:200-210` (ScrollPercent `y/(t-h)`), `:303-306` (maxYOffset), `:342` (visible slice), `keymap.go` (pgup/pgdn/b/f/u/d/j/k); codex `pager_overlay.rs:120-291` (offset, keys, percent), `keymap.rs:1094-1112`; conduit scrollbar.

**Canonical pure scroll-model (converged):** `maxOffset = max(0, total - height)`; `clampedOffset = clamp(desired, 0, maxOffset)`; `percent = maxOffset===0 ? 1 : clamp(offset/maxOffset,0,1)`; `visible = lines[offset : offset+height]`.
**Canonical keys:** ↑/k line-up · ↓/j line-down · PgUp/b page-up · PgDn/f/Space page-down · Ctrl+U/u half-up · Ctrl+D/d half-down · g/Home top · G/End bottom · q/Esc close.

**Approach:** `src/pager-model.ts` — pure reducer (bubbles viewport port): `{offset, viewportHeight, totalLines}` + the action set + `visibleRange()`/`scrollPercent()`/`atTop/atBottom`. `Pager` component = full-screen overlay consumer: reads `useStdout().rows` for height, renders the slice + a `line X of Y` + `NN%` status line, keys via M19 useInput. Takes `string`/`string[]` (app supplies the transcript; pager doesn't know AgentEvent/ChatMessage — that framing is OUT).

**ADRs:** C1 pure `pager-model.ts` reducer. C2 receive PRE-WRAPPED lines (no soft-wrap in M22 — wrapping is layout's job). C3 status shows `line X/Y` + `%` (both). C4 main-buffer full-screen (inherits B3).

**Edge cases:** total ≤ height → maxOffset 0, percent 100%; resize shrinks below offset → re-clamp; empty → "(empty)", 100%; grapheme/wide lines render as-is.

## D. Integration surface + scope guardrails

**Files:** `slash-menu-model.ts:75-87` (window contract SelectList generalizes — must stay byte-identical), `mention-menu-model.ts:67-83` (DRY target), `chat-composer.tsx:230-269,383-439` (renderer + regression harness; NOTE imports ink hooks — Ink-drop is later, SelectList uses OURS), `fuzzy.ts:73-82` (fuzzy filter), `use-focus.ts:176-200,302-321` (overlay focus mechanism + arbiter), `use-input.ts:19-36` (key channel), `input-source.ts:74-77,148-151` (priority ordering), `use-stdout.ts:31` (dims), `renderer.ts:110-128,79-108` (in-band render path), `output-engine.ts:6,24,162-195` (no engine change for in-band), `index.ts` (exports).

**Scope-creep guardrails (parity matrix OUT):** DO NOT build model/theme/session selectors, session browsers, theme preview picker, approval/permission/question prompts (→ M23), sidebar/login/quota dialogs. If PLAN adds a "ModelPicker" or wires AgentEvent into the Pager, that's the tripwire — stop + cite this.

## E. Phase decomposition (4 phases)

1. **SelectList pure model + component (generalizes M15/M21).** `select-list-model.ts` (generic item, prefix|fuzzy, single+multi Set<value>, M15 window); refactor deriveSlashMenu/deriveMentionMenu to delegate (existing snapshots = harness, no behavior change); `SelectList` component (OUR hooks) + multi-select column + export. Exit: menus unchanged, SelectList unit+oracle green.
2. **Overlay/modal infra on M20 focus.** `OverlayProvider` + `useOverlay()` (stack); **resolve the ref-count risk (F-HIGH-1)** with a depth-counted guard; in-band modal render; Esc-dismiss via priority arbiter + refocus; fake-stdin oracle (Esc pops + restores; nested push/pop keeps background inert until depth 0). Exit: overlay above thread, background inert, Esc dismisses + restores, nesting correct.
3. **Pager.** `pager-model.ts` (bubbles viewport port, canonical actions, pure unit tests with fake height); `Pager` component (full-screen overlay, useStdout rows, canonical keymap, status line); wire through OverlayProvider; export. Exit: scrolls long transcript, status correct at boundaries, Esc closes + restores.
4. **Example + house-standard close-out.** A primitives demo (SelectList in a modal + a pager over long output — NOT an app picker); degrade-ladder (monochrome markers); ≤3 snapshots; coverage/gates; CHANGELOG; index.ts/VERSION.

## F. Risk register

| Risk | Sev | Mitigation |
|---|---|---|
| `isFocusEnabled` boolean can't nest (re-enables background focus one pop early) | HIGH | Depth-counted overlay-open guard at OverlayProvider; resolve in PLAN before Phase 2 |
| SelectList generalization changes M15 window → snapshots break | HIGH | Keep exact trailing-window math; existing tests are the harness; behavior-preserving |
| Overlay ESC double-fires (pop + composer refocus) | MED | Overlay must be active focus so its useInput consumes ESC; deterministic via priority channel; oracle |
| In-band full-screen overlay leaves stale rows on dismiss | MED | Dismiss triggers relativeFullRender; verify with VirtualTerminal harness |
| Scope creep into app pickers | MED | §D tripwire; parity matrix OUT list |
| Multi-select index-vs-value across fuzzy filter | LOW | Store Set<value> (ADR A2) |

## Prior-art index
SelectList: pi `select-list.ts:60-107`, ink-ui `use-multi-select-state.ts:158-179`, gemini `BaseSelectionList.tsx:203-211`, bubbles `list.go`, codex `scroll_state.rs:124-141`. Ours: `slash-menu-model.ts:69-87`, `mention-menu-model.ts:67-83`, `fuzzy.ts:73-82`.
Overlay: codex `bottom_pane/mod.rs:214,574-619`, gemini `DialogManager.tsx`, ink `App.tsx`, opencode `dialog.tsx:71-137`, pi `tui.ts:799-810`. Ours: `use-focus.ts:176-200,302-321`, `input-source.ts:74-77`, `chat-composer.tsx:401-409`.
Pager: bubbles `viewport.go:200-210,342`, codex `pager_overlay.rs:120-291`. Ours: `use-stdout.ts:31`, `renderer.ts:110-128`.
