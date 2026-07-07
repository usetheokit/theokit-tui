import { Box, Text, render } from "ink";

import {
  ChatMessage,
  ContextWindowBar,
  TheoTUIProvider,
  ToolCall,
} from "../src/index.js";

// Theme showcase (plan T3.2 — TTFATT caller for the built-ins): the same
// scene under the dark and light themes. Static; piped output is clean.
function Scene() {
  return (
    <Box flexDirection="column">
      <ChatMessage role="assistant">theme showcase</ChatMessage>
      <ToolCall name="build" status="success" summary="2.1s" />
      <ContextWindowBar usedTokens={38_400} limitTokens={128_000} width={44} />
    </Box>
  );
}

const instance = render(
  <Box flexDirection="column">
    <Text bold>dark (default)</Text>
    <TheoTUIProvider theme="dark">
      <Scene />
    </TheoTUIProvider>
    <Text bold>light</Text>
    <TheoTUIProvider theme="light">
      <Scene />
    </TheoTUIProvider>
  </Box>,
);
setTimeout(() => {
  instance.unmount();
}, 50);
