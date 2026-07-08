---
slug: m15-composer-autocomplete
milestone_id: M15
created_at: 2026-07-08
discovery_plan: .claude/knowledge-base/discoveries/plans/m15-composer-autocomplete-plan.md
question: How do production agent CLIs implement the slash menu (trigger, filter, keyboard protocol, window) on a reducer-driven composer, deterministically testable with fake stdin?
---

# Blueprint: m15-composer-autocomplete

## Context

codex `command_popup.rs` filter contract read (:93-150): the FIRST token
after a leading `/` on the FIRST line is the filter (`/clear something`
keeps showing `/clear`); selection clamps + visibility re-ensured on
every text change. gemini `SuggestionsDisplay.tsx` read end-to-end
(window 8, ▲/▼ markers, `(n/total)` counter, label+description columns,
active row highlighted). Our `ChatComposer` is reducer-driven with
`actionForKey` and an established fake-stdin test idiom
(`instance.stdin.write`). Q1–Q5 all `done`.

## Objective

Lock the trigger/filter, keyboard precedence, the declarative API, the
window recipe, determinism strategy and the honest evidence plan.

## Cross-cutting Comparison

| Aspect | codex | gemini | OURS |
|---|---|---|---|
| trigger | leading `/` on first line (`command_popup.rs:93-117`) | slash mode in useCommandCompletion | same as codex (D1) — `/` at position 0 of line 1, focused, non-empty filter result |
| filter | FIRST token after `/`, case kept, prefix+exact match (`:99-127,145+`) | prefix + fuzzy layers | first token, PREFIX match (KISS; fuzzy is YAGNI) |
| selection | clamp + ensure_visible on change (`:121-127`) | activeIndex + scrollOffset slice | index clamped on narrow (EC-3), window of 5 with ▲/▼ + counter (gemini shape reduced) |
| completion | insert command text | insertValue | Tab/Enter → buffer becomes `/name ` (cursor at end); Enter with zero matches submits raw (EC-2) |
| dismiss | popup closes when `/` gone | Esc | Esc closes (menu-dismissed latch until the filter text CHANGES); second Esc is the app's concern |

## Recommendations

1. `useSlashMenu` internal hook (or inline derivation) in
   `chat-composer.tsx`: menu state DERIVED from buffer (D1) — only
   `selectionIndex` + `dismissed` are new state; filter per the codex
   token contract.
2. `ChatComposerProps` gains `commands?: readonly {name, description}[]`
   (declarative; zero dispatch logic — completion only edits the buffer).
3. Menu renders BELOW the input line: window ≤ 5, active row accent +
   `❯` marker, description dim truncate, ▲/▼ + `(n/total)` when
   overflowing (gemini shape), theme-token colors only.
4. Keyboard precedence (D2): menu open ⇒ ↑↓ selection (wraps), Tab/Enter
   complete, Esc dismisses; all other keys fall through to the buffer
   reducer; menu keys NEVER leak into the buffer (EC-4).
5. Cancel-hint affordance: optional `hint?: string` line under the
   composer (dim), the DoD's "cancel hint (Esc)" — app supplies the text
   (the composer doesn't own turn-cancel semantics).

## Coverage Corner 1 — Integration Tests

Fake-stdin script oracles (house idiom `instance.stdin.write` proven in
`chat-composer.test.tsx:35,170-172`): (a) typing `/` opens the menu with
ALL commands; (b) typing narrows (`/he` → only `help`), zero-match closes;
(c) `/` mid-text (`hello /wo`) NEVER opens (EC-1); (d) ↑↓ move + wrap;
window slides with ▲/▼ markers at > 5; (e) filter narrowing clamps the
selection (EC-3); (f) Tab completes to `/name ` in the buffer; (g) Enter
with menu open completes the selection; Enter with zero matches submits
raw text (EC-2 pinned); (h) Esc dismisses; ↑ afterwards edits the BUFFER
(EC-4 leak test both directions); typing again re-opens; (i) multi-line:
`/` on line 2 does not trigger; (j) monochrome degrade — active row
readable without color (marker `❯` carries the affordance, the M6
cursor-marker precedent); (k) submit of a completed command flows through
`onSubmit` unchanged. Snapshot budget ≤ 2 (menu open scene + monochrome).

## Coverage Corner 2 — Dependencies

**Zero new.** ink `useInput` (already the composer's engine) + Box/Text +
theme tokens; NO ink-ui select. Rule 9 PASS.

## Coverage Corner 3 — Tools

**Bench decision (honest):** typing with the menu open recomputes
filter+window per keystroke — a per-frame path ⇒ M9 flip condition
FIRES. OWN bench mode: scripted keystroke loop against a mounted
composer with N commands (drive stdin writes at 0-tick cadence, measure
ms/frame; real stdin writes, not fake timers). **Example/smoke (EC-5
honest):** the composer is interactive-only in `examples/chat.tsx` (raw
mode) — a pipe smoke CANNOT drive the menu; the deterministic evidence
lives in the unit fake-stdin scripts; the example gains `commands` so
interactive users see the menu (documented as manually-verifiable), and
the smoke pins that the non-interactive path still renders WITHOUT the
composer (existing behavior, unchanged).

## Coverage Corner 4 — Techniques

**Trigger/filter (codex contract):** open iff `firstLine.startsWith("/")`
AND focused AND NOT dismissed; `filter = firstLine.slice(1).trimStart()
.split(/\s+/)[0] ?? ""`; matches = `commands.filter(c =>
c.name.startsWith(filter))`; zero matches ⇒ menu closed (renders
nothing).

**Selection state:** `selectionIndex` clamped to `matches.length - 1` on
every render (EC-3, codex `clamp_selection`); window start =
`min(selectionIndex, max(0, matches.length - 5))` sliding to keep the
active row visible (gemini scrollOffset reduced).

**Dismissal latch:** `dismissed` set by Esc; RESET when the filter text
changes (typing re-opens) — mirrors codex popup lifecycle.

**Keyboard interception:** inside the existing `useInput` handler, an
early `if (menuOpen)` branch handles ↑/↓/Tab/Enter/Esc and RETURNS;
everything else falls through to `actionForKey` (single input surface —
no second useInput, no focus juggling).

**Determinism:** all oracles run through `instance.stdin.write` scripts +
`lastFrame()` asserts — no timers involved (the menu is synchronous
state); the M6 monochrome marker precedent covers degrade.

## ADRs

### D1 — Menu state derived from the buffer (FINAL)

Only `selectionIndex` + `dismissed` are new state; open/filter derive
from the buffer text. **Alternatives:** separate open/filter state
(drift); controlled-only (API burden). Codex derives identically.

### D2 — Menu keys intercept before buffer actions (FINAL)

Early-return branch in the existing useInput. **Alternatives:**
buffer-first (arrows move an invisible cursor); a second useInput
(ordering/focus hazards).

### D3 — Evidence: fake-stdin unit scripts + typing bench mode; smoke stays honest (FINAL)

The pipe cannot drive raw-mode input — unit scripts ARE the deterministic
evidence; the bench measures the per-keystroke path. **Alternatives:**
PTY-based e2e (a real pty dep — heavy, flaky, YAGNI for a lib).
