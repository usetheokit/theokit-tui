# @theokit/tui

**Ship an AI-agent terminal UI in minutes, not weeks.** Streaming chat,
tool-call cards, diffs, agent timeline, token/cost metrics and a welcome
banner — one coherent primitive set for coding-agent CLIs, built on
[Ink](https://github.com/vadimdemedes/ink) (React for the terminal).

Your first agent turn in the terminal (TTFATT) is the north-star: `npm i` →
mount a provider + thread + stream adapter → a streamed agent turn renders.
Target: under 10 minutes. Measured record: [`docs/ttfatt.md`](docs/ttfatt.md).

```
╭──────────────────────────────────────────────────────────╮
│ Theo TUI v0.10.0                                         │
│ AI-agent primitives for the terminal                     │
│                                                          │
│ /help for commands                                       │
│ esc to cancel a running turn                             │
╰──────────────────────────────────────────────────────────╯
✦ streaming assistant text…
✓  vitest        435 passed
```

## Install

```sh
npm i @theokit/tui react@19
```

Node ≥ 22, **ESM-only** (set `"type": "module"`). `ink` (v7) ships as a
dependency — don't install it separately. React **19.2+** is the required
peer (ink 7's floor); the 0.10.x line remains available for react 18/ink 5
consumers. `lowlight` is an optional peer for syntax highlighting.

## Quickstart — a streamed agent turn

```tsx
import { render } from "ink";
import {
  TheoTUIProvider,
  WelcomeBanner,
  AgentTimeline,
  AgentStreaming,
  useAgentStream,
} from "@theokit/tui";
import type { AgentStreamEvent } from "@theokit/tui";

async function* demoTurn(): AsyncGenerator<AgentStreamEvent> {
  yield { type: "thinking", text: "inspecting the failing test" };
  yield { type: "tool_call", call_id: "t1", name: "vitest", status: "running" };
  yield {
    type: "tool_call",
    call_id: "t1",
    name: "vitest",
    status: "completed",
    result: { stdout: "435 passed", stderr: "", exitCode: 0 },
  };
  yield { type: "text-delta", text: "All green now." };
}

function App() {
  const { events, streaming } = useAgentStream(demoTurn);
  return (
    <TheoTUIProvider>
      <WelcomeBanner name="My Agent" version="1.0.0" hints={["/help"]} />
      <AgentTimeline events={events} />
      {streaming.active ? <AgentStreaming thought={streaming.thought} /> : null}
    </TheoTUIProvider>
  );
}

render(<App />);
```

Swap `demoTurn` for your real stream: `useAgentStream` consumes any
`AsyncIterable<AgentStreamEvent>` (or a factory) — SDK streams, SSE, fixtures.
See `examples/live-agent-tui.tsx` for a real-LLM turn via OpenRouter.

## Primitives

| Surface | Components                                                                         |
| ------- | ---------------------------------------------------------------------------------- |
| Chat    | `ChatMessage`, `ChatThread` (windowed scrollback), `ChatComposer`                  |
| Tools   | `ToolCall`, `ToolCallCard`, `ToolResult` (shell envelope, truncation)              |
| Agent   | `AgentTimeline`, `AgentStreaming`, `useAgentStream` + `agentStreamReducer`         |
| Code    | `CodeBlock` (optional lowlight), `DiffViewer` + `parseUnifiedDiff`                 |
| Metrics | `ContextWindowBar`, `TokenUsageChart`, `CostMeter`                                 |
| Shell   | `WelcomeBanner`, `TheoTUIProvider` + built-in themes (`dark`, `light`, `no-color`) |

Every primitive degrades cleanly under `NO_COLOR`, `TERM=dumb` and bare
pipes — proven by a subprocess degrade matrix in CI.

## How it works

- **Data-props contract:** components render caller-provided data; no hidden
  fetching, no model registries, no timers inside dumb indicators.
- **Stream adapter (zero coupling):** `agentStreamReducer` is a pure fold
  from a structural event union onto the timeline — `@theokit/sdk` is a
  type-only devDependency with a compile-time drift tripwire; any producer
  that emits the same shapes works.
- **Theming as data:** one `TheoTheme` object; `NO_COLOR` resolves a
  no-color theme at the provider — components branch on theme data, never
  on env.
- **Evidence-driven:** 450+ tests, per-component render benchmarks with
  committed baselines, snapshot budget discipline.

## Status

Designed for coding-agent CLIs and chat surfaces; the API follows semver and
is pre-1.0 (expect additive evolution). v1.0 lands when our own dogfooding
gate — sustained internal use with recorded evidence — is satisfied.

## License

Apache-2.0
