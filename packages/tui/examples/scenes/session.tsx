import { render } from "ink";
import type { AgentStreamEvent } from "../../src/index.js";
import { AgentSession, TheoTUIProvider } from "../../src/index.js";

// Ready-made session screen: transcript + composer + streaming + footer in one component.
// Esc interrupts a running turn; a message typed while the agent streams is queued and sent after.
// Needs a TTY (the composer reads raw-mode stdin). Try `/clear`-style commands via the slash menu.
async function* scriptedTurn(
  message: string,
  signal: AbortSignal,
): AsyncGenerator<AgentStreamEvent> {
  yield { type: "thinking", text: `reading "${message}"` };
  for (const chunk of ["You said: ", message, ". ", "This reply is scripted."]) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    if (signal.aborted) {
      return;
    }
    yield { type: "text-delta", text: chunk };
  }
}

const commands = [
  {
    name: "exit",
    description: "leave the session",
    run: () => process.exit(0),
  },
];

render(
  <TheoTUIProvider>
    <AgentSession stream={scriptedTurn} commands={commands} placeholder="Message the agent" />
  </TheoTUIProvider>,
);
