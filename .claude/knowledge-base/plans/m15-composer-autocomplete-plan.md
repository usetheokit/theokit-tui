---
slug: m15-composer-autocomplete
milestone_id: M15
created_at: 2026-07-08
goal: ChatComposer slash-command menu (derived-from-buffer state, codex filter contract, gemini window recipe, menu-keys-first precedence) + declarative commands API + cancel-hint line; fake-stdin deterministic oracles; typing bench mode; zero new deps.
---

# Plan: m15-composer-autocomplete

## Goal

Ship the slash menu per blueprint
`.claude/knowledge-base/discoveries/blueprints/m15-composer-autocomplete-blueprint.md`
(D1 derived menu state, D2 menu-keys-first interception, D3 fake-stdin
evidence): `ChatComposerProps.commands?` (declarative `{name,
description}`), prefix filter on the first `/`-token of line 1, window
≤ 5 with ▲/▼ + counter, Tab/Enter completion, Esc dismissal latch,
optional `hint?` affordance line. Release (0.16.0) follows
READY_TO_MERGE — NEVER a plan task (M10 DV-1 rule).

## Baseline Context

Repo state: develop @ v0.15.0 pending (M14 in review at plan time; this
plan locks after the M14 release — 527/527 green then).

### Files that will be touched

| File | LoC | Role |
|---|---|---|
| `src/slash-menu-model.ts` | new (~80) | PURE derivation: filter extraction (codex token contract), prefix matching, selection clamp, window slice — no ink |
| `src/slash-menu-model.test.ts` | new (~140) | derivation unit oracles |
| `src/chat-composer.tsx` | 261 → ~360 | `commands?`/`hint?` props; menu interception branch; menu render (window, markers, counter) |
| `src/chat-composer.test.tsx` | ~260 → ~420 | fake-stdin script oracles (a)–(k) + ≤ 2 snapshots |
| `src/index.ts` | — | export `ChatComposerCommand` type |
| `tests/export-surface.test.ts` | — | type presence note |
| `examples/chat.tsx` | — | `commands` + `hint` on the composer (interactive-only; smoke pins the non-interactive path unchanged) |
| `benchmarks/chat-composer.bench.tsx` | new | typing mode (keystroke loop, menu open) + plain typing mode |
| `docs/benchmarks/m15-composer-baseline.json` | new | committed baseline |
| `tests/bench-banner-baseline.test.ts` | +40 | M15 contract describe |
| `CHANGELOG.md` | — | per task |

### Current callers / dependents

- `ChatComposer` consumers: `examples/chat.tsx` (interactive branch
  only). New props optional — every existing call site unchanged.
- `textBufferReducer` untouched (menu completion dispatches the existing
  `set-text`-shaped action if present, else a new reducer action — see
  D4).

### Domain glossary

- **filter token** = `firstLine.slice(1).trimStart().split(/\s+/)[0]`
  (codex `command_popup.rs:99-117` contract — `/clear something` filters
  by `clear`).
- **dismissal latch** = Esc sets `dismissed`; ANY filter-text change
  resets it (typing re-opens).
- **window** = 5 visible rows sliding to keep the active row in view;
  ▲/▼ markers + `(n/total)` when overflowing (gemini
  `SuggestionsDisplay.tsx:35,60-66,84,156-161` reduced).
- **menu-keys-first** = while open, ↑↓/Tab/Enter/Esc are consumed by the
  menu branch and NEVER reach `actionForKey` (EC-4).

### Architecture boundaries affected

None new — pure model module + composer-internal state (mirrors the M13
`markdown-model`/render split); no second `useInput`.

## Prior Art

- Blueprint Corners 1–4 + ADRs D1–D3 (codex/gemini citations therein).
- House fake-stdin idiom: `src/chat-composer.test.tsx:35,170-172`.
- M6 monochrome marker precedent (menu active-row `❯` marker).
- Test discipline per `.claude/rules/testing.md` (§ 4.1, § 6).

## ADRs

### D1 — Pure slash-menu model module

**Decision:** `src/slash-menu-model.ts` exports
`deriveSlashMenu(text, commands, selectionIndex, dismissed)` →
`{open, filter, matches, clampedIndex, windowStart, overflowUp,
overflowDown}` — pure function, unit-tested in isolation; the composer
consumes it.
**Rationale:** the M13 model/render split precedent; keyboard scripts
then only need to cover the INTERCEPTION, not the math.
**Alternatives considered:** all-in-component (composer grows past
budget; math untestable without stdin scripts); a hook with state
(hooks are harder to unit-test than pure functions — state stays in the
composer).
**Consequences:** selection/dismissed state lives in the composer; the
model is stateless.

### D2 — Menu keys intercept before buffer actions

