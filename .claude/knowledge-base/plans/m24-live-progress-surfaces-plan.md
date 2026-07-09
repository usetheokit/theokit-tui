---
slug: m24-live-progress-surfaces
milestone_id: M24
created_at: 2026-07-09
goal: Ship the five V4 live-turn progress surfaces — TodoList (☐/◐/☑ keyed replace-item), MultiStepProgress (n-of-m + subagent variant), CollapsibleBlock (controlled/uncontrolled + ThinkingBlock preset), Toast + notify() (bounded one-shot timer + conservative OSC-9/BEL), and AgentStreaming phrase-cycler/shimmer opt-ins — as pure/declarative components over the M8/M12/M22 primitives, with fake-timer oracles, an extracted reduced-motion gate, and a conservative capability matrix.
---

# Plan: m24-live-progress-surfaces

## Goal

Deliver the live-turn surfaces every agent CLI shows while a turn is running:
(1) a **TodoList** — a checklist keyed by stable ids (☐ pending / ◐ active / ☑ done)
that updates **in place** mid-turn (the M8 ChatThread keyed-identity precedent,
minus `<Static>` graduation — a todo list is fully live); (2) a **MultiStepProgress**
— n-of-m steps reusing the TodoList row + an `"{done} of {total}"` header, with a
**subagent-labelled** variant; (3) a **CollapsibleBlock** — a collapsed summary +
expandable body, controlled OR key-toggled, with a **ThinkingBlock** preset (dim+
italic, MarkdownText body); (4) a **Toast** — a transient auto-dismiss box on a
**bounded one-shot timer** (the M12 driver idiom) + a **`notify()`** imperative
helper (conservative OSC-9-where-supported, BEL fallback, suppressed under
multiplexers); (5) **AgentStreaming** **phrase-cycler + shimmer** opt-ins that stay
inert when reduced-motion is on. All are declarative/callback-only (the M15/M23
house rule — no app state machine in the lib). The M12 reduced-motion gate is
**extracted** to a shared helper (Rule-of-3). Every timer path is fake-timer tested;
any per-frame animation gets an OWN micro-bench (the M9 flip condition).

## Baseline Context

### Files that will be touched

| File | Role | Change |
|---|---|---|
| `src/todo-list.tsx` | NEW | `TodoList` — keyed-by-id `memo` rows (☐/◐/☑), duplicate-id throw, monochrome-degrade; the shared status-row core |
| `src/multi-step-progress.tsx` | NEW | `MultiStepProgress` — reuses the TodoList row + an n-of-m header + optional per-step `label` (subagent lane) + group header |
| `src/collapsible-block.tsx` | NEW | `CollapsibleBlock` (controlled/uncontrolled, ▶/▼+degrade, Space/Enter toggle) + `ThinkingBlock` preset |
| `src/toast.tsx` | NEW | `Toast` — one-shot `setTimeout` (self-clear + unmount teardown); default 5000ms |
| `src/notify.ts` | NEW | `notify(message)` imperative OSC-9/BEL helper + `detectNotifyProtocol(env)` (module-internal, injectable env) |
| `src/agent-streaming.tsx` | EDIT | additive `phrases?`/`shimmer?` opt-ins + a module-internal bounded phrase-cycler driver; byte-identical when off |
| `src/motion.ts` | NEW | `isMotionEnabled(env, stdout, monochrome)` extracted from M12's inlined gate (Rule-of-3, module-internal) |
| `src/welcome-banner.tsx` | EDIT | delegate its inlined motion gate to `isMotionEnabled` (behavior-preserving) |
| `benchmarks/agent-streaming.bench.tsx` | NEW (conditional) | OWN bench for the shimmer/phrase per-frame path IF it animates < ~100ms (M9 flip condition) |
| `examples/live-turn.tsx` | NEW | live-turn demo (TodoList + MultiStepProgress + CollapsibleBlock + Toast + streaming) |
| `src/index.ts` | exports | the 5 components + `ThinkingBlock` + `notify` + prop/status types |

### Current callers / dependents (READ — the integration seams)

