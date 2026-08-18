import { Box, render, useApp } from "ink";
import { useEffect } from "react";

import {
  AgentStreaming,
  AgentTimeline,
  TheoTUIProvider,
  ToolCallCard,
  VERSION,
  WelcomeBanner,
  useAgentStream,
} from "../../src/index.js";
import type { AgentStreamEvent } from "../../src/index.js";

// Stream-adapter demo (plan m7-stream-adapter T3.2 — TTFATT caller): a
// scripted agent turn folded through the REAL useAgentStream hook —
// thinking → tool running → tool success (shell result) → text-delta typing
// → done. On a TTY the turn is paced for humans; when piped/non-TTY the
// pacing collapses to zero and the final scene renders deterministically.
//
// UNMOUNT RULE (EC-8): the demo exits via an effect when status === "done" —
// gated on the terminal state, never a timer race.
//
// Real-SDK variant (devDep-gated, NOT executed in CI): replace demoTurn with
//   const run = agent.run(prompt);            // @theokit/sdk
//   useAgentStream(() => run.stream());       // total-replay per (re)call
const paced = process.stdout.isTTY === true;

async function pause(ms: number): Promise<void> {
  if (paced) {
    await new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }
}

async function* demoTurn(): AsyncGenerator<AgentStreamEvent> {
  yield { type: "thinking", text: "inspecting the failing test" };
  await pause(700);
  yield { type: "tool_call", call_id: "t1", name: "vitest", status: "running" };
  await pause(900);
  yield {
    type: "tool_call",
    call_id: "t1",
    name: "vitest",
    status: "completed",
    result: { stdout: "435 passed", stderr: "", exitCode: 0 },
  };
  await pause(400);
  for (const chunk of ["All ", "green ", "now."]) {
    yield { type: "text-delta", text: chunk };
    await pause(200);
  }
}

// Hoisted factory (EC-7): a stable identity — an inline arrow would restart
// the stream on every render.
function Demo() {
  const { events, streaming, status } = useAgentStream(demoTurn);
  const { exit } = useApp();

  useEffect(() => {
    if (status === "done" || status === "error") {
      // One breath before exit so the post-stream frame (with the M16
      // tool-detail cards) is the final piped frame.
      const handle = setTimeout(() => {
        exit();
      }, 100);
      return () => {
        clearTimeout(handle);
      };
    }
    return undefined;
  }, [status, exit]);

  return (
    <TheoTUIProvider>
      <Box flexDirection="column" width={60}>
        <AgentTimeline
          header={<WelcomeBanner name="Theo Stream" version={VERSION} />}
          events={events}
        />
        {/* M16: per-kind tool detail cards — the direct-composition route
            for ToolCallCard.result (the timeline's AgentEvent carries the
            coarse envelope; rich detail is app-side composition). */}
        {!streaming.active && (
          <Box flexDirection="column" marginTop={1}>
            <ToolCallCard
              name="Edit"
              status="success"
              summary="retry.ts"
              result={{
                kind: "diff",
                patch: [
                  "--- a/retry.ts",
                  "+++ b/retry.ts",
                  "@@ -1,2 +1,2 @@",
                  " const attempts = 3;",
                  "-const backoff = 0;",
                  "+added retry backoff",
                  "",
                ].join("\n"),
              }}
            />
            <ToolCallCard
              name="Bash"
              status="failed"
              summary="pnpm test"
              result={{
                kind: "output",
                shell: {
                  stdout: "434 passed",
                  stderr: "1 flaky retry",
                  exitCode: 1,
                },
              }}
            />
            <ToolCallCard
              name="Read"
              status="success"
              summary="retry.ts"
              result={{
                kind: "preview",
                text: Array.from(
                  { length: 12 },
                  (_, i) => `line ${i} of the file`,
                ).join("\n"),
                maxLines: 4,
              }}
            />
          </Box>
        )}
        {streaming.active ? (
          <AgentStreaming
            {...(streaming.thought === undefined
              ? {}
              : { thought: streaming.thought })}
          />
        ) : undefined}
      </Box>
    </TheoTUIProvider>
  );
}

render(<Demo />);
