import { Box, Text } from "ink";
import { useEffect, useState } from "react";

import { createRenderer, ProcessTerminal } from "../../src/renderer/index.js";

// M17 renderer skeleton example (plan T3.1): mounts a React <Text> tree
// through OUR react-reconciler host + differential engine — NO Ink runtime,
// only Ink's Box/Text as the intrinsic-element source. Run: `pnpm
// example:renderer`. TTY only (writes real CSI sequences to stdout); piped
// runs print a one-line notice and exit so CI never hangs.

function Ticker(): React.ReactElement {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (n >= 5) {
      return;
    }
    const timer = setTimeout(() => setN((v) => v + 1), 400);
    return () => clearTimeout(timer);
  }, [n]);

  return (
    <Box flexDirection="column">
      <Text>theokit/tui — own renderer (M17 skeleton)</Text>
      <Text>react-reconciler + differential engine + CSI-2026</Text>
      <Text>{`ticks: ${"█".repeat(n)}${"░".repeat(5 - n)} ${n}/5`}</Text>
      {n >= 5 ? <Text>done — press Ctrl-C to exit</Text> : <Text>rendering…</Text>}
    </Box>
  );
}

if (!process.stdout.isTTY) {
  process.stdout.write("example:renderer is interactive (TTY only). Run it in a real terminal.\n");
  process.exit(0);
}

const renderer = createRenderer(new ProcessTerminal());
renderer.render(<Ticker />);

const shutdown = (): void => {
  renderer.unmount();
  process.stdout.write("\n");
  process.exit(0);
};
process.on("SIGINT", shutdown);
// Auto-exit after the ticker completes so the example is self-terminating.
setTimeout(shutdown, 3000);
