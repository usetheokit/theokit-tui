import { Box, Text } from "ink";
import { render as inkRender } from "ink-testing-library";
import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";

import {
  AgentStreaming,
  AgentTimeline,
  AppStatusBar,
  ChatComposer,
  ChatMessage,
  ChatThread,
  CodeBlock,
  ContextWindowBar,
  CostMeter,
  DiffViewer,
  MarkdownText,
  TokenUsageChart,
  ToolCall,
  ToolCallCard,
  ToolResult,
  WelcomeBanner,
  type ChatThreadMessage,
} from "../../src/index.js";
import { createRenderer } from "../../src/renderer/index.js";
import { VirtualTerminal } from "./virtual-terminal.js";

// M20 T3.1 (plan m20-scrollback-cutover, ADR D2/D3): the DoD-2 gate. EVERY
// shipped component is dual-rendered through Ink (the baseline) AND our renderer
// and the PLAIN-TEXT screens are compared (SGR stripped — layout parity). This
// extends the M18 parity-corpus (primitives + 9 components) to the full suite,
// incl. the Static-driven ChatThread/AgentTimeline (scrollback on the new
// engine). DoD: ≥ 90% byte-identical (target 100%); every divergence is
// documented in docs/renderer/m20-parity-report.md with a scoped cause.

const ANSI = new RegExp(String.fromCharCode(27) + "\\[[0-9;]*m", "g");

function plainLines(frame: string): string[] {
  const lines = frame
    .replace(ANSI, "")
    .split("\n")
    .map((l) => l.replace(/\s+$/, ""));
  while (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }
  return lines;
}

async function tick(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function inkLines(element: ReactElement): string[] {
  const instance = inkRender(element);
  const lines = plainLines(instance.lastFrame() ?? "");
  instance.unmount();
  return lines;
}

async function ourLines(
  element: ReactElement,
  cols: number,
  rows: number,
): Promise<string[]> {
  const term = new VirtualTerminal(cols, rows);
  const r = createRenderer(term);
  r.render(element);
  await tick();
  await tick();
  await term.flush();
  // Normalize identically to inkLines: strip per-line trailing whitespace +
  // drop trailing blank rows, so a bare prompt ">" compares to ">" not "> ".
  const lines = term.screenLines().map((l) => l.replace(/\s+$/, ""));
  while (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }
  r.unmount();
  return lines;
}

const threadMessages: ChatThreadMessage[] = [
  { id: "m0", role: "user", content: "first question" },
  { id: "m1", role: "assistant", content: "first answer" },
  { id: "m2", role: "user", content: "second question" },
];

interface Scene {
  name: string;
  element: ReactElement;
  cols?: number;
  rows?: number;
}

// One representative scene per shipped component (the full public surface).
const scenes: Scene[] = [
  {
    name: "ChatMessage",
    element: <ChatMessage role="assistant">Hello there</ChatMessage>,
  },
  {
    name: "ChatThread",
    element: <ChatThread messages={threadMessages} />,
    rows: 16,
  },
  {
    name: "ToolCallCard",
    element: (
      <ToolCallCard
        name="bash"
        status="success"
        result={{
          kind: "output",
          shell: { stdout: "done", stderr: "", exitCode: 0 },
        }}
      />
    ),
  },
  {
    name: "DiffViewer",
    element: <DiffViewer patch={"--- a\n+++ b\n@@ -1 +1 @@\n-old\n+new\n"} />,
  },
  {
    name: "CodeBlock",
    element: <CodeBlock code={"const x = 1;"} language="ts" />,
  },
  {
    name: "MarkdownText",
    element: <MarkdownText text={"# Title\n\nSome **bold** text"} />,
  },
  { name: "AppStatusBar", element: <AppStatusBar model="gpt-5" /> },
  {
    name: "AgentTimeline",
    element: (
      <AgentTimeline
        events={[
          { id: "t1", kind: "thinking", text: "planning" },
          { id: "m1", kind: "message", role: "assistant", text: "done" },
        ]}
      />
    ),
    rows: 16,
  },
  {
    name: "AgentStreaming",
    element: <AgentStreaming thought="planning the diff" />,
  },
  {
    name: "WelcomeBanner",
    element: (
      <WelcomeBanner name="Theo" version="0.20.0" tagline="terminal AI" />
    ),
    cols: 60,
    rows: 12,
  },
  {
    name: "ContextWindowBar",
    element: <ContextWindowBar usedTokens={4000} limitTokens={8000} />,
  },
  { name: "CostMeter", element: <CostMeter costUsd={0.42} /> },
  {
    name: "TokenUsageChart",
    element: <TokenUsageChart usage={{ input: 100, output: 50 }} />,
  },
  {
    name: "ChatComposer",
    element: <ChatComposer onSubmit={() => {}} />,
    rows: 8,
  },
  { name: "ToolCall", element: <ToolCall name="search" status="success" /> },
  {
    name: "ToolResult",
    element: <ToolResult lines={["line one", "line two"]} />,
  },
];

describe("component parity — full suite on the new renderer (M20 T3.1)", () => {
  it("every_component_renders_byte_identical_to_ink_or_documented", async () => {
    const results: {
      name: string;
      match: boolean;
      ink: string;
      ours: string;
    }[] = [];
    for (const scene of scenes) {
      const ink = inkLines(scene.element);
      const ours = await ourLines(
        scene.element,
        scene.cols ?? 60,
        scene.rows ?? 12,
      );
      // Vacuity guard: a scene must produce real output on BOTH sides.
      const nonEmpty = ink.length > 0 && ours.length > 0;
      const match = nonEmpty && JSON.stringify(ink) === JSON.stringify(ours);
      results.push({
        name: scene.name,
        match,
        ink: JSON.stringify(ink),
        ours: JSON.stringify(ours),
      });
    }
    const passed = results.filter((r) => r.match);
    const failed = results.filter((r) => !r.match);
    const rate = passed.length / results.length;
    // Surface every divergence so the report can document its scoped cause.
    for (const f of failed) {
      console.log(
        `PARITY DIVERGENCE [${f.name}]\n  ink : ${f.ink}\n  ours: ${f.ours}`,
      );
    }
    console.log(
      `COMPONENT PARITY: ${passed.length}/${results.length} (${(rate * 100).toFixed(1)}%) — diverged: ${failed.map((f) => f.name).join(", ") || "none"}`,
    );
    // Pin the actual state: 100% today, so a future single-component regression
    // FAILS the gate instead of coasting on a 10% margin (review M1). Any real
    // divergence must be individually documented + this list narrowed.
    expect(failed.map((f) => f.name)).toEqual([]);
  });
});

// A thread long enough to ACTUALLY graduate rows into Static (windowSize=4,
// overscan=2 keeps 6 live; the rest graduate) — the earlier 3-message oracle was
// vacuous because nothing crossed the window boundary (review H2).
const bigThread = (n: number): ChatThreadMessage[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `m${i}`,
    role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
    content: `msg-${i} content`,
  }));

