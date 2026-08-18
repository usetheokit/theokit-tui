import { Box, Text, render } from "ink";

import {
  ChatMessage,
  ContextWindowBar,
  TheoTUIProvider,
  ToolCall,
  themes,
} from "../../src/index.js";
import type { TheoBuiltinThemeName } from "../../src/index.js";

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

// The showcase iterates the PUBLIC `themes` map (review wire-1 — the
// exported map demoed through the entry, not just the string-name form).
const showcase: TheoBuiltinThemeName[] = ["dark", "light"];

const instance = render(
  <Box flexDirection="column">
    {showcase.map((name) => (
      <Box key={name} flexDirection="column">
        <Text bold>
          {themes[name].name}
          {name === "dark" ? " (default)" : ""}
        </Text>
        <TheoTUIProvider theme={name}>
          <Scene />
        </TheoTUIProvider>
      </Box>
    ))}
  </Box>,
);
setTimeout(() => {
  instance.unmount();
}, 50);
