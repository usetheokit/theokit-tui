import { Box, render, Text } from "ink";

import { TheoTUIProvider, WindowedList } from "../../src/index.js";

// B-003 example: the presentational windowed list. Static scene — it captures no input, so piped
// output is clean and this runs without a raw-mode TTY (unlike `interaction.tsx`, whose SelectList
// needs one). That difference IS the component: something else owns the keys.
const turns = [
  "fix the flaky test in the payments consumer",
  "why is the p95 climbing after the 30d default landed?",
  "add a regression test for the tenant-id fallback",
  "revert the cache change, it broke the trace explorer",
  "summarise what we shipped this week",
  "the footer says 'auto-accept edits' but nothing is auto-accepted",
  "split the god module in packages/agent/src/chat.ts",
  "check whether the release tag points at the merge commit",
  "draft the ADR for the sandbox posture",
];

const instance = render(
  <TheoTUIProvider>
    <Box flexDirection="column">
      {/* Centred: the selection keeps context on BOTH sides, which is what walking backwards
          through history needs — and what a trailing menu window cannot give. */}
      <WindowedList
        rows={turns}
        selected={4}
        window={5}
        header={<Text dimColor>history — the header is the caller's, not ours</Text>}
      />
      {/* A list that fits renders whole, with no counts at all. */}
      <WindowedList marginTop={1} rows={turns.slice(0, 3)} selected={1} />
    </Box>
  </TheoTUIProvider>,
);
setTimeout(() => {
  instance.unmount();
}, 50);
