# Changelog

All notable changes to `@theokit/tui` are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `DiffViewer` — UNIFIED terminal diff renderer (split view deferred with a recorded verified-absence rationale — no terminal analog ships it): unconditional `+`/`-` sign column (the NO_COLOR mechanism), dim line-number gutter, per-file header with rename arrow + `+N`/`-M` stats, dim `⋮` hunk gaps, wrap-never-truncate content, `contextLines` folding + global HEAD-retained `maxLines` cap, explicit `(no changes)`/binary rows, typed malformed-patch error (m4-code-surface T1.2)
- `parseUnifiedDiff` — typed multi-file unified-diff model (`DiffFile`/`DiffLine`, CRLF stripped, `\ No newline` suppressed, `/dev/null` → absent names, binary/mode-change = zero-line files) built on `parse-diff`; typed error on unparsable patches; pure `foldDiffLines` context folding (m4-code-surface T1.1)

- `AgentEvent` union (`kind: "message" | "thinking" | "tool"`, caller-provided ids) + `AgentTimeline` — ordered agent-turn timeline dispatching to `ChatMessage`/thinking rows/`ToolCallCard`+`ToolResult`, with full boundary validation (duplicate id, unknown kind, invalid role/status, `output`⊕`shell` exclusivity → typed `AgentTimeline:` errors) (m3-agent-surface T1.1)
- `AgentTimeline` windowed `<Static>` history — events beyond `windowSize + windowOverscan` graduate into frozen terminal scrollback; identity-memoized rows keep streaming repaints scoped to the tail (M1 windowing contract, sibling implementation) (m3-agent-surface T1.2)
- `AgentStreaming` — dumb one-line live indicator (spinner + italic thought with `Thinking…` fallback + optional dim `(esc to cancel, 2m 5s)` suffix); elapsed arrives as a prop, ticking is the caller's concern (m3-agent-surface T2.1)
- Agent-surface integration coverage — representative multi-event-turn snapshot (thinking → tool running → tool success → assistant message), composition-root agent scene, NO_COLOR probe with thinking + streaming rows (m3-agent-surface T3.1)
- Agent-timeline benchmark (`benchmarks/agent-timeline.bench.tsx`) — 300 mixed events (50/30/20 message/tool/thinking incl. one 500-line output) streaming+appending under windowing, bounded|unbounded `maxLines` matrix; committed baseline `docs/benchmarks/m3-agent-timeline-baseline.json` (5 runs/mode, pinned env, peak = heterogeneous-heights metric) (m3-agent-surface T3.2)
- Agent-turn demo (`pnpm example:agent`) — scripted thinking → running tool → success → message with a live elapsed ticker; renders the final scene statically when piped (m3-agent-surface T3.2)
- `CHAT_ROLES` and `TOOL_CALL_STATUSES` runtime union arrays exported (single-source derivation of the existing `ChatRole`/`ToolCallStatus` types) (m3-agent-surface T1.1)
- `ToolCall` inline row with 4-state status lifecycle (`pending | running | success | failed`) — glyph indicator + running spinner via new runtime dependency `ink-spinner ^5.0.0` (m2-tool-surface T1.1)
- `ToolCallCard` — `ToolCall` header + body indented under the name; plain-string children auto-wrapped (m2-tool-surface T1.2)
- `ToolResult` — tool output block with tail-retention truncation (`maxLines`, dim `… +N lines hidden` indicator, caller-controlled `expanded`), 20k-char input cap, CRLF-safe splitting (pure `truncateLines` math kept module-internal per plan ADR D7) (m2-tool-surface T2.1)
- Tool-cards benchmark (`benchmarks/tool-cards.bench.tsx`) — 100-message thread + 50 mixed-status cards, 150 status transitions, one 500-line truncated output; committed baseline `docs/benchmarks/m2-tool-cards-baseline.json` (5 runs, mean ± std dev, pinned color env); shared sampling helpers extracted to `benchmarks/sampling.ts` (rule of three) (m2-tool-surface T3.2)
- Tool-cards demo (`pnpm example:tools`) — agent turn with queued/running→success/failed cards, truncated output and shell envelope; CI-covered by a subprocess smoke (m2-tool-surface T3.2)
- Tool-surface test hardening — real spinner animation test (exhaust+dedup over `cli-spinners` dots), status-transition rerenders, same-status interval stability, composition-root tool scene, NO_COLOR probe with 4-status + shell envelope (m2-tool-surface T3.1)
- `ToolResult` shell-envelope mode (`shell={{stdout, stderr, exitCode}}`) — labeled stderr block in error color, `exited {code}` badge only on non-zero exit (survives truncation), `(no output)` placeholder for empty streams (m2-tool-surface T2.2)

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

### Deprecated

### Removed

### Fixed

### Security

- Transitive `esbuild` advisory (GHSA-g7r4-m6w7-qqqr, LOW — dev-server file read on
  Windows; devDependency via tsup) resolved with a pnpm override to `>=0.28.1`;
  `pnpm audit` clean

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
