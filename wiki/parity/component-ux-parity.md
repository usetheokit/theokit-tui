---
type: Design Decision
title: M26 — component UX parity with the Claude Code look
description: The tool cards adopt the Claude Code idiom (● status bullet, name(args) header, ⎿ result tree); the other four agent surfaces are recorded as honest no-change decisions, with the no-color accessibility trade-off stated.
tags: [parity, ux, theme, tool-cards, accessibility, m26]
resource: "file:packages/tui/src/tools/tool-call.tsx"
sources:
  - id: component-parity
    resource: "git:9fd7eb1:docs/component-parity.md"
  - id: tool-call-src
    resource: "file:packages/tui/src/tools/tool-call.tsx"
  - id: theme-src
    resource: "file:packages/tui/src/theme/theme.tsx"
generated:
  by: claude-code/opus-5
  at: 2026-08-06
status: stable
---

Records the M26 tool-card parity change and the **bounded sweep** of the other
agent-surface components. One decision per named component — a tweak, or a
`no-change` with rationale — capping scope creep (M26 RISK-2).

# Anchor change — ToolCallCard / ToolResult

The tool cards now render the Claude Code idiom by default:

- **Status bullet** — the `theme.toolStatus` glyph is `●` (U+25CF) across all
  built-in themes, coloured by status: pending gray · success green · failed red;
  running animates via the spinner. `src/theme.tsx`, `src/tool-call.tsx`.
- **`name(args)` header** — the tool name in bold, immediately followed by the
  `summary` in dim parens, on one line, truncated to width. `formatArgs` (pure).
- **`⎿` result tree** — the result/children body renders under a single `⎿`
  (U+23BF) corner connector; continuation lines align under the body. `ToolTree`.

## Live evidence

**Output kind** — `examples/components/tools.tsx` (real pane width, piped; the `Read` pending
card + two `Bash` output cards, one truncated):

```
> install the deps and lint
✦ Running the toolchain now.
●  Read(registry.json)
●  Bash(pnpm install)
  ⎿ … +35 lines hidden
    installed package-35
    installed package-36
    installed package-37
    installed package-38
    installed package-39
●  Bash(pnpm lint)
  ⎿ checked 42 files
    stderr:
    src/demo.ts:3 unused variable
    exited 1
```

**Diff + preview kinds** — `examples/scenes/showcase.tsx` (piped; `Edit` diff card +
`Read` preview card):

```
●  Bash(pnpm vitest run retry)
  ⎿ 573 passed
    stderr:
    1 flaky: retry_backoff_caps
●  Edit(retry.ts)
  ⎿ retry.ts +1 -1
    1   const attempts = 3;
    2 - const backoff = 0;
    2 + const backoff = attempt * 250;
●  Read(retry.test.ts)
  ⎿ it("retry_backoff_caps", () => {
      const waits = plan(3);
      expect(waits).toEqual([250, 500, 750]);
```

All three result kinds are verified live: **output** (`Bash(pnpm install)` →
truncated `⎿ … +N lines`, from `tools.tsx`), **diff** (`Edit(retry.ts)` →
`⎿ retry.ts +1 -1`, from `showcase.tsx`), **preview** (`Read(retry.test.ts)` →
`⎿ it("…`, from `showcase.tsx`). Snapshot coverage: `src/tool-call.test.tsx`
(`each_result_kind_renders_under_the_connector`, per-status bullet, header
width-matrix) plus the piped smoke `tests/example-tools.integration.test.ts`.

# Parity sweep — the other agent surfaces

| Component        | Decision      | Rationale                                                                                                                                                                                                                                                    | Evidence                                                              |
| ---------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| `ChatMessage`    | **no-change** | Already role-glyph-prefixed via theme tokens (`> ` user / `✦ ` assistant / `· ` system) — the gemini-cli message idiom. Claude Code uses the same role-glyph shape; no bullet applies (messages are not tool calls).                                         | `src/chat-message.tsx:29` (role-glyph prefix, theme-token coloured)   |
| `AgentStreaming` | **no-change** | The thinking line is an `ink-spinner` + thought text — the SOTA streaming idiom. A bullet would conflate "agent thinking" with "tool status" (different semantics). The M14 turn-clock coupling makes a glyph change risk a regression for zero parity gain. | `src/agent-streaming.tsx:2` (spinner) + M14 `useTurnElapsed` coupling |
| `AppStatusBar`   | **no-change** | Already the `model · cwd · tokens · state` footer (gemini `FooterRow` recipe) with `truncate-start` on the path and a never-shrinking state — matches Claude Code's bottom bar. No tool-status glyph is involved.                                            | `src/app-status-bar.tsx:9,63` (footer recipe)                         |
| `ChatThread`     | **no-change** | Structural scroll container (windowed `Static` history) — carries no status glyph of its own; it composes `ChatMessage` + `ToolCallCard`, which already inherit the M26 look. Changing it would be scope creep with no visible parity delta.                 | `src/chat-thread.tsx` (composition only)                              |

The sweep found the tool cards were the single real gap; the other four surfaces
were already built to the gemini-cli / Claude Code idioms in earlier milestones,
so honest `no-change` decisions (Rule 3) beat cosmetic churn — the same discipline
the [exit-gate triple](/concepts/exit-gate-triple.md) enforces on the matrix rows.

# Accessibility — no-color status distinction (deliberate trade-off)

The `●` bullet encodes tool status by **colour** (the Claude Code idiom the owner
asked for). Under the `no-color` theme all statuses render an identical `●`
(colour stripped), so status is not glyph-distinguishable there — matching Claude
Code's own behaviour. This is a conscious trade-off to honour the project's **D6
invariant** ("theming changes only colour bytes, never text/layout"): encoding
status in the glyph would break D6 across themes. Running still animates (spinner)
in every theme, mechanically verified by
`tests/degrade-matrix.integration.test.tsx` under `NO_COLOR=1`.

**Full-honesty note (Rule 3):** this DID remove a pre-M26 affordance. The old
theme used distinct glyphs (`o` pending / `✓` success / `x` failed) that WERE
glyph-distinguishable under no-color. M26 collapses them to `●` for Claude Code
visual parity (the owner's explicit ask). A future enhancement could add a
no-color-only distinct-glyph channel behind an opt-in without violating D6;
deferred (YAGNI, no consumer need).
