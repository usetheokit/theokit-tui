import { Box, render } from "ink";

import { ChatMessage, TheoTUIProvider } from "../../src/index.js";

// Smallest real consumer of @theokit/tui (plan T3.2) — the TTFATT seed:
// a provider + one user/assistant exchange, rendered by the real Ink renderer.
render(
  <TheoTUIProvider>
    <Box flexDirection="column">
      <ChatMessage role="user">What is @theokit/tui?</ChatMessage>
      <ChatMessage role="assistant">
        Ink primitives for AI-agent surfaces — chat, tool-calls, timelines, diffs and metrics.
      </ChatMessage>
    </Box>
  </TheoTUIProvider>,
);
