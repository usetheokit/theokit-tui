import { Box, Text, render, useApp } from "ink";
import { useEffect } from "react";

import {
  AgentStreaming,
  AgentTimeline,
  ContextWindowBar,
  TheoTUIProvider,
  VERSION,
  WelcomeBanner,
  useAgentStream,
} from "../../src/index.js";
import type { AgentStreamEvent } from "../../src/index.js";

// Live agent demo (plan m8-ga-publish T2.1, ADR D2 — ROADMAP M8 DoD-1): a
// REAL LLM turn streamed through the M7 adapter using ONLY @theokit/tui
// primitives. Transport lives HERE (caller-side, M7 zero-coupling contract):
// OpenRouter SSE via global fetch — zero dependencies.
//
// GATE: without OPENROUTER_API_KEY the demo renders an instructive banner
// scene and exits 0 (deterministic for CI); with the key it streams a real
// turn. Model kept cheap/fast on purpose.
const API_KEY = process.env["OPENROUTER_API_KEY"];
const MODEL = process.env["OPENROUTER_MODEL"] ?? "openai/gpt-4o-mini";
const PROMPT =
  "In two short sentences, greet a developer opening an AI coding agent TUI.";

/** One SSE line → a text delta (or null for keep-alives/[DONE] handled upstream). */
function parseSseDelta(line: string): string | null {
  if (!line.startsWith("data: ")) {
    return null;
  }
  const payload = line.slice(6);
  if (payload === "[DONE]") {
    return "[DONE]";
  }
  const delta = (
    JSON.parse(payload) as {
      choices?: Array<{ delta?: { content?: string } }>;
    }
  ).choices?.[0]?.delta?.content;
  return typeof delta === "string" && delta !== "" ? delta : null;
}

/** Split the streaming buffer into complete lines + the remainder. */
function drainLines(buffer: string): { lines: string[]; rest: string } {
  const parts = buffer.split("\n");
  const rest = parts.pop() ?? "";
  return { lines: parts.map((line) => line.trim()), rest };
}

/** OpenRouter SSE → AgentStreamEvent generator (the caller-side transport). */
async function* openRouterTurn(): AsyncGenerator<AgentStreamEvent> {
  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY ?? ""}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        stream: true,
        messages: [{ role: "user", content: PROMPT }],
      }),
    },
  );
  if (!response.ok || response.body === null) {
    throw new Error(
      `OpenRouter HTTP ${response.status} ${response.statusText}`,
    );
  }
  const decoder = new TextDecoder();
  const reader = response.body.getReader();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      return;
    }
    buffer += decoder.decode(value, { stream: true });
    const { lines, rest } = drainLines(buffer);
    buffer = rest;
    for (const line of lines) {
      const delta = parseSseDelta(line);
      if (delta === "[DONE]") {
        return;
      }
      if (delta !== null) {
        yield { type: "text-delta", text: delta };
      }
    }
  }
}

function LiveTurn() {
  const { events, streaming, status, error } = useAgentStream(openRouterTurn);
  const { exit } = useApp();
  useEffect(() => {
    if (status === "done" || status === "error") {
      exit();
    }
  }, [status, exit]);
  return (
    <Box flexDirection="column" width={72}>
      <WelcomeBanner
        name="Theo TUI live demo"
        version={VERSION}
        tagline={`model: ${MODEL}`}
      />
      <AgentTimeline events={events} />
      {streaming.active ? (
        <AgentStreaming
          {...(streaming.thought === undefined
            ? {}
            : { thought: streaming.thought })}
        />
      ) : undefined}
      {error === undefined ? undefined : (
        <Text color="red">stream failed: {error.message}</Text>
      )}
      <ContextWindowBar usedTokens={events.length * 24} limitTokens={128000} />
    </Box>
  );
}

function KeylessScene() {
  return (
    <Box flexDirection="column" width={72}>
      <WelcomeBanner
        name="Theo TUI"
        version={VERSION}
        tagline="live-agent demo (gated)"
        hints={[
          "export OPENROUTER_API_KEY=sk-or-... to stream a real turn",
          "optional: OPENROUTER_MODEL (default openai/gpt-4o-mini)",
          "then: pnpm example:live",
        ]}
      />
      <Text dimColor>
        No OPENROUTER_API_KEY in the environment — rendering the instructive
        scene and exiting cleanly.
      </Text>
    </Box>
  );
}

if (API_KEY === undefined || API_KEY === "") {
  const instance = render(
    <TheoTUIProvider>
      <KeylessScene />
    </TheoTUIProvider>,
  );
  setTimeout(() => {
    instance.unmount();
  }, 50);
} else {
  render(
    <TheoTUIProvider>
      <LiveTurn />
    </TheoTUIProvider>,
  );
}
