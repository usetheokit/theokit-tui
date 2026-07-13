import { Box, Text, render } from "ink";

import { AgentTimeline, ChatThread, TheoTUIProvider } from "../src/index.js";
import {
  uiMessagesToAgentEvents,
  uiMessagesToChatThread,
} from "../src/ai-sdk/index.js";
import type { UIMessage } from "ai";

// `@theokit/tui/ai-sdk` demo: fold one `UIMessage[]` snapshot into BOTH render
// shapes — a chat bubble view (ChatThread) and a reasoning+tools timeline
// (AgentTimeline). In a real app these messages come from the `ai` SDK's
// `useChat` / the TheoKit unified client; they are built inline here so the
// example runs without a live model. Renders statically (safe piped to `cat`).

// The tool part shape is cast once — a real app receives fully-typed parts from
// the SDK; the adapter only reads `type` / `state` / `toolCallId` / `output`.
const messages = [
  {
    id: "u1",
    role: "user",
    parts: [{ type: "text", text: "Add a margin prop to the Button." }],
  },
  {
    id: "a1",
    role: "assistant",
    parts: [
      { type: "reasoning", text: "Reading Button.tsx to find the root Box." },
      {
        type: "tool-readFile",
        toolCallId: "call_1",
        state: "output-available",
        output: "export function Button(...) { return <Box>...</Box> }",
      },
      { type: "text", text: "Done — Button now accepts the margin family." },
    ],
  },
] as unknown as UIMessage[];

function Demo() {
  return (
    <TheoTUIProvider>
      <Box flexDirection="column">
        <Text bold>uiMessagesToChatThread → {"<ChatThread>"}</Text>
        <ChatThread messages={uiMessagesToChatThread(messages)} marginTop={1} />

        <Text bold>uiMessagesToAgentEvents → {"<AgentTimeline>"}</Text>
        <AgentTimeline
          events={uiMessagesToAgentEvents(messages)}
          marginTop={1}
        />
      </Box>
    </TheoTUIProvider>
  );
}

render(<Demo />);
