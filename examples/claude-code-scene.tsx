import { Box, Text, render } from "ink";

import {
  AgentStreaming,
  AgentTimeline,
  ModeIndicator,
  Notice,
  TheoTUIProvider,
  WelcomeBanner,
} from "../src/index.js";
import type { AgentEvent } from "../src/index.js";

// The full Claude Code look composed from the library's primitives: the
// two-column WelcomeBanner, inline Notices, an AgentTimeline transcript (which
// spaces every ⏺ block the Claude Code way), the working indicator with a live
// token count, and the permission-mode footer. Renders statically (safe piped).

const TRANSCRIPT: AgentEvent[] = [
  {
    id: "u1",
    kind: "message",
    role: "user",
    text: "add a hello world website",
  },
  {
    id: "a1",
    kind: "message",
    role: "assistant",
    text: "I'll create a hello world website for you.",
  },
  {
    id: "t1",
    kind: "tool",
    name: "Search",
    status: "success",
    summary: 'pattern: "**"',
    output: "Found 8 files",
  },
  {
    id: "a2",
    kind: "message",
    role: "assistant",
    text: "Since there are no existing files, I'll create a basic index.html.",
  },
  {
    id: "t2",
    kind: "tool",
    name: "Write",
    status: "success",
    summary: "/index.html",
  },
];

function Scene() {
  return (
    <TheoTUIProvider>
      <Box flexDirection="column">
        <WelcomeBanner
          name="Theo Code"
          version="0.35.0"
          tagline="Welcome back!"
          aside={
            <Box flexDirection="column">
              <Text bold>Tips for getting started</Text>
              <Text>Run /init to create a CLAUDE.md file</Text>
            </Box>
          }
        />
        <Notice variant="info" marginTop={1}>
          Opus 4.8 is now available! · /model to switch
        </Notice>
        <Notice variant="warning">
          Both apiKeyHelper and ANTHROPIC_API_KEY set · auth may not work
        </Notice>
        <Box marginTop={1}>
          <AgentTimeline events={TRANSCRIPT} />
        </Box>
        <AgentStreaming
          thought="Searching"
          showCancelHint
          elapsedSeconds={27}
          tokens={47_000}
          marginTop={1}
        />
        <ModeIndicator mode="auto-accept" marginTop={1} />
      </Box>
    </TheoTUIProvider>
  );
}

const instance = render(<Scene />);
setTimeout(() => instance.unmount(), 400);
