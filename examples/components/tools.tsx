import { Box, Text, render } from "ink";
import { useEffect, useState } from "react";

import {
  ChatMessage,
  TheoTUIProvider,
  ToolCall,
  ToolCallCard,
  ToolResult,
} from "../../src/index.js";
import type { ToolCallStatus } from "../../src/index.js";

// Tool-cards demo (plan T3.2 — TTFATT caller): an agent turn with a queued
// tool, a scripted running→success transition, and a failed shell card with
// truncated output. On a TTY the transition animates (~1.2s spinner →
// check); when piped/non-TTY (review dom-frontend-2) the demo renders the
// FINAL scene statically — Ink re-flushes every spinner tick even without a
// TTY, which would spray erase sequences into logs/pagers.
const isInteractive = process.stdout.isTTY === true;
const TRANSITION_MS = 1200;
const EXIT_MS = 2500;

const longOutput = Array.from(
  { length: 40 },
  (_, i) => `installed package-${i}`,
).join("\n");

function Demo() {
  const [buildStatus, setBuildStatus] = useState<ToolCallStatus>(
    isInteractive ? "running" : "success",
  );

  useEffect(() => {
    if (!isInteractive) {
      return;
    }
    const handle = setTimeout(() => {
      setBuildStatus("success");
    }, TRANSITION_MS);
    return () => {
      clearTimeout(handle);
    };
  }, []);

  return (
    <TheoTUIProvider>
      <Box flexDirection="column">
        <ChatMessage role="user">install the deps and lint</ChatMessage>
        <ChatMessage role="assistant">Running the toolchain now.</ChatMessage>
        <ToolCall name="Read" status="pending" summary="registry.json" />
        <ToolCallCard name="Bash" status={buildStatus} summary="pnpm install">
          <ToolResult lines={longOutput.split("\n")} maxLines={6} />
        </ToolCallCard>
        <ToolCallCard name="Bash" status="failed" summary="pnpm lint">
          <ToolResult
            shell={{
              stdout: "checked 42 files",
              stderr: "src/demo.ts:3 unused variable",
              exitCode: 1,
            }}
          />
        </ToolCallCard>
        <Text dimColor>demo exits after the transition settles…</Text>
      </Box>
    </TheoTUIProvider>
  );
}

const instance = render(<Demo />);
setTimeout(
  () => {
    instance.unmount();
  },
  isInteractive ? EXIT_MS : 0,
);
