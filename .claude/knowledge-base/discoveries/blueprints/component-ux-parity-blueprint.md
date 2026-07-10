---
slug: component-ux-parity
milestone_id: M26
kind: discovery-blueprint
date: 2026-07-10
owner: auto-plan (Staff-level deep research)
sources: codex/codex-rs/tui, gemini-cli/packages/cli/src/ui, mastra/mastracode, pi/packages/coding-agent
verdict_target: SHIPPABLE_WITH_CAVEATS
---

# Blueprint — Tool-card Claude Code parity (`● name(args)` + `⎿` result tree)

How SOTA terminal coding agents render tool calls, distilled into concrete
decisions for `@theokit/tui`'s `ToolCallCard` / `ToolResult`. Every claim cites a
real file under `.claude/knowledge-base/references/`.

## Objective

Evolve `ToolCallCard` + `ToolResult` to the Claude Code idiom: a **status-bulleted
header** (`● name(args)`) with the result body rendered **under a `⎿` corner
connector**, indented, per kind (diff / output / preview), truncated with a
"+N lines" affordance — the DEFAULT look (no back-compat constraint, M26 Q4).

## Coverage Corner 4 — Techniques (the core idiom)

### T1 — Status bullet header (`●` colored by status)

- **mastra** maps status → a `●` glyph colored by state: pending/streaming `●`,
  success ` ✓`, error ` ✗` (`mastra/mastracode/src/tui/components/tool-execution-enhanced.ts:1482`).
- **codex** uses a bold `•` bullet: green on success, red on failure, an activity
  indicator while running (`codex/codex-rs/tui/src/exec_cell/render.rs:372`).
- **gemini-cli** ships a status-symbol table: `SUCCESS '✓'`, `PENDING 'o'`,
  `EXECUTING '⊷'`, `ERROR 'x'` (`gemini-cli/packages/cli/src/ui/constants.ts:20`),
  and a status→color map (focus/active/warning/success/error) in
  `gemini-cli/packages/cli/src/ui/components/messages/ToolShared.tsx:152`.

**Decision (ADR-1):** header renders `<bullet> name(args)` where `bullet` is `●`
(U+25CF, filled circle — the Claude Code glyph), colored via the theme's tool
status tokens: running=warning/accent, success=success, failed=error. We already
have `ToolStatusTokens` in the theme + a status→indicator width helper — reuse them.

### T2 — Result tree connector (`⎿` / `└`) + indentation

- **codex** renders the output block with a two-line prefix: first line
  `"  └ "`, subsequent lines `"    "` (exactly 4 spaces) — see the
  `EXEC_DISPLAY_LAYOUT` prefixed blocks (`codex/codex-rs/tui/src/exec_cell/render.rs:706`)
  and the head/tail assembly (`.../render.rs:142`). Command continuation uses `"  │ "`.
- **mastra** uses tree branches `├─` / `╰─` for continuation and a `│` rail for
  preview lines (`mastra/mastracode/src/tui/components/tool-execution-enhanced.ts:938`).
- **gemini-cli** indents the body with a bordered box (`paddingX={1}`, left border)
  rather than an ASCII connector (`.../messages/ToolMessage.tsx:121`).

**Decision (ADR-2):** result body renders under a `⎿` (U+23BF) corner on its first
line, then 4-space indent for the rest — the codex idiom, which is exactly the
Claude Code look the owner pasted. We keep a single connector glyph (`⎿`) rather
than a full `├─/╰─` tree (KISS — one result block per card, no sibling branches).

### T3 — Truncation ("+N lines")

- **codex**: `TOOL_CALL_MAX_LINES = 5` for agent tool calls, ellipsis
  `"… +{omitted} lines (ctrl + t to view transcript)"`
  (`codex/codex-rs/tui/src/exec_cell/render.rs:32` and `:254`).
- **pi**: `BASH_PREVIEW_LINES = 5`, hint `"... (N earlier lines, [expand])"`
  (`pi/packages/coding-agent/src/core/tools/bash.ts:174`).

