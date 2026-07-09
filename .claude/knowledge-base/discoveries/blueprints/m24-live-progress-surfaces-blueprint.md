# BLUEPRINT — M24: Renderer V4 Live-Turn Progress Surfaces (TodoList · MultiStepProgress · CollapsibleBlock · Toast/notify · AgentStreaming animation)

**Slug:** `m24-live-progress-surfaces` · **Type:** DISCOVER blueprint (prior art + design) · **Date:** 2026-07-09 · **Milestone:** M24 (`ROADMAP.md § M24`, deps: M22) · **Package version:** `0.24.0` (`src/index.ts:1`)

All reference paths are under `.claude/knowledge-base/references/`. All `src/…` paths are the current tree, read for this blueprint.

---

## Coverage Corner 1 — Prior Art (patterns + citations)

### A. TodoList / live checklist

The live-checklist idiom is **well-established** across three peers with a convergent shape: `{id/step, label, status}` items + status-driven glyph.

| Peer | Glyphs (pending / active / done) | Status enum | Keying | file:line (verified) |
|---|---|---|---|---|
| **codex** | `"□ "` dim / `"□ "` cyan+bold / `"✔ "` crossed-out+dim | `Pending`, `InProgress`, `Completed` (snake_case wire) | whole-list re-render each `update_plan` tick; iterates `plan.iter()` | `codex/codex-rs/tui/src/history_cell/plans.rs:177-182, 210-212`; enum `codex/codex-rs/protocol/src/plan_tool.rs:9-20` |
| **assistant-ui (Ink!)** | `"□"` dim / `<Spinner type="line"/>` yellow / `"■"` green (`"x"` red = error) | `pending` \| `running` \| `complete` \| `error` | **stable `id`**, `key={item.id}`, single-item in-place re-render; supports nested `children` | types `assistant-ui/packages/react-ink/src/primitives/checklist/types.ts:1-9`; render `.../ChecklistItem.tsx:11-38` |
| **opencode** | `" "` / `"•"` / `"✓"` | `"in_progress"` \| `"completed"` \| (implicit pending) | array-index (`<For>`), whole-list re-render | `opencode/packages/tui/src/component/todo-item.tsx:4-19` |

**Key findings:**
- **assistant-ui is the direct Ink precedent** — a `ChecklistItemData = {id, text, status, detail?, children?}` keyed by `id`, rendered as `<ChecklistItem key={item.id}/>` with a **status→indicator** dispatch (spinner for `running`, glyph otherwise). This is exactly the M24 replace-item contract, in the same framework.
- **Glyph consensus is loose:** codex `□/□/✔`, assistant-ui `□/spinner/■`, opencode ` /•/✓`. The ROADMAP names `☐/◐/☑`. **No peer uses `◐`** for in-progress — codex differentiates in-progress purely by *color+bold* on the same `□`; assistant-ui uses a *spinner*. `◐` (half-filled) is a defensible novel choice but must degrade under monochrome (no color to distinguish pending from active).
- **Status enum consensus:** codex `Pending/InProgress/Completed` ↔ ROADMAP `pending/active/done`. The ROADMAP's `active` == codex `InProgress` == assistant-ui `running`.
- **Our own `ChatThread` is the keyed-ordering precedent** (`src/chat-thread.tsx:55-62`): rows are `memo`ed by **object identity** (`(prev, next) => prev.message === next.message`) and keyed by `id`; duplicate ids throw (`:65-80`). A TodoList replace-item is the same pattern minus `<Static>` graduation (a todo list is *fully live*, never graduated — see D1).

### B. MultiStepProgress / n-of-m steps

