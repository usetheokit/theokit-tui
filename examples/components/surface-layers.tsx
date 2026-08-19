import { Box, render, Text } from "ink";

import {
  TheoTUIProvider,
  selectSurface,
  type SurfaceLayer,
} from "../../src/index.js";

// B-007 example: which surface owns the input row, as a LIST rather than a nested ternary.
//
// Reading the list top to bottom answers "what owns the row right now?" — the question a chained
// ternary can only answer by being followed. And the answer is a value: `selected.layer` is a
// string a test can assert without mounting any of the surfaces below.
interface SessionState {
  readonly trusted: boolean;
  readonly pendingApproval: boolean;
  readonly question: string | undefined;
}

const LAYERS: readonly SurfaceLayer<SessionState>[] = [
  {
    name: "trust-gate",
    when: (s) => !s.trusted,
    render: () => <Text color="yellow">Trust this directory? [y/n]</Text>,
  },
  {
    name: "approval",
    when: (s) => s.pendingApproval,
    render: () => <Text color="cyan">Allow `rm -rf build`? [y/n]</Text>,
  },
  {
    name: "question",
    when: (s) => s.question !== undefined,
    render: (s) => <Text>{s.question}</Text>,
  },
  {
    name: "composer",
    when: () => true,
    render: () => <Text dimColor>› _</Text>,
  },
];

// Trusted, nothing pending, no question — so the composer wins. The three surfaces above it are
// never rendered, and their `render` functions are never called.
const state: SessionState = {
  trusted: true,
  pendingApproval: false,
  question: undefined,
};
const selected = selectSurface(LAYERS, state);

const instance = render(
  <TheoTUIProvider>
    <Box flexDirection="column">
      <Text dimColor>claimant: {selected.layer ?? "(none)"}</Text>
      {selected.render()}
    </Box>
  </TheoTUIProvider>,
);
setTimeout(() => {
  instance.unmount();
}, 50);
