import { Box, render, Text } from "ink";
import { useEffect } from "react";

import {
  DiffViewer,
  ExpandableOutput,
  MarkdownText,
  osc8Link,
  setTerminalTitle,
} from "../../src/index.js";
import { FocusProvider } from "../../src/renderer/hooks/use-focus.js";
import { createInputSource } from "../../src/renderer/input/input-source.js";
import { InputContext } from "../../src/renderer/input/use-input.js";

// M25 example: the parity-polish surfaces composed — a Markdown table, a DiffViewer
// with intra-line word highlight, an ExpandableOutput (ctrl+r), and the terminal
// title + OSC-8 hyperlink helpers. Run: `pnpm tsx examples/renderer/parity-polish.tsx`.
// Requires a raw-mode TTY for the expand toggle.

const TABLE = [
  "## Release matrix",
  "",
  "| surface | status | since |",
  "| --- | :-: | ---: |",
  "| tables | ✓ | v0.26 |",
  "| intra-line diff | ✓ | v0.26 |",
  "",
].join("\n");

const PATCH = [
  "--- a/config.ts",
  "+++ b/config.ts",
  "@@ -1,1 +1,1 @@",
  "-const retries = 3;",
  "+const retries = 5;",
  "",
].join("\n");

const HIDDEN = Array.from({ length: 12 }, (_, i) => `log line ${i}`).join("\n");

function Demo() {
  useEffect(() => {
    setTerminalTitle("theokit — parity polish");
  }, []);
  return (
    <Box flexDirection="column" gap={1}>
      <MarkdownText text={TABLE} />
      <DiffViewer patch={PATCH} intraLineHighlight />
      <ExpandableOutput
        collapsed={<Text dimColor>log line 0 … (capped)</Text>}
        expanded={<Text dimColor>{HIDDEN}</Text>}
        hiddenCount={11}
      />
      <Text>{osc8Link("docs", "https://github.com/usetheokit/theokit-tui")}</Text>
    </Box>
  );
}

// Wire OUR input + focus providers (the composition root an app owns).
const source = createInputSource(process.stdin as never, (d) => process.stdout.write(d));
source.start();

const instance = render(
  <InputContext.Provider value={source}>
    <FocusProvider>
      <Demo />
    </FocusProvider>
  </InputContext.Provider>,
);

// Piped (non-TTY) — print one frame then exit cleanly (deterministic smoke test).
if (!process.stdin.isTTY) {
  setTimeout(() => {
    instance.unmount();
    source.stop();
    process.exit(0);
  }, 300);
}
