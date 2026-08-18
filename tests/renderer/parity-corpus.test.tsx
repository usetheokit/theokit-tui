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
import {
  createHostReconciler,
  createRootNode,
} from "../../src/renderer/host-config.js";
import { createRenderer } from "../../src/renderer/index.js";
import { Output } from "../../src/renderer/output/output-grid.js";
import { renderNodeToOutput } from "../../src/renderer/output/render-node.js";
import Yoga from "yoga-layout";
import { VirtualTerminal } from "./virtual-terminal.js";

// M18 T3.1 (plan m18-yoga-layout, ADR D5): the parity gate. Each corpus scene is
// rendered through Ink (the baseline) AND our renderer, and the PLAIN-TEXT
// layouts are compared (SGR stripped — a NO_COLOR pass isolates layout from
// color; SGR byte-parity is tracked separately). DoD: ≥ 90% of scenes match
// byte-identical; every divergence is documented in
// wiki/renderer/layout-parity.md. This is the M18 exit gate against the
// existing corpus.

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

/** Our COLORED frame (the cell grid before the emulator strips SGR). */
function ourColoredFrame(element: ReactElement, cols: number): string {
  const root = createRootNode();
  const reconciler = createHostReconciler(() => {});
  const container = reconciler.createContainer(
    root,
    0,
    null,
    false,
    null,
    "sgr",
    () => {},
    () => {},
    () => {},
    () => {},
  );
  reconciler.updateContainerSync(element, container, null, () => {});
  reconciler.flushSyncWork();
  root.yogaNode!.setWidth(cols);
  root.yogaNode!.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);
  const output = new Output({
    width: root.yogaNode!.getComputedWidth(),
    height: root.yogaNode!.getComputedHeight(),
  });
  renderNodeToOutput(root, output, {
    offsetX: 0,
    offsetY: 0,
    transformers: [],
  });
  return output.get().output;
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
  {
    // Breadth (review MEDIUM-2): flexGrow distribution — Ink is the oracle for
    // the width math, not our own expectation.
    name: "flex-grow distribution",
    element: (
      <Box width={12} flexDirection="row">
        <Box flexGrow={1}>
          <Text>L</Text>
        </Box>
        <Box flexGrow={1}>
          <Text>R</Text>
        </Box>
      </Box>
    ),
  },
  {
    name: "justify-content space-between",
    element: (
      <Box width={10} flexDirection="row" justifyContent="space-between">
        <Text>x</Text>
        <Text>y</Text>
      </Box>
    ),
  },
  {
    name: "text wrap within width",
    element: (
      <Box width={8}>
        <Text>hello world foo</Text>
      </Box>
    ),
    cols: 8,
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
      // Vacuity guard (review HIGH-1): a scene that renders NOTHING must not
      // count as a match — every scene must produce real output on BOTH sides.
      expect(ink.length).toBeGreaterThan(0);
      expect(ours.length).toBeGreaterThan(0);
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

  it("sgr_color_bytes_match_ink", () => {
    // DoD-2 SGR parity: our colored output (the cell grid BEFORE the emulator
    // strips SGR) must byte-match Ink for a colored Text — proven by
    // construction since we share Ink's chalk transform + @alcalzone tokenizer.
    const scene = (
      <Box flexDirection="row">
        <Text color="red">hi</Text>
        <Text color="green"> ok</Text>
      </Box>
    );
    const inkFrame = inkRender(scene).lastFrame() ?? "";
    const oursFrame = ourColoredFrame(scene, 20);
    expect(oursFrame).toBe(inkFrame.replace(/\s+$/, ""));
    // And it genuinely carries SGR (not a plain-text coincidence).
    expect(oursFrame).toContain(String.fromCharCode(27));
  });
});
