---
slug: theokit-tui
date: 2026-07-05
generated_by: roadmap-init
questions_answered: 7
unresolved_dims: []
status: completed
---

# Roadmap grill: theokit-tui

### Q1/7: Root problem

**Question:** What is the root problem `@theokit/tui` solves, and for whom does it hurt today?

**Recommended:** Coding agents increasingly run in the terminal (Claude Code, Codex CLI, Gemini CLI, opencode), but each rebuilds the same agent-UI TUI primitives from scratch (streaming chat message render, tool-call cards with status, diff viewer, agent timeline, token/cost meter, input composer). No reusable, coherent TUI component library exists for AI-agent surfaces — the terminal analog of what `@theokit/ui` is for web. It hurts anyone building coding agents / agent CLIs (including our own TheoCode), who spend weeks reimplementing streaming/tool-call/diff render in Ink/ratatui before shipping value. `@theokit/tui` closes the gap: the same AI primitives as `@theokit/ui` (`AgentEvent`, `ToolCall`, `ChatMessage`, `DiffViewer`, `TokenUsageChart`…) as Ink components for the terminal — same AI-native identity, terminal surface.

**User answer:** Accepted the recommendation verbatim.

### Q7/7: North-star metric

**Question:** What is the north-star metric that, when it moves, the team knows the project is winning?

**Recommended:** Time-to-first-agent-turn-in-terminal (TTFATT) — dev-minutes from `npm i @theokit/tui` to a streaming + tool-calls agent turn rendered in the terminal. The TUI analog of the ecosystem north-star (time-to-first-working-agent). V1 target: < 10 minutes (install → mount `<TheoTUIProvider>` + `<ChatThread>` + stream adapter → see a real turn run). Secondary "winning" signal: adoption — number of projects/CLIs (beyond TheoCode) depending on `@theokit/tui` on npm, and number of primitives reused per consumer (proves surface parity is useful, not just present).

**User answer:** Accepted the recommendation verbatim.

### Q6/7: Measurable V1 ship criterion

**Question:** What is the measurable success criterion for V1 ship (a number, a behavior, a benchmark)?

**Recommended:** V1 ships when TheoCode (dogfood) renders a full agent turn end-to-end in the terminal using ONLY `@theokit/tui` primitives, with these verifiable conditions: (1) minimum surface parity: ≥ 12 agent-surface primitives published (ChatMessage, ChatThread, ChatComposer, AgentEvent, AgentTimeline, ToolCall, ToolCallCard, ToolResult, DiffViewer, CodeBlock, TokenUsageChart, ContextWindowBar) + `<TheoTUIProvider>` + stream adapter; (2) real streaming: a demo (examples/live-agent-tui) consumes an AsyncIterable of `@theokit/sdk` events against a real LLM (OpenRouter) and renders token-by-token text + live tool-cards in the terminal, measuring the north-star; (3) green gates: format → lint → typecheck → test → build exit 0; snapshot coverage (ink-testing-library) on ≥ 80% of primitives; ESM-only + Apache-2.0 + publint clean; (4) published: `@theokit/tui` installable from npm; AI-native README; (5) robustness: primitives degrade correctly in NO_COLOR and non-TTY (snapshot test covering both modes).

**User answer:** Accepted the recommendation verbatim.

### Q5/7: Hard constraints

**Question:** What are the hard constraints (stack, compliance, deadline, team size, runtime targets)?