- `src/chat-thread.tsx:55-80` — `memo`-by-object-identity Row + `key={id}` + duplicate-id throw (`assertUniqueIds`). TodoList/MultiStepProgress mirror this for the replace-item contract, MINUS `<Static>` graduation (fully-live surface — ADR D1).
- `src/welcome-banner.tsx:29,81-117` — the M12 reduced-motion gate (`THEOKIT_TUI_NO_MOTION` env + `isMonochrome` + TTY/rows) inlined in `isRevealEligible`, and the bounded `useRevealPhase` driver (`setInterval` + `clearInterval`-on-unmount, self-clearing at cap). `isMotionEnabled` is extracted from the former; Toast/phrase-cycler are the one-shot/interval variants of the latter.
- `src/use-turn-elapsed.ts:15-32` — the `setInterval`+cleanup+fake-timer-tested precedent for the Toast/phrase-cycler drivers.
- `src/agent-timeline.tsx:124-138` — `ThinkingRow` (`•` + `dimColor italic` + indicator width): the ThinkingBlock preset style.
- `src/markdown-text.tsx:140` (`MarkdownText`) — CollapsibleBlock/ThinkingBlock expanded body; streaming-safe, never throws.
- `src/renderer/hooks/use-focus.ts:268` + `src/renderer/input/use-input.ts:19` — CollapsibleBlock Space/Enter toggle (gated on `isFocused`); the M23 `handleMenuKey`-consumed leak idiom is the keyboard-leak-negative precedent.
- `src/renderer/terminal-image.ts:37-105` (`detectImageProtocol`) — the ordered-rule + injectable-env + no-cache capability-matrix precedent that `detectNotifyProtocol` mirrors (multiplexer→null first).
- `src/theme.tsx:33-40,120-125,384-403` — `toolStatus.*` glyph/color tokens + `isMonochrome(theme)` (the degrade branch — never `name==="no-color"`).
- `src/agent-streaming.tsx:41-45,56-87` — the currently DUMB, timer-less streaming indicator (driver is `useTurnElapsed`); `phrases?`/`shimmer?` are additive opt-ins preserving that contract.
- `benchmarks/welcome-banner.bench.tsx:14-90` + `benchmarks/sampling.ts` — the OWN-bench template (real-timer reveal mode, `frameSampler`, baseline JSON, wall assert).
- `src/welcome-banner.animated.test.tsx` + `src/use-turn-elapsed.test.tsx` — the `vi.useFakeTimers()` + `vi.stubEnv` fake-timer discipline M24 extends.

### Domain glossary

- **replace-item contract** — a live item updates in place when the caller passes a NEW item object with the same `id`; rows are `memo`ed by identity, keyed by `id` (ChatThread precedent, no `<Static>`).
- **fully-live surface** — never graduates to `<Static>` (unlike ChatThread/AgentTimeline); any item may update and re-update (done→active revert allowed).
- **bounded one-shot driver** — a `setTimeout` that fires once (→ `onDismiss`), self-clears at fire, and is torn down on unmount (the M12 `useRevealPhase` shape, one tick).
- **reduced-motion gate** — `isMotionEnabled(env, stdout, monochrome)`: `THEOKIT_TUI_NO_MOTION` empty AND `stdout.isTTY` AND not monochrome.
- **conservative notify gate** — `detectNotifyProtocol(env)`: `"osc9"` only for known-supported (iTerm2/ConEmu), `null` (suppress) under multiplexers, `"bel"` otherwise.
- **subagent variant** — MultiStepProgress where each step's `label` is a lane name + a group header (gemini `SubagentGroupDisplay` idiom).

### Architecture boundaries affected

- `src/motion.ts`, `src/notify.ts` (the `detectNotifyProtocol` half) are pure + ink-free (env/stdout injected) — same posture as `terminal-image.ts`/`select-list-model.ts`.
- The five components consume OUR M12/M22 hooks + ink; NO `output-engine`/`renderer` change.
- `notify()` writes escape bytes to `stdout` only when `stdout.isTTY` (never into a pipe).
- No new dependency (parsimony rung 4): `ink`, `ink-spinner`, `react`, `MarkdownText` all shipped.

## Prior Art

- **Blueprint:** `.claude/knowledge-base/discoveries/blueprints/m24-live-progress-surfaces-blueprint.md` (this cycle) — the peer synthesis, ADRs D1-D7, the capability matrix, the two constraint risks.
- **TodoList:** assistant-ui `packages/react-ink/src/primitives/checklist/ChecklistItem.tsx:11-38` (keyed-by-id Ink checklist), codex `codex-rs/tui/src/history_cell/plans.rs:177-212`, opencode `packages/tui/src/component/todo-item.tsx:4-19`.
- **MultiStepProgress:** codex `codex-rs/tui/src/resume_picker.rs:2076-2097` (position/total format), gemini-cli `SubagentGroupDisplay.tsx:103` (subagent group header).
- **CollapsibleBlock:** opencode `packages/tui/src/routes/session/index.tsx:1607-1666`, gemini-cli `ThinkingMessage.tsx:85-92`.
- **Toast + OSC-9:** opencode `packages/tui/src/ui/toast.tsx:53-68`, codex `codex-rs/tui/src/notifications/osc9.rs:46-54`, assistant-ui `react-ink/src/hooks/notification-channels.ts:29-51`.
- **Animation:** gemini-cli `usePhraseCycler.ts`, codex `shimmer.rs`/`motion.rs:12-60`.
- **Ours:** `chat-thread.tsx`, `welcome-banner.tsx` (M12 gate + bounded driver), `use-turn-elapsed.ts`, `agent-timeline.tsx`, `markdown-text.tsx`, `terminal-image.ts` (capability matrix), `agent-streaming.tsx`, `benchmarks/welcome-banner.bench.tsx`.

