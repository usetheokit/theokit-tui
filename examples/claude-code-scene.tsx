import { Box, Text, render } from "ink";

import {
  AgentStreaming,
  AgentTimeline,
  Notice,
  ProgressActivity,
  Stack,
  StatusFooter,
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
      {/* One <Stack> owns the vertical rhythm — no per-component marginTop. Every
          block (banner, notices group, timeline, working line, footer) is spaced
          by the same gap, so nothing is ever accidentally cramped. */}
      <Stack>
        <WelcomeBanner
          name="Theo Code"
          version="0.36.0"
          tagline="Welcome back!"
          aside={
            <Box flexDirection="column">
              <Text bold>Tips for getting started</Text>
              <Text>Run /init to create a CLAUDE.md file</Text>
            </Box>
          }
        />
        {/* the two notices are one tight group (gap 0), spaced from the rest by
            the outer Stack */}
        <Stack gap={0}>
          <Notice variant="info">
            Opus 4.8 is now available! · /model to switch
          </Notice>
          <Notice variant="warning">
            Both apiKeyHelper and ANTHROPIC_API_KEY set · auth may not work
          </Notice>
        </Stack>
        <AgentTimeline events={TRANSCRIPT} />
        <AgentStreaming
          thought="Searching"
          showCancelHint
          elapsedSeconds={27}
          tokens={47_000}
          tokenDirection="down"
        />
        <ProgressActivity
          label="Compacting conversation…"
          percent={10}
          elapsedSeconds={423}
          tokens={24_600}
          tokenDirection="up"
        />
        <StatusFooter
          left={<Text>main · plan mode</Text>}
          right={<Text>42% context · add a hello world website</Text>}
          mode="auto-accept"
        />
      </Stack>
    </TheoTUIProvider>
  );
}

const instance = render(<Scene />);
setTimeout(() => instance.unmount(), 400);
