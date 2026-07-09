import { Box, render, Text } from "ink";
import { useEffect } from "react";

import {
  AgentStreaming,
  CollapsibleBlock,
  MultiStepProgress,
  notify,
  ThinkingBlock,
  Toast,
  TodoList,
  type TodoItem,
} from "../src/index.js";
import { FocusProvider } from "../src/renderer/hooks/use-focus.js";
import { createInputSource } from "../src/renderer/input/input-source.js";
import { InputContext } from "../src/renderer/input/use-input.js";

// M24 example: the live-turn progress surfaces composed — a TodoList + a
// MultiStepProgress + a ThinkingBlock/CollapsibleBlock + a Toast + the animated
// AgentStreaming indicator. Declarative/callback-only (the app owns the data).
// Run: `pnpm tsx examples/live-turn.tsx`. Requires a raw-mode TTY for the toggles.

const TODOS: TodoItem[] = [
  { id: "1", label: "read the spec", status: "done" },
  { id: "2", label: "write the tests", status: "active" },
  { id: "3", label: "make them pass", status: "pending" },
];

const STEPS: TodoItem[] = [
  { id: "a", label: "researcher", status: "done" },
  { id: "b", label: "coder", status: "active" },
  { id: "c", label: "reviewer", status: "pending" },
];

function Demo() {
  // Fire a desktop notification once — on a real TTY it emits OSC-9/BEL per the
  // capability matrix; piped (this example's smoke test), stdout is a non-TTY so
  // `notify` is a no-op (no stray escape bytes — the RISK-2 guard, end-to-end).
  useEffect(() => {
    notify("build finished ✓");
  }, []);
  return (
    <Box flexDirection="column" gap={1}>
      <TodoList items={TODOS} />
      <MultiStepProgress steps={STEPS} groupLabel="3 subagents" />
      <ThinkingBlock>
        The user wants a **live-turn** demo — I will compose the primitives.
      </ThinkingBlock>
      <CollapsibleBlock summary={<Text>tool output (space to expand)</Text>}>
        <Text dimColor>… 240 lines of build log …</Text>
      </CollapsibleBlock>
      <AgentStreaming
        phrases={["Thinking", "Cooking", "Reticulating splines"]}
      />
      <Toast
        message="build finished ✓"
        durationMs={5000}
        onDismiss={() => {}}
      />
    </Box>
  );
}

// Wire OUR input + focus providers (the composition root an app owns).
const source = createInputSource(process.stdin as never, (d) =>
  process.stdout.write(d),
);
source.start();

const instance = render(
  <InputContext.Provider value={source}>
    <FocusProvider>
      <Demo />
    </FocusProvider>
  </InputContext.Provider>,
);

// Piped (non-TTY) — print one frame then exit cleanly so the smoke test is
// deterministic (mirrors examples/decisions.tsx's ADR-D8-style exit).
if (!process.stdin.isTTY) {
  setTimeout(() => {
    instance.unmount();
    source.stop();
    process.exit(0);
  }, 300);
}
