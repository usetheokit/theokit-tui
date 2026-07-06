import { render } from "ink-testing-library";

import { ChatMessage } from "../../src/chat-message.js";

// NO_COLOR probe (plan T2.1 / SEPA resolutions 2 + pre-commit audit):
// chalk fixes its color level at module load, so a degraded render can only
// be produced in a FRESH process whose env carries NO_COLOR before imports.
// This fixture renders one message and prints the raw frame to stdout.
const instance = render(
  <ChatMessage role="user">plain text probe</ChatMessage>,
);
await new Promise((resolve) => setTimeout(resolve, 0));
process.stdout.write(instance.lastFrame() ?? "");
instance.unmount();
