---
slug: component-ux-parity
milestone_id: M26
created_at: 2026-07-10
goal: Evolve ToolCallCard/ToolResult to the Claude Code tool-card look — a `●` status-bulleted `name(args)` header + a `⎿` corner-connector result body (per kind, indented, truncated with an interactive +N-lines affordance) as the DEFAULT — plus a bounded parity sweep of the other agent-surface components documented in docs/component-parity.md.
---

# Plan: component-ux-parity (M26)

## Goal

Deliver the Claude Code tool-card idiom as the DEFAULT look of `@theokit/tui`:
(1) **Status bullet header** — the tool-status glyph becomes `●` (U+25CF) colored by
status (running=spinner in accent, pending/success/failed=`●` in the theme's
tool-status color), and the header renders `name(args)` on one line (args = the
existing `summary`, in dim parens, truncated to width); (2) **`⎿` result tree** — the
`ToolCallCard` result/children body renders under a `⎿` (U+23BF) corner connector
with the continuation indented, per kind (diff/output/preview) unchanged inside;
(3) **truncation reuse** — the capped body keeps the M25 `ExpandableOutput` ctrl+o
affordance (`… +N lines`); (4) **parity sweep** — ChatMessage, AgentStreaming,
AppStatusBar, ChatThread each get ONE documented tweak OR a `no-change` rationale in
`docs/component-parity.md`; (5) **evidence** — per-kind `renderFrame` snapshots + a
live tmux capture embedded in the parity doc. No consumers exist (owner Q4), so the
new look ships as the default with no opt-in prop; the full suite + export-surface
stay green. House rules hold: presentational/declarative, degrade-as-data, zero new
dependencies (reuse theme tokens, `ExpandableOutput`, `string-width`).

## Baseline Context

### Files that will be touched

| File | LoC | Role | Change |
|---|---|---|---|
| `src/theme.tsx` | ~180 | theme tokens (toolStatus glyphs/colors) | default toolStatus glyphs → `●` (pending/success/failed) |
| `src/tool-call.tsx` | 230 | `ToolCall` header + `ToolCallCard` body | `name(args)` header formatting; `⎿` tree body wrapper |
| `src/tool-call.test.tsx` | — | tool-call tests | new RED tests for bullet + `name(args)` + `⎿` |
| `src/theme.test.tsx` | ~450 | theme snapshot tests | update glyph expectations (deliberate) |
| `docs/component-parity.md` | new | the sweep record | created |
| `examples/showcase.tsx`, `examples/chat.tsx` | — | live demos | pass tool-name + args-shaped summary |
| `CHANGELOG.md` | — | contract | `[Unreleased]` entry |

### Current callers / dependents (READ — the integration seams)

- `ToolCallCard` is consumed by `examples/showcase.tsx`, `examples/all-components.tsx`
  and re-exported from `src/index.ts` (public surface).
- `ToolCall`/`ToolCallCard` depend on `useTheoTheme().toolStatus` for glyph+color and
  on `STATUS_INDICATOR_WIDTH` (3) for header/body alignment.
- `ResultBody` delegates per kind to `DiffViewer` / `ToolResult` / `CodeBlock` — all
  unchanged (the change is the framing around them).
- `theme.test.tsx:143-151` pins the default toolStatus glyphs (`o`/`✓`/`x`) — these
  expectations are updated deliberately as part of this milestone.

### Domain glossary

- **status bullet** — the leading glyph of a tool card header; `●` colored by status.
- **`⎿` corner connector** — U+23BF; drawn once at the top-left of the result body,
  the rest of the body indented under it (the codex `"  └ "`/`"    "` idiom).
- **`name(args)` header** — the tool name with its argument summary in parens, one
  line, truncated to terminal width.

### Architecture boundaries affected

Presentational only (`rules/architecture.md`): no I/O, no new dependency, no state
machine. The renderer stays declarative; status/args arrive via props.

## Prior Art

The discovery blueprint (`.claude/knowledge-base/discoveries/blueprints/component-ux-parity-blueprint.md`)
distilled the idiom from four peers with verified citations: codex
`codex/codex-rs/tui/src/exec_cell/render.rs:372` (status bullet) + `:706`/`:142`
(`└`/4-space result tree) + `:32` (5-line cap); mastra
`mastra/mastracode/src/tui/components/tool-execution-enhanced.ts:1482` (`●` by
status); gemini-cli `gemini-cli/packages/cli/src/ui/constants.ts:20` (status
symbols) + `.../messages/ToolMessage.tsx:121` (indented body); pi
`pi/packages/coding-agent/src/core/tools/bash.ts:174` (5-line preview).

## ADRs

