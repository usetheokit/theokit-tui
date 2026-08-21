import { Box, render, Text } from "ink";

import {
  composerShortcutsFor,
  KeyboardHelp,
  StatusFooter,
  TheoTUIProvider,
} from "../../src/index.js";

// B-005 example: what an app says it can do, when it says only what it wired.
//
// This app wires the command menu and the help toggle, and does NOT wire the shell shortcut, file
// mentions, or an agents panel. Everything below is derived from that one declaration.
const WIRED = { commands: true, help: true } as const;

const instance = render(
  <TheoTUIProvider>
    <Box flexDirection="column">
      <KeyboardHelp shortcuts={composerShortcutsFor(WIRED)} />
      {/* The row that used to be unreachable: a permission mode is active, and the agents hint is
          absent because this app declared it does not have one. Before B-005 no prop could
          suppress it. */}
      <StatusFooter
        marginTop={1}
        left={<Text>main · plan</Text>}
        right={<Text>42% context</Text>}
        mode="auto-accept"
        affordances={{ shortcuts: true }}
      />
    </Box>
  </TheoTUIProvider>,
);
setTimeout(() => {
  instance.unmount();
}, 50);
