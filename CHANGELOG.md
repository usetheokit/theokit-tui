# Changelog

All notable changes to `@theokit/tui` are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Consecutive read-only exploration tools (read/list/grep) now collapse into a Codex-style **"Explored" block** — a header + one dim verb+target line per tool ("Read chat.ts", 'Search "foo"', "List agents") instead of one full output card each, so exploration no longer dominates the transcript. Grouping happens in the `messagesToAgentEvents` projection (a new `explored` `AgentEvent` kind), so the `<Static>` windowing is untouched (1 event = 1 row). Tool events now carry their `input` (when non-empty). Configurable via `messagesToAgentEvents(messages, { exploreTools })` — default `DEFAULT_EXPLORE_TOOLS`; pass `[]` to disable. Apps whose tools are named differently are unaffected.
- Timeline tool results now render a **colored inline diff** (via `DiffViewer`) when the result is a git-style unified diff — the Codex-style edit render for tools like `apply_patch`. `AgentToolEvent` gains an exclusive `diff` field (`output | shell | diff` — one only, validated at the boundary); a clean unified-diff result (no stderr, exit 0) routes to it automatically in both timeline projections. Shared routing lives in `routeToolResult` / `looksLikeUnifiedDiff` (`agent-stream-event.ts`).

### Changed

### Deprecated

### Removed

- **BREAKING:** the `@theokit/tui/ai-sdk` subpath (deprecated back-compat shim) and the optional
  `ai` peer dependency. The ai-free projections on the main entry replace it 1:1 — import
  `messagesToChatThread` / `messagesToAgentEvents` from `@theokit/tui` instead of
  `uiMessagesToChatThread` / `uiMessagesToAgentEvents` from `@theokit/tui/ai-sdk`; the ai SDK's
  `UIMessage[]` is structurally assignable to `UIMessageLike`, so call sites only rename the
  function. (no issue — owner request 2026-07-23)

### Fixed