**Honest finding: no peer renders a discrete "step 2/5 with per-step glyphs" list.** The prior art splits:
- **Percentage bars** (not step-counted): `bubbles/progress/progress.go:231-339` (spring-animated, `ShowPercentage`, `PercentFormat: " %3.0f%%"`, `Full/Empty` runes); `gemini-cli/packages/cli/src/ui/components/ProgressBar.tsx:17-39` (`▬`-repeat fill).
- **Position/total** only in codex's *list pagination*, not workflow steps: `" {position} / {total} · {percent}% "` with narrower fallbacks (`codex/codex-rs/tui/src/resume_picker.rs:2076-2097`).
- **Per-step status glyphs** exist as a *tool-status* vocabulary in gemini: `TOOL_STATUS = { SUCCESS:'✓', PENDING:'o', EXECUTING:'⊷', CONFIRMING:'?', CANCELED:'-', ERROR:'x' }` (`gemini-cli/packages/cli/src/ui/constants.ts:20-27`) over `ToolCallStatus` enum (`.../ui/types.ts:63-96`).

**⇒ MultiStepProgress is a synthesis, not a clone.** The right build is a **discrete step list** (each step a row = `TodoList`'s render) + an **`n of m` header** (codex position/total format) — i.e., MultiStepProgress is TodoList's sibling with an ordered-sequence semantic + a counter. This is a **DRY opportunity** (D2).

**Subagent-labelled variant — gemini-cli is the sole full reference.** `SubagentGroupDisplay.tsx:34-272` renders parallel lanes: a bordered box, a header `"{n} Agents ({running} running, {completed} completed)…"` (`:103`), then **one lane per agent** with a status icon (`✓`/`✗`/`ℹ`/`!`) + agent name + last-activity line; collapsed vs expanded per lane. `SubagentProgressDisplay.tsx:60-183` is the per-lane detail. **No other peer** renders parallel labelled lanes. ⇒ the subagent variant = MultiStepProgress with a **per-step `label`** (the lane name) + a group header.

### C. CollapsibleBlock / thinking

| Peer | Collapse affordance | Toggle mechanism | Thinking styling | file:line |
|---|---|---|---|---|
| **opencode** | `"+ "` collapsed / `"- "` expanded | app-level `/thinking` slash cycles `show→hide`, persisted in KV; local `expanded` signal per block | `fg={theme.textMuted}`; summary `"Thought: {title} · {duration}"` | glyph `opencode/packages/tui/src/routes/session/index.tsx:1658`; reasoning part `:1607-1666`; mode `.../context/thinking.ts:24-36` |
| **gemini-cli** | (no per-block glyph; global truncation) | **`Ctrl+O`** = `SHOW_MORE_LINES`, global overflow registry | title `bold italic` primary; body `italic secondary`; header `"Thinking..."` | `ThinkingMessage.tsx:66,85-92`; keybind `key/keyBindings.ts:92`; overflow `shared/MaxSizedBox.tsx:141` |
| **codex** | reasoning cells collapsed-by-default | — | `ReasoningSummaryCell`, dim+italic (our `AgentTimeline.ThinkingRow` `:132-136` mirrors this) | (precedent: `agent-timeline.tsx:124-138`) |

**Key findings:**
- **Two toggle models:** opencode = per-block local state + app-level show/hide; gemini = one global `Ctrl+O`. For a **library primitive** the correct choice is **local, controlled-OR-uncontrolled** — neither peer's *global* registry belongs in a lib (app orchestration, the M23/M15 house rule).
- **Glyph fork:** opencode `+`/`-` (ASCII-safe) vs `▶`/`▼` (ROADMAP suggestion, wider EAW). Recommend `▶`/`▼` with `>`/`v` monochrome-safe fallback.
- **ThinkingBlock preset:** dim+italic body + a `"Thinking…"`/first-line/`"Thought · {duration}"` summary. Our `AgentTimeline.ThinkingRow` (`agent-timeline.tsx:132-136`) is the in-house precedent.
- **Body:** `MarkdownText` (`src/markdown-text.tsx:140`) is the streaming-safe body renderer.

### D. Toast + notify() / OSC-9

**Toast (transient auto-dismiss):**
- **opencode is the exact idiom** (`opencode/packages/tui/src/ui/toast.tsx:53-68`): `setTimeout(() => setStore("currentToast", null), duration).unref()`, **default `5000ms`**, `clearTimeout` before re-scheduling.
- **bubbletea:** `tea.Tick(d, fn)` one-shot timer (`bubbletea/commands.go:154-164`).
- In-house driver precedent: `useTurnElapsed` (`src/use-turn-elapsed.ts:15-32`) + the M12 bounded `useRevealPhase` (`src/welcome-banner.tsx:99-117`) — both `setInterval`+`clearInterval`-on-unmount, fake-timer tested. A Toast wants a **one-shot `setTimeout`** self-clearing at fire, torn down on unmount.

**OSC-9 / desktop notify:**
- **codex** (`codex/codex-rs/tui/src/notifications/osc9.rs:46-54`): `"\x1b]9;{message}\x07"`; tmux-passthrough with ESC-doubling. Tests assert `"\u{1b}]9;hello\u{7}"`.
- **gemini-cli** (`.../utils/terminalNotifications.ts`): method enum `Auto|Osc9|Osc777|Bell`; auto-detection (iTerm2→OSC-9; Alacritty/AppleTerminal/VSCode/WindowsTerminal→BEL; else→OSC-777); env via `TERM_PROGRAM`/`ALACRITTY_WINDOW_ID`/`WT_SESSION`.
- **assistant-ui (Ink!)** (`.../react-ink/src/hooks/notification-channels.ts:29-51`): `sendOSCNotification` — osc9 `"\x1b]9;{msg}\x07"`, osc777, osc99. The direct TS/Ink `notify()` precedent.
- **opentui** (`.../packages/core/src/zig/terminal.zig:502-546`): fullest capability matrix.

**Terminal support matrix (synthesized):**

| Terminal | Native notify | Env signal | M24 gate → sequence |
|---|---|---|---|
| iTerm2 | OSC-9 | `TERM_PROGRAM=iTerm.app` / `ITERM_SESSION_ID` | **OSC-9** |
| kitty | OSC-99 | `KITTY_WINDOW_ID` | **BEL** (M24 is OSC-9 only) |
| WezTerm/ghostty | OSC-777 | `WEZTERM_PANE`/`GHOSTTY_*` | **BEL** |
| Alacritty/Apple Terminal/VSCode/WT | BEL | `ALACRITTY_WINDOW_ID`/`TERM_PROGRAM`/`WT_SESSION` | **BEL** |
| tmux/screen/zellij | passthrough | `TMUX`/`STY`/`ZELLIJ` | **suppress** (M21 matrix nulls under multiplexers) |
| unknown | — | — | **BEL** |

**RISK-2:** M24 is scoped to **OSC-9 + BEL** (not 9/99/777). Emit OSC-9 only where known-supported (iTerm2/ConEmu), BEL else, suppress under multiplexers — mirroring M21 conservative `detectImageProtocol` (`terminal-image.ts:92-105`).

### E. AgentStreaming animation (phrase-cycler + shimmer)

- **Phrase-cycler — gemini-cli** (`.../ui/hooks/usePhraseCycler.ts:11-12,135-158`): 138-phrase array, **random** selection via `setInterval`, `PHRASE_CHANGE_INTERVAL_MS=10000`/`WITTY=5000`.
- **Shimmer — codex** (`codex/codex-rs/tui/src/shimmer.rs:21-69`): time-continuous per-char color sweep, `sweep_seconds=2.0`, cosine fade, RGB blend, BOLD on-band; 32ms scheduler. Non-RGB → DIM/normal/BOLD.
- **Reduced-motion — codex `motion.rs:12-60`:** `MotionMode::{Animated,Reduced}`; Reduced → plain text / static `"•".dim()`. gemini gates on screen-reader; opencode on `animations_enabled` KV → `⋯`.
- **Frame cadence:** spinners 80–100ms; smooth-gradient 30–32ms.
- **In-house gate:** `AgentStreaming` (`src/agent-streaming.tsx:56-87`) is currently a **dumb, timer-less** spinner (driver is `useTurnElapsed`). The M12 reduced-motion gate is `THEOKIT_TUI_NO_MOTION` env (`welcome-banner.tsx:29,93`) + `isRevealEligible` (`:81-95`) + bounded `useRevealPhase` (`:99-117`).

---

## Coverage Corner 2 — Dependencies (the integration seams — READ)

| Seam | File:line | What M24 consumes | Contract note |
|---|---|---|---|
| Keyed-ordering precedent | `src/chat-thread.tsx:55-62,65-80` | `memo`-by-identity Row + `key={id}` + duplicate-id throw | TodoList/MultiStepProgress replace-item: items `memo`ed by identity, keyed by `id`; caller passes a NEW object to update; duplicate ids fail-fast. **Never graduates to `<Static>`** (fully live). |
| Reduced-motion gate | `src/welcome-banner.tsx:29,81-95` | `THEOKIT_TUI_NO_MOTION` + `isMonochrome(theme)` + TTY/rows gate | **Extract `isMotionEnabled(env,stdout,theme)`** (Rule-of-3, module-internal): `NO_MOTION` empty AND TTY AND not monochrome. |
| Bounded-driver idiom | `src/welcome-banner.tsx:99-117` + `src/use-turn-elapsed.ts:15-32` | `setInterval`+`clearInterval`-on-unmount | Toast = one-shot `setTimeout` (self-clear + unmount teardown); phrase-cycler = interval. Both fake-timer testable. |
| Thinking-row precedent | `src/agent-timeline.tsx:124-138` | `•` + `dimColor italic` + `STATUS_INDICATOR_WIDTH` | ThinkingBlock preset reuses this style. |
| Markdown body | `src/markdown-text.tsx:140` | `<MarkdownText text/>` | CollapsibleBlock/ThinkingBlock body; streaming-safe, never throws. |
| Key-toggle (focus/input) | `src/renderer/hooks/use-focus.ts:268-308` + `src/renderer/input/use-input.ts:19-36` | `useFocus`→`isFocused`; `useInput({isActive})` | CollapsibleBlock Space/Enter toggle gated on `isFocused`. |
| Capability-matrix precedent | `src/renderer/terminal-image.ts:37-105` | ordered `PROTOCOL_RULES` + injectable `env` | OSC-9 gate mirrors this: ordered rules, multiplexer→null first, injectable env, no cache. Build `detectNotifyProtocol(env): "osc9"|"bel"|null`. |
| Theme tokens/glyphs | `src/theme.tsx:33-40,120-125,384-403` | `toolStatus.*` glyph+color; `accent`; `isMonochrome(theme)` | Status glyphs derive from theme where overlapping; `active/◐` has no token yet (D5). Monochrome via `isMonochrome`. |
| Spinner dep | `src/agent-streaming.tsx:2` (`ink-spinner`) | `<Spinner type="dots"/>` | Reuse for active/running indicator. No new dep. |
| Export surface | `src/index.ts:122-165` | add 5 components + `notify` + types | Follow M22/M23 block; `isMotionEnabled`/`detectNotifyProtocol` module-internal. |
| OWN-bench precedent | `benchmarks/welcome-banner.bench.tsx:14-90` + `benchmarks/sampling.ts` | reveal/static two-mode bench, `frameSampler`, baseline JSON | M9 flip condition template for any per-frame path (shimmer/phrase-cycler). |
| Fake-timer test precedent | `src/welcome-banner.animated.test.tsx:1-60` + `src/use-turn-elapsed.test.tsx` | `vi.useFakeTimers()`, `advanceTimersByTime`, `vi.stubEnv` | The discipline surface M24 extends to Toast + phrase-cycler. |

**No new dependency required** (`ink`, `ink-spinner`, `react` cover everything).

---

## Coverage Corner 3 — Tools / Techniques

- **Fake-timer oracles (RISK-1).** Every timer-bearing component tested with `vi.useFakeTimers()` + `act(() => vi.advanceTimersByTime(ms))`. Oracles: (a) Toast fires `onDismiss` at exactly `durationMs`; (b) unmount before deadline clears the timer (no post-unmount `onDismiss`); (c) phrase-cycler advances at each interval; (d) `NO_MOTION`/non-TTY → **zero timers scheduled**.
- **OWN bench (M9 flip).** Shimmer + any <100ms phrase-cycler get a `benchmarks/{name}.bench.tsx` in the `welcome-banner.bench.tsx` shape (real timers, `frameSampler`, mean/peak ms/frame, baseline JSON). Toast is NOT per-frame → no bench.
- **Capability detection (RISK-2).** `detectNotifyProtocol(env)` pure + injectable-env; unit-test every branch; assert exact bytes `"\x1b]9;msg\x07"` / `"\x07"`.
- **Monochrome-degrade snapshots.** `◐` must differ by glyph from `☐`/`☑` (no color); `▶/▼` degrades to `>/v` (M6 ladder).
- **Keyboard-leak negative (CollapsibleBlock).** Space/Enter toggle consumed, not leaked (M23 `handleMenuKey` idiom, spy on sibling `useInput`).

---

## Coverage Corner 4 — ADR-worthy Decisions (with alternatives)

### D1 — TodoList/MultiStepProgress: pure, keyed-by-id, `<Static>`-free, replace-item by object identity
**Decision.** Pure declarative, rows `memo`ed by object identity + `key={id}`, duplicate ids throw. **Never graduates to `<Static>`** (any item may update+re-update mid-turn). Streaming update = caller passes a NEW `items` array with a NEW object for the changed item.
**Alternative rejected:** index-keyed (opencode) — breaks on reorder/insert. `<Static>` graduation — wrong for a live surface. Precedent: assistant-ui `ChecklistItem key={item.id}`, `chat-thread.tsx:55-62`.

### D2 — MultiStepProgress reuses the TodoList row model + an n-of-m header (DRY)
**Decision.** A step is a todo item with ordered semantics; share the row renderer + a `"{done} of {total}"` header. Subagent variant = per-step `label` (lane) + group header.
**Alternative rejected:** percentage bar (loses per-step state); bespoke parallel tree (YAGNI). *(Row-reuse vs standalone fork — confirm in `/to-plan`.)*

### D3 — CollapsibleBlock: controlled-OR-uncontrolled, local key-toggle, NO global registry
**Decision.** `{summary, children, expanded?, defaultExpanded?, onToggle?}`; Space/Enter toggle when focused; `▶`/`▼`+degrade. ThinkingBlock preset: collapsed-default, dim+italic, `MarkdownText` body.
**Alternative rejected:** gemini global `Ctrl+O` registry / opencode KV mode — app orchestration in a lib. Glyph fork `▶/▼` vs `+/-` — confirm in `/to-plan`.

### D4 — Toast: a component + a bounded one-shot timer; `notify()` is a separate imperative helper
**Decision.** `Toast {message, durationMs=5000, onDismiss}` one-shot `setTimeout` self-cleared at fire + unmount. `notify(message)` = pure imperative OSC-9/BEL helper (NOT a component).
**Alternative rejected:** app-managed toast queue (app state); Toast owning the OSC-9 emit (coupling — a headless CLI wants `notify()` with no TUI).

### D5 — OSC-9 conservative gate
**Decision.** `detectNotifyProtocol(env)` → `"osc9"` only for iTerm2/ConEmu, `null` (suppress) under multiplexers, `"bel"` else. Bytes: OSC-9 `"\x1b]9;{msg}\x07"`; BEL `"\x07"`. Capability note in docstring + example.
**Alternative rejected:** full 9/99/777 matrix (out of scope); unconditional OSC-9 (corrupts non-supporting terminals). tmux passthrough deferred.

### D6 — Reduced-motion gate extracted to a shared helper (Rule-of-3)
**Decision.** Extract `isMotionEnabled(env, stdout, theme)` (module-internal) from M12's inlined gate. Animated opt-ins inert when motion disabled (fall back to the dumb spinner).
**Alternative rejected:** per-component re-inline (DRY); runtime KV flag (`NO_MOTION` env already exists).

### D7 — AgentStreaming stays dumb by default; phrase-cycler/shimmer are additive opt-ins
**Decision.** Preserve the timer-less contract; add `phrases?`/`shimmer?` opt-ins with a module-internal bounded driver (deterministic **round-robin**, not random), `isMotionEnabled`-gated, byte-identical when off.
**Alternative rejected:** gemini random selection (un-testable with fake timers); breaking the dumb contract (regresses M3).

---

## Recommended approach per component

- **TodoList** — `{items:{id,label,status:"pending"|"active"|"done"}[]}`, pure, `memo`-by-identity keyed by `id`, `☐/◐/☑`, monochrome-distinct glyphs, never `<Static>`.
- **MultiStepProgress** — `{steps:{id,label,status}[], current?}` reusing TodoList's row + `"{done} of {total}"` header; subagent variant = per-step `label` + group header.
- **CollapsibleBlock** — `{summary, children, expanded?, defaultExpanded?, onToggle?}`, controlled/uncontrolled, `▶/▼`+degrade, Space/Enter toggle when focused; ThinkingBlock preset (dim+italic, `MarkdownText` body).
- **Toast + notify()** — `Toast {message, durationMs=5000, onDismiss}` one-shot timer; `notify(message)` OSC-9/BEL via `detectNotifyProtocol`.
- **AgentStreaming animation** — additive `phrases?`/`shimmer?`, module-internal bounded driver, deterministic round-robin, gated on `isMotionEnabled`.

---

## Edge cases (feed `/edge-case-plan`)

1. Timer × render-loop flake (RISK-1): Toast unmount before `durationMs` → clear the `setTimeout` (no post-unmount `onDismiss`); fake-timer negative.
2. Re-scheduling a Toast: `durationMs` change mid-life → clear old before new; decide whether `message` change resets the timer.
3. TodoList duplicate/empty id: duplicates throw; empty-string ids legal; reorder keeps in-place update.
4. TodoList status revert (done→active): allowed (fully live), must repaint via new identity.
5. MultiStepProgress `current` out of range / all-done / empty steps: no NaN/divide-by-zero; empty → `(0 of 0)`.
6. CollapsibleBlock keyboard leak: Space/Enter consumed, not leaked (spy assertion).
7. CollapsibleBlock controlled+uncontrolled misuse: controlled wins; document.
8. Streaming ThinkingBlock body: `MarkdownText` unclosed fence renders as code; body may update while collapsed.
9. Monochrome degrade: `◐` differs by glyph from `☐`/`☑`; `▶/▼` → `>/v`.
10. OSC-9 under multiplexer: suppress/BEL, never raw OSC-9 leaking bytes.
11. `notify()` on non-TTY/piped stdout: gate on `stdout.isTTY`.
12. Reduced-motion disables timers entirely: phrase-cycler/shimmer schedule ZERO timers; assert no interval created.
13. Phrase-cycler with single/empty `phrases`: `[]` → `"Thinking…"`; one phrase → no timer.
14. Shimmer per-frame cost (M9 flip): OWN bench with wall/frame assert, or cap cadence to 32ms and prove it.

---

## Constraint-risk flags (ROADMAP top risks)

- **RISK 1 — Toast timers × render-loop flake:** bounded one-shot driver (D4) + mandatory fake-timer oracles (Corner 3); the "unmount before deadline clears the timer" negative (EC-1) is the specific flake-guard.
- **RISK 2 — OSC-9 support matrix:** conservative `detectNotifyProtocol` (D5) mirroring M21; injectable-env, exact-byte tests, capability note. Out of scope: OSC-99/OSC-777, tmux passthrough (documented deferrals).

---

## Proposed phase decomposition (4–5 phases)

- **Phase 1 — TodoList + shared status-row core + `isMotionEnabled` extraction.** Build `TodoList` (keyed-by-id `memo` rows, `☐/◐/☑`, duplicate-id throw, monochrome-degrade); extract `isMotionEnabled` (Rule-of-3, D6). Tests: replace-item, reorder, revert, duplicate throw, monochrome. Export.
- **Phase 2 — MultiStepProgress (+ subagent variant).** Reuse the Phase-1 row; `{steps,current}` + `"{n} of {m}"` header + per-step `label` + group header. Tests: counter, all-done, empty, out-of-range, subagent labels.
- **Phase 3 — CollapsibleBlock + ThinkingBlock preset.** Controlled/uncontrolled, `▶/▼`+degrade, Space/Enter toggle. ThinkingBlock preset. Tests: controlled/uncontrolled, key-toggle, keyboard-leak negative, streaming body, monochrome.
- **Phase 4 — Toast + `notify()` + `detectNotifyProtocol`.** One-shot timer (self-clear + unmount teardown) + OSC-9/BEL helper + conservative matrix. Tests: fake-timer dismiss + unmount-clears negatives; exact-byte emission; every capability branch; non-TTY suppression.
- **Phase 5 — AgentStreaming animation + wiring + OWN bench + example.** Additive `phrases?`/`shimmer?` (deterministic round-robin, `isMotionEnabled`-gated, byte-identical off). OWN bench if per-frame. Live-turn example (wiring caller). CHANGELOG, exports, coverage.

---

**Honest caveats:**
1. MultiStepProgress has the weakest prior art (a synthesis, not a clone); the subagent variant leans entirely on gemini `SubagentGroupDisplay`.
2. `◐` (in-progress) is a novel glyph — must be glyph-distinct under monochrome (EC-9).
3. OSC-9-only scope gives kitty/wezterm users a BEL, not rich notify (documented caveat + future work).
4. The TodoList-row-reuse (D2) and CollapsibleBlock glyph (D3) forks are worth confirming in `/to-plan`.

## ADRs

- **ADR-1 (D1):** TodoList/MultiStepProgress pure, keyed-by-id, `memo`-by-identity, never `<Static>`. Alternatives: index-keyed (rejected), `<Static>` graduation (rejected).
- **ADR-2 (D2):** MultiStepProgress reuses TodoList row + n-of-m header; subagent = labelled steps + group header. Alternatives: percentage bar (rejected), parallel tree (rejected — YAGNI).
- **ADR-3 (D3):** CollapsibleBlock controlled-OR-uncontrolled, local key-toggle, no global registry. Alternatives: gemini global registry / opencode KV (rejected).
- **ADR-4 (D4):** Toast = component + one-shot timer; `notify()` = separate imperative helper. Alternatives: app-managed queue (rejected), Toast owning OSC-9 (rejected).
- **ADR-5 (D5):** Conservative OSC-9 gate, injectable-env, exact-byte tested. Alternatives: full 9/99/777 (rejected), unconditional OSC-9 (rejected).
- **ADR-6 (D6):** Extract `isMotionEnabled` (Rule-of-3); animated opt-ins inert when disabled. Alternatives: re-inline (rejected), KV flag (rejected).
- **ADR-7 (D7):** AgentStreaming stays timer-less; `phrases?`/`shimmer?` additive, deterministic, byte-identical off. Alternatives: random selection (rejected), breaking dumb contract (rejected).