### A — Status bullet is `●` colored by the theme tool-status token; running stays a spinner
`●` is the Claude Code glyph and mastra/codex both bullet-by-status. Running keeps the
live `Spinner` (better UX than a static bullet); pending/success/failed render `●` in
`theme.toolStatus[status].color`. Alternative rejected: per-status distinct glyphs
(`o`/`✓`/`x`) — color already carries the meaning and `●` is the target look.

### B — Result body renders under a single `⎿` corner + indented column, not a full `├─/╰─` tree
codex's `"  └ "` first line + `"    "` continuation is exactly the pasted look. We use
one connector glyph (`⎿`) + a flex gutter so the first body line sits after `⎿ ` and
the rest align under the body (KISS — one result block per card, no sibling branches).
Alternative rejected: bordered box (gemini) — heavier, less like the pasted target.

### C — `name(args)` reuses the existing `summary` prop in dim parens; no new prop
The header renders `name` bold + `(summary)` dim when a summary is present. No consumers
exist (owner Q4), so we change the framing without adding API. Alternative rejected: a
new `args` prop — YAGNI; `summary` already carries the arg-shaped detail.

### D — Truncation reuses M25 `ExpandableOutput`; no new cap logic
The per-kind bodies already cap (`ToolResult`/`CodeBlock` maxLines) and `ExpandableOutput`
gives ctrl+o expand. The `⎿` framing wraps them unchanged.

### E — New look is the DEFAULT (no opt-in prop)
Owner Q4: no consumers, no back-compat constraint — do what's best. Shipping default
avoids a dead config knob (YAGNI).

## Dependencies

Zero new runtime dependencies. Reused (already declared): `string-width` (wide/ambiguous
glyph width for `●`/`⎿`), `ink-spinner` (running), the theme tokens, `ExpandableOutput`.
`/deps-audit` runs to confirm no CVE regression on the existing set.

## Critical paths

- `src/theme.tsx` (default toolStatus glyphs) — the visual contract root.
- `src/tool-call.tsx` (`ToolCall` header + `ToolCallCard` `⎿` wrapper) — the anchor.

## Phase 1: Status bullet + `name(args)` header (ADR A, C)

### T1.1 — `●` status glyphs in the default theme + `name(args)` header formatting

#### Objective
Change the default `theme.toolStatus` glyphs to `●` for `pending`/`success`/`failed`
(colors unchanged; running unchanged = spinner). In `ToolCall`, render the header as
`name(args)`: bold `name`, then—when `summary` is present—`(summary)` in dim, the whole
row `truncate-end` to width. Add a pure `formatArgs(summary)` helper returning the
parenthesized string (or `""`).

#### Why this step
The bullet + `name(args)` is DoD item 1 and the highest-visibility parity change;
theming the glyph centrally keeps one source of truth (the existing toolStatus token).

#### Evidence
Blueprint ADR-1/§T1; mastra `tool-execution-enhanced.ts:1482`; codex `exec_cell/render.rs:372`;
current header `src/tool-call.tsx:99-114`; theme token `src/theme.tsx` toolStatus; theme
test pins `src/theme.test.tsx:143`.

#### TDD
- RED `tool-call.test.tsx`: `test_header_renders_a_status_bullet_for_success` (frame `contains` `●`), `test_failed_status_bullet_is_error_colored` (assert via theme color token), `test_header_formats_name_with_args_in_parens` (`● edit(retry.ts)` shape), `test_header_without_summary_shows_bare_name` (no parens), `test_long_name_args_truncates_to_width` (width-matrix: rendered row never `exceeds` `columns`).
- RED `formatArgs` pure unit: `test_formats_present_summary_in_parens`, `test_empty_summary_returns_empty_string`.
- RED `theme.test.tsx` update: default `toolStatus.success.glyph` `parses` to `●`.
- GREEN: theme glyph change + header formatting (complexity ≤10 via `formatArgs`).

#### Concurrency tests
(none — single-threaded)

#### Acceptance Criteria
- [ ] `formatArgs` is pure and 100% branch-covered; complexity ≤10.
- [ ] The success/failed header `asserts` a `●` bullet in the theme status color; running still renders the spinner.
- [ ] `test_header_formats_name_with_args_in_parens` `asserts` the `name(args)` shape; a card without `summary` shows the bare name (no empty parens).
- [ ] A width-matrix oracle `asserts` the header row never `exceeds` `columns` for `columns ∈ [80,40,20]`.
- [ ] `pnpm gates` green.

#### DoD
- [ ] `●` bullet + `name(args)` land as the default; theme + tool-call tests green; CHANGELOG `[Unreleased]` updated.

## Phase 2: `⎿` result-tree framing (ADR B, D)

