import { Box } from "ink";
import { render } from "ink-testing-library";

import { AgentStreaming } from "../../src/agent-streaming.js";
import { ContextWindowBar } from "../../src/context-window-bar.js";
import { CostMeter } from "../../src/cost-meter.js";
import { DiffViewer } from "../../src/diff-viewer.js";
import { AgentTimeline } from "../../src/agent-timeline.js";
import { ChatThread } from "../../src/chat-thread.js";
import { TokenUsageChart } from "../../src/token-usage-chart.js";
import { ToolCall, ToolCallCard } from "../../src/tool-call.js";
import { ToolResult } from "../../src/tool-result.js";

// NO_COLOR probe (M0 T2.1 + M1 T4.2 + M2 T3.1): chalk fixes its color level
// at module load, so the degraded render can only be produced in a FRESH
// process whose env carries NO_COLOR before imports. Renders a 3-role thread
// + a 4-status tool scene — glyphs, the stderr label and the exit badge must
// stay distinguishable without color (plan ADR D5 / EC-13).
const instance = render(
  <Box flexDirection="column">
    <ChatThread
      messages={[
        { id: "s", role: "system", content: "session context" },
        { id: "u", role: "user", content: "plain text probe" },
        { id: "a", role: "assistant", content: "degraded but readable" },
      ]}
    />
    <ToolCall name="queued-tool" status="pending" />
    <ToolCall name="running-tool" status="running" />
    <ToolCall name="ok-tool" status="success" />
    <ToolCallCard name="broken-tool" status="failed" summary="exit path">
      <ToolResult
        shell={{ stdout: "partial", stderr: "permission denied", exitCode: 2 }}
      />
    </ToolCallCard>
    <AgentTimeline
      events={[
        {
          id: "think",
          kind: "thinking",
          text: "inspecting the failing test",
        },
      ]}
    />
    <AgentStreaming thought="agent turn" showCancelHint elapsedSeconds={12} />
    <DiffViewer
      patch={[
        "--- a/probe.ts",
        "+++ b/probe.ts",
        "@@ -1,11 +1,11 @@",
        "-old probe line",
        "+new probe line",
        ...Array.from({ length: 10 }, (_, i) => ` probe-ctx-${i}`),
        "",
      ].join("\n")}
      contextLines={2}
    />
    {/* M5 (T3.1): metrics scene — glyph-distinct fill (█ vs ░) is the
        color-independence mechanism (EC-5). */}
    <ContextWindowBar usedTokens={64_000} limitTokens={128_000} width={40} />
    <TokenUsageChart usage={{ input: 12_500, output: 4_000 }} />
    <CostMeter costUsd={1.234} />
  </Box>,
);
await new Promise((resolve) => setTimeout(resolve, 0));
process.stdout.write(instance.lastFrame() ?? "");
instance.unmount();
