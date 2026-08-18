import { Box, render, Text } from "ink";
import { useState } from "react";

import {
  OverlayProvider,
  Pager,
  SelectList,
  useOverlay,
  type SelectListItem,
} from "../../src/index.js";
import { FocusProvider } from "../../src/renderer/hooks/use-focus.js";
import { createInputSource } from "../../src/renderer/input/input-source.js";
import { InputContext } from "../../src/renderer/input/use-input.js";

// M22 example: the three interaction PRIMITIVES composed — a SelectList that
// opens a Pager overlay. This is a primitives demo, NOT an app picker (model/
// theme/session selectors are app compositions, OUT — parity matrix). Run:
// `pnpm tsx examples/components/interaction.tsx`. Requires a raw-mode TTY.

const FRUITS: SelectListItem[] = [
  { value: "apple", label: "apple", description: "open a pager" },
  { value: "banana", label: "banana", description: "open a pager" },
  { value: "cherry", label: "cherry", description: "open a pager" },
];

const LONG_TEXT = Array.from({ length: 60 }, (_, i) => `line ${i + 1}`).join(
  "\n",
);

function Demo() {
  const { push, pop } = useOverlay();
  const [chosen, setChosen] = useState<string | null>(null);
  return (
    <Box flexDirection="column" gap={1}>
      <Text>
        Pick a fruit (↑/↓, Enter) — it opens a scrollable Pager overlay:
      </Text>
      <SelectList
        items={FRUITS}
        onSubmit={(values) => {
          setChosen(values[0] ?? null);
          push(<Pager content={LONG_TEXT} onClose={pop} />);
        }}
      />
      {chosen ? <Text dimColor>last chosen: {chosen}</Text> : null}
    </Box>
  );
}

// Wire OUR input + focus + overlay providers (the composition root an app owns).
const source = createInputSource(process.stdin as never, (d) =>
  process.stdout.write(d),
);
source.start();

render(
  <InputContext.Provider value={source}>
    <FocusProvider>
      <OverlayProvider>
        <Demo />
      </OverlayProvider>
    </FocusProvider>
  </InputContext.Provider>,
);
