---
slug: m22-interaction-primitives
milestone_id: M22
created_at: 2026-07-08
goal: Ship the three V4 interaction primitives — a windowed fuzzy SelectList (single/multi), an overlay/modal layer on the M20 focus manager (Esc-dismiss, nesting-safe), and a full-screen Pager — as pure-model + component pairs, generalizing the M15 slash-menu recipe without changing it.
---

# Plan: m22-interaction-primitives

## Goal

Deliver the interaction foundation every peer ships: (1) a **SelectList** — a
windowed list with prefix|fuzzy filter, single AND multi-select, `❯` marker,
▲/▼ overflow + counter — that GENERALIZES the M15 `slash-menu-model` (which
becomes a thin adapter, behavior-preserving); (2) an **Overlay/modal** layer built
on the M20 `FocusProvider` (background focus disabled while open, Esc-dismiss via
the priority arbiter, nesting-safe via a depth counter); (3) a **Pager** — a pure
scroll-model + a full-screen overlay consumer with the canonical less/vim keymap.
All as pure-model + dumb-component pairs (house style). App-specific pickers
(model/theme/session/approval) are OUT — M22 ships PRIMITIVES.

## Baseline Context

### Files that will be touched

| File | Role | Change |
|---|---|---|
| `src/select-list-model.ts` | NEW | pure model: generic item, prefix\|fuzzy, single+multi (`Set<value>`), M15 trailing-window |
| `src/select-list.tsx` | NEW | `SelectList` component (OUR M19/M20 hooks) — generalizes `SlashMenuList` |
| `src/slash-menu-model.ts` | refactor | delegate windowing to `deriveSelectList` (behavior-preserving) |
| `src/mention-menu-model.ts` | refactor | same delegation (collapses the duplicated window math) |
| `src/renderer/hooks/use-overlay.tsx` | NEW | `OverlayProvider` + `useOverlay()` (stack, push/pop, depth-counted focus guard) |
| `src/pager-model.ts` | NEW | pure scroll reducer (bubbles viewport port) |
| `src/pager.tsx` | NEW | `Pager` component (full-screen overlay, `useStdout` rows, canonical keymap) |
| `src/renderer/hooks/use-focus.ts` | maybe | expose whatever the overlay guard needs (see F-HIGH-1 resolution) |
| `examples/interaction.tsx` | NEW | primitives demo (SelectList in a modal + a pager) |
| `src/index.ts` | exports | `SelectList`, `Pager`, `OverlayProvider`/`useOverlay` + models/types |

### Current callers / dependents

- `src/slash-menu-model.ts:69-87` + `src/mention-menu-model.ts:67-83` — the SAME windowing/clamp/overflow math, duplicated. SelectList collapses them; `deriveSlashMenu`/`deriveMentionMenu` keep their trigger logic + return shape, so `SlashMenuList` + the composer key handlers (`chat-composer.tsx:230-269,383-439`) are UNTOUCHED — the existing M15/M21 snapshots + tests are the regression harness.
- `src/fuzzy.ts:73-82` (`fuzzyRank`) — reused for SelectList's fuzzy mode.
- `src/renderer/hooks/use-focus.ts` (M20 FocusProvider / `useFocusManager` / priority ESC arbiter) — the overlay focus mechanism.
- `src/renderer/hooks/use-stdout.ts` (`stdout.rows/columns`) — pager height + full-screen overlay sizing.
- `src/renderer/input/use-input.ts` + `keybindings.ts` (M19) — SelectList/Pager keys.

### Domain glossary

- **trailing window** — M15's window: `windowStart = clamp(clampedIndex - (W-1), 0, len-W)` (bottom-anchored). SelectList's default (ADR A1).
- **multi-select by value** — `Set<string>` of item values (NOT `matches` indices — fuzzy re-orders matches).
- **overlay stack** — `OverlayEntry[]`; only the top captures focus.
- **depth-counted focus guard** — background focus is disabled while `stack.length > 0`, re-enabled only at depth 0 (fixes the boolean-`isFocusEnabled` nesting bug — F-HIGH-1).
- **in-band overlay** — the overlay renders as part of the live frame (no z-index compositing).

### Architecture boundaries affected

