import { Box, Text } from "ink";
import { render as inkRender } from "ink-testing-library";
import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";

import {
  AppStatusBar,
  ChatMessage,
  CodeBlock,
  DiffViewer,
  MarkdownText,
  ToolCallCard,
  WelcomeBanner,
} from "../../src/index.js";
import { createRenderer } from "../../src/renderer/index.js";
import { VirtualTerminal } from "./virtual-terminal.js";

// M18 T3.1 (plan m18-yoga-layout, ADR D5): the parity gate. Each corpus scene is
// rendered through Ink (the baseline) AND our renderer, and the PLAIN-TEXT
// layouts are compared (SGR stripped — a NO_COLOR pass isolates layout from
// color; SGR byte-parity is tracked separately). DoD: ≥ 90% of scenes match
// byte-identical; every divergence is documented in docs/renderer/
// m18-parity-report.md. This is the M18 exit gate against the existing corpus.

const ANSI = new RegExp(String.fromCharCode(27) + "\\[[0-9;]*m", "g");

/** Plain, trimmed, trailing-blank-stripped lines from an ANSI frame. */
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

async function ourLines(
  element: ReactElement,
  cols: number,
  rows: number,
): Promise<string[]> {
  const term = new VirtualTerminal(cols, rows);
  const r = createRenderer(term);
  r.render(element);
  await tick();
  await term.flush();
  const lines = term.screenLines();
  r.unmount();
  return lines;
}

function inkLines(element: ReactElement): string[] {
  const instance = inkRender(element);
  const lines = plainLines(instance.lastFrame() ?? "");
  instance.unmount();
  return lines;
}

interface Scene {
  name: string;
  element: ReactElement;
  cols?: number;
  rows?: number;
}

const scenes: Scene[] = [
  {
    name: "plain text column",
    element: (
      <Box flexDirection="column">
        <Text>alpha</Text>
        <Text>beta</Text>
      </Box>
    ),
  },
  {
    name: "row layout",
    element: (
      <Box flexDirection="row">
        <Text>left </Text>
        <Text>right</Text>
      </Box>
    ),
  },
  {
    name: "padding + border box",
    element: (
      <Box flexDirection="row">
        <Box borderStyle="round" paddingX={1}>
          <Text>boxed</Text>
        </Box>
      </Box>
    ),
  },
  {
    name: "nested column in row",
    element: (
      <Box flexDirection="row">
        <Box flexDirection="column">
          <Text>a1</Text>
          <Text>a2</Text>
        </Box>
        <Text>b</Text>
      </Box>
    ),
  },
  {
    name: "chat message",
    element: <ChatMessage role="assistant">Hello there</ChatMessage>,
  },
  {
    name: "markdown text",
    element: <MarkdownText text={"# Title\n\nSome **bold** text"} />,
  },
  {
    name: "code block",
    element: <CodeBlock code={"const x = 1;"} language="ts" />,
  },
  {
    name: "diff viewer",
    element: <DiffViewer patch={"@@ -1 +1 @@\n-old\n+new\n"} />,
  },
  {
    name: "tool call card output",
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
  { name: "app status bar", element: <AppStatusBar model="gpt-5" /> },
  {
    name: "welcome banner",
    element: (
      <WelcomeBanner name="Theo" version="0.18.0" tagline="terminal AI" />
    ),
    rows: 16,
  },
];

describe("M18 parity corpus vs Ink (T3.1)", () => {
  it("parity_corpus_matches_ink_within_budget", async () => {
    const results: { name: string; match: boolean }[] = [];
    for (const scene of scenes) {
      const ink = inkLines(scene.element);
      const ours = await ourLines(
        scene.element,
        scene.cols ?? 60,
        scene.rows ?? 12,
      );
      const match = JSON.stringify(ink) === JSON.stringify(ours);
      results.push({ name: scene.name, match });
      if (!match) {
        console.error(
          `PARITY DIVERGENCE [${scene.name}]\n  ink : ${JSON.stringify(ink)}\n  ours: ${JSON.stringify(ours)}`,
        );
      }
    }
    const total = results.length;
    const matched = results.filter((r) => r.match).length;
    const failures = results.filter((r) => !r.match).map((r) => r.name);
    console.error(
      `M18 parity: ${matched}/${total} (${((matched / total) * 100).toFixed(0)}%) — diverging: ${failures.join(", ") || "none"}`,
    );
    expect(matched / total).toBeGreaterThanOrEqual(0.9);
  });
});