### T2.1 — `ToolTree` wrapper renders the result/children body under a `⎿` connector

#### Objective
Replace the two `paddingLeft={STATUS_INDICATOR_WIDTH}` body wrappers in `ToolCallCard`
with a single `ToolTree` sub-component: a flex row of a fixed-width `⎿ ` gutter
(dim) + a `flexDirection="column"` body holding the result body (first) and children
(below). The `⎿` shows once at the top-left; continuation lines align under the body.
Per-kind bodies (diff/output/preview) render unchanged inside.

#### Why this step
The `⎿` tree is DoD item 2 and the other half of the pasted look; wrapping the existing
per-kind bodies avoids reworking `ResultBody` (ADR-4 no-rework).

#### Evidence
Blueprint ADR-2/§T2; codex `exec_cell/render.rs:706` (`└`/4-space layout) + `:142`;
current body wrappers `src/tool-call.tsx:222-227`; per-kind `ResultBody` `:150-188`.

#### TDD
- RED `tool-call.test.tsx`: `test_result_body_renders_under_a_corner_connector` (frame `contains` `⎿`), `test_children_only_body_also_uses_the_connector`, `test_no_body_card_omits_the_connector` (bare row — no `⎿`), `test_multiline_result_indents_continuation_under_the_body` (line 2 `starts` past the gutter, asserted via the stripped frame), `test_diff_output_preview_kinds_each_render_under_the_tree` (per-kind snapshot).
- GREEN: the `ToolTree` wrapper (complexity ≤10); keep `hasBody`/`ResultBody` logic.

#### Concurrency tests
(none — single-threaded)

#### Acceptance Criteria
- [ ] The result body and children `render` under a single `⎿` connector; a bodyless card `asserts` NO `⎿` (bare row unchanged).
- [ ] A multi-line result `asserts` its continuation aligns under the body (the connector shows once).
- [ ] Per-kind snapshot tests (diff/output/preview) each `assert` the `⎿` frame; existing per-kind bodies unchanged.
- [ ] `pnpm gates` green; export-surface stays green.

#### DoD
- [ ] `⎿` framing lands as default across all kinds; tool-call tests + snapshots green; CHANGELOG updated.

## Phase 3: Parity sweep + docs (DoD 4)

### T3.1 — `docs/component-parity.md`: one documented tweak-or-no-change per component

#### Objective
Audit ChatMessage, AgentStreaming, AppStatusBar, ChatThread against the Claude Code
look. For each, land ONE small documented tweak OR record a justified `no-change` in
`docs/component-parity.md` (a table: component → decision → rationale → evidence).
Any code tweak follows TDD (RED test first).

#### Why this step
DoD item 4; caps scope creep (RISK-2) at exactly one decision per named component.

#### Evidence
Blueprint §Techniques (bullet/tree idiom); gemini `constants.ts:20` (status symbols);
current components `src/chat-message.tsx`, `src/agent-streaming.tsx`, `src/app-status-bar.tsx`, `src/chat-thread.tsx`.

#### TDD
- RED (only for components that get a code tweak): a focused test asserting the tweak (e.g. `test_agent_streaming_bullet_matches_tool_status` IF a tweak is chosen), else a documented `no-change` with rationale (no code, no test).
- GREEN: the chosen tweaks; `docs/component-parity.md` written with a row per component.

#### Concurrency tests
(none — single-threaded)

#### Acceptance Criteria
- [ ] `docs/component-parity.md` `contains` exactly one decision row per named component (ChatMessage, AgentStreaming, AppStatusBar, ChatThread), each with a rationale + evidence.
- [ ] Every code tweak has a RED-first test that `asserts` the change; `no-change` rows cite why.
- [ ] `pnpm gates` green.

#### DoD
- [ ] The sweep doc lands with 4 decision rows; any tweaks are tested; CHANGELOG updated.

## Phase 4: Examples + live evidence (DoD 5)

### T4.1 — Wire the examples to the new look + capture live tmux evidence

#### Objective
Update `examples/showcase.tsx` / `examples/all-components.tsx` so the tool cards pass a
tool-name + args-shaped `summary` (so the header reads `Bash(cmd)`), and capture a live
tmux frame of all three kinds (diff/output/preview) into `docs/component-parity.md`.

#### Why this step
DoD item 5 — evidence the look works end-to-end at real width, not just in snapshots.

#### Evidence
Current example usage `examples/showcase.tsx:151-197` (three kinds); tmux session
`theokit` pane `%1` (the standing QA harness).

#### TDD
- RED `tests/example-tool-parity.integration.test.ts`: piped render of the gallery tool page `contains` `●` and `⎿` and exits clean (deterministic, non-TTY).
- GREEN: the example edits; the captured tmux frame pasted into `docs/component-parity.md`.