- New pure models (`select-list-model`, `pager-model`) are ink-free (no I/O, no React) — same posture as `slash-menu-model`/`fuzzy`/`composer-editor`. The components (`select-list.tsx`, `pager.tsx`, `use-overlay.tsx`) consume OUR M19/M20 hooks, NOT ink's (ADR A3) — new code with no Ink-drop debt.
- The overlay renders in-band (ADR B2) — no `output-engine`/`renderer` change. Full-screen overlay stays in the main screen buffer (ADR B3).

## Prior Art

- **Blueprint:** `.claude/knowledge-base/discoveries/blueprints/m22-interaction-primitives-blueprint.md` (this cycle) — the peer synthesis, ADRs A1-A4/B1-B4/C1-C4, and the F-HIGH-1 risk.
- **SelectList:** ink-ui `use-multi-select-state.ts` (multi via Set), codex `scroll_state.rs`/`list_selection_view.rs` (filtered_indices), pi `select-list.ts`.
- **Overlay:** codex `bottom_pane/mod.rs` (view stack), ink `App.tsx` focus-manager, opencode `dialog.tsx` (mode-stack + refocus), pi `tui.ts` (z-index).
- **Pager:** bubbles `viewport.go` (ScrollPercent + visible slice + keymap), codex `pager_overlay.rs`.
- **Ours:** `slash-menu-model.ts`, `mention-menu-model.ts`, `fuzzy.ts`, `use-focus.ts`, `use-stdout.ts`, `chat-composer.tsx:401-409` (ESC-refocus precedent).

## ADRs

### A1 — SelectList keeps the M15 trailing-window (not pi center / codex edge)
**Alt:** center-focus (pi — changes slash snapshots); edge-triggered `ensure_visible` (codex/gemini — needs persisted `scroll_top`, ours is pure/derived). Chosen: M15 trailing-window as default → slash/mention byte-identical + stateless pure derivation. Center-focus is a deferred opt-in param (YAGNI).

### A2 — Multi-select stored by value (`Set<string>`), not `matches` index
**Alt:** `Set<number>` of indices — goes stale when fuzzy re-orders `matches`. Chosen: by-value (codex `filtered_indices` precedent).

### A3 — SelectList/Pager/Overlay components consume OUR M19/M20 hooks, not ink's
**Alt:** mirror `chat-composer.tsx`'s current ink import. Chosen: our hooks — new code, no cutover debt; wiring to ink creates a second migration.

### A4 — Filter strategy is a param (prefix | fuzzy), one model
Slash = prefix (M15 case-sensitive contract); mention/standalone = fuzzy.

### B1 — Overlay focus = M20 `disableFocus`/`enableFocus`, not a new modal flag
**Alt:** codex short-circuit (needs a central dispatcher we lack); opencode binding-gate (a 2nd gating mechanism parallel to focus). Chosen: reuse the focus manager — it IS our short-circuit + the ink-parity contract. DRY.

### B2 — Overlays render in-band (part of the live frame), not composited z-index
**Alt:** pi `compositeLineAt` floating overlay — needs a new engine pass. Chosen: in-band; the DoD (full-screen pager + bottom modal) needs no floating layer.

### B3 — Full-screen overlay stays in the MAIN screen buffer (no alt-screen), unlike codex
Consistent with the graduated-scrollback thesis; dismiss restores via `relativeFullRender`.

### B5 — Nesting-safe overlay focus via a DEPTH COUNTER (resolves F-HIGH-1)
The M20 `isFocusEnabled` is a boolean; per-overlay toggling re-enables background focus one pop too early. **Resolution:** the OverlayProvider owns the source of truth — background focus is disabled while `stack.length > 0` and re-enabled ONLY when the stack empties (a single `disableFocus()` on 0→1 and a single `enableFocus()` on 1→0, keyed off the stack length, NOT per overlay). Nested push/pop keep the background inert until depth 0.

### C1 — Pager is a pure `pager-model.ts` reducer (bubbles viewport port), render-separated
### C2 — Pager receives PRE-WRAPPED lines (no soft-wrap in M22) — wrapping is layout's job (YAGNI)
### C3 — Pager status shows `line X/Y` + `NN%` (both)

## Dependencies

(none new — SelectList/overlay/pager are built from React + our M19/M20 hooks + the existing `fuzzy.ts`. deps-audit: no new runtime deps.)

## Critical paths

- `src/select-list-model.ts` — the window/clamp/multi-select math (the M15 generalization; a regression here breaks the slash menu).
- `src/renderer/hooks/use-overlay.tsx` — the depth-counted focus guard (F-HIGH-1) + Esc-dismiss ordering.
- `src/pager-model.ts` — the scroll/clamp math.