## ADRs

### D1 — TodoList/MultiStepProgress are pure, keyed-by-id, memo-by-identity, and never graduate to `<Static>`
**Alternative rejected:** index-keyed rows (opencode `todo-item.tsx`) — remount the wrong rows on reorder/insert and lose in-place update; OR `<Static>` graduation (ChatThread) — wrong for a fully-live surface where a done item may revert. Chosen: rows `memo`ed by object identity + `key={id}`, duplicate ids throw at the boundary (mirror `chat-thread.tsx:73-76`), no `<Static>`. The caller passes a NEW object to update an item in place (the ChatThread streaming contract minus graduation). Precedent: assistant-ui `ChecklistItem key={item.id}`.

### D2 — MultiStepProgress reuses the TodoList row model + an n-of-m header (DRY)
**Alternative rejected:** a continuous percentage bar (bubbles/gemini) — loses per-step status the ROADMAP requires; OR a bespoke parallel-subagent tree with lane borders (gemini's full `SubagentGroupDisplay`) — over-engineered (YAGNI). Chosen: a step is a TodoList item with ordered semantics; share the row renderer, wrap with a `"{done} of {total}"` header (codex `resume_picker.rs:2076` format); the subagent variant is the same component with each step's `label` as a lane name + a group header.

### D3 — CollapsibleBlock is controlled-OR-uncontrolled with a local key-toggle; NO global registry
**Alternative rejected:** gemini's global `Ctrl+O` overflow registry (all blocks toggle together) OR opencode's KV-persisted app mode — both are app orchestration, forbidden in a lib (the M15/M23 declarative rule). Chosen: `{summary, children, expanded?, defaultExpanded?, onToggle?}` — controlled when `expanded` is passed, else uncontrolled; Space/Enter toggle when focused; `▶`/`▼` affordance with a `>`/`v` monochrome degrade. ThinkingBlock is a preset (collapsed-default, dim+italic, MarkdownText body).

### D4 — Toast is a component + a bounded one-shot timer; `notify()` is a separate imperative helper
**Alternative rejected:** an app-managed toast queue/stack (opencode's `createStore` singleton) — app state in a lib; OR Toast owning the OSC-9 emit — couples the visual toast to desktop-notify (a headless CLI wants `notify()` with no TUI). Chosen: `Toast {message, durationMs=5000, onDismiss}` runs a one-shot `setTimeout(onDismiss, durationMs)` self-cleared at fire and on unmount (the `useRevealPhase` bounded shape); `notify(message)` is a pure imperative OSC-9/BEL writer (NOT a component). The app decides queueing (callback-only).

### D5 — Conservative OSC-9 gate: OSC-9 only where known-supported, BEL else, suppress under multiplexers
**Alternative rejected:** the full 9/99/777 matrix (opentui/gemini) — out of M24 scope (the ROADMAP names OSC-9+BEL only), and emitting OSC-9 to kitty (which wants OSC-99) is noise; OR always-emit OSC-9 unconditionally — corrupts output on terminals that don't parse it. Chosen: `detectNotifyProtocol(env)` returns `"osc9"` only for iTerm2/ConEmu, `null` (suppress) under tmux/screen/zellij, `"bel"` otherwise; exact bytes `"\x1b]9;{msg}\x07"` / `"\x07"`; injectable env, no module cache (the `terminal-image.ts:92` discipline). tmux passthrough is a documented deferral.

### D6 — Extract `isMotionEnabled` (Rule-of-3) from M12's inlined gate
**Alternative rejected:** re-inline the gate in each new animated component (4 copies drift — DRY violation); OR a runtime KV/config flag (opencode) — the `THEOKIT_TUI_NO_MOTION` env contract already exists (M12). Chosen: extract `isMotionEnabled(env, stdout, monochrome): boolean` (module-internal), have WelcomeBanner delegate to it (behavior-preserving), and gate the phrase-cycler/shimmer opt-ins on it (codex `motion.rs` "Reduced → plain text" precedent).

### D7 — AgentStreaming stays timer-less by default; phrase-cycler/shimmer are additive, deterministic opt-ins
**Alternative rejected:** gemini's random phrase selection (`Math.random`) — non-deterministic, un-testable with fake timers (the DoD demands deterministic oracles); OR making the driver a required prop / breaking the dumb contract — regresses the timer-less M3/M8 design. Chosen: `phrases?: readonly string[]` and `shimmer?: boolean` opt-ins; when set AND motion enabled, a module-internal bounded driver advances the shown phrase by **deterministic round-robin**; when off, `thought || phrases?.[0] || "Thinking…"` renders statically, byte-identical for existing callers.

## Dependencies

No new runtime or dev dependency (Unbreakable Rule 9 / parsimony rung 4). Every seam
— `ink`, `ink-spinner` (`agent-streaming.tsx:2`), `react`, `MarkdownText` (M13),
the M12 motion gate + bounded driver, the M22 focus/input hooks, the M21 capability-
matrix pattern — is already declared and shipped. `## Dependencies` lists none;
`/deps-audit` runs against the unchanged `package.json`.

## Critical paths

- `src/motion.ts` — `isMotionEnabled` (gates every animation; a wrong branch either flakes timers or freezes motion).
- `src/notify.ts` — `detectNotifyProtocol` (a wrong branch leaks raw escape bytes to an unsupporting terminal — RISK-2).
- `src/toast.tsx` — the one-shot timer teardown (a leaked timer fires `onDismiss` after unmount — RISK-1).
- `src/todo-list.tsx` — the keyed replace-item + duplicate-id throw (the live-update correctness core).

## Phase 1: TodoList + shared status-row core + `isMotionEnabled` extraction

### T1.1 — `motion.ts` (`isMotionEnabled`) + WelcomeBanner delegation

#### Objective
Extract `isMotionEnabled(env, stdout, monochrome): boolean` (module-internal) from
WelcomeBanner's inlined gate: true iff `(env.THEOKIT_TUI_NO_MOTION ?? "") === ""` AND
`stdout.isTTY === true` AND `!monochrome`. Refactor `welcome-banner.tsx` to call it
(behavior-preserving — the M12 animated tests are the regression harness).

#### Why this step
The gate now has 3+ consumers (WelcomeBanner + phrase-cycler + shimmer + Toast's
don't-animate check) → Rule-of-3 fires. Extracting first, with the existing M12
tests green, de-risks every downstream animation on one tested predicate.

#### Evidence
Blueprint ADR D6 + Coverage Corner 2 (reduced-motion gate row); `welcome-banner.tsx:29,81-95` (the inlined gate); `welcome-banner.animated.test.tsx` (regression harness).

#### TDD
- RED `motion.test.ts`: `test_motion_enabled_when_env_empty_tty_and_color`, `test_disabled_when_NO_MOTION_set`, `test_disabled_on_non_tty`, `test_disabled_under_monochrome`. Pure, injected `env`/`stdout`/`monochrome`.
- GREEN: the predicate; then refactor WelcomeBanner to delegate (M12 animated tests must stay green — behavior-preserving).

#### Concurrency tests
(none — single-threaded)

#### Acceptance Criteria
- [ ] `isMotionEnabled` is pure, 100% branch-covered; complexity ≤10.
- [ ] `WelcomeBanner` delegates to `isMotionEnabled`; all pre-existing M12 animated tests pass unchanged (`npm test`).
- [ ] `pnpm gates` green.

#### DoD
- [ ] `motion.ts` + tests land; WelcomeBanner refactor behavior-preserving; CHANGELOG `[Unreleased]` updated (internal refactor noted under Changed).

### T1.2 — `TodoList` (keyed replace-item, ☐/◐/☑, duplicate-id throw)

#### Objective
`TodoList({ items: {id, label, status}[] })` where `status ∈ "pending"|"active"|"done"`:
rows `memo`ed by object identity + `key={id}`, glyphs `☐`/`◐`/`☑` (glyph-distinct so
they survive monochrome — no color-only signal), duplicate ids throw at the boundary
(mirror `chat-thread.tsx:73-76`). Pure/declarative, no internal state, never `<Static>`.

#### Why this step
TodoList is the shared status-row core MultiStepProgress reuses (D2); building it
first with the replace-item + duplicate-id + monochrome contracts pins the foundation.

#### Evidence
Blueprint ADR D1 + Coverage Corner 1.A; `chat-thread.tsx:55-80` (keyed identity + throw); assistant-ui `ChecklistItem.tsx:11-38`; `theme.tsx:384-403` (`isMonochrome`).

#### TDD
- RED `todo-list.test.tsx` (itl-adapter): `test_renders_items_with_status_glyphs`, `test_replace_item_updates_in_place` (new object same id → repaints), `test_status_can_revert_done_to_active` (fully-live), `test_reorder_keeps_items_keyed` (no wrong-row remount), `test_duplicate_id_throws`, `test_empty_id_is_legal`, `test_glyphs_survive_a_monochrome_theme` (☐/◐/☑ distinct without color), `test_empty_items_renders_nothing`.
- GREEN: the component + a table-driven status→glyph resolver (complexity ≤10).

#### Concurrency tests
(none — single-threaded)

#### Acceptance Criteria
- [ ] Replace-item updates in place; reorder keeps `id`s; a duplicate `id` throws a typed error (`assert` in `todo-list.test.tsx`).
- [ ] ☐/◐/☑ are glyph-distinct under `themes["no-color"]` (no color-only differentiation).
- [ ] Pure, no internal state, no `<Static>`.
- [ ] `pnpm gates` green.

#### DoD
- [ ] `todo-list.tsx` exported; CHANGELOG updated; the status→glyph resolver 100% branch-covered.

## Phase 2: MultiStepProgress (+ subagent variant)

### T2.1 — `MultiStepProgress` (n-of-m header + subagent labels)

#### Objective
`MultiStepProgress({ steps: {id,label,status}[], current?, groupLabel? })`: reuse the
TodoList row renderer; render a `"{done} of {total}"` (or `"{i}/{n}"`) header; when
`groupLabel` is set, render it as a subagent group header above the labelled lanes.
No divide-by-zero on empty steps → `(0 of 0)`.

#### Why this step
MultiStepProgress is TodoList's ordered sibling (D2); proving the row reuse + the
counter + the subagent labelling confirms the DRY split without a second row impl.

#### Evidence
Blueprint ADR D2 + Coverage Corner 1.B; codex `resume_picker.rs:2076-2097` (counter format); gemini `SubagentGroupDisplay.tsx:103` (group header); `select-list-model.ts:38-45` (count===0 → (0/0) precedent).

#### TDD
- RED `multi-step-progress.test.tsx` (itl-adapter): `test_renders_steps_with_an_n_of_m_counter`, `test_all_done_shows_full_count`, `test_empty_steps_shows_zero_of_zero`, `test_current_out_of_range_does_not_crash`, `test_subagent_group_label_and_lane_labels_render`, `test_reuses_todo_status_glyphs`.
- GREEN: compose the TodoList row + the header helper (keep ≤10 complexity).

#### Concurrency tests
(none — single-threaded)

#### Acceptance Criteria
- [ ] `{done} of {total}` counter correct; empty → `(0 of 0)`, no NaN; out-of-range `current` safe.
- [ ] Subagent group header + per-lane `label`s render; status glyphs match `TodoList` (`assert` in `multi-step-progress.test.tsx`).
- [ ] `pnpm gates` green.

#### DoD
- [ ] `multi-step-progress.tsx` exported; CHANGELOG updated; counter/empty/subagent branches covered.

## Phase 3: CollapsibleBlock + ThinkingBlock preset

### T3.1 — `CollapsibleBlock` (controlled/uncontrolled, key-toggle) + `ThinkingBlock`

#### Objective
`CollapsibleBlock({ summary, children, expanded?, defaultExpanded?, onToggle? })`:
controlled when `expanded` is passed (calls `onToggle` on Space/Enter, renders per the
prop), else uncontrolled (internal state seeded by `defaultExpanded`). `▶`/`▼`
affordance with a `>`/`v` monochrome degrade; Space/Enter toggle gated on `isFocused`.
`ThinkingBlock({ summary?, children })` preset: collapsed-default, dim+italic,
`MarkdownText` body, summary defaulting to `"Thinking…"`.

#### Why this step
CollapsibleBlock is the first M24 surface with keyboard interaction; the
controlled/uncontrolled contract + the keyboard-leak negative establish the toggle
pattern the ThinkingBlock preset reuses.

#### Evidence
Blueprint ADR D3 + Coverage Corner 1.C; opencode `session/index.tsx:1607-1666`; gemini `ThinkingMessage.tsx:85-92`; `agent-timeline.tsx:124-138` (thinking style); `markdown-text.tsx:140` (body); `chat-composer.tsx:381` (leak-consumed idiom).

#### TDD
- RED `collapsible-block.test.tsx` (itl-adapter): `test_uncontrolled_defaults_to_collapsed`, `test_space_toggles_when_focused`, `test_enter_toggles_when_focused`, `test_controlled_expanded_prop_wins`, `test_controlled_calls_onToggle_not_internal_state`, `test_toggle_key_is_consumed_not_leaked` (spy on a sibling `useInput`), `test_affordance_survives_a_monochrome_theme`, `test_thinking_block_preset_is_collapsed_and_dim`, `test_streaming_body_updates_while_collapsed`.
- GREEN: the component + preset.

#### Concurrency tests
(none — single-threaded)

#### Acceptance Criteria
- [ ] Uncontrolled toggles via Space/Enter; controlled defers to `expanded`+`onToggle` (no internal state).
- [ ] The toggle key (`Space`/`Enter`) is consumed (leak-negative `assert` on a sibling handler); affordance glyph-distinct under monochrome.
- [ ] `ThinkingBlock` is collapsed-default (`defaultExpanded={false}`), dim+italic, `MarkdownText` body.
- [ ] `pnpm gates` green.

#### DoD
- [ ] `collapsible-block.tsx` (+ `ThinkingBlock`) exported; CHANGELOG updated; controlled/uncontrolled/leak/monochrome branches covered.

## Phase 4: Toast + notify() + detectNotifyProtocol

### T4.1 — `detectNotifyProtocol` + `notify()` + `Toast` (fake-timer)

#### Objective
`detectNotifyProtocol(env): "osc9" | "bel" | null` — ordered rules: multiplexer
(`TMUX`/`STY`/`ZELLIJ`) → `null`; iTerm2/ConEmu → `"osc9"`; else → `"bel"` (injectable
env, no module cache). `notify(message, out=process.stdout)` — writes `"\x1b]9;{msg}\x07"`
/ `"\x07"` / nothing, gated on `out.isTTY`. `Toast({ message, durationMs=5000, onDismiss })`
— renders a bordered box + runs a one-shot `setTimeout(onDismiss, durationMs)` cleared
at fire AND on unmount; re-scheduling clears the prior timer.

#### Why this step
This phase carries both constraint risks — the timer teardown (RISK-1) and the
capability matrix (RISK-2). Fake-timer oracles + injectable-env branch tests are the
mitigations; building them together keeps the timer + emission contracts co-verified.

#### Evidence
Blueprint ADR D4/D5 + Coverage Corner 1.D + Corner 3; opencode `toast.tsx:53-68`; codex `osc9.rs:46-54,82-126` (exact-byte assertions); `terminal-image.ts:37-105` (injectable-env matrix); `use-turn-elapsed.ts:29` (unmount clear).

#### TDD
- RED `notify.test.ts` (pure): `test_osc9_for_iterm2`, `test_bel_for_alacritty_and_unknown`, `test_null_under_tmux_and_zellij`, `test_notify_emits_exact_osc9_bytes`, `test_notify_emits_bel_bytes`, `test_notify_is_a_noop_on_non_tty` (injected fake `out` with `isTTY:false`), `test_notify_suppressed_under_multiplexer`.
- RED `toast.test.tsx` (itl-adapter + `vi.useFakeTimers()`): `test_renders_the_message`, `test_fires_onDismiss_at_exactly_durationMs` (not before — advance to duration-1 then +1), `test_unmount_before_deadline_clears_the_timer` (unmount at t<duration, advance past, assert onDismiss NOT called), `test_rescheduling_clears_the_prior_timer`.
- GREEN: the resolver + helper + component.

#### Concurrency tests
(none — single-threaded)

#### Failure scenarios (external I/O — terminal / stdout)
- `notify()` to a non-TTY (piped) stdout MUST emit nothing (no escape bytes into a pipe — gated on `out.isTTY`); tested by an injected fake `out`.
- OSC-9 under a multiplexer MUST be suppressed (`null`) — never a raw OSC-9 that leaks visible bytes (M21 multiplexer-null precedent).

#### Acceptance Criteria
- [ ] `detectNotifyProtocol` branches: iTerm2→osc9, alacritty/unknown→bel, tmux/zellij→null; 100% branch-covered.
- [ ] `notify` emits the exact `\x1b]9;…\x07` / `\x07` bytes; a no-op on non-TTY.
- [ ] Toast fires `onDismiss` at `durationMs`; unmount before the deadline clears the timer (no post-unmount call); fake-timer tested.
- [ ] `pnpm gates` green.

#### DoD
- [ ] `notify.ts` + `toast.tsx` exported (`notify`, `Toast`); CHANGELOG updated; capability + timer branches covered.

## Phase 5: AgentStreaming animation + OWN bench + example

### T5.1 — `AgentStreaming` phrase-cycler/shimmer opt-ins + OWN bench + live-turn example

#### Objective
Add `phrases?: readonly string[]` and `shimmer?: boolean` to `AgentStreaming`. When
`phrases` is set AND `isMotionEnabled`, a module-internal bounded driver advances the
shown phrase by **deterministic round-robin** (a `setInterval` at ~2s, self-cleared on
unmount); when off (motion disabled / no phrases), `thought || phrases?.[0] || "Thinking…"`
renders statically — **byte-identical for existing callers**. If the shimmer/phrase
path animates < ~100ms/frame, add an OWN bench (`benchmarks/agent-streaming.bench.tsx`,
the M9 flip condition); the M24 cadence is ~2s so the phrase-cycler alone likely needs
no bench — the shimmer (if per-char per-frame) does. Extend `examples/live-turn.tsx`
with the full live-turn demo (the wiring-triad caller).

#### Why this step / Evidence
Closes the animation surface + the wiring triad: the example is the caller, the
fake-timer tests are the integration, the OWN bench is the runtime metric. Evidence:
ROADMAP M24 DoD bullets 5-6; blueprint ADR D6/D7; `agent-streaming.tsx:41-45` (dumb
contract); `welcome-banner.bench.tsx:14-90` (bench template); gemini `usePhraseCycler.ts`.

#### TDD
- RED `agent-streaming.animated.test.tsx` (`vi.useFakeTimers()` + `vi.stubEnv`): `test_static_when_motion_disabled_is_byte_identical` (existing callers unchanged), `test_phrase_cycler_advances_round_robin_on_interval`, `test_no_timer_scheduled_when_NO_MOTION` (assert zero intervals), `test_empty_phrases_falls_back_to_thinking`, `test_single_phrase_schedules_no_timer`.
- RED (bench, if per-frame): a wall-clock/frame assert in `benchmarks/agent-streaming.bench.tsx` (real timers) — RED = the animated path doesn't exist yet.
- GREEN: the opt-ins + driver + (conditional) bench; then the example + smoke test.

#### Concurrency tests
(none — single-threaded)

#### Failure scenarios (external I/O — terminal dims)
- Non-TTY / reduced-motion → ZERO timers scheduled (assert no interval), static render (the M12 mount-frozen gate); the example exits cleanly when piped (ADR-D8-style non-TTY exit, mirroring `examples/decisions.tsx`).

#### Acceptance Criteria
- [ ] Existing `AgentStreaming` callers render byte-identical (no `phrases`/`shimmer`).
- [ ] The phrase-cycler advances round-robin on each `setInterval` tick; zero timers scheduled when motion disabled (`assert` no interval created).
- [ ] Any per-frame path has an OWN bench with a wall/frame assert + baseline JSON (or a documented note that no path is per-frame).
- [ ] `examples/live-turn.tsx` runs the demo + smoke-clean; `pnpm gates` green twice.

#### DoD
- [ ] `AgentStreaming` opt-ins + example + (conditional) bench land; exports updated; CHANGELOG complete; VERSION bump prepared.

## Edge cases absorbed

Absorbed from the blueprint § Edge cases (MUST-FIX owners = the phase that ships the surface):
1. Timer × render flake — Toast unmount-before-deadline clears the timer (T4.1 fake-timer negative).
2. Toast re-schedule clears the prior timer (T4.1).
3. TodoList duplicate/empty id (T1.2: duplicate throws, empty legal).
4. TodoList status revert done→active (T1.2, fully-live).
5. MultiStepProgress empty/out-of-range/all-done (T2.1: `(0 of 0)`, no NaN).
6. CollapsibleBlock keyboard leak (T3.1 spy negative).
7. CollapsibleBlock controlled+uncontrolled — controlled wins (T3.1).
8. Streaming ThinkingBlock body (T3.1 `test_streaming_body_updates_while_collapsed`).
9. Monochrome degrade of ◐ + ▶/▼ (T1.2, T3.1 — glyph carries the signal).
10. OSC-9 under multiplexer suppressed (T4.1 `test_null_under_tmux_and_zellij`).
11. `notify()` non-TTY no-op (T4.1 `test_notify_is_a_noop_on_non_tty`).
12. Reduced-motion → zero timers (T5.1 `test_no_timer_scheduled_when_NO_MOTION`).
13. Phrase-cycler empty/single phrases (T5.1).
14. Shimmer per-frame cost — OWN bench or capped cadence (T5.1).

## Coverage Matrix

| Goal claim | Task(s) |
|---|---|
| TodoList: live checklist keyed by stable ids (☐/◐/☑), replace-item | T1.2 |
| MultiStepProgress: n-of-m steps + per-step status | T2.1 |
| MultiStepProgress: subagent-labelled variant | T2.1 |
| CollapsibleBlock: collapsed summary + expanded body, controlled/key-toggled | T3.1 |
| CollapsibleBlock: ThinkingBlock preset | T3.1 |
| Toast: transient auto-dismiss timer | T4.1 |
| notify(): OSC-9 with BEL fallback | T4.1 |
| AgentStreaming phrase-cycler + shimmer, reduced-motion respected | T5.1, T1.1 |
| Deterministic fake-timer oracles | T4.1, T5.1 |
| OWN bench for any per-frame path | T5.1 |
| Example (live-turn) + smoke | T5.1 |
| gates/coverage/CHANGELOG | every task DoD + T5.1 |
| Reduced-motion gate extracted (Rule-of-3) — DRY | T1.1 |
| Timer × render flake — risk 1 | T4.1 (unmount-clears negative) |
| OSC-9 support matrix — risk 2 | T4.1 (`detectNotifyProtocol` branches) |

## Drawbacks & Risks

| # | Risk / drawback | Mitigation |
|---|---|---|
| 1 | Timer-bearing components (Toast, phrase-cycler) can flake against the render loop (RISK-1). | Bounded one-shot/interval drivers (self-clear + unmount teardown, the M12 shape) + mandatory `vi.useFakeTimers()` oracles incl. the "unmount before deadline clears the timer" negative (EC-1). |
| 2 | OSC-9 emitted to a terminal that doesn't parse it leaks visible bytes (RISK-2). | Conservative `detectNotifyProtocol` (OSC-9 only where known-supported, BEL else, suppress under multiplexers), injectable-env, exact-byte + every-branch tests, non-TTY no-op. |
| 3 | `◐` (in-progress) is a novel glyph no peer uses — under monochrome it must not read as pending/done. | ☐/◐/☑ are glyph-distinct (not color-differentiated); a monochrome snapshot test pins it (M6 ladder). |
| 4 | MultiStepProgress has thin prior art (a synthesis); the subagent variant leans on one reference. | Kept minimal (row reuse + counter + label + group header — DRY, YAGNI); no parallel-orchestration engine (that stays the app's job). |

## Failure scenarios (when I/O external)

The external I/O surfaces are (a) `notify()` writing escape bytes to `stdout`, and
(b) the terminal capability env. Handled: `notify()` is a no-op on non-TTY (gated on
`out.isTTY`), suppressed under multiplexers, and emits only the exact known-safe bytes;
`detectNotifyProtocol` is injectable-env + branch-tested so a mis-detected terminal is
caught by a unit test, not in production. The Toast/phrase timers are in-memory (no
network/DB/queue — the `## Dependencies` section lists none), so no timeout/5xx/retry
scenarios apply; the timer-teardown negative is the relevant failure guard (RISK-1).

## Unresolved Questions

(none — every decision is resolved at plan time). The two blueprint forks are RESOLVED
in the ADRs: MultiStepProgress reuses the TodoList row (D2), CollapsibleBlock uses
`▶`/`▼` with a monochrome degrade (D3). Whether the shimmer needs an OWN bench is
decided by its cadence at implementation time (T5.1: per-frame → bench; ~2s → a
documented no-bench note), which the DoD makes explicit either way.

## Test Plan

- **Unit (pure):** `motion.test.ts` (`isMotionEnabled` branches, 100%), `notify.test.ts` (`detectNotifyProtocol` + exact-byte emission, 100% branch).
- **Component (itl-adapter):** `todo-list`, `multi-step-progress`, `collapsible-block` — replace-item/reorder/revert, counter/empty, controlled/uncontrolled + leak-negative, monochrome degrade.
- **Fake-timer (`vi.useFakeTimers`):** `toast.test.tsx` (dismiss-at-duration + unmount-clears + reschedule), `agent-streaming.animated.test.tsx` (round-robin advance + zero-timers-when-disabled + byte-identical-off).
- **Bench (OWN, real timers):** `benchmarks/agent-streaming.bench.tsx` if the shimmer/phrase path is per-frame (wall/frame assert + baseline JSON), else a documented no-bench note.
- **Example smoke:** `tests/example-live-turn.integration.test.ts` — pipes the example, asserts the surfaces render + clean non-TTY exit.
- **Regression harness:** the M12 WelcomeBanner animated tests stay unchanged (the `isMotionEnabled` extraction is behavior-preserving).

## Global Definition of Done

- [ ] All 5 phases' DoD checked.
- [ ] TodoList / MultiStepProgress / CollapsibleBlock / ThinkingBlock / Toast / notify + AgentStreaming opt-ins exported from `src/index.ts`.
- [ ] No new dependency; no `output-engine`/`renderer` change.
- [ ] Quality gates: `pnpm gates` (prettier + lint + typecheck + test + build) green twice consecutively; new pure modules 100% branch-covered; complexity ≤10.
- [ ] Every timer path fake-timer tested incl. the unmount-clears negative; reduced-motion → zero timers proven; `notify()` non-TTY no-op + multiplexer suppression proven.
- [ ] Any per-frame animation has an OWN bench with a wall/frame assert (or a documented note that no path is per-frame).
- [ ] `examples/live-turn.tsx` runs the demo + smoke-clean; CHANGELOG `[Unreleased]` complete; blueprint + plan cross-referenced.
