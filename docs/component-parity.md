# Component UX parity — Claude Code look (M26)

Records the M26 tool-card parity change and the bounded sweep of the other
agent-surface components. One decision per named component (tweak OR `no-change`
with rationale), capping scope creep (M26 RISK-2).

## Anchor change — ToolCallCard / ToolResult

The tool cards now render the Claude Code idiom by default:

- **Status bullet** — `theme.toolStatus` glyph is `●` (U+25CF) across all built-in
  themes, colored by status (pending gray · success green · failed red; running
  animates via the spinner). `src/theme.tsx`, `src/tool-call.tsx`.
- **`name(args)` header** — the tool name, bold, immediately followed by the
  `summary` in dim parens, one line, truncated to width. `formatArgs` (pure).
- **`⎿` result tree** — the result/children body renders under a single `⎿`
  (U+23BF) corner connector; continuation lines align under the body. `ToolTree`.

### Live evidence (tmux, real pane width, `examples/tools.tsx`)

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

All three result kinds verified live: output (`Bash(pnpm install)` → truncated
`⎿ … +N lines`), diff (`Edit(retry.ts)` → `⎿ retry.ts +1 -1`), preview
(`Read(retry.test.ts)` → `⎿ it("…`). Snapshot coverage:
`src/tool-call.test.tsx` (`each_result_kind_renders_under_the_connector`,
per-status bullet, header width-matrix) + the piped smoke
`tests/example-tools.integration.test.ts`.

## Parity sweep — the other agent-surface components

| Component        | Decision      | Rationale                                                                                                                                                                                                                                                    | Evidence                                                              |
| ---------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| `ChatMessage`    | **no-change** | Already role-glyph-prefixed via theme tokens (`> ` user / `✦ ` assistant / `· ` system) — the gemini-cli message idiom. Claude Code uses the same role-glyph shape; no bullet applies (messages are not tool calls).                                         | `src/chat-message.tsx:29` (role-glyph prefix, theme-token colored)    |
| `AgentStreaming` | **no-change** | The thinking line is an `ink-spinner` + thought text — the SOTA streaming idiom. A bullet would conflate "agent thinking" with "tool status" (different semantics). The M14 turn-clock coupling makes a glyph change risk a regression for zero parity gain. | `src/agent-streaming.tsx:2` (spinner) + M14 `useTurnElapsed` coupling |
| `AppStatusBar`   | **no-change** | Already the `model · cwd · tokens · state` footer (gemini `FooterRow` recipe) with `truncate-start` on the path and a never-shrinking state — matches Claude Code's bottom bar. No tool-status glyph is involved.                                            | `src/app-status-bar.tsx:9,63` (footer recipe)                         |
| `ChatThread`     | **no-change** | Structural scroll container (windowed `Static` history) — carries no status glyph of its own; it composes `ChatMessage` + `ToolCallCard`, which already inherit the M26 look. Changing it would be scope creep with no visible parity delta.                 | `src/chat-thread.tsx` (composition only)                              |

The sweep found the tool cards were the single real gap; the other four surfaces
were already built to the gemini-cli / Claude Code idioms in earlier milestones,
so honest `no-change` decisions (Rule 3) beat cosmetic churn.

## Accessibility note — no-color status distinction (deliberate trade-off)

The `●` bullet encodes tool status by **color** (the Claude Code idiom the owner
asked for). Under the `no-color` theme all statuses render an identical `●`
(color stripped), so status is not glyph-distinguishable there — matching Claude
Code's own behavior. This is a conscious trade-off to honor the project's D6
invariant ("theming changes only color bytes, never text/layout") — encoding
status in the glyph would break D6 across themes. Running still animates (spinner)
in every theme. A future enhancement could add a no-color-only distinct-glyph
channel behind an opt-in without violating D6; deferred (YAGNI, no consumer need).