## Phase 1: SelectList model + component (generalizes M15/M21)

### T1.1 — `select-list-model.ts` + delegation + `SelectList` component
#### Objective
Ship a pure SelectList model (generic item, prefix|fuzzy filter, single+multi by value, M15 trailing-window), refactor `deriveSlashMenu`/`deriveMentionMenu` to delegate windowing to it (behavior-preserving), and ship the `SelectList` component.

#### Why this step
1. **What:** RED — the model's window/clamp/overflow (byte-identical to M15), multi-select toggle by value across a filter change, fuzzy vs prefix, + the slash/mention delegation keeping existing tests green. GREEN — the model + the delegation + the component.
2. **Why now:** it's the foundation the overlay/pager reuse; doing it first proves the DRY generalization against the M15 harness.

#### Evidence
Blueprint §A, ADR A1-A4; `slash-menu-model.ts:69-87`, `mention-menu-model.ts:67-83`, `fuzzy.ts:73-82`, ink-ui `use-multi-select-state.ts:158-179`.

#### TDD
```
RED: select_list_window_matches_the_m15_trailing_window() — index 7 in a 5-window → windowStart 3 (the M15 snapshot value), overflowUp/Down exact
RED: prefix_and_fuzzy_filter_modes() — prefix keeps M15 startsWith; fuzzy ranks via fuzzyRank
RED: multi_select_toggles_by_value_and_survives_a_filter_reorder() — toggle "b"; filter re-orders matches; "b" stays selected (by value, not index)
RED: single_select_commits_the_clamped_index()
RED: slash_menu_still_derives_identically_after_delegation() — the existing slash-menu tests pass unchanged (regression harness)
RED: mention_menu_still_derives_identically_after_delegation()
RED: select_list_component_renders_marker_overflow_counter_and_checkboxes() — ❯ on active, ▲/▼ on overflow, (i/n), ◉/◯ per selected
VERIFY: pnpm vitest run src/select-list-model.test.ts src/slash-menu-model.test.ts src/mention-menu-model.test.ts src/select-list.test.tsx
```
#### Concurrency tests (none — single-threaded)
#### Acceptance Criteria
- [ ] `select-list-model.ts` at 100% lines; window math byte-identical to M15 (existing slash/mention tests green unchanged)
- [ ] multi-select persists by value across a fuzzy re-order; RED exit recorded
- [ ] `SelectList` exported; consumes OUR hooks (zero ink-hook imports)
#### DoD
- [ ] `pnpm gates` exits 0

## Phase 2: Overlay/modal layer (M20 focus, nesting-safe)

### T2.1 — `OverlayProvider` + `useOverlay` (depth-counted focus guard)
#### Objective
Ship the overlay stack: `push`/`pop`, in-band render of a modal above the thread, background focus disabled while any overlay is open (depth-counted — F-HIGH-1), and Esc-dismiss via the M20 priority arbiter + focus restore.

#### Why this step
1. **What:** RED — pushing an overlay disables background focus; a background focusable is inert while open; Esc pops the top + restores background focus; nested push→push→pop keeps the background inert until depth 0 (the F-HIGH-1 regression). GREEN — the provider + the depth-counted guard + the Esc handler.
2. **Why now:** the pager (Phase 3) is an overlay consumer.

#### Evidence
Blueprint §B, ADR B1/B2/B3/B5, risk F-HIGH-1; `use-focus.ts:114,176-200,302-321`, `input-source.ts:74-77`, `chat-composer.tsx:401-409`.

#### TDD
```
RED: pushing_an_overlay_disables_background_focus() — a background useFocus goes inert (isFocused false) while an overlay is open
RED: esc_pops_the_top_overlay_and_restores_background_focus()
RED: nested_overlays_keep_background_inert_until_depth_zero() — push A, push B, pop B → background STILL inert; pop A → background focus restored (the F-HIGH-1 guard)
RED: an_overlay_captures_keys_the_background_does_not_see() — a key handler on a background component does not fire while an overlay is open
RED: overlay_unmount_re_enables_focus() — leaking disableFocus would kill the UI; cleanup restores
VERIFY: pnpm vitest run src/renderer/hooks/use-overlay.test.tsx
```
#### Concurrency tests (none — single-threaded)
#### Acceptance Criteria
- [ ] `use-overlay` at 100% lines; the F-HIGH-1 nested-push/pop guard test green
- [ ] Esc pops + restores focus deterministically (priority-arbiter ordering); RED exit recorded
- [ ] background keys inert while open; unmount re-enables focus
#### DoD
- [ ] `pnpm gates` exits 0

