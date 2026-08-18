# @theokit/tui

**Ship an AI-agent terminal UI in minutes, not weeks.** Streaming chat,
tool-call cards, diffs, agent timeline, token/cost metrics and a welcome
banner — one coherent primitive set for coding-agent CLIs, built on
[Ink](https://github.com/vadimdemedes/ink) (React for the terminal).

Your first agent turn in the terminal (TTFATT) is the north-star: `npm i` →
mount a provider + thread + stream adapter → a streamed agent turn renders.
Target: under 10 minutes. Measured record:
[`wiki/benchmarks/ttfatt.md`](wiki/benchmarks/ttfatt.md).

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
See `examples/scenes/live-agent-tui.tsx` for a real-LLM turn via OpenRouter.

## Primitives

| Surface | Components                                                                                                                                                                |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chat    | `ChatMessage`, `ChatThread` (windowed scrollback), `ChatComposer`                                                                                                         |
| Tools   | `ToolCall`, `ToolCallCard`, `ToolResult` (shell envelope, truncation)                                                                                                     |
| Agent   | `AgentTimeline`, `AgentStreaming`, `useAgentStream` + `agentStreamReducer`                                                                                                |
| Code    | `CodeBlock` (optional lowlight), `DiffViewer` + `parseUnifiedDiff`                                                                                                        |
| Metrics | `ContextWindowBar`, `TokenUsageChart`, `CostMeter`                                                                                                                        |
| Shell   | `WelcomeBanner` (optional `animated` < 2 s reveal — TTY-gated, disable with `THEOKIT_TUI_NO_MOTION=1`), `TheoTUIProvider` + built-in themes (`dark`, `light`, `no-color`) |

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

### Scrollback vs the live region

Ink re-prints the live region on every render. Anything you want printed to the
terminal **once** — a banner, a session header — must reach scrollback through
`<Static>`, or it re-prints and visibly duplicates as the user scrolls.

`ChatThread` and `AgentTimeline` already do this for their own history:
messages/events past the window graduate into `<Static>` and freeze.

For your own one-shot content, the supported slot is their **`header` prop**,
folded in as the first `<Static>` item:

```tsx
<Box flexDirection="column" width={72}>
  <AgentTimeline
    header={<WelcomeBanner name="Theo" version={VERSION} />}
    events={events}
  />
</Box>
```

Two constraints come with it:

- **Mount-frozen.** The header is captured on the first render — later changes
  to its content, identity or presence are ignored. It is a banner, not state.
- **Size it explicitly.** `<Static>`'s box is content-sized, so percentage
  widths may collapse. Give the header — or the box around the timeline, as
  above — concrete cell counts.

Rendering that same banner as a plain child of your app (outside the timeline)
puts it in the live region, where it duplicates on scroll. There is no general
`insertHistory` primitive yet — see
[#55](https://github.com/usetheokit/theokit-tui/issues/55).

### When a component rejects a prop, it writes to stderr

Components in this package validate their props and throw a typed `TypeError` before rendering.
Since `0.61`, a guard that fires **may** also write one line to `process.stderr` before throwing:

```
[theokit/tui] 2026-08-18T15:22:59Z UsagePanel: contextWindow must be a finite number > 0 when given — got 0
```

**One component does this today — `UsagePanel`.** The other 20 guarded components still throw with
nothing recorded; adopting the sink across them is tracked separately, and until then the absence of
a line means "this component has not adopted it", not "no guard fired". An earlier version of this
section stated the record as a property of the package's guards in general, which review measured
false (1 of 21).

The line exists because a terminal frame is not a log. Ink prints its own error panel when a render
throws, but that panel is on stdout and is gone at the next repaint or once the scrollback rolls —
so an operator debugging an intermittent guard has nothing to read afterwards. The record is what
survives.

**A TUI owns the screen, so you should redirect stderr for the life of your session.** This package
ships `installStderrGuard` for exactly that: it sends stderr — these records, and anything else in
your process that writes there — to a rotating log file instead of into the middle of a frame.

```ts
import { installStderrGuard } from "@theokit/tui/terminal";

const dispose = installStderrGuard("~/.your-cli/session.log", {
  label: "your-cli",
});
try {
  // render your app
} finally {
  dispose(); // restores stderr and reports how many writes were lost, if any
}
```

Without it, a record can land mid-frame and corrupt the display until the next repaint — and be
aware of what actually follows a fired guard: ink's error boundary tears the whole app down and the
process exits **0**. So the record is what survives for you to read afterwards, not a blemish on a
session that continues. An earlier version of this paragraph offered "a corrupted frame is
repainted" as the consolation, which this package's own measurement contradicts.

If the sink itself fails — a closed pipe, an unwritable log path — the record is **counted rather
than swallowed**, and `lostGuardRecords()` returns how many this process lost. Nothing reports that
number for you: this package owns no lifecycle to hook, so read it where your session already ends.

```ts
import { lostGuardRecords } from "@theokit/tui";

const lost = lostGuardRecords();
if (lost > 0)
  console.error(`[your-cli] ${lost} diagnostic(s) could not be recorded`);
```

Two limits worth knowing:

- The sink is a per-call parameter, so there is no global `setGuardSink` today. `installStderrGuard`
  is the lever. If you need a finer one, open an issue — it has not been asked for yet.
- One logical guard failure can produce MORE THAN ONE record, because React re-invokes a component
  whose render threw. How many depends on the component's own shape and on the renderer mode —
  measured 2 for a conditional guard, 3 for an unconditional one, and 0 at `render()` return under
  ink's `concurrent: true` root. The count is a renderer detail, not a count of failures.

## Development

Node ≥ 22, pnpm 10 (pinned via `packageManager` — use corepack).

```bash
pnpm install --frozen-lockfile
pnpm gates   # format:check + lint + typecheck + test + build — what CI runs
```

**`auto-install-peers=false` in `.npmrc` is deliberate — do not flip it.** `figlet` and
`lowlight` are _optional_ peers. `figlet` is deliberately **not** installed, and
`figlet-art.test.ts → returns_null_when_figlet_is_absent` proves the real import
failure degrades to `null` instead of throwing — auto-installing peers would put
`figlet` in the tree and that test would stop testing anything. Peers a test
genuinely needs are explicit devDependencies instead (`react`, and `lowlight` so
the syntax-highlight path can run; `code-block-absent.test.tsx` covers _its_
absent case by mocking the module, not by emptying the tree).

So a missing-peer warning for `figlet` during install is expected — not something
to fix by changing that flag.

## Status

Designed for coding-agent CLIs and chat surfaces; the API follows semver and
is pre-1.0 (expect additive evolution). v1.0 lands when our own dogfooding
gate — sustained internal use with recorded evidence — is satisfied.

## License

Apache-2.0
