import { Box } from "ink";
import { describe, expect, it } from "vitest";

// Integration boundary (plan T2.2, wiring pillar b): everything imported
// ONLY through the composition root — exactly as a consumer would.
import { render } from "ink-testing-library";
import { vi } from "vitest";

import {
  AGENT_EVENT_KINDS,
  AgentStreaming,
  AgentTimeline,
  CodeBlock,
  ContextWindowBar,
  CostMeter,
  DiffViewer,
  parseUnifiedDiff,
  ChatComposer,
  ChatMessage,
  ChatThread,
  TheoTUIProvider,
  TokenUsageChart,
  ToolCallCard,
  ToolResult,
  defaultTheme,
  themes,
} from "../src/index.js";
import type { TheoBuiltinThemeName } from "../src/index.js";
import {
  agentStreamReducer,
  initialAgentStreamState,
  useAgentStream,
  WelcomeBanner,
} from "../src/index.js";
import type { AgentStreamEvent } from "../src/index.js";
// (M1↔M2 composition asserted below — review wire-4.)
import { renderFrame } from "./helpers.js";

// eslint-disable-next-line no-control-regex
const stripAnsi = (s: string): string => s.replace(/\u001B\[[0-9;]*m/g, "");

describe("public API integration (T2.2)", () => {
  it("public_entry_composes_provider_and_message_for_both_roles", async () => {
    const frame = await renderFrame(
      <TheoTUIProvider theme={{ role: { user: { glyph: "$ " } } }}>
        <Box flexDirection="column">
          <ChatMessage role="user">first question</ChatMessage>
          <ChatMessage role="assistant">first answer</ChatMessage>
        </Box>
      </TheoTUIProvider>,
    );
    // Custom user glyph from the override + default assistant glyph intact.
    expect(frame).toContain("$");
    expect(frame).toContain(defaultTheme.role.assistant.glyph.trim());
    expect(frame).toContain("first question");
    expect(frame).toContain("first answer");
  });

  it("public_entry_renders_with_default_theme_without_provider", async () => {
    const frame = await renderFrame(
      <ChatMessage role="user">no provider needed</ChatMessage>,
    );
    expect(frame).toContain(defaultTheme.role.user.glyph.trim());
    expect(frame).toContain("no provider needed");
  });
});

describe("public API integration (T2.2 — thread scene)", () => {
  it("public_entry_composes_thread_with_provider", async () => {
    const frame = await renderFrame(
      <TheoTUIProvider theme={{ role: { system: { glyph: "§ " } } }}>
        <ChatThread
          messages={[
            { id: "s", role: "system", content: "session notes" },
            { id: "u", role: "user", content: "hi" },
            { id: "a", role: "assistant", content: "hello!" },
          ]}
        />
      </TheoTUIProvider>,
    );
    expect(frame).toContain("§");
    expect(frame).toContain("session notes");
    expect(frame).toContain("hello!");
  });
});

describe("public API integration (T3.2 — composer scene)", () => {
  it("public_entry_composes_composer_typing_and_submit", async () => {
    // Review F-wire-1: the composer exercised through the composition root,
    // driving the REAL stdin boundary (type + Enter submit).
    const onSubmit = vi.fn();
    const instance = render(
      <TheoTUIProvider>
        <ChatComposer onSubmit={onSubmit} placeholder="say hi" />
      </TheoTUIProvider>,
    );
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    instance.stdin.write("hey");
    await new Promise((r) => setTimeout(r, 50));
    instance.stdin.write("\r");
    await new Promise((r) => setTimeout(r, 50));
    expect(onSubmit).toHaveBeenCalledWith("hey");
    instance.unmount();
  });
});

describe("public API integration (M2 T3.1 — tool scene)", () => {
  it("public_entry_composes_tool_card_with_result", async () => {
    // Wiring pillar (b) for the M2 surface: card + shell result through the
    // composition root, exactly as a consumer would import them.
    const frame = await renderFrame(
      <TheoTUIProvider>
        <Box flexDirection="column">
          <ToolCallCard name="pnpm test" status="success" summary="exit 0">
            <ToolResult
              shell={{
                stdout: "130 passed",
                stderr: "deprecation warning",
                exitCode: 0,
              }}
            />
          </ToolCallCard>
          <ToolCallCard name="pnpm lint" status="failed">
            <ToolResult
              shell={{ stdout: "", stderr: "1 error", exitCode: 1 }}
            />
          </ToolCallCard>
        </Box>
      </TheoTUIProvider>,
    );
    expect(frame).toContain("●");
    expect(frame).toContain("130 passed");
    expect(frame).toContain("stderr:");
    expect(frame).toContain("deprecation warning");
    expect(frame).not.toContain("exited 0");
    expect(frame).toContain("exited 1");
  });

  it("public_entry_composes_thread_with_tool_cards", async () => {
    // M1↔M2 composition inside the test gate (review wire-4): a thread and a
    // tool card in one scene — the agent-turn shape the bench exercises.
    const frame = await renderFrame(
      <TheoTUIProvider>
        <Box flexDirection="column">
          <ChatThread
            messages={[
              { id: "u1", role: "user", content: "run the tests" },
              { id: "a1", role: "assistant", content: "on it" },
            ]}
          />
          <ToolCallCard name="vitest" status="success" summary="141 passed">
            <ToolResult lines={["all suites green"]} />
          </ToolCallCard>
        </Box>
      </TheoTUIProvider>,
    );
    expect(frame).toContain("run the tests");
    expect(frame).toContain("on it");
    expect(frame).toContain("●");
    expect(frame).toContain("vitest");
    expect(frame).toContain("all suites green");
  });
});

describe("public API integration (M3 T3.1 — agent scene)", () => {
  it("public_entry_composes_agent_surface", async () => {
    const frame = await renderFrame(
      <TheoTUIProvider>
        <Box flexDirection="column">
          <AgentTimeline
            events={[
              { id: "t1", kind: "thinking", text: "planning" },
              {
                id: "x1",
                kind: "tool",
                name: "build",
                status: "success",
                output: "done",
              },
              { id: "m1", kind: "message", role: "assistant", text: "Ready." },
            ]}
          />
          <AgentStreaming />
        </Box>
      </TheoTUIProvider>,
    );
    expect(frame).toContain("•"); // thinking glyph (dom-frontend-2)
    expect(frame).toContain("●");
    expect(frame).toContain("Ready.");
    expect(frame).toContain("Thinking…");
  });

  it("agent_events_export_kinds_array", () => {
    expect(AGENT_EVENT_KINDS).toEqual(["message", "thinking", "tool"]);
  });
});

describe("public API integration (M4 T3.1 — code scene)", () => {
  const scenePatch = [
    "--- a/old-name.ts",
    "+++ b/new-name.ts",
    "@@ -1,3 +1,3 @@",
    " context line",
    "-removed line",
    "+added line",
    "",
  ].join("\n");

  it("public_entry_composes_code_surface", async () => {
    const frame = await renderFrame(
      <TheoTUIProvider>
        <Box flexDirection="column">
          <DiffViewer patch={scenePatch} />
          <CodeBlock code={"const scene = true;"} language="typescript" />
        </Box>
      </TheoTUIProvider>,
    );
    const plain = stripAnsi(frame);
    expect(plain).toContain("old-name.ts → new-name.ts");
    expect(plain).toMatch(/^\s*\d+ \+ added line$/m);
    expect(plain).toContain("const scene = true;");
    expect(typeof parseUnifiedDiff).toBe("function");
  });

  it("composed_scene_matches_snapshot", async () => {
    const frame = await renderFrame(
      <Box width={60}>
        <TheoTUIProvider>
          <Box flexDirection="column">
            <DiffViewer patch={scenePatch} contextLines={2} />
            <CodeBlock code={"const scene = true;"} />
          </Box>
        </TheoTUIProvider>
      </Box>,
    );
    expect(frame).toMatchSnapshot("code-surface-scene");
  });
});

describe("public API integration (M5 T3.1 — metrics scene)", () => {
  it("public_entry_composes_metrics_surface", async () => {
    const frame = await renderFrame(
      <TheoTUIProvider>
        <Box flexDirection="column">
          <ContextWindowBar
            usedTokens={64_000}
            limitTokens={128_000}
            width={40}
          />
          <TokenUsageChart usage={{ input: 12_500, output: 4_000 }} />
          <CostMeter costUsd={1.234} />
        </Box>
      </TheoTUIProvider>,
    );
    const plain = stripAnsi(frame);
    expect(plain).toContain("% left");
    expect(plain).toContain("input");
    expect(plain).toContain("~$");
  });

  it("composed_metrics_scene_matches_snapshot", async () => {
    const frame = await renderFrame(
      <Box width={60}>
        <TheoTUIProvider>
          <Box flexDirection="column">
            <ContextWindowBar
              usedTokens={64_000}
              limitTokens={128_000}
              width={40}
            />
            <TokenUsageChart usage={{ input: 12_500, output: 4_000 }} />
            <CostMeter costUsd={1.234} />
          </Box>
        </TheoTUIProvider>
      </Box>,
    );
    // Anchor-then-snapshot hard convention (D5): the load-bearing numbers
    // are pinned before the layout snapshot can absorb them.
    const plain = stripAnsi(frame);
    expect(plain).toContain("50% left");
    expect(plain).toContain("~$1.23");
    expect(plain).toContain("█");
    expect(frame).toMatchSnapshot("metrics-surface-scene");
  });
});

describe("public API integration (M6 T3.2 — theme matrix)", () => {
  // Representative scene — NO focused composer: its ▏ marker is a DELIBERATE
  // no-color layout delta (plan EC-1); the invariance contract covers the
  // color-only components.
  function scene(themeName: TheoBuiltinThemeName) {
    return (
      <Box width={60}>
        <TheoTUIProvider theme={themeName}>
          <Box flexDirection="column">
            <ChatMessage role="assistant">theme matrix scene</ChatMessage>
            <ToolCallCard name="build" status="success" summary="ok" />
            <ContextWindowBar
              usedTokens={32_000}
              limitTokens={128_000}
              width={40}
            />
            <CodeBlock code={"const t = 1;"} language="typescript" />
          </Box>
        </TheoTUIProvider>
      </Box>
    );
  }

  it("theme_swap_preserves_text_layout", async () => {
    // D6: theming may change ONLY color bytes — never text or layout.
    const dark = stripAnsi(await renderFrame(scene("dark")));
    for (const themeName of ["light", "no-color"] as const) {
      const themed = stripAnsi(await renderFrame(scene(themeName)));
      expect(themed, themeName).toBe(dark);
    }
  });

  it("light_composite_scene_matches_snapshot", async () => {
    // review tests-1: the snapshot pins HIGHLIGHTED bytes — await the
    // single-flight loader so a filtered/isolated run can't capture the
    // plain first frame (testing.md § 3 independence).
    const { ensureHighlighter } = await import("../src/code-block.js");
    await ensureHighlighter();
    const frame = await renderFrame(scene("light"));
    // Anchor-then-snapshot hard convention: the light accent (blue → [34m)
    // must be present BEFORE the layout snapshot can absorb it.
    expect(frame).toContain("[34m");
    const plain = stripAnsi(frame);
    expect(plain).toContain("theme matrix scene");
    expect(plain).toContain("75% left");
    expect(plain).toContain("const t = 1;");
    expect(frame).toMatchSnapshot("light-theme-scene");
  });

  it("builtin_themes_reachable_from_entry", () => {
    expect(themes.light.accent).toBe("blue");
    expect(themes["no-color"].accent).toBe("");
    expect(themes.dark).toBe(defaultTheme);
  });
});

describe("public API integration (M7 T3.2 — stream adapter scene)", () => {
  const streamTicks = async (count = 20) => {
    for (let index = 0; index < count; index += 1) {
      await new Promise((resolve) => {
        setTimeout(resolve, 0);
      });
    }
  };

  // The canonical agent turn, streamed through the REAL hook — thinking,
  // tool lifecycle with a shell result, text-delta typing, done.
  async function* scriptedTurn(): AsyncGenerator<AgentStreamEvent> {
    yield { type: "thinking", text: "inspecting the failing test" };
    yield {
      type: "tool_call",
      call_id: "t1",
      name: "vitest",
      status: "running",
    };
    yield {
      type: "tool_call",
      call_id: "t1",
      name: "vitest",
      status: "completed",
      result: { stdout: "435 passed", stderr: "", exitCode: 0 },
    };
    yield { type: "text-delta", text: "All " };
    yield { type: "text-delta", text: "green now." };
  }

  function StreamScene() {
    const { events, streaming } = useAgentStream(scriptedTurn);
    return (
      <TheoTUIProvider>
        <Box flexDirection="column" width={60}>
          <AgentTimeline events={events} />
          {streaming.active ? (
            <AgentStreaming
              {...(streaming.thought === undefined
                ? {}
                : { thought: streaming.thought })}
            />
          ) : undefined}
        </Box>
      </TheoTUIProvider>
    );
  }

  it("public_entry_composes_stream_adapter", async () => {
    expect(typeof agentStreamReducer).toBe("function");
    expect(initialAgentStreamState.status).toBe("idle");
    const instance = render(
      <Box width={60}>
        <StreamScene />
      </Box>,
    );
    await streamTicks();
    const frame = instance.lastFrame() ?? "";
    instance.unmount();
    const plain = stripAnsi(frame);
    expect(plain).toContain("●");
    expect(plain).toContain("vitest");
    expect(plain).toContain("inspecting the failing test");
    expect(plain).toContain("All green now.");
  });

  it("composed_stream_scene_matches_snapshot", async () => {
    const instance = render(
      <Box width={60}>
        <StreamScene />
      </Box>,
    );
    await streamTicks();
    const frame = instance.lastFrame() ?? "";
    instance.unmount();
    // Anchors FIRST — the snapshot is a layout pin, not the oracle.
    const plain = stripAnsi(frame);
    expect(plain).toContain("All green now.");
    expect(plain).toContain("vitest");
    expect(plain).toContain("●");
    expect(frame).toMatchSnapshot("stream-adapter-scene");
  });
});

describe("public API integration (M9 T2.1 — welcome banner scene)", () => {
  it("composed_banner_scene_matches_snapshot", async () => {
    const frame = await renderFrame(
      <Box width={60}>
        <TheoTUIProvider>
          <Box flexDirection="column">
            <WelcomeBanner
              name="Theo TUI"
              version="0.9.0"
              tagline="AI-agent primitives for the terminal"
              hints={["/help for commands", "esc to cancel"]}
            />
            <ChatThread
              messages={[
                { id: "u1", role: "user", content: "hello" },
                { id: "a1", role: "assistant", content: "welcome aboard" },
              ]}
            />
          </Box>
        </TheoTUIProvider>
      </Box>,
    );
    // Anchors FIRST (house convention) — then the layout pin.
    const plain = stripAnsi(frame);
    expect(plain).toContain("Theo TUI");
    expect(plain).toContain("v0.9.0");
    expect(plain).toContain("/help for commands");
    expect(plain).toContain("●");
    expect(plain).toContain("welcome aboard");
    expect(frame).toMatchSnapshot("welcome-banner-scene");
  });
});
