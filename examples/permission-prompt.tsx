import { Text, render } from "ink";

import {
  InkInputProvider,
  PermissionPrompt,
  TheoTUIProvider,
} from "../src/index.js";

// The Claude Code tool-approval card, live. Arrow keys (↑/↓) or a digit (1/2)
// move the selection; Enter commits; Esc is the safe default (No). Mounts
// InkInputProvider so the vertical numbered ChoiceRow responds to keys under Ink.

function Scene() {
  return (
    <TheoTUIProvider>
      <InkInputProvider>
        <PermissionPrompt
          toolType="Bash command"
          command="cd .../theo-sandboox/sdk/javascript && npm install 2>&1 | tail -8"
          description="Install SDK dev deps"
          ruleNote="Permission rule Bash(npm *) requires confirmation for this command."
          hint="/permissions to update rules"
          onDecision={(decision) => {
            instance.unmount();
            console.log(`\nDecision: ${decision}`);
            process.exit(0);
          }}
        />
      </InkInputProvider>
    </TheoTUIProvider>
  );
}

const instance = render(
  <>
    <Text dimColor>Use ↑/↓ or 1/2, Enter to confirm, Esc to reject.</Text>
    <Scene />
  </>,
);