## Phase 3: Pager (pure scroll-model + full-screen overlay)

### T3.1 — `pager-model.ts` + `Pager` component
#### Objective
Ship a pure scroll reducer (bubbles viewport port: offset/height/total → visible slice + clamp + percent + the canonical action set) and a `Pager` component that mounts as a full-screen overlay, reads `useStdout().rows`, and binds the less/vim keymap + a `line X/Y NN%` status line.

#### Why this step
1. **What:** RED — the scroll math (clamp, percent at boundaries, visible slice, page/half-page/goto), + the component scrolling a long transcript via keys through the overlay, Esc closing + restoring the thread. GREEN — the model + the component.
2. **Why now:** composes Phase 1 (no) + Phase 2 (overlay); last because it consumes the overlay.

#### Evidence
Blueprint §C, ADR C1/C2/C3; bubbles `viewport.go:200-210,342`, codex `pager_overlay.rs:120-291`; `use-stdout.ts:31`.

#### TDD
```
RED: pager_visible_slice_and_clamp() — lines[offset:offset+h]; offset clamped to [0, max(0,total-h)]
RED: scroll_percent_at_boundaries() — total<=h → 100%; top → 0%; bottom → 100%
RED: page_half_page_and_goto_actions() — page-down += h; half-down += floor(h/2); goto-bottom → maxOffset
RED: pager_component_scrolls_a_transcript_and_shows_the_status_line() — PgDn/j scroll; "line X of Y" + "NN%" render
RED: pager_esc_closes_and_restores_the_thread() — via the overlay; the thread repaints
VERIFY: pnpm vitest run src/pager-model.test.ts src/pager.test.tsx
```
#### Concurrency tests (none — single-threaded)
#### Failure scenarios (external I/O — terminal dims)
- Resize shrinks height below the current offset → re-clamp on the next render (a test: set a large offset, shrink rows, assert offset re-clamped ≤ maxOffset).
#### Acceptance Criteria
- [ ] `pager-model.ts` at 100% lines; percent correct at both boundaries
- [ ] the pager scrolls via PgUp/PgDn/j/k/g/G through the overlay; Esc closes + restores; RED exit recorded
- [ ] resize re-clamp tested
#### DoD
- [ ] `pnpm gates` exits 0

## Phase 4: Example + close-out

### T4.1 — primitives example + degrade ladder + house standard
#### Objective
An `examples/interaction.tsx` composing all three (a SelectList inside a modal + a pager over long output — a PRIMITIVES demo, not an app picker), a monochrome degrade pass (markers), ≤ 3 snapshots, and the CHANGELOG/index/VERSION close-out.

#### Why this step / Evidence
Blueprint §D (scope guardrails), §E Phase 4; the M6 `NO_COLOR_CURSOR_MARKER` degrade precedent.

#### TDD
```
RED: monochrome_degrade_renders_markers_not_ansi_only() — SelectList ❯ + pager status render under a monochrome theme
VERIFY: pnpm vitest run src/select-list.test.tsx (degrade case)
```
#### Acceptance Criteria
- [ ] `examples/interaction.tsx` runs (fallback path); composes SelectList + modal + pager; NO app-specific picker (scope guardrail honored)
- [ ] degrade case green; CHANGELOG `[Unreleased]` updated; exports in `index.ts`
#### DoD
- [ ] `pnpm gates` exits 0

## Edge cases absorbed
(SelectList: empty matches → open:false + filter reported; filter reset index but selected persists by value; window>matches → windowStart 0; disabled items deferred. Overlay: ESC when both overlay+composer want it → overlay is active focus, consumes ESC, no fall-through; nested → depth guard; resize → live rows; unmount → enableFocus. Pager: total≤h → 100%; resize shrink → re-clamp; empty → "(empty)".)

## Coverage Matrix