**Decision (ADR-3):** default cap = 5 body lines, then a dim `… +N lines` line.
We already ship `ExpandableOutput` (M25) with a ctrl+o toggle — the `⎿` body reuses
it, so the cap is interactive, not a dead truncation.

### T4 — Per-kind result bodies

- **codex** branches Read (file list + count) vs command (cmd + output)
  (`.../render.rs:262` vs `:365`).
- **gemini-cli** `DenseToolMessage` renders diffs as `→ summary (+N, -N)`
  (`.../messages/DenseToolMessage.tsx:182`).
- **pi** has per-tool `renderResult()` (bash/read/edit) with diff stats
  (`pi/packages/coding-agent/src/core/tools/edit.ts:363`).
- **mastra** switches on tool name to per-kind renderers
  (`mastra/mastracode/src/tui/components/tool-execution-enhanced.ts:390`).

**Decision (ADR-4):** keep our existing `ToolCardResult` union (diff/output/preview)
— it already models per-kind. The change is purely the **framing** (header bullet +
`⎿` tree), applied uniformly around each kind's existing body.

## Coverage Corner 1 — Integration tests

- codex/gemini test the renderers as pure line/segment producers (snapshot of the
  rendered lines), not via a live terminal. Our project convention (testing.md §5)
  is `renderFrame()` + ANSI-strip snapshots — the same shape. **Decision:** per-kind
  snapshot tests via `renderFrame`, asserting the `●` header and `⎿` body appear,
  plus a live tmux capture (DoD item 5).

## Coverage Corner 2 — Dependencies

- No new runtime dependency is needed. The glyphs are literals; the theme tokens,
  `ExpandableOutput`, and width helpers already exist. **Decision (ADR-5):** zero
  new deps (parsimony ladder rung 4 — reuse installed). `string-width` (already a
  dep) handles the wide/ambiguous glyph width for truncation.

## Coverage Corner 3 — Tools

- All peers ship their renderer inside the same package/test toolchain (vitest /
  cargo). We reuse `pnpm gates` (prettier+lint+typecheck+test+build) + the existing
  snapshot infra. No new tooling.

## ADRs (investigation + design decisions)

| ADR | Decision | Rationale |
|---|---|---|
| ADR-1 | `●` status bullet header, colored by theme tool-status tokens | mastra/codex/gemini all bullet-by-status; `●` is the Claude Code glyph |
| ADR-2 | `⎿` corner + 4-space indent result body (single connector, not full tree) | codex `"  └ "`/`"    "` idiom = the pasted look; KISS one block |
| ADR-3 | 5-line cap + `… +N lines`, reusing `ExpandableOutput` (ctrl+o) | codex/pi both cap at 5; we already have interactive expand |
| ADR-4 | Keep the `ToolCardResult` union; reframe only | per-kind already modeled (M16); avoid rework |
| ADR-5 | Zero new deps; reuse `string-width` for glyph width | parsimony; wide-glyph safety |
| ADR-6 | New look is DEFAULT (no opt-in prop) | M26 Q4: no consumers, no back-compat constraint |

## Risks (carried into the plan)

1. **Render regression** — `●`/`⎿` are ambiguous/wide-width; wrap/alignment and the
   existing M16 snapshots can break. Mitigation: per-kind snapshot tests + live tmux
   at real width; update M16 snapshots deliberately (documented, not silent).
2. **Scope creep on the sweep** — cap at ONE documented change-or-no-change per named
   component in `docs/component-parity.md`.

## Project-rule alignment

- `rules/architecture.md` — the renderer stays presentational; no I/O added.
- `rules/testing.md §5` — snapshot via `renderFrame`; edge (empty output) + negative
  (failed status) cases both covered.
- `rules/parsimony-ladder.md` — rung 4 (reuse installed: theme tokens,
  `ExpandableOutput`, `string-width`); no new dependency.

## Acceptance (feeds `/to-plan`)

Every DoD bullet of M26 maps to a technique above; the plan will decompose into
tasks: (P1) header bullet, (P2) `⎿` result framing per kind, (P3) truncation reuse,
(P4) component sweep + doc, (P5) live evidence.
