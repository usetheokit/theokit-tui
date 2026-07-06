import { Box, Text, render } from "ink";
import { useEffect, useState } from "react";

import {
  ChatMessage,
  TheoTUIProvider,
  ToolCall,
  ToolCallCard,
  ToolResult,
} from "../src/index.js";
import type { ToolCallStatus } from "../src/index.js";

// Tool-cards demo (plan T3.2 — TTFATT caller): an agent turn with a queued
// tool, a scripted running→success transition, and a failed shell card with
// truncated output. Non-TTY-safe by design (no composer) — `pnpm
// example:tools | cat` renders the full scene and exits cleanly.
const longOutput = Array.from(
  { length: 40 },
  (_, i) => `installed package-${i}`,
).join("\n");

function Demo() {
  const [buildStatus, setBuildStatus] = useState<ToolCallStatus>("running");

  useEffect(() => {
    const handle = setTimeout(() => {
      setBuildStatus("success");
    }, 300);
    return () => {
      clearTimeout(handle);
    };
  }, []);

  return (
    <TheoTUIProvider>
      <Box flexDirection="column">
        <ChatMessage role="user">install the deps and lint</ChatMessage>
        <ChatMessage role="assistant">Running the toolchain now.</ChatMessage>
        <ToolCall name="resolve-registry" status="pending" summary="queued" />
        <ToolCallCard name="pnpm install" status={buildStatus}>
          <ToolResult lines={longOutput.split("\n")} maxLines={6} />
        </ToolCallCard>
        <ToolCallCard name="pnpm lint" status="failed" summary="exit 1">
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
setTimeout(() => {
  instance.unmount();
}, 600);