**Decision:** early `if (menu.open)` branch inside the EXISTING
`useInput` handler: ↑↓ selection (wrap), Tab/Enter completion, Esc
dismiss — then `return`; other keys fall through.
**Rationale:** blueprint D2 — single input surface; arrows must not move
an invisible text cursor (EC-4).
**Alternatives considered:** second `useInput` (ordering/focus hazards);
buffer-first precedence (leaks).
**Consequences:** Enter semantics split: menu open ⇒ complete; menu
closed/zero-match ⇒ existing submit path (EC-2 pinned by oracle g).

### D3 — Completion writes the buffer via the reducer

**Decision:** completing dispatches a reducer action that replaces line 1
with `/name ` and places the cursor at end (new action `complete-command`
in `text-buffer.ts` if no existing action fits).
**Rationale:** the buffer is the single source of truth (D1 derivation
reads it back — the menu closes itself because `/name ` has a complete
token and… stays open filtered to the exact match; dismissal on exact
single match avoids a stuck one-row menu — pinned by oracle f).
**Alternatives considered:** direct state write bypassing the reducer
(breaks the reducer's tested invariants).
**Consequences:** `text-buffer.ts` gains one action + unit tests.

### D4 — Evidence: typing bench mode + honest smoke

**Decision:** `benchmarks/chat-composer.bench.tsx` — `menu` mode
(scripted stdin keystrokes with the menu open over 50 commands) vs
`plain` mode (same keystrokes, no `commands` prop); baseline committed
with `load_1min_at_start`. Smoke: the non-interactive example path is
UNCHANGED (composer not mounted in pipes) — pinned as-is; menu evidence
is unit-level (EC-5, honest).
**Rationale:** per-keystroke recompute is a per-frame path (M9 flip
condition); a pipe cannot drive raw mode — pretending otherwise is
theatre.
**Alternatives considered:** PTY e2e dep (YAGNI, flaky).
**Consequences:** the example's menu is manually-verifiable only;
documented in the example header.

## Dependencies

| Dependency | Version | New? | Rule 9 evaluation |
|---|---|---|---|
| ink `useInput`/`Box`/`Text` | existing ^7.1.0 | no | platform primitives |
| `textBufferReducer` (internal) | — | no | extended with one action |

**NEW packages: (none).** Manifest untouched (pinned by existing tests).

## Critical paths

- `src/slash-menu-model.ts` — 100% lines.
- The interception branch in `chat-composer.tsx` — 100% lines.

## Phase 1: The model

### T1.1 — slash-menu-model (pure) + text-buffer completion action

#### Objective

The derivation math + the reducer action, unit-proven.

#### Why this step (action + reasoning)

1. **What:** RED executed first (suite vs missing module); GREEN — the
   D1 derivation + D3 reducer action.
2. **Why now:** the composer branch then only wires proven parts.

#### Evidence

- Blueprint Corner 4 (trigger/filter/selection/window formulas with
  codex/gemini citations).

#### TDD

```
RED:     filter_token_follows_codex_contract() — deriveSlashMenu("/clear something", cmds, 0, false); expect(menu.filter).toBe("clear"); multi-line "/x\n/y" uses line 1; leading spaces after slash trimmed
RED:     slash_not_at_line_start_never_opens() — deriveSlashMenu("hello /wo", ...); expect(menu.open).toBe(false) (EC-1)
RED:     prefix_matching_and_zero_match_closes() — commands [help, hello, clear]; filter "he" matches help+hello in declared order; filter "zz" ⇒ open false
RED:     selection_clamps_when_filter_narrows() — selectionIndex 2 with 1 match; expect(menu.clampedIndex).toBe(0) (EC-3)
RED:     window_slides_and_flags_overflow() — 9 matches, selection 7, window 5; expect(menu.windowStart).toBe(3); overflowUp true; overflowDown false at the end; counter data present
RED:     dismissed_stays_closed_until_filter_changes() — dismissed true + same text ⇒ open false; different filter ⇒ open true (latch reset is the CALLER's job — the model just reports; pin the contract shape)
RED:     empty_commands_never_opens() — commands []; expect(menu.open).toBe(false)
RED:     buffer_complete_command_action() — textBufferReducer(state with "/he" line 1 + "rest" line 2, {type:"complete-command", name:"help"}); expect(next.text).toBe("/help \nrest"); cursor sits after the space on line 1
VERIFY:  pnpm vitest run src/slash-menu-model.test.ts src/text-buffer.test.ts
```

#### Files to edit

```
src/slash-menu-model.ts / src/slash-menu-model.test.ts
src/text-buffer.ts / src/text-buffer.test.ts / CHANGELOG.md
```

#### Concurrency tests

(none — single-threaded)

#### Acceptance Criteria

- [ ] `pnpm vitest run src/slash-menu-model.test.ts` exits 0; coverage
  report shows `slash-menu-model.ts` at 100% lines
- [ ] `wc -l src/slash-menu-model.ts` ≤ 110
- [ ] `pnpm vitest run src/slash-menu-model.test.ts` exits NON-ZERO
  before `src/slash-menu-model.ts` exists (exit code recorded in the
  progress notes)

#### DoD (Definition of Done)

- [ ] `pnpm gates` exits 0

## Phase 2: The composer

### T2.1 — Menu interception + render + props

#### Objective

The full keyboard protocol + menu UI on ChatComposer.

#### Why this step (action + reasoning)

1. **What:** RED executed (stdin-script suite additions fail against the
   proppless composer); GREEN — `commands?`/`hint?` props, interception
   branch, menu render (window/markers/counter/`❯`).
2. **Why now:** wires the proven model into the single input surface.

#### Evidence

- Blueprint Corner 1 oracles (a)–(k) + Corner 4 interception recipe.

#### TDD

```
RED:     typing_slash_opens_menu_with_all_commands() — stdin.write("/"); lastFrame() lists every command name (oracle a)
RED:     typing_narrows_and_zero_match_closes() — write "/he" ⇒ help+hello only; write "/zz" ⇒ no menu rows (oracle b)
RED:     mid_text_slash_never_opens() — write "hello /wo"; no menu (oracle c — EC-1)
RED:     arrows_move_selection_and_wrap_without_touching_buffer() — menu open, write ARROW_DOWN ×N (wraps); buffer text unchanged; write ESC then ARROW_UP ⇒ cursor moves in the BUFFER (oracle d+h — EC-4 both directions)
RED:     window_slides_with_markers_and_counter() — 9 commands, walk selection to 8; frame contains "▲" and the counter "(9/9)" shape at the end position (oracle d window)
RED:     tab_completes_to_command_with_trailing_space() — "/he" + TAB on help; buffer shows "/help " (oracle f; exact-match menu dismissed)
RED:     enter_with_menu_completes_enter_without_matches_submits() — "/he" + ENTER completes; "/zz" + ENTER submits raw "/zz" through onSubmit (oracle g — EC-2)
RED:     escape_dismisses_and_typing_reopens() — ESC closes; append "l" (filter change) reopens (oracle h latch)
RED:     slash_on_second_line_does_not_trigger() — multiline "a\n/he" ⇒ no menu (oracle i)
RED:     monochrome_active_row_carries_marker() — no-color theme; active row shows "❯"; zero color SGR; expect(frame).toMatchSnapshot("slash-menu-monochrome") (snapshot 1 of ≤ 2)
RED:     menu_open_scene_snapshot() — anchored toContain("help") then toMatchSnapshot("slash-menu-open") (snapshot 2 of ≤ 2)
RED:     hint_line_renders_dim() — hint="esc cancels the turn"; dim line present under the composer (oracle k affordance)
VERIFY:  pnpm vitest run src/chat-composer.test.tsx
```

#### Files to edit

```
src/chat-composer.tsx / src/chat-composer.test.tsx
src/index.ts / tests/export-surface.test.ts / CHANGELOG.md
```

#### Concurrency tests

(none — single-threaded)

#### Acceptance Criteria

- [ ] `pnpm vitest run src/chat-composer.test.tsx` exits 0; the coverage
  report shows `chat-composer.tsx` new-branch lines at 100%
- [ ] `wc -l src/chat-composer.tsx` ≤ 400
- [ ] `git diff --numstat <m15-base>..HEAD -- '**/__snapshots__/**'`
  insertions-only, ≤ 2 new snapshot entries
- [ ] `git diff <m15-base>..HEAD -- src/chat-composer.test.tsx` shows
  zero deleted `it(` lines (pre-existing tests untouched)

#### DoD (Definition of Done)

- [ ] `pnpm gates` exits 0

## Phase 3: Wiring + evidence

### T3.1 — Example + bench + baseline

#### Objective

The D4 evidence: example commands + typing bench.

#### Why this step (action + reasoning)

1. **What:** RED executed (baseline contract ENOENT); GREEN — example
   `commands`/`hint`, the bench (menu vs plain typing), one load-gated
   run committed.
2. **Why now:** terminal evidence step (release follows review, NOT
   here).

#### Evidence

- Blueprint Corner 3 (honest smoke scope: pipes cannot drive raw mode).

#### TDD

```
RED:     m15_composer_baseline_contract() — baseline JSON: stack.ink "7.1.0"; const modeNames = baseline.modes.map(pick mode); expect(modeNames).toEqual(expect.arrayContaining(["menu", "plain"])); load_1min_at_start < 4; every aggregate finite
RED:     chat_example_noninteractive_path_unchanged() — the piped smoke STILL passes byte-for-byte on its existing asserts (composer not mounted in pipes — pinned by the current suite re-run 3×)
GREEN:   example commands+hint (interactive-only, header note "menu is manually verifiable"); bench with scripted stdin keystrokes over 50 commands
VERIFY:  pnpm vitest run tests/bench-banner-baseline.test.ts tests/example-chat.integration.test.ts
```

#### Files to edit

```
examples/chat.tsx / tests/example-chat.integration.test.ts
benchmarks/chat-composer.bench.tsx / docs/benchmarks/m15-composer-baseline.json
tests/bench-banner-baseline.test.ts / CHANGELOG.md
```

#### Concurrency tests

(none — single-threaded)

#### Acceptance Criteria

- [ ] Baseline JSON field `load_1min_at_start` parses < 4 via the
  contract test
- [ ] 3 consecutive `pnpm vitest run tests/example-chat.integration.test.ts` invocations exit 0
- [ ] The implementation log contains a mode table where the menu-mode
  mean_ms_per_frame delta vs plain is ≤ 1σ OR carries a citable cause
  row

#### DoD (Definition of Done)

- [ ] `pnpm gates` exits 0

## Edge cases absorbed

(discovery MUST-FIX set: EC-1 mid-text slash → T1.1/T2.1 oracles; EC-2
Enter semantics → T2.1 oracle g; EC-3 clamp → T1.1 oracle; EC-4 key
leaks → T2.1 oracle d+h; EC-5 honest smoke → T3.1 scope)

## Coverage Matrix

| # | Gap / Requirement (source) | Task(s) | Resolution |
|---|---|---|---|
| 1 | M15 DoD-1: slash menu — filter, ↑↓, Tab/Enter, Esc (ROADMAP § M15) | T1.1, T2.1 | model + interception + oracles a–h |
| 2 | M15 DoD-2: multi-line + cancel hint (ROADMAP § M15) | T2.1 | multi-line EXISTS (newline chord — oracle i pins slash-on-line-2); `hint` line oracle k |
| 3 | M15 DoD-3: declarative commands API, zero app logic (ROADMAP § M15) | T2.1 | `commands` prop; completion only edits the buffer |
| 4 | M15 DoD-4: deterministic keyboard tests (ROADMAP § M15) | T1.1, T2.1 | fake-stdin scripts + pure-model units |
| 5 | M15 DoD-5: gates/coverage/CHANGELOG (ROADMAP § M15) | T1.1, T2.1, T3.1 | gates-gated commits |
| 6 | M15 risk-1: first interactive surface — stdin raw-mode determinism (ROADMAP § M15) | T2.1 | house fake-stdin idiom (proven at M1); no PTY |
| 7 | M15 risk-2: generic-menu scope creep (ROADMAP § M15) | T2.1 | slash-only API; no generic select export |
| 8 | Per-keystroke render cost (M9 flip condition) | T3.1 | typing bench menu vs plain |

**Coverage: 8/8 (100%)**

## Drawbacks & Risks

| Drawback / Risk | Severity | Mitigation | Owner |
|---|---|---|---|
| Enter dual semantics (complete vs submit) may surprise | Medium | EC-2 pinned + prop docs state the rule loudly | implement |
| Composer file growth (261 → ~360) | Low | model extracted (D1); budget 400 with the menu render | implement |
| itl fake stdin may not cover arrow-key escape sequences | Medium | verify at T1.1 spike start: write("[A") — if unsupported, drive via key-name path in useInput tests (documented fallback) | implement |
| Menu under composer shifts layout when open | Low | fixed max height (window 5 + 2 marker rows); documented | implement |

## Failure scenarios (when I/O external)

(none — no external I/O touched)

## Unresolved Questions

(none — every decision is resolved at plan time by blueprint ADRs D1–D3
plus D4 above.)

## Test Plan

Pure-model units + fake-stdin scripts (a)–(k) + baseline contract +
non-interactive path pin; discipline per `.claude/rules/testing.md`
(§ 4.1 negatives — zero-match, mid-text slash, second-line slash; § 6 —
no timers, synchronous menu state). Two consecutive full runs green.

## Final Phase: Integration Validation (MANDATORY)

- `run_validation.py m15-composer-autocomplete` exit 0; `/code-quality`
  PASS; coverage: model + interception 100% lines.
- Review (multi-role) BEFORE any release — the release chain (0.16.0
  minor) runs only on READY_TO_MERGE (M10 DV-1 rule).

## Global Definition of Done

- [ ] All tasks committed gates-gated (1 task = 1 commit, `gates && commit`)
- [ ] 527+ tests green; zero weakened tests
- [ ] ≤ 2 new snapshots; manifest untouched
- [ ] Bench baseline committed (`load_1min_at_start` < 4)
- [ ] Plan archived post-release
