import { Box, render, Text } from "ink";
import { useEffect, useState } from "react";

import { TheoTUIProvider, useCoalesced } from "../../src/index.js";

// B-009 example: a stream that changes faster than anyone can read, throttled to a frame budget.
//
// `tokens` grows every 5ms. Deriving from it is not free, so `useCoalesced` recomputes at most once
// per 50ms window — and the counter proves it: far fewer derivations than updates. The LAST value
// still arrives, because the trailing update fires after the window closes even though nothing
// further changed. Without that, the final token of a stream is silently dropped.
let derivations = 0;

function Stream() {
  const [tokens, setTokens] = useState(0);

  useEffect(() => {
    if (tokens >= 40) return;
    const t = setTimeout(() => setTokens((n) => n + 1), 5);
    return () => clearTimeout(t);
  }, [tokens]);

  const summary = useCoalesced(
    () => {
      derivations += 1;
      return `derived at token ${String(tokens)}`;
    },
    tokens,
    { windowMs: 50 },
  );

  return (
    <Box flexDirection="column">
      <Text>updates: {tokens}</Text>
      <Text>derivations: {derivations}</Text>
      <Text dimColor>{summary}</Text>
    </Box>
  );
}

const instance = render(
  <TheoTUIProvider>
    <Stream />
  </TheoTUIProvider>,
);
setTimeout(() => {
  instance.unmount();
}, 400);