const HEADER = (
  <Box>
    <Text>BANNER</Text>
  </Box>
);

describe("M11 scrollback oracles on the new renderer (M20 T3.1)", () => {
  it("header_stays_above_graduated_history_and_prints_once", async () => {
    // Genuine M11 header-slot oracle on the new renderer: a growing thread that
    // graduates rows; the header prints ONCE into scrollback, above every
    // graduated row, in order (mirrors chat-thread.test.tsx:239).
    const term = new VirtualTerminal(60, 30);
    const r = createRenderer(term);
    r.render(
      <ChatThread
        header={HEADER}
        messages={bigThread(6)}
        windowSize={4}
        windowOverscan={2}
      />,
    );
    await tick();
    await tick();
    for (const n of [12, 20]) {
      r.render(
        <ChatThread
          header={HEADER}
          messages={bigThread(n)}
          windowSize={4}
          windowOverscan={2}
        />,
      );
      await tick();
      await tick();
    }
    await term.flush();
    const stream = term.writeStream();
    // Header printed exactly once (print-once), above msg-0, and history ordered.
    expect(stream.split("BANNER").length - 1).toBe(1);
    expect(stream.indexOf("BANNER")).toBeLessThan(
      stream.indexOf("msg-0 content"),
    );
    expect(stream.indexOf("msg-0 content")).toBeLessThan(
      stream.indexOf("msg-13 content"),
    );
    r.unmount();
  });

  it("window_keeps_the_live_tail_bounded_on_the_new_renderer", async () => {
    // Windowing oracle: grow the thread incrementally so rows graduate (M11
    // graduation is append-driven, not mount-driven), on a SHORT terminal so
    // graduated history scrolls off the viewport — the live tail (last
    // windowSize+overscan) remains, the oldest message does not.
    const term = new VirtualTerminal(40, 8);
    const r = createRenderer(term);
    r.render(
      <ChatThread messages={bigThread(6)} windowSize={4} windowOverscan={2} />,
    );
    await tick();
    await tick();
    for (const n of [12, 20]) {
      r.render(
        <ChatThread
          messages={bigThread(n)}
          windowSize={4}
          windowOverscan={2}
        />,
      );
      await tick();
      await tick();
    }
    await term.flush();
    const screen = term.screenLines().join("\n");
    // The newest message is in the live tail; the oldest has graduated + scrolled
    // off the viewport — the live frame is bounded, not the whole thread.
    expect(screen).toContain("msg-19 content");
    expect(screen).not.toContain("msg-0 content");
    r.unmount();
  });

  it("agenttimeline_graduated_events_appear_on_screen", async () => {
    const term = new VirtualTerminal(50, 20);
    const r = createRenderer(term);
    r.render(
      <AgentTimeline
        events={[
          { id: "t1", kind: "thinking", text: "planning" },
          { id: "m1", kind: "message", role: "assistant", text: "shipped" },
        ]}
      />,
    );
    await tick();
    await tick();
    await term.flush();
    const screen = term.screenLines().join("\n");
    expect(screen).toContain("planning");
    expect(screen).toContain("shipped");
    r.unmount();
  });
});
