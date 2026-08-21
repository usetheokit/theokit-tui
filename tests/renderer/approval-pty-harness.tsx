import { Text } from "ink";

import { ApprovalPrompt } from "../../src/prompts/approval-prompt.js";
import { FocusProvider } from "../../src/renderer/hooks/use-focus.js";
import { createInputSource } from "../../src/renderer/input/input-source.js";
import { InputContext } from "../../src/renderer/input/use-input.js";
import { createRenderer } from "../../src/renderer/renderer.js";
import { ProcessTerminal } from "../../src/renderer/terminal.js";

// M23 T4.1 PTY harness (plan m23-agent-decision-surfaces): a standalone program
// node-pty spawns in a REAL pseudo-terminal. It renders the REAL ApprovalPrompt
// through OUR V4 renderer (ProcessTerminal → process.stdout) driven by OUR
// InputSource in RAW MODE (stdin.isTTY === true, real setRawMode), and echoes the
// emitted decision as a cumulative-safe stdout marker. This exercises one full
// approve flow over the real raw-mode path AND the V4 render stack end-to-end
// (ChoiceRow keyboard → onDecision callback). Markers survive frame redraws
// because the e2e buffers ALL bytes ever written.

const stdin = process.stdin as unknown as Parameters<typeof createInputSource>[0];
const source = createInputSource(stdin, (d) => process.stdout.write(d));
source.setRawMode(true);
source.start();

const renderer = createRenderer(new ProcessTerminal());

const onDecision = (decision: string): void => {
  renderer.unmount();
  source.stop();
  process.stdout.write(`\nDECISION=${decision}\n`);
  process.exit(0);
};

renderer.render(
  <InputContext.Provider value={source}>
    <FocusProvider>
      <ApprovalPrompt title="Run command?" onDecision={onDecision}>
        <Text>$ deploy --prod</Text>
      </ApprovalPrompt>
    </FocusProvider>
  </InputContext.Provider>,
);

// Startup marker: proves the REAL raw-mode path (isTTY true in the pty child).
// Emitted AFTER render so the choice bar is mounted + focused before the e2e
// starts driving keys.
process.stdout.write(`\nREADY tty=${process.stdin.isTTY === true}\n`);