#### Concurrency tests
(none — single-threaded)

#### Failure scenarios (external I/O — terminal dims)
- At a narrow terminal the `name(args)` header MUST `truncate` (never overflow) and the `⎿` body MUST stay indented; the width-matrix oracle (T1.1) + the live capture at the real pane width prove it. A bodyless card MUST NOT emit a dangling `⎿`.

#### Acceptance Criteria
- [ ] The example integration test `asserts` the piped gallery `contains` `●` and `⎿` and exits `0`.
- [ ] A live tmux capture of the three kinds is embedded in `docs/component-parity.md`.
- [ ] `pnpm gates` green.

#### DoD
- [ ] Examples render the new look; live evidence captured; CHANGELOG updated.

## Coverage Matrix

| Goal claim | Task(s) |
|---|---|
| `●` status-bulleted header colored by status | T1.1 |
| `name(args)` header on one line, truncated to width | T1.1 |
| `⎿` corner-connector result body, indented, per kind | T2.1 |
| Truncation reuses ExpandableOutput (ctrl+o) | T2.1 (ADR D — bodies unchanged) |
| New look is the DEFAULT; suite + export-surface green | T1.1, T2.1 |
| Parity sweep of the 4 other components documented | T3.1 |
| Live tmux evidence + per-kind snapshots | T1.1, T2.1, T4.1 |
| Zero new dependency cleared | Dependencies + T1.1 (deps-audit) |
| Header truncation under narrow width — risk 1 | T1.1 (width-matrix) |
| Sweep scope capped at one decision/component — risk 2 | T3.1 |

## Drawbacks & Risks

| # | Risk / drawback | Mitigation |
|---|---|---|
| 1 | The `●`/`⎿` glyphs are ambiguous/wide-width; the header/tree can overflow or misalign, and the M16/theme snapshots break. | Width via `string-width`; a width-matrix oracle over `columns ∈ [80,40,20]` gates the header; snapshots updated deliberately with the frame captured live (T1.1/T2.1). |
| 2 | The parity sweep (DoD 4) is subjective and can balloon. | Cap at exactly ONE decision (tweak or `no-change`) per named component in `docs/component-parity.md` (T3.1). |
| 3 | Changing the default toolStatus glyphs could surprise a monochrome theme. | The glyph is theme-token data; monochrome keeps `●` (a solid glyph, not color-dependent); degrade-as-data holds (T1.1). |
| 4 | A bodyless card could emit a dangling `⎿`. | `test_no_body_card_omits_the_connector` pins the bare-row path (T2.1). |

## Failure scenarios (when I/O external)

The only external surface is the terminal width. Handled: the header `truncate-end`s
(never overflows) and the `⎿` body indents regardless of width; the width-matrix oracle
(T1.1) + the live pane capture (T4.1) prove it at `columns ∈ [80,40,20]`. No
network/DB/queue/RPC is touched, so no timeout/5xx/retry scenarios apply. No new
dependency, so no supply-chain failure surface beyond the existing (deps-audit clears it).

## Unresolved Questions

(none — every decision is resolved at plan time). The two design forks are RESOLVED in
the ADRs: status bullet is `●` colored by token with running=spinner (A); the result
tree is a single `⎿` connector + indented column, not a full tree (B). The `name(args)`
data source is the existing `summary` (C) — no new API.

## Test Plan

- **Unit (pure):** `formatArgs` (parens/empty, 100% branch).
- **Component (renderFrame / itl-adapter):** `tool-call.test.tsx` — bullet per status, `name(args)` shape, header width-matrix, `⎿` per kind, bodyless-no-connector, multiline continuation; `theme.test.tsx` — updated default glyph expectations.
- **Integration:** `tests/example-tool-parity.integration.test.ts` (piped gallery `contains` `●`+`⎿`, clean exit).
- **Live:** tmux capture of the three kinds embedded in `docs/component-parity.md`.
- **Regression harness:** existing `tool-result` / `code-block` / `diff-viewer` tests stay green (the change is framing, not per-kind body); export-surface stays green.

## Global Definition of Done

- All five M26 DoD bullets validated with evidence (snapshots + live tmux frame).
- `pnpm gates` green (prettier + lint ≤10 complexity + typecheck + test + build).
- New pure module 100% branch-covered; CHANGELOG `[Unreleased]` updated.
- `/code-quality` verdict ∈ {PASS, PASS_WITH_CAVEATS}; `/review` = READY_TO_MERGE.
- `docs/component-parity.md` records the sweep (4 decision rows) + the live frame.