- Regras `deny` de permissão em `.claude/settings.json`: removidas as entradas `Write(knowledge-base/references/**)` e `Write(knowledge-base/tools/**)`, que eram no-ops (checks de permissão de arquivo só casam regras `Edit(path)`, que cobrem todas as ferramentas de edição — as regras `Edit(...)` equivalentes já existiam) (config interna; sem issue)
- Tool results that arrive as a JSON-string-encoded shell envelope (`{"stdout":…,"stderr":…,"exitCode":…}` — how the in-process SDK serializes a tool's result) now render through `ToolResult`'s shell mode (clean stdout lines, labeled `stderr:`, non-zero exit badge) instead of dumping the raw JSON into the timeline. Fixed in BOTH projections: the message projection (`messagesToAgentEvents`) and the stream reducer (`agentStreamReducer`). Plain text results (file contents, `path:line:` grep, directory listings) and non-envelope JSON are unchanged. Shell-envelope helpers (`toShell`/`parseShellEnvelope`) are now shared from `agent-stream-event.ts`.

### Security

## [0.41.1] - 2026-07-16

### Changed

- `SelectList` multi-select checkbox now uses the smaller `○` / `●` circle instead of the bulky `◯` / `◉` LARGE CIRCLE, so dense option lists read lighter and less cramped.

## [0.41.0] - 2026-07-16

### Added

- **Opt-in inter-item `gap` on the list/menu components** (issue #50): `SelectList`, `TodoList`,
  `MultiStepProgress`, `QuestionPrompt`, and vertical `ChoiceRow` now accept an optional
  `gap?: number` (default `0`), mirroring `Stack`. It spaces **between items** only — the
  filter / counter / header chrome stays flush — so consumers can add breathing room without
  changing the tight default (which matches Claude Code / standard TUI menus). Purely additive:
  `gap` unset is byte-identical to the current output.

## [0.40.0] - 2026-07-16

### Added

- **`PermissionPrompt` — the Claude Code tool-approval card.** A top-ruled frame around a
  tool-type header (`Bash command`), the command + optional description, an optional
  permission-rule note + hint (`/permissions to update rules`), the `Do you want to proceed?`
  question, and a **vertical numbered** Yes/No list (`❯ 1. Yes` / `2. No`). Enter commits the
  active choice; Esc is the safe default (the last choice — reject). Exports
  `DEFAULT_PERMISSION_CHOICES`.

### Changed

- **`ChoiceRow` gains a `vertical` + `numbered` mode** (opt-in; the default horizontal bar is
  byte-identical). Vertical stacks each choice on its own line with a `{n}. ` prefix; ↑/↓ now
  move alongside ←/→ (the shared keyboard oracle handles both). Powers `PermissionPrompt`.

## [0.39.0] - 2026-07-16

### Added

- **`ProgressActivity` — the Claude Code compaction-style progress surface.** Two lines: a
  sparkle header (`✳ Compacting conversation… (7m 3s · ↑ 24.6k tokens)` — label + optional
  elapsed + directional `↑`/`↓` token count) over a `ProgressBar`. Determinate (a percentage),
  unlike `AgentStreaming` (the indeterminate stream with an interrupt hint).
- **`ProgressBar` — a determinate progress bar primitive** (`█████░░░░░ 50%`): a filled run
  (theme accent) + an empty run (dim) + an optional `N%` label; `percent` clamps to [0,100].
  Configurable `fullChar` / `emptyChar` / `width` / `showPercent`. Built on the shared fill-bar.

## [0.38.0] - 2026-07-16

### Added

- **`Stack` — the vertical-rhythm primitive.** Spacing between transcript blocks is a
  container concern, not a per-component one: wrap a column of surfaces (banner, notices,
  timeline, working indicator, footer) in one `<Stack gap={1}>` and every child is separated
  by the same gap — regardless of type — so nothing is ever accidentally cramped (the
  `AgentStreaming` "thinking" line included). Named over Ink's `<Box flexDirection="column"
gap>` (the SwiftUI `VStack(spacing:)` / Braid `<Stack>` idiom); `gap` applies only between
  children, never as leading/trailing padding. Default `gap` is 1 (the Claude Code cadence).
  Accepts the margin family. `example:claude-code` now uses it instead of per-component margins.

## [0.37.0] - 2026-07-16

### Added

- **`StatusFooter` — the two-line Claude Code footer.** A justified status row (`left`
  space-between `right`, e.g. `main · plan … 42% context · fix the bug`) above a mode /
  agents row (`ModeIndicator` + `← for agents`, or `? for shortcuts · ← for agents` when
  no mode is active). Display-only slots.
- **`AgentStreaming` gained a `tokenDirection?` prop** — `↓` / `↑` before the token count
  (`↓ 30.6k tokens`), the Claude Code context-trend arrow.
- Example: `example:claude-code` now showcases the full parity surface — the sparkle working
  glyph + `↓` token arrow and the two-line `StatusFooter` (justified status row + mode/agents row).

### Changed

- **`AgentStreaming` working glyph is now the sparkle `✳`** (cycling `✳ ✷ ✶ ✵` under
  motion; static under reduced-motion / non-TTY / monochrome) instead of the braille
  spinner — the Claude Code look.

## [0.36.0] - 2026-07-16

### Added

- **`ModeIndicator` — the Claude Code permission-mode footer.** Renders
  `⏵⏵ auto-accept edits on (shift+tab to cycle)` / `⏸ plan mode on …`; `default`
  renders nothing. Callback-only (the app owns the mode + the shift+tab cycling);
  the glyph carries the mode under a monochrome theme. Exports `PERMISSION_MODES`.
- **`Notice` — a persistent inline banner** (distinct from the transient `Toast`):
  `!! warning …` (yellow) / `│ info · /cmd` (accent) / `✓ success` / `✗ error`, with
  a leading variant marker that stays legible under `NO_COLOR`. Exports `NOTICE_VARIANTS`.
- **`AgentStreaming` gained a `tokens?` prop** — the working indicator now renders the
  Claude Code shape `(27s · 47k tokens · esc to interrupt)`.
- **`WelcomeBanner` gained an `aside?` slot** — an optional right column (the "Tips for
  getting started" / "What's new" panel) rendered alongside the main content. Absent →
  the single-column layout, byte-identical to before.
- Example: `example:claude-code` — the full Claude Code look composed from the primitives
  (two-column welcome, inline notices, spaced transcript, working indicator, mode footer).

### Changed

- **`AgentTimeline` now spaces its event blocks** — one blank line above every message /
  thinking / tool block except the first, matching `ChatThread`'s inter-turn cadence (the
  Claude Code transcript rhythm). Consumers rendering a live turn get the spacing for free.
- **Assistant bullet gap** — `theme.role.assistant.glyph` is now `⏺ ` + an extra space
  (two-space gap) so the assistant message text aligns with the tool-status rows in a
  transcript (both sit one column past the `⏺`). Override via the theme as before.

- **`AgentStreaming` interrupt hint** is now `({elapsed} · {N} tokens · esc to interrupt)`
  (was `(esc to cancel[, {elapsed}])`) — Claude Code wording.
- **`ExpandableOutput` toggles on `ctrl+r`** (was `ctrl+o`) and shows `(ctrl+r to expand)` /
  `(ctrl+r to collapse)` — matching Claude Code's `⎿ … (ctrl+r to expand)` affordance.

## [0.35.0] - 2026-07-16

### Added

- Examples: `example:ai-sdk` (the `@theokit/tui/ai-sdk` UIMessage adapter — one
  `UIMessage[]` folded into both `<ChatThread>` and `<AgentTimeline>`) and
  `example:margin` (the universal margin API across several components), each with
  a piped-smoke integration test.

### Changed

- **Claude-Code bullet restored to `⏺` (#40).** With the width fix below, the theme's
  filled-circle bullet changes from `●` (the interim workaround) to `⏺` (U+23FA) across all
  three themes — for the assistant role glyph and the tool-status pending/success/failed
  glyphs. `⏺` and `●` are both one cell wide, so nothing shifts; only the character changes.
  Override it via the theme's `role.assistant.glyph` / `toolStatus.*.glyph` as before.

### Fixed

- **Renderer no longer over-counts the `⏺` glyph's width (#40).** The custom cell-grid
  measured `⏺` (U+23FA) as 2 columns while Ink measures it as 1, misaligning any line
  that used it. Root cause: `string-width` was pinned to 7.2.0 (and `widest-line` to 5.0.0,
  which pulls its own 7.x) while Ink 7.1.0 is on the string-width `^8` line. Bumped
  `string-width` → 8.2.1 and `widest-line` → 6.0.0 so both measurement paths agree with Ink
  (`measureText("⏺") === 1`).
- **Interactive components now receive keyboard input under pure Ink (#41).** `ChoiceRow`,
  `SelectList`, `Pager`, `FreeTextInput` and the decision prompts (`ApprovalPrompt`,
  `QuestionPrompt`, `PlanApproval`) consume the custom renderer's input+focus hooks, whose
  context is not mounted under Ink's `render` — so they rendered but silently ignored every
  key. New public **`InkInputProvider`** bridge wires an input source to Ink's stdin and
  provides that context: mount it once, high in the tree, around this library's interactive
  surfaces. (The `examples/decisions.tsx` demo now uses it instead of reaching into renderer
  internals.)

## [0.34.0] - 2026-07-16

### Added

- **`findPendingApproval(messages)` + `PendingApproval` — surface a HITL-gated tool awaiting a human
  decision.** When a gated tool pauses the run, ai-sdk reconstructs a tool part with
  `state: "approval-requested"` + `approval: { id }`; this reader (structural, ai-free, newest-first)
  returns `{ approvalId, toolName, input }` so a surface renders an `ApprovalPrompt` and settles it via
  the agent client's `approve(approvalId, decision)`. `undefined` when nothing is pending.

## [0.33.0] - 2026-07-16

### Added

- **`readTurnUsage(message)` + `TurnUsage` — read per-turn usage from a message's
  metadata for the status bar / cost meter.** The agent stream now rides each turn's
  usage (input/output/total tokens + reasoning/cache buckets), cost, and durationMs on
  the assistant `UIMessage.metadata`; `readTurnUsage` reads it structurally (ai-free,
  never throws — a user turn or malformed shape yields `undefined`). This is the seam a
  terminal footer renders real tokens/cost from, instead of a static `model · cwd` line.
- **`AppStatusBar` gained a `cost?` slot** — rendered `cost ~$X` (via `formatCost`)
  between the tokens and state slots, absent when undefined. The footer is now
  `model · cwd · tokens · cost · state` — the Claude-Code shape.

### Fixed

- **`AppStatusBar` accepts an explicit `undefined` on the `tokens` / `cost` slots** — so a
  consumer under `exactOptionalPropertyTypes` can wire the natural `cond ? value : undefined`
  without a conditional-spread dance (the App footer pattern).

## [0.32.0] - 2026-07-16

### Added

- **ai-free message projection: `messagesToAgentEvents` / `messagesToChatThread`** — the
  same fold as the `./ai-sdk` adapter but over a structural `UIMessageLike` with **no `ai`
  import**, exported from the main barrel. `AgentTimeline` now renders assistant Markdown.

## [0.31.0] - 2026-07-13

### Added

- **Universal margin API** — every public visual component (all 32) now accepts the CSS/Ink
  margin family (`margin`, `marginX`, `marginY`, `marginTop`, `marginRight`, `marginBottom`,
  `marginLeft`) and applies it to its root layout, so any component can be spaced from its
  neighbours without a wrapper `<Box>`. Backed by a shared `LayoutMarginProps` type (now
  exported) plus `pickMargin` / `omitMargin` / `LAYOUT_MARGIN_KEYS` helpers. Backward-compat
  invariant: when no margin is passed the spread is a no-op and output is byte-identical to
  before (no existing snapshot changed). Text-rooted components (`FreeTextInput`) and
  `<Static>`-based surfaces (`ChatThread`, `AgentTimeline`) carry the margin on a margin-only
  wrapper / their live region respectively — documented per component.

### Changed

- `ChatMessage` — Claude Code chat differentiation. The **assistant** turn is now
  marked with a `●` bullet (an aligned width-1 filled circle, matching the tool-status
  bullet) instead of `✦`; the **user** turn renders its text **dim** (the input echo),
  so the assistant reply reads as the prominent output. The default `theme.role.assistant`
  glyph changes across dark/light/no-color. `>` (user) and `·` (system) prefixes are
  unchanged. Consumers can override the glyph via the theme as before.
- `ChatThread` — inter-turn spacing. Turns are now separated by one blank line (Claude
  Code cadence) so the conversation breathes; there is **no** leading blank above the
  first turn. Spacing lives in `ChatThread`'s row layout — standalone `<ChatMessage>`
  keeps zero margin, so embedding it elsewhere is unaffected.

### Fixed

- `VERSION` constant drift — `src/index.ts` exported `0.29.0` while `package.json` was
  already `0.30.0` (the 0.30.0 release bumped the manifest but not the constant). Synced
  to `0.30.0`; the export-surface guard (`VERSION === package.json`) is green again.

## [0.30.0] - 2026-07-12

### Added

- `@theokit/tui/ai-sdk` — a new subpath that adapts the `ai` SDK's `UIMessage[]`
  (the shape TheoKit's unified agent client produces) into this package's render
  shapes: `uiMessagesToChatThread(messages)` → `ChatThreadMessage[]` for
  `<ChatThread>` (one bubble per text turn, tool/reasoning-only turns skipped),
  and `uiMessagesToAgentEvents(messages)` → `AgentEvent[]` for `<AgentTimeline>`
  (text → `message`, reasoning → `thinking`, each tool invocation → a `tool`
  event with status mapped from the ai part `state`; ids stay unique for the
  timeline's duplicate-id contract). Pure functions, no React/Ink. `ai` is an
  OPTIONAL peer (type-only import) — a terminal app renders the unified client's
  output with the same primitives the web/desktop surfaces use. UI-track Step A.

### Changed

- Examples — `all-components` gallery (page 1) now demonstrates the M27 `<Banner>`
  (ASCII-art logo + framed status box) alongside `WelcomeBanner`, closing the
  examples↔components coverage gap; `banner` example wires `renderFigletArt`
  (optional figlet peer) with a ready-art fallback to document the real pattern.

### Deprecated

### Removed

### Fixed

- Examples — the `banner` / `all-components` ASCII logo now reads **"Theo"** (was
  "Thoo"): the hand-typed art had collapsed figlet's 5-row rendering into 4 rows,
  dropping the `e`-crossbar row so the `e` rendered as a round `o`. Replaced with the
  verified 5-row figlet "Standard" art; the integration test asserts the `\___|\___/`
  bottom row (the `\___|` proves the `e`). Examples only — no shipped code affected.

### Security

## [0.29.0] - 2026-07-10

### Added

- `Banner` (M27) — an ASCII-art startup header. Renders a provided `art` string verbatim
  (accent-themed) OR degrades to the bold product `name` when `art` is absent (the
  WelcomeBanner idiom); PURE/sync. Optional framed status panel (`status?: {label,value}[]`
  in a themed bordered box — round/accent, `single` under monochrome) and a
  `layout?: 'minimal' | 'banner'` prop (default `minimal`; `banner` stacks the art above
  the status panel). Plus `renderFigletArt(text, font?)` — an async helper that generates
  art via an OPTIONAL `figlet` peer (`peerDependenciesMeta.figlet.optional`) and returns
  `null` when figlet is absent or the font is unknown (so callers fall back to `name`);
  and a pure `bannerArtWidth(art)` (widest line via `string-width`). New exports: `Banner`,
  `BannerProps`, `BannerStatusRow`, `renderFigletArt`, `bannerArtWidth`, `FigletLike`,
  `FigletLoader`. No new REQUIRED dependency (figlet is an optional peer).
- Roadmap amended: added M27 ASCII-art banner header (`<Banner>`)
  (`/roadmap-feature ascii-banner-header`).
- `Toast` — a `variant?: 'info' | 'success' | 'error'` prop (default `info`). `success`/`error`
  color the border by the theme status token and prefix a `●` status bullet; `info` keeps the
  accent border with no bullet. Additive, non-breaking. New export `ToastVariant`.
- `FreeTextInput` — an `autoFocus?: boolean` prop (default true), matching the rest of
  the interactive component family (`ChatComposer` / `SelectList` / the agent-decision
  surfaces). `autoFocus={false}` renders the input without grabbing stdin — required to
  demo it in a non-interactive component gallery. Found by an examples↔components
  coverage audit: `FreeTextInput` had zero example coverage AND was the only interactive
  component missing focus control. Now demonstrated in `examples/decisions.tsx` (the
  round-trip) and `examples/all-components.tsx` (the gallery).

### Changed

- Examples (`all-components`, `stream`) — tool cards now pass a tool-name + args-shaped
  `summary` (e.g. `Edit(retry.ts)`, `Bash(pnpm test)`), matching the M26 `name(args)`
  convention already applied to `tools`/`showcase`. All five tool-card examples are now
  consistent.
- Live-progress UX (Claude Code parity): `TodoList` now renders `done` items dim +
  **strikethrough** and the `active` item **bold** (the signature completed-todo look;
  propagates to `MultiStepProgress`, which reuses it). `ThinkingBlock` prefixes its summary
  with the `✻` thinking marker. New pure export `todoRowStyle`.

## [0.28.0] - 2026-07-10

### Added

- `ChatComposer` **bang mode** (`!` quick command — Claude Code parity). New optional
  `onShellCommand?: (command: string) => void` prop: when provided, typing `!` at the start
  of the buffer enters a distinct shell mode (the prompt drops to `!` and the hint changes);
  Enter calls `onShellCommand` with the command (text after the `!`, trimmed) instead of
  `onSubmit`, and Esc cancels the draft. The library NEVER spawns a process — the consumer
  decides how to run it (fail-fast boundary / DIP). Omit the prop and a leading `!` is plain
  text submitted through `onSubmit` (non-breaking). The `chat` example wires a real runner
  (`spawnSync`) to demonstrate. New pure export: `parseShellCommand`.
- `KeyboardHelp` component + `DEFAULT_COMPOSER_SHORTCUTS` — a bordered keyboard-shortcut
  help panel (keys column + description; monochrome-degrading border), plus a ready-made
  list of the composer's built-in chords. Pairs with a new `ChatComposer` prop
  `onHelpToggle?: () => void`: pressing `?` on an EMPTY buffer calls it (the app toggles the
  panel) instead of typing the `?`; a `?` mid-text stays literal. Claude Code `?` parity.
  Omit the prop and `?` is always ordinary text (non-breaking). The `chat` example wires it.
- Roadmap amended: added M26 Component UX parity — Claude Code tool-card look
  (`/roadmap-feature component-ux-parity`).

### Changed

- **Tool cards — Claude Code look (M26).** `ToolCallCard` / `ToolResult` now render
  the Claude Code tool idiom by DEFAULT: a `●` status bullet colored by status
  (pending gray · success green · failed red; running still animates), a `name(args)`
  header (the `summary` becomes a dim parenthesized arg suffix, truncated to width),
  and the result body under a `⎿` corner connector with the continuation indented
  (per kind — diff/output/preview — unchanged inside). The default `theme.toolStatus`
  glyph is now `●` across dark/light/no-color (color carries status). New pure export:
  `formatArgs`. The tool cards were the last agent-surface gap; the other components
  (ChatMessage, AgentStreaming, AppStatusBar, ChatThread) are documented `no-change`
  in `docs/component-parity.md`. No consumers existed, so this ships as the default
  (no opt-in). Accessibility note: under `no-color`, status is color-encoded (matches
  Claude Code) — see `docs/component-parity.md`.
- Examples (`chat`, `showcase`, `all-components`, `tools`) — tool cards pass a
  tool-name + args-shaped `summary` so the header reads `Bash(pnpm install)`; earlier
  copy advertising the `@`-file mention + path navigation is retained.

### Fixed

- `ChatComposer` `@`-mentions — hidden entries (names starting with `.`) are now excluded
  by default (file-picker convention): typing `@` no longer surfaces `.claude/…` and other
  dotfiles/dot-directories, and `@~/` no longer lists `.ansible/` etc. Typing the dot opts
  back in (`@~/.` reveals hidden entries). The cwd walk never descends into dot-directories.

## [0.27.0] - 2026-07-09

### Added

- `ChatComposer` — a `bordered` prop that draws a rounded box around the input line
  (the Claude Code look; degrades to a `single` border under a monochrome theme).
  Default false, so existing consumers are unchanged.
- `ChatComposer` `@`-mentions — **path navigation** (Claude Code parity). When the
  `@`-query names a path (contains `/` or starts with `~`), the menu switches from the
  cwd fuzzy-walk to a directory listing: `searchFiles` reads that directory (with `~`
  expanded to `$HOME`), lists its entries dirs-first filtered by the trailing partial,
  and keeps the verbatim prefix — so `@~/Área de Trabalho/` lists that folder. Selecting
  a directory re-inserts the `@` (so the menu stays open) with a trailing `/` and no
  closing space, so you keep navigating in; selecting a file completes the mention as
  before. New pure exports: `isPathQuery`, `splitMentionPath` (`src/file-search.ts`).

### Changed

- `ChatComposer` — **Alt+Enter now inserts a newline** in multi-line mode, in every
  terminal (it arrives as `\x1b\r` → `{return, meta}`, unlike Shift+Enter which needs
  the kitty protocol). Enter still submits; Ctrl+J / Shift+Enter still work. The chat
  and showcase examples adopt the bordered box + the Alt+Enter hint.
- `@`-mention token scanning (`findMentionToken`) — the token no longer stops at the
  first whitespace once a `/` has been seen, so a path with spaces (`@~/Área de Trabalho/`)
  stays a single token. A space before the first `/` still closes the token as before.

### Fixed

- `ChatComposer` `@`-mention menu rendered a spurious leading `/` on every file path
  (`/src/foo.ts`) because it reused the slash-command renderer, which hard-coded the `/`
  sigil. `SlashMenu` gained an optional `sigil` field (default `/`); the mention menu sets
  it to `""` so paths render bare (`src/foo.ts`).

## [0.26.1] - 2026-07-09

### Added

- Component gallery example (`examples/all-components.tsx`) — a paginated
  (n/p/q) live demo of every shipped component across 7 pages (chat/agent,
  markdown+table+diff, tool cards, metrics, live progress, agent decisions,
  interaction primitives).

### Fixed

- `ExpandableOutput`: multi-line collapsed/expanded content no longer collapses
  onto one line (it was wrapped in a single `<Text>`); content now renders in a
  `Box` with the `▶`/`▼` affordance on its own line below it (the gemini/pi
  idiom). Regression test added; found while running the live component gallery.

## [0.26.0] - 2026-07-09

### Added

- Markdown tables in `MarkdownText` — a GFM table (header + delimiter + rows,
  alignment from `:--`/`--:`/`:-:`) parses to a `table` node and renders as a
  box-drawing grid when it fits the terminal width, degrading to wrapping plain
  text (no cell truncation → no data loss) when narrow. Fail-soft: a pipe line
  without a delimiter next stays a paragraph. Column widths via `string-width`
  (CJK/EAW-aware); a width-matrix oracle pins no-overflow across widths (M25 T1.1).
- `DiffViewer` intra-line word highlight — an opt-in `intraLineHighlight` prop
  (default off = byte-identical) that pairs equal-length del/add line runs and
  marks the changed WORDS with inverse video (a pure indentation change is not
  highlighted). New dependency `diff` (jsdiff, BSD-3, no CVEs), imported only on
  the opt-in path (M25 T2.1).
- `ExpandableOutput` — a capped view that reveals its full body on ctrl+o / Space
  / Enter (per-component state, no global registry) over the M24 CollapsibleBlock.
  `ToolResult` and `CodeBlock` gain an `interactive` prop that wraps their
  line-capped output in it (the 20k char guard is never bypassed) (M25 T3.1).
- `setTerminalTitle()` + `osc8Link()` (+ `supportsHyperlinks()`) — terminal window
  title (OSC 0) and hyperlink (OSC 8) helpers, mirroring the `notify()` capability
  gate: a no-op / plain-text degrade off-TTY or under a multiplexer (never leak raw
  escape bytes) (M25 T4.1).
- Parity-polish example (`examples/parity-polish.tsx`) composing a Markdown table,
  an intra-line diff, an ExpandableOutput, and the OSC helpers; plus dual-render
  parity scenes (the table + intra-line highlight render byte-identically under Ink
  and the V4 renderer) (M25 T5.1).
- V4 exit-gate re-audit: `docs/v4-parity-matrix.md` re-scored by an adversarial
  2-specialist refutation panel (not a self-grade) — all four M25 rows pass the
  component ∧ oracle ∧ example triple with no standing refutation; borderline rows
  ship with an honesty note. The report `docs/renderer/m25-parity-report.md` is the
  release artifact. The V4 parity program is closed (M25 T6.1).

### Changed

### Deprecated

### Removed

### Fixed

### Security

## [0.25.0] - 2026-07-09

### Added

- `TodoList` — a live checklist keyed by stable `id` (☐ pending / ◐ active / ☑
  done). An item updates in place when the caller passes a new object with the same
  id (rows memo-ed by identity, the M8 ChatThread precedent); duplicate ids throw;
  it never graduates to `<Static>` (a done item may revert). The status glyph
  carries the meaning, so the surface survives a monochrome theme (M24 T1.2).
- `MultiStepProgress` — a discrete n-of-m step list that reuses the `TodoList` row
  (DRY) + a header: `"{done} of {total}"`, or `"step {i} of {total}"` (clamped)
  when a `current` step is given. A `groupLabel` renders the subagent-lane variant
  (each step's label is a lane name) (M24 T2.1).
- `CollapsibleBlock` — a collapsed summary + expandable body, controlled (via
  `expanded`+`onToggle`) or key-toggled (Space/Enter when focused); `▶`/`▼`
  affordance (glyph — survives monochrome); no global toggle registry. Plus a
  `ThinkingBlock` preset (collapsed-default, dim+italic summary, MarkdownText body
  when the children are a markdown string) (M24 T3.1).
- `Toast` — a transient message on a bounded one-shot auto-dismiss timer (default
  5000ms, self-clearing at fire + torn down on unmount; an inline `onDismiss` does
  not reset the countdown). Plus `notify(message)` — a desktop notification helper
  with a conservative capability gate: OSC-9 only where known-supported
  (iTerm2/ConEmu), BEL fallback, suppressed under a multiplexer or on a non-TTY
  (M24 T4.1).
- `AgentStreaming` phrase-cycler + shimmer opt-ins: `phrases` cycles a set of
  status phrases (deterministic round-robin, ~2s) and `shimmer` pulses the primary
  line, both gated on `isMotionEnabled` (reduced-motion / non-TTY / monochrome →
  inert). Absent opt-ins render byte-identical to before; neither path is per-frame
  (~600ms–2s cadence) so no OWN bench is required. Plus a live-turn example
  (`examples/live-turn.tsx`) composing all the M24 surfaces (M24 T5.1).

### Changed

- Extracted the reduced-motion gate to a shared `isMotionEnabled(env, stdout,
monochrome)` predicate (module-internal); `WelcomeBanner` now delegates its M12
  motion check to it (behavior-preserving — the animated tests are unchanged). The
  M24 phrase-cycler / shimmer opt-ins gate on the same predicate (M24 T1.1).

### Deprecated

### Removed

### Fixed

### Security

## [0.24.0] - 2026-07-09

### Added

- `ChoiceRow` — a horizontal fixed choice bar (❯ active marker, ←/→ wrap, Enter
  commit, Esc cancel, digit-key jump) plus the pure `agent-decision-model`
  (`resolveChoiceKey` oracle, `ApprovalDecision`/`ApprovalChoice`/`QuestionAnswer`/
  `PlanDecision` types, `DEFAULT_APPROVAL_CHOICES`) — the callback-only spine of the
  M23 agent-decision surfaces (M23 T1.1).
- `ApprovalPrompt` — a titled pending-action card whose preview is a `children`
  slot (the app composes `<DiffViewer/>` / a command line / any body — never a
  diff-prop union, so zero prop-forwarding), a `ChoiceRow` defaulting to
  once/always/reject (override-able), Enter commits, Esc → reject. The decision
  leaves via one `onDecision` callback; the component holds no app state (M23 T1.2).
- `QuestionPrompt` — a per-question header + question text + a composed M22
  SelectList (single or multi). With `allowFreeText`, an "Other…" option is
  injected that reveals a mini text input (over the M15 text-buffer reducer); the
  answer leaves via one `onAnswer({values,text})` callback, an empty submit is a
  no-op (M23 T2.1).
- `PlanApproval` — the plan-mode idiom: a proposed-plan markdown body (M13
  MarkdownText, streaming-safe) + a `ChoiceRow` of approve/revise; `revise`
  reveals a feedback input (empty allowed). Esc is a safe default → revise (never
  auto-approve). Decision via one `onDecision(PlanDecision)` callback. Plus the
  shared `FreeTextInput` (a minimal single-line input over the M15 text-buffer
  reducer) backing both QuestionPrompt's "Other…" and PlanApproval's revise
  branches — Esc cancels the free-text branch back to the parent (options /
  choice bar), so it is never a dead end (M23 T3.1).
- Agent-decision round-trip example (`examples/decisions.tsx`) — ApprovalPrompt
  (composing a DiffViewer) → QuestionPrompt (options + free text) → PlanApproval;
  plus a node-pty e2e driving one full approve flow over the real raw-mode path
  through the V4 renderer, and an overlay-integration test (Esc = reject + close)
  (M23 T4.1).

### Changed

### Deprecated

### Removed

### Fixed

### Security

## [0.23.0] - 2026-07-09

### Added

- Interaction-primitives example (`examples/interaction.tsx`) composing SelectList
  - an overlay-pushed Pager (a primitives demo, not an app picker), and a
    monochrome degrade test for the SelectList marker (M22 T4.1).

- Pager interaction primitive: a full-screen scrollable viewport over pre-wrapped
  content, on a new PURE `pager-model.ts` (bubbles-viewport port — clamp, percent,
  visible slice). Canonical less/vim keymap (↑/k, ↓/j, PgUp/PgDn or b/f page, C-u/C-d
  half-page, g/G top/bottom, q close) + a `line X–Y of Z · NN%` status line; reads
  the terminal height from `useStdout` and re-clamps on resize. Meant to be pushed
  as an overlay (M22 T3.1).

- Overlay/modal layer: `OverlayProvider` + `useOverlay()` — a stack of overlays
  rendered in-band above the thread on the M20 focus manager. Opening the first
  overlay saves + blurs the background focus and disables Tab (background goes
  inert / captures keys); the top overlay owns Esc-dismiss; closing the last
  overlay restores focus. Nesting is DEPTH-COUNTED (a push→push→pop keeps the
  background inert until depth 0 — the review-flagged boolean-isFocusEnabled bug
  fixed). A new `blur()` on the focus manager backs the capture (M22 T2.1).

- SelectList interaction primitive: a windowed list with prefix|fuzzy filter,
  single AND multi-select (by value, so it survives a fuzzy re-order), `❯` marker,
  ▲/▼ overflow + counter/checkboxes. Built on a new PURE `select-list-model.ts`
  whose `windowFor` is now the ONE authoritative trailing-window site — the M15
  slash-menu + M21 mention-menu delegate to it (DRY collapse, behavior-preserving,
  all existing menu tests unchanged). The component consumes OUR M19/M20 hooks
  (M22 T1.1).

### Fixed

- Pager: PgUp/PgDn keys now scroll a page (the M19 Key projection gained
  `pageUp`/`pageDown`); the status line is clipped to one row so it never steals a
  content row on a narrow terminal (M22 review). Nested-overlay state-loss
  documented (the covered overlay re-mounts on reveal).

## [0.22.0] - 2026-07-08

### Added

- ChatComposer `@`-file mentions + fuzzy matching: a hand-rolled subsequence
  fuzzy scorer (`fuzzy.ts`, ported from pi), an async `.gitignore`-aware cwd
  file-search provider (`file-search.ts`, DIP'd fs + the `ignore` package —
  bounded + abortable), and an `@`-mention menu (`mention-menu-model.ts`) that
  reuses the M15 slash-menu rendering — `@` triggers on the token at the cursor
  (mid-line), fuzzy-ranks file paths, and completes to a cwd-relative path
  (`complete-mention` reducer action). The `/` command menu is unchanged (prefix,
  line-start — ADR-C3 regression-guarded). New runtime dep `ignore` (MIT, no
  known CVEs). All new modules 100% lines (M21 T4.1).

- ChatComposer readline-grade editor upgrade: Emacs kill-ring (C-w/C-u/C-k/M-d +
  C-y yank, M-y yank-pop, with consecutive-kill coalescing), word navigation
  (M-b/M-f over graphemes), coalesced undo (C-_), and input history recall (↑/↓,
  gated to the first/last visual line). Built on a new PURE editor reducer
  (`composer-editor.ts`) bundling buffer + kill-ring + undo + history — 100% unit
  tested, no refs/timers; the composer is a thin dispatcher over the M19 keymap.
  Real-raw-mode PTY e2e drives the editor chords; an OWN editor micro-bench
  (`~3.8 µs/op`) is committed (M21 T3.1).

- Renderer V4 image core: `src/renderer/terminal-image.ts` — kitty + iTerm2 inline
  image encoders (with 4096-byte chunking), magic-byte dimension extraction
  (PNG/JPEG/GIF/WebP, no decode), cell-fit sizing, an env-based capability matrix
  (multiplexers + unknown terminals conservatively yield no-image → text
  fallback), and the `[Image: …]` fallback. Pure, 100% lines, env-injected tests
  (ported from pi) (M21 T1.1).
- Renderer V4 `<Image>` component + a raw-passthrough line convention: an image
  emits an `ink-image` host node carrying the protocol escape sequence + blank
  filler rows, routed to a new `Output.writeRaw` (width-exempt, emitted verbatim
  — an image escape would otherwise be corrupted by the cell-grid tokenizer). The
  image reserves the correct vertical space and a differential update BELOW it
  lands correctly (regression-tested, mirroring the M20 scroll-invariant engine);
  unsupported terminals get the text fallback (M21 T2.1).

## [0.21.0] - 2026-07-08

### Added

- Renderer V4 scrollback: Static-equivalent graduated history written once above
  the differential live frame — `OutputEngine.writeStatic` (relative-to-origin
  positioning), the live pass skips `internal_static` subtrees, and the renderer
  captures the static delta per-commit; Ink's `<Static>` works unchanged on the
  new engine. Plus our own `useStdout` (Ink's context is un-importable) provided
  by `createRenderer` (M20 T1.1).
- Renderer V4 focus manager: `useFocus`/`useFocusManager` + `FocusProvider` over
  our M19 InputSource — the ESC/Tab/Shift+Tab arbiter runs on a new priority
  input channel (before component `useInput`), matching Ink's App ordering the
  composer's ESC-refocus relies on. InputSource now flushes a lone ESC after a
  short delay (Escape-key delivery). Plus an ink-testing-library-shaped test
  adapter over the new renderer (lastFrame = scrollback + live) (M20 T2.1).
- Renderer V4 cutover evidence: 100% component parity (16/16 shipped components
  render byte-identical to Ink on the new renderer) + a comparative Ink-vs-V4
  benchmark showing V4 writes ~20× fewer bytes on a streaming ChatThread (1063 vs
  21840; ms/frame at parity). Parity report, comparative-bench report, and the
  conservative cutover ADR 0004 (Ink stays default+fallback, V4 opt-in, drop-Ink
  deferred to an owner-signed future ADR) (M20 T3.1).
- Renderer V4 scrollback correctness: the live frame is now positioned RELATIVE
  to a tracked cursor row instead of absolute screen rows, so a differential
  patch lands correctly even after graduated history has scrolled the terminal
  (the chat steady state) — fixes a frame-corruption defect found in M20 review
  (B1); regression test included.

## [0.20.0] - 2026-07-08

### Added

- M19 review fixes: the kitty handshake is now **emitted** — `createInputSource(stdin, writeToTerminal?)` writes the enable query on `start` and the disable pop on `stop` (the query a terminal replies to, so `isKittyActive()` is functional); the composer-compat proof now drives the ChatComposer's **real** `actionForKey` (exported) instead of a hand-copy (review m19-input-stack)

- M19 T3.1 (renderer input — composer compat + kitty + real-raw-mode e2e): proved M15's ChatComposer runs unchanged on the new stack (`composer-compat.test.tsx` drives the composer's `textBufferReducer` through our `useInput` — Ink-identical transitions); added kitty keyboard-protocol handshake + awareness (`kitty.ts`: enable/disable bytes + `detectKittyActive`, intercepted by `InputSource.isKittyActive()`, full CSI-u decode deferred to M21); and a **node-pty e2e that drives the REAL raw-mode path** (`stdin.isTTY===true`, real `setRawMode`) — **permanently closing the M15 EC-5 gap** (a submit whose handler throws surfaces the error + preserves the draft on the real pty). PTY tier SKIPs gracefully when node-pty's native module can't build (EC-7). All 7 input modules at 100% lines (plan m19-input-stack, ADR D5/D6)

- M19 T2.1 (renderer input source + hooks): `InputSource` (`input-source.ts`) — the raw-stdin lifecycle (multi-subscriber key + paste channels, ref-counted `setRawMode` so mounts/unmounts never thrash raw mode); `useInput`/`usePaste`-compat hooks (`use-input.ts`) over our own `InputContext` (no Ink StdinContext); and a remappable emacs keybindings registry (`keybindings.ts`: chord→action, `ctrl+w`/`ctrl+u`/`ctrl+k`/`alt+f`/`alt+b`/…). All at 100% lines, driven by a deterministic fake-stdin fast tier (plan m19-input-stack, ADR D1/D3)

- M19 T1.1 (renderer input parser): `src/renderer/input/` — a faithful port of Ink's byte framer (`input-parser.ts`: CSI/SS3/ESC-alt slicing, `pending` accumulation, bracketed-paste atomic framing, held-backspace-run splitting) + keypress semantics (`parse-keypress.ts`: the legacy path — arrows/ctrl/meta/shift/tab/escape/backspace/delete/return + the Ctrl+J-newline contract) + the 12-field `Key` projection (`key.ts`, matching `ComposerKey` exactly). All three at 100% lines; **ported, not imported** from `ink/build` (unblocks the M20 Ink-drop) (plan m19-input-stack, ADR D2/D4)

### Fixed

- Eliminated a load-dependent flake in `chat-composer.test.tsx` (M15): five frame assertions relied on a fixed 50 ms `settle` vs Ink's time-throttled render, failing ~1-in-2 under load; a poll-based `waitForFrame` now waits until the frame settles (deterministic — 5/5 green under load 9.4) (review m19-input-stack)

## [0.19.0] - 2026-07-08

### Added

- M18 review fixes: `commitUpdate` now diffs old vs new style and resets **removed** style keys (Ink's diff-with-undefined-deletes — a key toggled out across renders no longer keeps its stale yoga value); the parity gate gained a vacuity guard (empty frames can't count as a match), 3 breadth scenes (flex-grow / justify-content / wrap, with Ink as the oracle for the layout math), and an **SGR byte-parity check** proving our colored output is byte-identical to Ink; the layout bench now drives the **real `ChatThread`** (the M1 workload, ~2.6× faster than Ink) instead of a synthetic proxy (review m18-yoga-layout)

- M18 T3.1 (renderer Yoga paint + parity gate): `src/renderer/render-node.ts` (Ink's render-node-to-output + render-border + get-max-width ported — the laid-out-tree → cell-grid walk with borders and foreground colors) and a rewritten `renderer.ts` paint path (yoga `calculateLayout` at terminal width → `renderNodeToOutput` → cell grid → differential engine; the M17 `assembleLines` is deleted). Gated by `tests/renderer/parity-corpus.test.tsx`: **all 11 corpus scenes render byte-identical to Ink** (100%, exceeding the ≥ 90% DoD) — the M17 layout gaps (nested-row, padding, width/wrap, borders) are now correct; parity documented in `docs/renderer/m18-parity-report.md`. Bench: the full layout+render pipeline is **~3.9× faster than Ink** (5.2 vs 20.2 ms/frame on a 30-message thread). `<Box>`/`<Text>` now render on the own renderer with real flexbox layout (plan m18-yoga-layout, ADR D2/D4/D5)

- M18 T2.1 (renderer text measurement + cell grid): `src/renderer/text-measure.ts` (Ink's measure-text / wrap-text / squash-text-nodes / measureTextNode ported over `widest-line`/`wrap-ansi`/`cli-truncate`/`string-width` — the yoga measure func + the wrap/truncate-end/truncate-start/CJK/`<1px`-guard behaviors) and `src/renderer/output-grid.ts` (Ink's `output.js` cell-grid ported, minus clips: a height×width styled-cell buffer that preserves trailing padding rows, handles wide chars, applies per-line transformers, and trims trailing space — byte-parity via `@alcalzone/ansi-tokenize`). host-config now binds the measure func to each `ink-text` yoga node, so `calculateLayout` sizes text. Both new files at 100% lines (plan m18-yoga-layout, ADR D2/D3)

- M18 T1.1 (renderer Yoga tree): `src/renderer/yoga-style.ts` — a faithful port of Ink's `styles.js` (`applyStyles(yogaNode, style)`, the full flexbox prop set: position/margin/padding/flex/dimensions/display/border/gap) driving the same `yoga-layout@3.2.1` WASM engine Ink uses (parity by construction). The renderer's host-config now attaches a yoga node per Box/top-level-Text, mutates the yoga tree on append/insert/remove, frees WASM nodes on removal (no leak), and treats a `<Text>` nested inside `<Text>` as virtual (no yoga node). yoga-style + host-config at 100% lines; `yoga-layout` joins the runtime dep graph (plan m18-yoga-layout, ADR D1/D4)

### Fixed

- The exported `VERSION` constant now tracks the manifest (0.18.0). The v0.18.0 release bumped `package.json` but not `src/index.ts`, so the two briefly disagreed — caught by the `public_entry_exposes_version_constant` guardrail

## [0.18.0] - 2026-07-08

### Added

- M17 review fixes: `Renderer.stats()` exposes the differential engine's `fullRedrawCount` + `lastRedrawReason` through the public seam (the D2 observability pillar); `host-config` gained the Offscreen/Suspense `hide/unhide` stubs (no swallowed commit-phase throw). The `m17-parity-report.md` now enumerates the nested-box / newline-in-row / over-viewport divergences as reachable-but-deferred-to-M18 (review m17-renderer-skeleton, wiring + domain findings)

- M17 T3.1 (renderer wiring + evidence): the `@theokit/tui/renderer` subpath export (types-first ESM, `publint`-clean), an `examples/renderer-skeleton.tsx` live ticker mounted through the own renderer (`pnpm example:renderer`), and the first **dual-engine bytes benchmark** (`benchmarks/renderer-skeleton.bench.tsx` + committed baseline): on a 200-line + 60-update script the differential engine writes **29× fewer bytes** than Ink's full-frame model (20 000 vs 584 472) and renders ~6× faster (7.9 vs 48.0 ms/frame). A `docs/renderer/m17-parity-report.md` documents the line-by-line Ink parity on the text scene and the divergences deferred to M18 (Yoga layout) (plan m17-renderer-skeleton, ADR D4)

- M17 T2.1 (renderer reconciler host): a custom `react-reconciler` ^0.33.0 host (`src/renderer/host-config.ts`, Ink 7's mutation-mode hook subset reduced to text) and `createRenderer(terminal)` (`src/renderer/renderer.ts`) that mounts a React tree through the differential engine — commits coalesce via a microtask (N commits/tick → one paint), `unmount` restores the cursor. Verified against the `@xterm/headless` screen oracle, including a **byte-parity gate vs Ink** on a `<Box flexDirection="column">` Text scene (passes line-by-line). Exposed at the `@theokit/tui/renderer` subpath only — the root entry is unchanged. `react-reconciler` joins the runtime dep graph (plan m17-renderer-skeleton, ADR D1 / 0003)

- M17 T1.1 (renderer walking skeleton): the `src/renderer/` island — a `Terminal` seam (interface + `ProcessTerminal`), a differential `OutputEngine` porting pi/tui's strategy ladder (first-render / line-diff / deleted-tail / width-and-height full-redraw with logged reason), all writes wrapped in CSI-2026 synchronized output, and a `@xterm/headless` `VirtualTerminal` test oracle that asserts on REAL emulator screen state. Engine at 100% line/branch/func coverage, 180 LoC, zero Ink imports (M17 renderer program — ADR 0003, plan m17-renderer-skeleton)

- ROADMAP V4 expanded from the 7-peer parity matrix (`docs/v4-parity-matrix.md`): added M22 interaction primitives (SelectList/overlay/pager), M23 agent decision surfaces (approval/question/plan), M24 live progress surfaces (todo/progress/collapsible/toast), M25 parity polish + matrix re-audit (exit gate); tau + opentui reference rows added

- SOTA reference: `tau` (huggingface, MIT) — the 7th parity peer named for the V4 component-parity criterion (Python coding agent, src/tau_coding/tui)

- SOTA reference for V4: `opentui` (sst, MIT) — the direct peer of the renderer program (custom TUI engine with react-reconciler ^0.33.0 bindings, the same pin as ink 7 and our M17 plan)

- ROADMAP V4 (renderer program, owner decision — ADR 0003): M17 walking skeleton (react-reconciler + CSI-2026 + @xterm/headless harness), M18 Yoga layout + Box/Text parity, M19 input stack (bracketed paste, keybindings, PTY e2e), M20 scrollback + migration + cutover gate, M21 premium capabilities (inline images, rich editor, fuzzy+paths); the "no homegrown TUI framework" out-of-scope item removed with a dated note

- SOTA references extended for the V4 gap analysis: `pi` (earendil-works, MIT — standalone TUI framework: differential rendering, CSI-2026, bracketed paste, rich Editor, fuzzy autocomplete), `agent-tui` (MIT — PTY automation harness for driving TUIs from agents), `conduit` (MIT, Rust/ratatui — team-of-agents UX)

- `examples/showcase.tsx` (`pnpm example:showcase`) — every shipped primitive in ONE scripted agent turn: animated WelcomeBanner in the ChatThread header slot, markdown assistant reply, per-kind ToolCallCards (diff/output/preview), AgentStreaming driven by useTurnElapsed, ContextWindowBar + CostMeter, AppStatusBar and the slash-command ChatComposer (interactive runs); piped runs play the script deterministically and exit — pinned by a per-surface smoke

### Fixed

- M16 `ToolCallCard` snapshot tests: eliminated a [NEEDS-REPRO] flake (review r1-F1) where the diff/preview-with-language variants captured plain-vs-highlighted output nondeterministically — CodeBlock/DiffViewer async-load lowlight via a module-cached promise, and whether the re-render flushed inside `renderFrame`'s 0ms tick depended on cross-worker cache warming; a `beforeAll(preloadHighlighter)` now forces the highlight state deterministic (0/10 full-suite runs flaked, verified under load)

## [0.17.0] - 2026-07-08

### Added

- `examples/stream.tsx` renders per-kind tool-detail cards after the turn (diff/output/preview — the direct-composition route for `ToolCallCard.result`); smoke pins the three shapes under the pipe contract; done-exit delayed one breath so the post-stream frame is the final piped frame (m16-tool-card-variants T2.1)

- `ToolCallCard` `result?: ToolCardResult` — explicit per-kind bodies over the existing primitives: `{kind:"diff"}` → DiffViewer (malformed patch throws the typed error AT the card boundary — a child render throw is silently swallowed by ink's error boundary, probed), `{kind:"output"}` → ToolResult shell envelope, `{kind:"preview"}` → capped CodeBlock (with language) or plain lines; children coexist BELOW the result body; `ToolCardResult` exported (m16-tool-card-variants T1.1)

### Fixed

- `ToolCallCard` diff result: the `fileName` prop was removed before release (it duplicated DiffViewer's own header row in every scenario and shipped without an oracle — review convergence); the boundary-validation comment now states the PROVED contract (plain-call testability + boundary stack; under a mounted ink render any throw is absorbed and surfaces via waitUntilExit); preview cap-semantics asymmetry documented; passthrough and tail-trailer oracles added (m16 review batch)

## [0.16.0] - 2026-07-08

### Added

- `examples/chat.tsx` registers slash commands + hint on the composer (interactive-only — raw-mode stdin; unit fake-stdin scripts are the deterministic evidence); OWN typing bench (`benchmarks/chat-composer.bench.tsx`): menu 8.03 ± 0.63 vs plain 5.99 ± 0.03 ms/keystroke — the +2.04 ms delta is the honest cost of an OPEN 50-row menu on every keystroke (the first draft's script let the menu close and understated it ~7×; caught at review, workload fixed with a fail-fast open-menu guard and baseline re-recorded) (m15-composer-autocomplete T3.1 + review F-1)

- `ChatComposer` slash-command menu: `commands` prop (`{name, description}`, declarative — completion only edits the buffer), prefix filter on the first `/`-token of line 1, ↑↓ selection with wrap + 5-row sliding window (▲/▼ + counter), Tab/Enter completion to `/name `, Esc dismissal latch (typing reopens; the composer re-takes focus — ink's global ESC-blur runs first by design), `hint` affordance line; menu keys never leak into the buffer (m15-composer-autocomplete T2.1)

- `slash-menu-model` (internal): pure slash-menu derivation — codex token-filter contract (first token after `/` on line 1), prefix matching, selection clamp, 5-row sliding window with overflow flags; `text-buffer` gains the `complete-command` action (line 1 becomes `/name `, cursor after the space) (m15-composer-autocomplete T1.1)

### Fixed

- `ChatComposer` slash menu: a multiline draft now CLOSES the menu (Enter submits — it hijacked the submit into a completion before); long descriptions truncate instead of interleaving with the name column; prefix matching gained its substring negative (review-survived mutant killed); hint dimness, tab trailing-space and negative-anchor oracles strengthened (m15 review batch)

## [0.15.0] - 2026-07-08

### Added

- OWN render bench for the status bar (`benchmarks/app-status-bar.bench.tsx` — the ticking 1 Hz hook path IS a per-frame path): ticking mode wall 10020 ± 1 ms (10 real 1 s ticks, ~1 frame/s), static-presence rerender cost 14.4 ± 0.1 ms/frame at load 1.95; baseline committed with contract test (m14-status-bar T2.2)

- `examples/chat.tsx` mounts the AppStatusBar under the thread (model · cwd · tokens · state) and drives `AgentStreaming elapsedSeconds` through `useTurnElapsed` during the scripted turn; smoke pins the bar below the thread with its separators (m14-status-bar T2.1)

- `AppStatusBar` — the persistent AI-native status line (model · cwd · tokens · state): dim `·` separators between PRESENT slots only, cwd tildeified with truncate-start (path tail survives narrow widths), tokens compacted via formatTokens, typed validation; exported from the package entry (m14-status-bar T1.2)

- `useTurnElapsed(active)` — the lib-shipped 1 Hz turn clock for `AgentStreaming.elapsedSeconds` (0 while inactive, resets on re-activation, cleared on deactivate/unmount; AgentStreaming's no-timer contract untouched) (m14-status-bar T1.1)

### Fixed

- `AppStatusBar`: separators no longer shrink before the cwd slot (they collapsed under squeeze), the tokens slot clips VISIBLY with an ellipsis instead of silently showing a wrong limit, empty-string slots are treated as absent (no dangling `·`), and `tildeify` respects the path boundary (`/home/user-backup` is not inside `~`); per-axis token negatives + a width-fit oracle kill the two review-survived mutants (m14 review batch)

## [0.14.0] - 2026-07-08

### Added

- `ChatThreadMessage.markdown?` — per-message opt-in routed to the row's ChatMessage (unflagged rows byte-identical); `examples/chat.tsx` ships a markdown-rich assistant reply (smoke pins rendered shapes, not markers); chat-message bench gains a `markdown` mode (markdown-rich streaming tail re-parses per repaint — plain 32.1±1.7 vs markdown 42.0±2.1 ms/frame at load 0.82, honest per-frame parse+highlight cost) with the legacy plain shape preserved (m13-markdown-renderer T3.1)

- `MarkdownText` — assistant-text Markdown renderer (AI-chat subset: headings 1-4, ul/ol lists, hr, paragraphs, fenced code via the existing `CodeBlock`; inline bold/italic/bold-italic/strikethrough/verbatim code spans/links/bare URLs), theme-token styled (monochrome themes keep bold/italic SGR, drop color); exported from the package entry. `ChatMessage` gains opt-in `markdown` (default false — raw text stays byte-identical; requires string children, TypeError otherwise) (m13-markdown-renderer T2.1)

- `markdown-model` (internal): pure AI-chat markdown subset parser — headings 1-4, ul/ol, hr, paragraphs, length-matched code fences (unclosed fence at EOF still emits code — streaming-safe), inline bold/italic/bold-italic/strikethrough/verbatim code spans (backreference-matched, handles ``a`b``)/links/bare URLs; malformed markers fall through as literal, never throw; zero deps, zero ink imports (m13-markdown-renderer T1.1)

- Roadmap amended (V3 series): added M13 Markdown renderer, M14 Composed status bar + turn elapsed, M15 Composer slash autocomplete + keyboard affordances, M16 ToolCallCard rich variants (`/roadmap-feature`, batch — all depend on M12; gap table from the TheoCode dogfood vs Claude Code/Codex/Gemini/OpenCode/Mastra); SOTA references extended with mastra/mastracode (Apache-2.0 — `ee/` dirs enterprise-licensed, excluded from study)

### Fixed

- `markdown-model`: italic now respects the gemini path guards (asterisk runs between path separators stay literal — `ls src/*x*/y` no longer italicizes) and the fence close-length rule gained its missing oracle; `ChatMessage` default-off contract now pinned by a live byte-compare incl. explicit `markdown={false}` (two review-survived mutants killed) (m13 review batch)

## [0.13.0] - 2026-07-08

### Added

- `WelcomeBanner` `animated?: boolean` — opt-in < 2 s typewriter reveal (12 phases × 80 ms, bounded and self-clearing). Mount-time gate stack evaluated once: interactive TTY + rows ≥ 15 + columns ≥ 44 + non-monochrome theme + `THEOKIT_TUI_NO_MOTION` unset (any non-empty value disables motion — the end-user reduced-motion override). Everywhere the gate is closed — and at convergence — the render is the exact static banner tree, byte-identical by construction (m12-animated-banner T1.1)
- `examples/banner.tsx` opts into the animated reveal (interactive terminals get the < 2 s typewriter; piped runs stay on the static path — pipe smoke pins the static scene printing exactly once) + one anchored mid-reveal snapshot (m12-animated-banner T2.1)
- OWN render bench for the reveal (`benchmarks/welcome-banner.bench.tsx` — the recorded M9 flip condition fired): reveal mode under real timers (measured wall 967.6 ± 2.1 ms < 2 s DoD, load-gated 1.67) + static rerender mode (10.7 ms/frame); baseline committed at `docs/benchmarks/m12-welcome-banner-baseline.json` with a contract test (m12-animated-banner T2.2)

### Fixed

- `WelcomeBanner` animated: phase-0 frame no longer collapses to a 2-line box (empty name row now renders a space placeholder — no layout shift on the first tick); gate legs `columns >= 44` and monochrome-theme now each have a dedicated oracle (both had empirically survived mutation at review) (m12 review batch)

## [0.12.0] - 2026-07-08

### Added

- `ChatThread` `header?: ReactElement` — folded as the FIRST item of the thread's own `<Static>`, pinned above graduated scrollback (resolves the recorded M9 banner-sinking drawback). MOUNT-TIME prop: the first render's value is frozen; later content/identity/presence changes are ignored by design (the ink Static index advances by length only — a shrinking union would permanently skip freshly graduated rows). Reserved id `__theokit_tui_header__` now always rejected; `AgentTimeline` gains the mirrored `header?` slot with the same contract (+1 anchored snapshot) (m11-chatthread-header-slot T1.1+T1.2)
- `examples/chat.tsx` mounts the WelcomeBanner in the ChatThread header slot (smoke pins presence, order and print-once); the degrade-matrix fixture moves the banner INTO the slot — all three degraded scenes now exercise header-in-Static (m11-chatthread-header-slot T2.1)
- `examples/stream.tsx` mounts a WelcomeBanner in the AgentTimeline header slot — production caller for the timeline mirror; smoke pins presence + order (m11 review F-2)

## [0.11.1] - 2026-07-08

### Changed

- `ToolCall` summary now renders dim-only (not bold+faint) on bold-capable terminals — ink 7 closes bold before opening dim; docblock updated, snapshots pinned at M10 (m10 review LOW)

### Fixed

- CI: full-history checkout (`fetch-depth: 0`) — the never-weaken migration guard diffs against the M10 base SHA and errored on shallow clones (m10 review HIGH)
- Review-batch guards: snapshot re-record review guard test, TTFATT 0.11.0 pin, strict-effects canary NODE_ENV precondition, stack-provenance itl assert, never-weaken guard fails loud on unexpected git errors + sunset note (m10 review batch)

## [0.11.0] - 2026-07-07

### Added

- Bench baselines re-recorded on the new stack with a `stack` provenance field; the 20-metric cross-stack jump table (all deltas explained by an isolated ink5-vs-ink7 engine A/B: ~6.5× wall / ~40× CPU-pure per rerender on the debug path) lives at `implementations/m10-bench-jump-table.md` (m10-react19-ink7 T2.2)
- Strict-effects canary (`tests/strict-effects-canary.test.tsx`) — pins the OBSERVED single-invoke behavior under StrictMode on ink7 (the source-level prediction of a double-invoke flip was empirically refuted; the M7 DV-1 claim remains true) (m10-react19-ink7 T2.1)
- ink7 pipe-contract pin in the degrade matrix (non-interactive writes ONE final frame at unmount — content appears exactly once) and a permanent never-weaken migration guard (it-count never decreases vs the pre-bump base) (m10-react19-ink7 T1.2+T1.3)

- Roadmap M10 DoD revised pre-lock: dual React peer is impossible on modern ink (every ink ≥ 6.0.0 requires `react >= 19`, registry-verified) — M10 targets ink ^7 + react `^19` peer; react-18 consumers stay on the 0.10.x line
- Roadmap V2 amended: added M10 Foundation upgrade (ink 7 + dual React peer), M11 ChatThread/AgentTimeline header slot, M12 Animated welcome banner (`/roadmap-feature`, V2 batch — dependencies M8→M10→{M11, M12})
- TTFATT record `docs/ttfatt.md` — 16.3 s measured from the published registry artifact (install 13.7 s + first rendered turn 2.6 s; target < 10 min), pinned by a package-contract test (m8-ga-publish T2.2)

### Changed

- Requires: react >= 19.2.0 (peer, was ^18.2.0) and node >= 22 (engines, was >= 20) — the foundation moved to ink ^7.1.0 (every ink >= 6 is react-19-only); the 0.10.x line remains the ink5/react18 track (m10-react19-ink7 T1.1)
- Snapshot resequencing: ink 7 closes bold (`[22m`) before opening dim — 2 snapshot files re-recorded with per-diff review (visible text byte-identical; border glyphs zero-diff, cli-boxes 4 proven glyph-stable) (m10-react19-ink7 T1.4)

## [0.10.0] - 2026-07-07

### Added

- Publish readiness: `publint --strict` clean (new devDependency, audit clean), manifest publish fields (description/keywords/`prepublishOnly` gates+build) pinned by a package-contract test; AI-native README (outcome-shaped HERO, quickstart with resolving symbols, public-copy-compliant — banned-claim lint runs in the suite) (m8-ga-publish T1.1+T1.2)
- `examples/live-agent-tui.tsx` (`pnpm example:live`) — a REAL LLM turn streamed through `useAgentStream` using only @theokit/tui primitives (OpenRouter SSE via global fetch, zero deps, caller-side transport per the M7 contract); gated on `OPENROUTER_API_KEY` — absent key renders an instructive scene and exits cleanly (deterministic smoke) (m8-ga-publish T2.1)

### Fixed

- React peer range corrected to `^18.2.0` — the previous `^18 || ^19` shipped a broken fresh-install (ink 5's reconciler does not run on React 19; caught by the pre-publish tarball rehearsal, never reached the registry); README install line fixed accordingly (`ink` is a dependency — never install it separately) (m8-ga-publish T2.2)

## [0.9.0] - 2026-07-07

### Added

- `WelcomeBanner` — Claude Code/gemini-cli-style startup banner primitive: `name`/`version?`/`tagline?`/`hints?` + single `children` slot; accent-bordered box clamped to `min(columns ?? 60, 60)` with a plain-text final rung below 24 columns; border style is theme-data-driven (`single` under monochrome themes, `round` otherwise); fail-fast typed prop validation; zero new dependencies; exported from the package entry, composed-scene snapshot, degrade-matrix coverage in all three scenes with per-scene border policy; deterministic `examples/banner.tsx` demo (`pnpm example:banner`) + non-TTY subprocess smoke (m9-welcome-banner T1.1+T2.1+T2.2)
- Roadmap amended: added M9 Welcome banner (`/roadmap-feature welcome-banner`); SOTA references extended with opencode (MIT), oh-my-logo (MIT+CC0), ascii-motion (MIT) — crush excluded by license gate (FSL-1.1)

### Fixed

- `WelcomeBanner`: empty/whitespace `version` now renders as absent (never a dangling ` v`); width contract documented honestly (columns frozen at render — ink does not re-render React on resize); behavioral oracles added for the hints margin gap and floor-rung truncation (m9-welcome-banner review F-1/F-2/F1/F2)
- Manifest `version`/`VERSION` synced to the released tag (the v0.3.0–v0.8.0 split-release chain had not bumped `package.json` — caught by the entry-surface contract before any npm publish)

## [0.8.0] - 2026-07-07

### Added

- Stream adapter wired through the composition root: `useAgentStream`/`agentStreamReducer`/`initialAgentStreamState` + types exported from the package entry; composed integration scene + anchored snapshot; deterministic `examples/stream.tsx` demo (`pnpm example:stream`) driving AgentTimeline/AgentStreaming through the real hook with done-gated exit (m7-stream-adapter T3.2)
- Drift tripwire against the real `@theokit/sdk` (devDependency `^2.19.0`, import-type-only): compile-time whole-union + per-member assignability checks plus a canonical runtime fold contract test — a stream-shape drift in a new sdk minor now fails `pnpm typecheck` at install time naming the member (m7-stream-adapter T3.1)
- `useAgentStream(source?)` hook (module `src/use-agent-stream.ts`) — consumes an async-iterable stream (or factory) and folds it through `agentStreamReducer`; cancelled-flag-after-every-await loop, `iterator.return` teardown, state reset on source change, `cancel()` escape hatch, sync-throwing/failing sources become the error state; reconnect proven both ways — producer-side exactly-once resume and reset-and-refold total replay (m7-stream-adapter T2.1+T2.2)
- `agentStreamReducer` + `initialAgentStreamState` pure mapping fold (module `src/agent-stream-reducer.ts`) — folds SDK stream events onto the M3 `AgentEvent` timeline: tail-replace live message, close-on-effectful-fold, thinking graduation, namespaced ids, shell⊕output ladder, terminal `done`/`error` fails open tools and drops later events (m7-stream-adapter T1.2)
- `AgentStreamEvent` structural stream-event union (module `src/agent-stream-event.ts`) — designed fresh from the real `@theokit/sdk` tables (coarse `SDKMessage` + fine `onDelta` vocabularies under their REAL names; `message` widened for the status-event string arm); shell-envelope and assistant-text guards with string-when-present validation (m7-stream-adapter T1.1)

### Fixed

- Stream reducer: thinking graduation now closes an open live message first — a thinking burst between text deltas no longer makes later deltas replace a non-tail timeline event (frozen scrollback under windowing); late result-less tool updates preserve already-folded shell/output; the hook's internal reset is envelope-guarded so a stream event `{type: "__reset__"}` can never wipe folded state; teardown `iterator.return()` rejections are swallowed at the only place they can be handled (m7-stream-adapter review fixes F-1/F-2/F-4/F-6)

### Security

- Transitive `esbuild` advisory (GHSA-g7r4-m6w7-qqqr, LOW — dev-server file read on
  Windows; devDependency via tsup) resolved with a pnpm override to `>=0.28.1`;
  `pnpm audit` clean

## [0.7.0] - 2026-07-07

### Added

- Degrade matrix (`tests/degrade-matrix.integration.test.tsx`) — THREE subprocess scenes of ONE provider-wrapped all-primitives probe fixture (NO_COLOR / TERM=dumb / bare-pipe), with a byte-equality invariant between the NO_COLOR and TERM=dumb renders (modulo the composer cursor marker) and a chalk hex→ANSI-256 downsample canary pinning the installed rounding; the probe fixture gains ChatComposer + CodeBlock (every primitive now degrades under test) (m6-theme-robustness T3.2)
- Theme-invariance test — `stripAnsi(light/no-color frame) === stripAnsi(dark frame)`: theming may change ONLY color bytes, never text/layout; plus ONE composite light-theme snapshot and a theme showcase demo (`pnpm example:themes`) (m6-theme-robustness T3.2)
- Built-in themes `themes.dark` (≡ `defaultTheme`), `themes.light` and `themes["no-color"]` — named ANSI-16 values only (chalk-version-proof, level-pin-proof); the provider `theme` prop now also accepts a built-in name or `{ base, override }` with an EXPLICIT base (existing override objects unchanged — the M0 call sites compile and behave identically) (m6-theme-robustness T1.2)
- `NO_COLOR` support implemented at the theme layer — a non-empty `NO_COLOR` env resolves the no-color built-in (full swap: ALL overrides including glyphs revert to defaults), read once per provider mount, never per frame. NOTE: the installed ink→chalk chain never reads `NO_COLOR`; handling requires mounting `TheoTUIProvider` (m6-theme-robustness T1.2)
- `TheoTheme` semantic growth — `name` (theme identity), `accent`, `code.*` (7 syntax-highlight bucket colors) and `toolStatus.*` (glyph+color per tool status; `running` is color-only — the spinner animates) token groups, all overridable via `TheoThemeOverride` with the same leaf-preserving merge; defaults are byte-identical to the M0-M5 constants they will replace (m6-theme-robustness T1.1)

### Changed

- Metrics accent moved to the `theme.accent` token — the duplicated `ACCENT_COLOR` constants in ContextWindowBar/TokenUsageChart deleted; default bytes unchanged (m6-theme-robustness T2.3)
- Syntax-highlight colors moved to `theme.code.*` bucket tokens — `HLJS_COLOR_MAP` deleted; the hljs class→bucket table stays module-local; default bytes unchanged (m6-theme-robustness T2.2)
- Tool-status visuals moved to `theme.toolStatus.*` tokens — `STATUS_VISUALS` deleted; BEHAVIOR NOTE: the pending glyph's color is now the `toolStatus.pending.color` token literal and no longer follows `role.system.prefix` overrides (theme `toolStatus.pending.color` instead); default bytes unchanged (m6-theme-robustness T2.1)
- `TheoTheme` (the OUTPUT type of `useTheoTheme`) gained required groups — consumers who hand-built a full `TheoTheme` object must spread `defaultTheme` (`{...defaultTheme, ...}`); override-based usage is source-compatible and unchanged (m6-theme-robustness T1.1)

### Fixed

- `ChatComposer` cursor was invisible under color-less rendering (chalk level 0 strips the `inverse` attribute) — under the `no-color` theme a visible `▏` marker now carries the cursor affordance (colored-mode bytes unchanged; NO_COLOR remains the opt-out for dumb interactive terminals) (m6-theme-robustness T3.1)

## [0.6.0] - 2026-07-07

### Added

- Metrics-footer benchmark (`benchmarks/metrics-footer.bench.tsx`) — 50-message streaming thread × 150 ticks, with-metrics|without-metrics matrix; committed baseline shows the footer costs **1.00 ± 0.31 ms/frame** in the streaming hot path (3.684 ± 0.309 vs 2.682 ± 0.058 ms mean; conclusive at >1σ; peak delta 3.22 ms vs σ 2.46 — also conclusive, σ-inflated by one outlier run) (m5-metrics-surface T3.2)
- Metrics demo (`pnpm example:metrics`) — always-on agent footer (context gauge + category bars + cost), static scene, clean piped output (m5-metrics-surface T3.2)
- M5 integration coverage — composition-root metrics footer scene (gauge + chart + cost), NO_COLOR probe metrics scene proving glyph-distinct `█`/`░` fill readable without color (m5-metrics-surface T3.1)
- `CostMeter` — honest USD cost display (`cost ~$1.23`): caller-computed number (no pricing tables), `~` estimate marker with `approx={false}` opt-out, `<$0.01` sub-cent honesty — never `$0.00` for a nonzero cost (m5-metrics-surface T2.3)
- `TokenUsageChart` — per-category token bars (`input | output | cached | reasoning`, fixed order, only present keys render): bars scale to the LARGEST category (relative comparison — total is not a limit), aligned label/value columns, k/M values, all-zero renders empty bars, all-absent renders nothing (m5-metrics-surface T2.2)
- `ContextWindowBar` — context-window fill gauge with data-props contract (`usedTokens` + optional `limitTokens` — never a model registry): `% left` (default, with dim `(used / limit)` detail) or `% used` conventions both derived from ONE display authority; unknown limit renders the absolute count only (never a fabricated percentage); over-limit clamps the bar and colors it as error; opt-in codex-parity `baselineTokens`; warning at ≥ 50% used; label-only degrade below a 3-cell bar floor (m5-metrics-surface T2.1)
- Pure metric formatters (`src/format.ts`, module-internal) — `formatTokens` lowercase k/m with half-up 1-decimal rounding AND boundary promotion (`999_950 → "1m"`, never the analog "1000K" anomaly); `formatCost` honest USD (`~$1.23` estimate marker, `<$0.01` sub-cent — never `$0.00` for nonzero, thousands separators) (m5-metrics-surface T1.2)
- Pure fill-bar core (`src/fill-bar.ts`, module-internal) — `renderFillBar` glyph-distinct `█`/`░` segments + `formatPercent`/`displayPercent` as THE single endpoint-honest rounding authority (100% reserved for truly-full, 0% for truly-empty; label and bar can never disagree); integer-numerator fill math immune to the verified `p/100*w` float divergences (m5-metrics-surface T1.1)

## [0.5.0] - 2026-07-07

### Added

- Diff-viewer benchmark (`benchmarks/diff-viewer.bench.tsx`) — growing multi-hunk diff (10+40 hunks, wide-line hunk appended mid-loop with a fail-fast self-check), windowed|full matrix; committed baseline shows windowing ~12× faster per frame (9.2 ± 1.0 vs 114.1 ± 4.9 ms mean; peak 16.1 ± 1.9 vs 216.0 ± 28.2) (m4-code-surface T3.2)
- Code-surface demo (`pnpm example:code`) — diff + highlighted code block, static scene, clean piped output (m4-code-surface T3.2)
- M4 integration coverage — composition-root diff+code scene, NO_COLOR probe diff (signs + fold indicator readable without color) (m4-code-surface T3.1)
- `CodeBlock` — syntax-highlighted code rendering with `lowlight` as an OPTIONAL peer (dynamic import, single-flight; absent peer degrades to plain text with one console hint); explicit `language` only (no auto-detect — determinism), 4-level fallback ladder, ANSI-sanitized input, tab expansion, optional original-numbered gutter, HEAD-retained `maxLines` cap (m4-code-surface T2.1)
- `DiffViewer` — UNIFIED terminal diff renderer (split view deferred with a recorded verified-absence rationale — no terminal analog ships it): unconditional `+`/`-` sign column (the NO_COLOR mechanism), dim line-number gutter, per-file header with rename arrow + `+N`/`-M` stats, dim `⋮` hunk gaps, wrap-never-truncate content, `contextLines` folding + global HEAD-retained `maxLines` cap, explicit `(no changes)`/binary rows, typed malformed-patch error (m4-code-surface T1.2)
- `parseUnifiedDiff` — typed multi-file unified-diff model (`DiffFile`/`DiffLine`, CRLF stripped, `\ No newline` suppressed, `/dev/null` → absent names, binary/mode-change = zero-line files) built on `parse-diff`; typed error on unparsable patches; pure `foldDiffLines` context folding (m4-code-surface T1.1)

### Changed

- Review-batch hardening (m4-code-surface review 2026-07-07): `preloadHighlighter()`
  promoted to the public entry (one-shot/static renders could never capture a highlighted
  frame — published consumers had no readiness seam; logged divergence DV-5); DiffViewer
  cap trailer now counts SOURCE lines (a dropped fold row hid its whole run from the
  count); loader distinguishes lowlight-absent from lowlight-broken in its one-time hint;
  `⋮` hunk gaps indent under the gutter; `DiffFold`/`DiffRow` types withdrawn from the
  entry (module-internal per plan D10); lowlight devDependency exact-pinned (snapshot
  drift budget); bench gains a windowing-active mount self-check + a negative wide-hunk
  guard; oracle hardening across suites (fresh-registry plain-first proof, fold edges,
  width-matrix positive anchors, backslash/quoted-name pins, example highlight-byte
  assert). The `diff` AgentEvent variant remains deferred to M5+ (M3 note kept traceable)

## [0.4.0] - 2026-07-07

### Added

- `AgentEvent` union (`kind: "message" | "thinking" | "tool"`, caller-provided ids) + `AgentTimeline` — ordered agent-turn timeline dispatching to `ChatMessage`/thinking rows/`ToolCallCard`+`ToolResult`, with full boundary validation (duplicate id, unknown kind, invalid role/status, `output`⊕`shell` exclusivity → typed `AgentTimeline:` errors) (m3-agent-surface T1.1)
- `AgentTimeline` windowed `<Static>` history — events beyond `windowSize + windowOverscan` graduate into frozen terminal scrollback; identity-memoized rows keep streaming repaints scoped to the tail (M1 windowing contract, sibling implementation) (m3-agent-surface T1.2)
- `AgentStreaming` — dumb one-line live indicator (spinner + italic thought with `Thinking…` fallback + optional dim `(esc to cancel, 2m 5s)` suffix); elapsed arrives as a prop, ticking is the caller's concern (m3-agent-surface T2.1)
- Agent-surface integration coverage — representative multi-event-turn snapshot (thinking → tool running → tool success → assistant message), composition-root agent scene, NO_COLOR probe with thinking + streaming rows (m3-agent-surface T3.1)
- Agent-timeline benchmark (`benchmarks/agent-timeline.bench.tsx`) — 300 mixed events (50/30/20 message/tool/thinking incl. one 500-line output) streaming+appending under windowing, bounded|unbounded `maxLines` matrix; committed baseline `docs/benchmarks/m3-agent-timeline-baseline.json` (5 runs/mode, pinned env, peak = heterogeneous-heights metric) (m3-agent-surface T3.2)
- Agent-turn demo (`pnpm example:agent`) — scripted thinking → running tool → success → message with a live elapsed ticker; renders the final scene statically when piped (m3-agent-surface T3.2)
- `CHAT_ROLES` and `TOOL_CALL_STATUSES` runtime union arrays exported (single-source derivation of the existing `ChatRole`/`ToolCallStatus` types) (m3-agent-surface T1.1)

### Changed

- Review-batch hardening (m3-agent-surface review 2026-07-06): agent-timeline bench
  tall-item fixed twice over (index 42 landed in a MESSAGE slot and never rendered; index
  45 graduated at mount, outside the sampled steps — now APPENDED mid-loop with a fail-fast
  workload self-check) and the baseline regenerated with a conclusive ~5.5× unbounded peak
  (51.05 ± 9.25 vs 9.19 ± 1.83 ms); thinking rows now use a distinct `•` glyph (the system
  role's `·` was indistinguishable under NO_COLOR); AgentStreaming cancel-hint suffix no
  longer wraps at narrow widths (`truncate-end` + width-30 regression test) and invalid
  `elapsedSeconds` is pinned to throw even with the hint hidden; tool-tail repaint oracle,
  M1-parity finiteness asserts and line-anchored glyph oracles added; shared internal
  `unionMessage` helper (rule-of-3) with ChatMessage's role union now derived from
  `CHAT_ROLES`; `AgentMessageEvent`/`AgentThinkingEvent`/`AgentToolEvent` types and the
  `CHAT_ROLES`/`TOOL_CALL_STATUSES` arrays are deliberate public-entry exports for M7
  adapters (plan divergence logged)

## [0.3.0] - 2026-07-07

### Added

- `ToolCall` inline row with 4-state status lifecycle (`pending | running | success | failed`) — glyph indicator + running spinner via new runtime dependency `ink-spinner ^5.0.0` (m2-tool-surface T1.1)
- `ToolCallCard` — `ToolCall` header + body indented under the name; plain-string children auto-wrapped (m2-tool-surface T1.2)
- `ToolResult` — tool output block with tail-retention truncation (`maxLines`, dim `… +N lines hidden` indicator, caller-controlled `expanded`), 20k-char input cap, CRLF-safe splitting (pure `truncateLines` math kept module-internal per plan ADR D7) (m2-tool-surface T2.1)
- Tool-cards benchmark (`benchmarks/tool-cards.bench.tsx`) — 100-message thread + 50 mixed-status cards, 150 status transitions, one 500-line truncated output; committed baseline `docs/benchmarks/m2-tool-cards-baseline.json` (5 runs, mean ± std dev, pinned color env); shared sampling helpers extracted to `benchmarks/sampling.ts` (rule of three) (m2-tool-surface T3.2)
- Tool-cards demo (`pnpm example:tools`) — agent turn with queued/running→success/failed cards, truncated output and shell envelope; CI-covered by a subprocess smoke (m2-tool-surface T3.2)
- Tool-surface test hardening — real spinner animation test (exhaust+dedup over `cli-spinners` dots), status-transition rerenders, same-status interval stability, composition-root tool scene, NO_COLOR probe with 4-status + shell envelope (m2-tool-surface T3.1)
- `ToolResult` shell-envelope mode (`shell={{stdout, stderr, exitCode}}`) — labeled stderr block in error color, `exited {code}` badge only on non-zero exit (survives truncation), `(no output)` placeholder for empty streams (m2-tool-surface T2.2)

### Changed

- Review-batch hardening (m2-tool-surface review 2026-07-06): `stderr:` label now PINNED
  outside the truncation budget (color-independent marker survives tight `maxLines`;
  fully-capped stderr renders `stderr: (capped)`); tool-card header Texts use
  `wrap="truncate-end"` (one-line contract holds at any terminal width); truncation
  indicator no longer wraps past its reserved row; `pnpm example:tools` renders the final
  scene statically when piped (no ANSI erase noise in logs) and animates ~1.2s on a TTY;
  tool-cards bench EC-15 guard now actually fires (stdout-frame check — the original was
  dead code) and M0/M1 benches migrated to the shared `benchmarks/sampling.ts` helpers;
  NO_COLOR probe gains line-anchored `o`/`x`/spinner asserts; subprocess tests kill hung
  children at their deadline (`execFileSync timeout`)

## [0.2.0] - 2026-07-06

### Added

- `system` role for `ChatMessage` — `· ` gray glyph tokens (`defaultTheme.role.system`,
  overridable), exported `ChatRole` union (m1-chat-surface T1.1)
- `ChatThread` — ordered chat surface with windowed `<Static>` history (frozen
  append-only prefix in terminal scrollback), identity-memoized live rows for
  flicker-free streaming, duplicate-id fail-fast guard (m1-chat-surface T2.1)
- Grapheme-aware text-buffer reducer (`Intl.Segmenter` — cursor ops never split
  emoji), pure and TTY-free (m1-chat-surface T3.1)
- `ChatComposer` — multi-line terminal input (Enter submits, Ctrl+J newline —
  Shift+Enter honored on kitty-protocol terminals), inverse-video cursor, dimmed
  placeholder, whitespace-only submit guard (m1-chat-surface T3.2)
- Thread benchmark with plain-vs-windowed mode matrix — committed baseline shows
  windowed history ~64× faster per frame under streaming+append load
  (`docs/benchmarks/m1-chat-thread-baseline.json`) (m1-chat-surface T4.1)
- Interactive chat example (`pnpm example:chat`) — thread + composer + fake
  streaming; degrades to a scripted demo when piped/non-TTY (m1-chat-surface T4.2)

### Changed

- Review-batch hardening (m1-chat-surface review 2026-07-06): composer scene added to
  the public-API integration suite; `onSubmit` now runs BEFORE the buffer clears (a
  throwing handler preserves the draft); cursor cell renders only while focused;
  `textBufferReducer` clamps out-of-range cursor state at the public boundary; Delete
  key erases backward at M1 (forward-delete is reducer-only — kitty/ink 5 conflation);
  M1 benchmark baselines regenerated under the pinned color env; example demo fixes
  overlapping-stream interval handling
- Invalid-role error message now names the three-role union
  (`"user" | "assistant" | "system"`) (m1-chat-surface T1.1)

## [0.1.0] - 2026-07-06

### Added

- Publishable package scaffold: ESM-only manifest (types-first `exports`, react-only peer,
  `ink ^5` dependency, Node ≥ 20), Apache-2.0 LICENSE + NOTICE, protected by an executable
  manifest-contract test (m0-walking-skeleton T0.1)
- Five-gate toolchain — format (prettier) → lint (eslint flat + typescript-eslint,
  complexity ≤ 10) → typecheck (strict tsc) → test (vitest, deterministic color env) →
  build (tsup ESM + dts) — plus the `src/index.ts` public entry (m0-walking-skeleton T0.2)
- Theme stub: flat semantic tokens (`role`, `status`), `<TheoTUIProvider>` with leaf-level
  partial override, `useTheoTheme()` with default fallback, `defaultTheme` export
  (m0-walking-skeleton T1.1)
- `ChatMessage` primitive (user/assistant) with role glyph prefix + themed colors,
  per-role snapshots, typed invalid-role error, narrow-width wrap and NO_COLOR degraded
  render coverage (m0-walking-skeleton T2.1)
- Render benchmark harness (`pnpm bench`, `--smoke` mode) with committed baseline —
  100-message thread + 300-token streaming, 5 measured runs + warmup, mean ± std dev;
  authoritative numbers live in `docs/benchmarks/m0-chat-message-baseline.json`
  (m0-walking-skeleton T3.1)
- Runnable example (`pnpm example`) — provider + user/assistant exchange; degrades
  cleanly when piped/non-TTY (m0-walking-skeleton T3.2)
- GitHub Actions CI: gate chain (format → lint → typecheck → test → build → bench smoke)
  on Node 20 + 22 for pushes to `develop` and PRs, including a coverage gate step
  (m0-walking-skeleton T4.1)

### Changed

- Review-batch hardening (m0-walking-skeleton review 2026-07-06): theme context value
  memoized (stable identity for consumers), `defaultTheme` deep-frozen, nested-provider
  reset semantics documented + pinned by test, exported `VERSION` now contract-tested
  against `package.json`, benchmark runner pins the color env (baseline regenerated),
  `eslint-plugin-react-hooks` enabled