**Recommended:** Stack: TypeScript strict + Ink 5 (React for terminal) + tsup (ESM-only) + vitest + ink-testing-library — same discipline as `@theokit/ui`. Peer: React is the only required peer (like `@theokit/ui`); Ink as a dependency; syntax-highlight/diff via opt-in deps. Runtime: Node ≥ 20, ESM-only (no CJS); terminals: support truecolor AND degrade to 16-color/NO_COLOR; variable width (resize); no mouse dependency. License: Apache-2.0; only compatible deps (no GPL/AGPL transitive). Primary prior art (assistant-ui/react-ink) is MIT — compatible for study/inspiration (don't copy code without checking). Robustness/a11y: respect NO_COLOR/FORCE_COLOR/TERM=dumb; don't break on pipe/non-TTY (degraded render); terminal a11y = screen-reader-friendly where feasible. Gates: mirror `@theokit/ui` quality gates adapted (format → lint → typecheck → test → build) with terminal-output snapshot testing (ink-testing-library) in place of vitest-axe. Team/deadline: solo/assisted, no hard deadline — but each milestone runs the cycles (discover→plan→implement→review).

**User answer:** Accepted the recommendation verbatim.

### Q4/7: Out of scope

**Question:** What is explicitly out of scope (tempting but not for this project)?

**Recommended:** Deliberately excluded:
- Generic TUI components (menus, tables, forms, generic spinners, layout widgets) — that's ink-ui/@inquirer/ratatui territory. Don't reinvent (Rule 9); we're AI-native, not a general-purpose TUI lib.
- A homegrown TUI framework — we use Ink (don't write our own terminal renderer). No ratatui (Rust) or opentui port.
- The agent harness/runtime — `@theokit/tui` only renders; agent/LLM logic is `@theokit/sdk`'s. We consume events, don't produce them.
- A full coding-agent app/CLI — that's TheoCode (consumer), not the lib.
- Heavy view-only engines from `@theokit/ui`: slide/whiteboard/diagram — meaningless in the terminal.
- 1:1 web↔terminal parity — we don't port all 99 components; only the agent-surface subset that makes sense in TUI.
- shadcn registry interop — `@theokit/ui`'s copy-paste model is web; TUI ships via npm only.

**User answer:** Accepted the recommendation verbatim.

### Q3/7: In scope (V1)

**Question:** What is in scope for V1 (must-have to call `@theokit/tui` alive)?

**Recommended:** The core set of coding-agent terminal-surface primitives, in Ink, plus essential infra:
- Chat/streaming: `ChatMessage` (user/assistant/system), `ChatThread` (scroll/viewport), `ChatComposer` (multi-line input), token-by-token streaming render.
- Tool-use: `ToolCall`/`ToolCallCard` with status lifecycle (running → success/failed), `ToolResult`.
- Agent: `AgentEvent` (thinking/action), `AgentTimeline`, `AgentStreaming`.
- Code: `DiffViewer` (terminal-adapted unified/split), `CodeBlock` with syntax highlight (cli-highlight/shiki-cli).
- Metrics: `TokenUsageChart`/`CostMeter` (ASCII bars), `ContextWindowBar`.
- Foundation: theme system (terminal-adaptive colors, NO_COLOR/truecolor aware), tokens, a `<TheoTUIProvider>`, and the stream adapter (`SDKMessage`/AsyncIterable → UI state, mirroring theo-ui's `useAgentStream`).
- Quality: ink-testing-library tests, ESM-only, Apache-2.0, TS strict.
Excludes generic primitives (Button/Card make no sense in TUI) and heavy engines (slide/whiteboard) — YAGNI.

**User answer:** Accepted the recommendation verbatim.

### Q2/7: Primary users

**Question:** Who are the primary users (role, internal vs external, single team vs many)?

**Recommended:** TypeScript developers building coding agents / agent CLIs — primarily external (the community using Ink/assistant-ui to build agent TUIs today), with TheoCode as the first-party internal consumer (the dogfood). Same profile as `@theokit/ui`: an Apache-2.0 community auxiliary, not part of the paid funnel — usable standalone in any Ink app, pairing naturally with `@theokit/sdk` (harness) as the event source (`SDKMessage`/`tool_call`/`assistant` → `AgentEvent`/`ToolCall`/`ChatMessage`). Not for end-users or non-devs; for whoever builds an agent's terminal surface.

**User answer:** Accepted the recommendation verbatim.
