import { render } from "ink-testing-library";

import { ChatThread } from "../../src/chat-thread.js";

// NO_COLOR probe (M0 T2.1 + M1 T4.2): chalk fixes its color level at module
// load, so the degraded render can only be produced in a FRESH process whose
// env carries NO_COLOR before imports. Renders a 3-role thread and prints the
// raw frame — role glyphs must stay distinguishable without color.
const instance = render(
  <ChatThread
    messages={[
      { id: "s", role: "system", content: "session context" },
      { id: "u", role: "user", content: "plain text probe" },
      { id: "a", role: "assistant", content: "degraded but readable" },
    ]}
  />,
);
await new Promise((resolve) => setTimeout(resolve, 0));
process.stdout.write(instance.lastFrame() ?? "");
instance.unmount();
