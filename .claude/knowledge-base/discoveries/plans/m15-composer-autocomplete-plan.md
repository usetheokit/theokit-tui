---
slug: m15-composer-autocomplete
milestone_id: M15
created_at: 2026-07-08
question: How do production agent CLIs implement the slash-command menu (trigger, filter, keyboard protocol, render window) on top of a reducer-driven composer, deterministically testable with fake stdin?
---

# Discovery Plan: m15-composer-autocomplete

## Context

M15 adds the slash menu + keyboard affordances to `ChatComposer`
(ROADMAP § M15; out-of-scope overlap "menus" resolved as coincidental —
grill log). Fase A findings: gemini `SuggestionsDisplay.tsx` (164 lines —
window of 8, ▲/▼ overflow markers, `(n/total)` counter, label+description
columns, active row focus-colored) + `useCommandCompletion` hooks; codex
`command_popup.rs` (630 lines — the filter is the text after the FIRST
`/` on the FIRST line); mastracode `wrapping-autocomplete-list.ts` +
slash-command loader/processor. House: `ChatComposer` (261 lines) is
reducer-driven (`textBufferReducer`, 169 lines — pure, tested), submits
on Enter, multi-line ALREADY exists via the newline chord; `useInput`
maps keys to actions via `actionForKey`; keyboard tests use itl's fake
stdin (`Stdin.write`).

## Objective

Blueprint locking: trigger/filter semantics (when is the menu open),
the keyboard protocol (↑↓/Tab/Enter/Esc precedence over buffer editing),
the declarative `commands` API, the render window, determinism strategy
(fake stdin scripts), and the evidence plan.

## In-Scope / Out-of-Scope

**In:** slash menu on the composer (`commands` prop: `{name,
description}`), incremental prefix filter, ↑↓ selection with window,
Tab/Enter completion, Esc dismiss, cancel-hint affordance line; fake-
stdin keyboard oracles.
**Out:** command EXECUTION/dispatch (app concern — the composer only
completes text and submits); fuzzy matching (prefix is the peer default
for slash); MCP/agent command kinds (gemini machinery); reverse search;
shell completions; generic autocomplete for non-slash tokens.

## ADRs

### D1 — Menu state derived from the buffer, not duplicated (preliminary)

**Decision shape:** menu is OPEN iff the buffer's first line starts with
`/` AND the composer is focused AND `commands` is non-empty after
filtering; the filter is the text after `/` up to the cursor (codex
`command_popup.rs` filter contract). Selection index is the only new
state.
**Alternatives:** separate menu open/closed state (drifts from the
buffer); controlled-only API (pushes state to every consumer).
**Consequences:** Q1 verifies codex's filter edge cases (multi-line,
`/` mid-text); Q2 the selection-window math.

### D2 — Keyboard precedence: menu keys intercept BEFORE buffer actions (preliminary)

**Decision shape:** while the menu is open, ↑↓ move the selection,
Tab/Enter complete (`/name ` into the buffer; Enter on an EXACT complete
match may submit), Esc closes the menu (second Esc = cancel hint);
everything else falls through to `actionForKey`.
**Alternatives:** buffer-first (arrow keys would move a cursor the user
is not looking at); modal input swap (too invasive).
**Consequences:** Q3 pins the precedence table as oracles.

## Research Questions

| # | Question | Corner | Reference project(s) | Fase A (broad — map hotspots) | Fase B (deep — Read at each hotspot) | Expected answer shape |
|---|---|---|---|---|---|---|
| Q1 | codex filter semantics: first-`/`-first-line contract, filter updates per keystroke, when the popup closes (space? no match?), completion insertion shape | techniques | `.claude/knowledge-base/references/codex/codex-rs/tui/src/bottom_pane/command_popup.rs` | Grep `command_filter\|on_composer_text` (done) | Read the filter + key handling regions | Trigger/filter contract — citations |
| Q2 | gemini window math: MAX 8 + scrollOffset slice + ▲/▼ markers + counter; how activeIndex wraps (top→bottom?); our reduced window (5) | techniques | `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/components/SuggestionsDisplay.tsx` (read end-to-end), `useCommandCompletion.tsx` (navigation region) | Grep `scrollOffset\|activeIndex` (done) | Read the navigation hook region | Window recipe — citations |
| Q3 | Oracle set: fake-stdin scripts (type `/`, filter narrows, ↑↓ wraps, Tab completes, Enter on selection, Esc dismisses, non-slash text never opens the menu, menu keys do NOT leak into the buffer), determinism of itl stdin writes, snapshot budget | tests | our `src/chat-composer.test.tsx` (existing fake-stdin idiom — verify), `src/text-buffer.test.ts` | Grep our stdin.write usage | Design the script oracles | Oracle set + budget — citations |
| Q4 | Deps: zero new (ink useInput + our reducer); confirm no ink-ui SelectList import | deps | our `package.json`, gemini/mastra manifests | Grep imports | Zero-dep verdict | Rule 9 verdict — citations |
| Q5 | Evidence: bench decision (the menu renders per keystroke — is typing-with-menu a per-frame path? YES: filter+window recompute per key ⇒ M9 flip condition analysis), example (interactive-only — the pipe smoke can NOT exercise raw-mode input; what CAN the smoke pin?), degrade (monochrome menu highlight) | tools | our `benchmarks/`, `examples/chat.tsx` (composer is interactive-only there), `tests/degrade-matrix` | Map the interactive-only constraint | Decide bench + smoke shape honestly | Evidence plan — citations |

## Edge-case annotations (MUST-FIX absorbed)

- **MUST-FIX EC-1 (→ Q1/Q3):** `/` NOT at position 0 of the first line
  (e.g. `hello /wo`) must NOT open the menu (codex first-char contract).
- **MUST-FIX EC-2 (→ Q3):** menu open + Enter with NO selection movement
  — does Enter complete the top match or submit the raw text? Pin ONE
  behavior (peers: complete). Submitting `/typo` raw is the fallback when
  the filter has zero matches.
- **MUST-FIX EC-3 (→ Q2/Q3):** selection index must CLAMP/reset when the
  filter narrows below the current index (no out-of-range highlight).
- **MUST-FIX EC-4 (→ Q3):** menu keys must not leak: ↑ while the menu is
  open must NOT move the text cursor; after Esc, ↑ resumes buffer
  behavior.
- **MUST-FIX EC-5 (→ Q5):** the smoke CANNOT drive raw-mode input in a
  pipe — the deterministic evidence is unit-level fake-stdin scripts +
  the example remains interactive-gated (honest, not theatre).

## Coverage Matrix

| Corner | Questions mapped | Status |
|---|---|---|
| Integration tests | Q3 | Covered |
| Dependencies | Q4 | Covered |
| Tools | Q5 | Covered |
| Techniques | Q1, Q2 | Covered |

**Coverage: 4/4 corners covered (100%)**

## Halt-loop Checkpoints

- Q1/Q2 done: trigger/filter + window verdicts with citations.
- Q3/Q4/Q5 done: oracle set + deps verdict + evidence plan.
- Blueprint: 4 corners, ADRs final.

## Acceptance Criteria

- Every question `done`; citations resolve; blueprint ≥ SHIPPABLE_WITH_CAVEATS.

## Global Definition of Done

- Blueprint at `discoveries/blueprints/m15-composer-autocomplete-blueprint.md`
  consumable task-by-task by the M15 plan.