| # | Gap / Requirement (source) | Task(s) | Resolution |
|---|---|---|---|
| 1 | DoD: SelectList windowed + fuzzy + single/multi + ❯/▲▼/counter (ROADMAP § M22) | T1.1 | pure model + component generalizing M15 |
| 2 | DoD: overlay/modal stacked + focus capture + Esc-dismiss (ROADMAP § M22) | T2.1 | OverlayProvider on M20 focus + depth guard |
| 3 | DoD: Pager full-screen + PgUp/PgDn/vim keys (ROADMAP § M22) | T3.1 | pure scroll-model + full-screen overlay |
| 4 | DoD: deterministic keyboard oracles (fake-stdin + PTY e2e); degrade ladder; ≤3 snapshots (ROADMAP § M22) | T1.1-T4.1 | pure-model units + fake-stdin oracles + monochrome case |
| 5 | DoD: example + smoke; gates/coverage/CHANGELOG (ROADMAP § M22) | T4.1 | primitives example + close-out |
| 6 | Risk: focus across overlay stack (ROADMAP § M22) | T2.1 | depth-counted guard (F-HIGH-1 resolution, ADR B5) |
| 7 | Risk: scope creep to app pickers (ROADMAP § M22) | T4.1 | example is primitives-only; parity-matrix OUT cited |
| 8 | SelectList must not regress the M15 slash-menu window (blueprint F-HIGH-2) | T1.1 | delegation is behavior-preserving; existing tests are the harness |
| 9 | In-band full-screen overlay must not leave stale rows on dismiss (blueprint risk) | T2.1, T3.1 | dismiss → relativeFullRender; VirtualTerminal assert |

**Coverage: 9/9 (100%)**

## Drawbacks & Risks

| Drawback / Risk | Severity | Mitigation | Owner |
|---|---|---|---|
| Nested-overlay focus (boolean isFocusEnabled) | High | depth-counted guard at the OverlayProvider (ADR B5); the nested push/pop test | implement |
| SelectList generalization regresses the M15 window | High | keep exact trailing-window; existing slash/mention tests are the harness | implement |
| Overlay ESC double-fires (pop + composer refocus) | Medium | overlay is the active focus so its useInput consumes ESC; oracle test | implement |
| In-band full-screen overlay leaves stale rows on dismiss | Medium | dismiss → relativeFullRender; VirtualTerminal assert | implement |
| Scope creep into app pickers | Medium | example primitives-only; parity-matrix OUT list | implement |

## Failure scenarios (when I/O external)
The primitives write to the Terminal (in-process) + read terminal dims (`useStdout`). The one non-happy path is resize-while-open (T3.1 failure scenario — re-clamp; T2.1 — recompute full-screen height). No network/DB/queue.

## Unresolved Questions
- SelectList window algorithm → **M15 trailing-window** (ADR A1; center-focus deferred).
- Multi-select storage → **Set<value>** (ADR A2).
- Overlay render strategy → **in-band** (ADR B2; z-index compositing deferred).
- Nested-overlay focus → **depth counter** (ADR B5).
- Pager wrapping → **pre-wrapped lines** (ADR C2; soft-wrap deferred).
- Pager horizontal scroll / search-in-pager → **OUT** (YAGNI / app composition).

## Test Plan
Pure-model units (select-list window/clamp/multi-select-by-value/filter-modes; pager scroll/clamp/percent/actions) + component oracles via fake-stdin (SelectList keys, overlay Esc/focus/nesting, pager keys) + the M15/M21 slash/mention regression harness (unchanged) + the F-HIGH-1 nested push/pop test + resize re-clamp + monochrome degrade. Discipline per `.claude/rules/testing.md` (§4.1 negatives — empty matches, disabled nav, resize-shrink, overlay-unmount-leak; §6 determinism — fake stdin + injected height, no real timers). ≤ 3 snapshots (prefer model units). Two consecutive full runs green.

## Global Definition of Done
- [ ] All tasks committed gates-gated (1 task = 1 commit or coherent gated sub-commits, FULL `pnpm gates`)
- [ ] SelectList: windowed + prefix|fuzzy + single/multi (by value) + ❯/▲▼/counter/checkboxes; M15 slash/mention menus unchanged
- [ ] Overlay: stacked + background-focus-disabled + Esc-dismiss + restore; nested push/pop correct (depth guard)
- [ ] Pager: full-screen + canonical less/vim keymap + `line X/Y NN%`; resize re-clamp
- [ ] Deterministic oracles (fake-stdin); degrade ladder; ≤3 snapshots; example (primitives-only); CHANGELOG/exports
- [ ] Plan archived post-release
