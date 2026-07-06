import { Box } from "ink";
import { render } from "ink-testing-library";
import { describe, expect, it, vi } from "vitest";

import { renderFrame } from "../tests/helpers.js";
import type { AgentEvent, AgentMessageEvent } from "./agent-event.js";

// Row-render spy (M1 idiom): wrap the real ChatMessage so repaint-scope
// assertions can count message-row renders (plan T1.2, D2).
const rowRenders = vi.hoisted(() => ({ count: 0 }));
vi.mock("./chat-message.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./chat-message.js")>();
  return {
    ...actual,
    ChatMessage: (props: Parameters<typeof actual.ChatMessage>[0]) => {
      rowRenders.count += 1;
      return actual.ChatMessage(props);
    },
  };
});

const { AgentTimeline } = await import("./agent-timeline.js");

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

const message = (id: string, text: string): AgentMessageEvent => ({
  id,
  kind: "message",
  role: "assistant",
  text,
});

describe("AgentTimeline — event dispatch (T1.1)", () => {
  it("message_event_dispatches_to_chat_message", async () => {
    const frame = await renderFrame(
      <AgentTimeline events={[message("m1", "hello there")]} />,
    );
    expect(frame).toContain("✦");
    expect(frame).toContain("hello there");
  });

  it("thinking_event_renders_dim_italic_text", async () => {
    const frame = await renderFrame(
      <AgentTimeline
        events={[{ id: "t1", kind: "thinking", text: "planning the diff" }]}
      />,
    );
    expect(frame).toContain("planning the diff");
    expect(frame).toContain("·");
  });

  it("tool_event_dispatches_to_tool_card_with_result", async () => {
    const frame = await renderFrame(
      <AgentTimeline
        events={[
          {
            id: "x1",
            kind: "tool",
            name: "grep",
            status: "success",
            output: "3 matches",
          },
        ]}
      />,
    );
    expect(frame).toContain("✓");
    expect(frame).toContain("grep");
    expect(frame).toContain("3 matches");
  });

  it("tool_event_without_output_renders_bare_row", async () => {
    const frame = await renderFrame(
      <AgentTimeline
        events={[{ id: "x1", kind: "tool", name: "grep", status: "success" }]}
      />,
    );
    expect(frame).toContain("✓");
    expect(frame.split("\n")).toHaveLength(1);
  });

  it("empty_events_render_nothing", async () => {
    const frame = await renderFrame(<AgentTimeline events={[]} />);
    expect(frame).toBe("");
  });

  it("duplicate_event_ids_throw_typed_error", () => {
    const call = () =>
      AgentTimeline({ events: [message("e1", "a"), message("e1", "b")] });
    expect(call).toThrow(TypeError);
    expect(call).toThrow('AgentTimeline: duplicate event id "e1"');
  });

  it("unknown_event_kind_throws_typed_error", () => {
    const call = () =>
      AgentTimeline({
        events: [{ id: "w1", kind: "weird", text: "x" } as never],
      });
    expect(call).toThrow(TypeError);
    expect(call).toThrow(
      'AgentTimeline: unknown event kind "weird" — expected "message" | "thinking" | "tool"',
    );
  });

  it("shell_tool_event_renders_envelope", async () => {
    const frame = await renderFrame(
      <AgentTimeline
        events={[
          {
            id: "s1",
            kind: "tool",
            name: "pnpm lint",
            status: "failed",
            shell: { stdout: "", stderr: "boom", exitCode: 1 },
          },
        ]}
      />,
    );
    expect(frame).toContain("stderr:");
    expect(frame).toContain("exited 1");
  });

  it("tool_event_with_output_and_shell_throws_typed_error", () => {
    // EC-1: mid-render ToolResult exclusivity would be swallowed by Ink's
    // boundary and name the wrong component — fail at OUR boundary.
    const call = () =>
      AgentTimeline({
        events: [
          {
            id: "x1",
            kind: "tool",
            name: "grep",
            status: "success",
            output: "a",
            shell: { stdout: "", stderr: "", exitCode: 0 },
          },
        ],
      });
    expect(call).toThrow(TypeError);
    expect(call).toThrow(
      'AgentTimeline: tool event "x1" — provide only one of output | shell',
    );
  });

  it("invalid_message_role_throws_at_boundary", () => {
    // EC-2: ChatMessage's own guard fires mid-render (swallowed) — the
    // boundary owns variant-field validation (D8).
    const call = () =>
      AgentTimeline({
        events: [
          { id: "m1", kind: "message", role: "bot", text: "hi" } as never,
        ],
      });
    expect(call).toThrow(TypeError);
    expect(call).toThrow(/^AgentTimeline:/);
  });

  it("invalid_tool_status_throws_at_boundary", () => {
    const call = () =>
      AgentTimeline({
        events: [
          { id: "x1", kind: "tool", name: "grep", status: "weird" } as never,
        ],
      });
    expect(call).toThrow(TypeError);
    expect(call).toThrow(/^AgentTimeline:/);
  });

  it("empty_string_id_is_legal_and_duplicate_empty_throws", async () => {
    // EC-5: M1 parity — empty-but-valid ids are legal, only DUPLICATES throw.
    const frame = await renderFrame(
      <AgentTimeline events={[message("", "solo")]} />,
    );
    expect(frame).toContain("solo");
    const call = () =>
      AgentTimeline({ events: [message("", "a"), message("", "b")] });
    expect(call).toThrow(TypeError);
    expect(call).toThrow('AgentTimeline: duplicate event id ""');
  });

  it("invalid_max_lines_throws_at_boundary", () => {
    // SEPA F1: ToolResult's guard would fire mid-render — boundary owns it.
    const call = () =>
      AgentTimeline({
        events: [
          {
            id: "x1",
            kind: "tool",
            name: "grep",
            status: "success",
            output: "a",
            maxLines: 0,
          },
        ],
      });
    expect(call).toThrow(TypeError);
    expect(call).toThrow(
      'AgentTimeline: tool event "x1" — maxLines must be an integer >= 1 — got 0',
    );
  });

  it("tool_output_inherits_m2_normalization", async () => {
    // SEPA F2: CRLF stripped (EC-6), trailing blank popped (EC-7).
    const frame = await renderFrame(
      <AgentTimeline
        events={[
          {
            id: "x1",
            kind: "tool",
            name: "build",
            status: "success",
            output: "a\r\nb\n",
          },
        ]}
      />,
    );
    expect(frame).not.toContain("\r");
    expect(frame.split("\n")).toHaveLength(3); // header + 2 rows, no phantom
  });

  it("empty_output_collapses_to_bare_row", async () => {
    const frame = await renderFrame(
      <AgentTimeline
        events={[
          {
            id: "x1",
            kind: "tool",
            name: "noop",
            status: "success",
            output: "",
          },
        ]}
      />,
    );
    expect(frame.split("\n")).toHaveLength(1);
  });

  it("thinking_row_is_actually_dim_and_italic", async () => {
    // SEPA F3: dispatching thinking → ChatMessage(system) would produce an
    // identical NO-ANSI frame — pin the styling bytes (FORCE_COLOR=1).
    const frame = await renderFrame(
      <AgentTimeline
        events={[{ id: "t1", kind: "thinking", text: "styled thought" }]}
      />,
    );
    // eslint-disable-next-line no-control-regex
    expect(frame).toMatch(/\u001B\[2m/); // dim
    // eslint-disable-next-line no-control-regex
    expect(frame).toMatch(/\u001B\[3m/); // italic
  });

  it("tool_event_max_lines_flows_into_truncation", async () => {
    const output = Array.from({ length: 8 }, (_, i) => `row-${i}`).join("\n");
    const frame = await renderFrame(
      <AgentTimeline
        events={[
          {
            id: "x1",
            kind: "tool",
            name: "cat",
            status: "success",
            output,
            maxLines: 3,
          },
        ]}
      />,
    );
    expect(frame).toContain("… +6 lines hidden");
    expect(frame).toContain("row-7");
    expect(frame).not.toContain("row-0");
  });

  it("extra_event_properties_are_tolerated", async () => {
    // EC-12: M7 adapters forward enriched objects — unknown extras pass.
    const enriched: AgentMessageEvent & { timestamp: number } = {
      ...message("m1", "enriched"),
      timestamp: 123,
    };
    const events: AgentEvent[] = [enriched];
    const frame = await renderFrame(<AgentTimeline events={events} />);
    expect(frame).toContain("enriched");
  });
});

describe("AgentTimeline — windowed Static history (T1.2)", () => {
  const events = (n: number): AgentEvent[] =>
    Array.from({ length: n }, (_, i) => message(`e${i}`, `event-${i} body`));

  it("only_tail_rows_repaint_on_identity_replace", async () => {
    let list = events(20);
    const instance = render(
      <AgentTimeline events={list} windowSize={8} windowOverscan={4} />,
    );
    await tick();
    rowRenders.count = 0;
    const last = list[list.length - 1] as AgentMessageEvent;
    list = [...list.slice(0, -1), { ...last, text: last.text + "!" }];
    instance.rerender(
      <AgentTimeline events={list} windowSize={8} windowOverscan={4} />,
    );
    await tick();
    instance.unmount();
    expect(rowRenders.count).toBe(1);
  });

  it("static_prefix_is_frozen_after_graduation", async () => {
    let list = events(20);
    const instance = render(
      <AgentTimeline events={list} windowSize={8} windowOverscan={4} />,
    );
    await tick();
    // Mutate a GRADUATED event (index 0) via a new object, same id.
    const first = list[0] as AgentMessageEvent;
    list = [{ ...first, text: "MUTATED" }, ...list.slice(1)];
    instance.rerender(
      <AgentTimeline events={list} windowSize={8} windowOverscan={4} />,
    );
    await tick();
    const frame = instance.lastFrame() ?? "";
    instance.unmount();
    expect(frame).not.toContain("MUTATED");
  });

  it("same_array_rerender_repaints_nothing", async () => {
    const list = events(20);
    const instance = render(
      <AgentTimeline events={list} windowSize={8} windowOverscan={4} />,
    );
    await tick();
    rowRenders.count = 0;
    instance.rerender(
      <AgentTimeline events={list} windowSize={8} windowOverscan={4} />,
    );
    await tick();
    instance.unmount();
    expect(rowRenders.count).toBe(0);
  });

  it("window_size_zero_graduates_everything", async () => {
    let list = events(3);
    const instance = render(
      <AgentTimeline events={list} windowSize={0} windowOverscan={0} />,
    );
    await tick();
    const before = instance.lastFrame() ?? "";
    expect(before).toContain("event-0 body");
    expect(before).toContain("event-2 body");
    rowRenders.count = 0;
    list = [...list, message("e3", "event-3 body")];
    instance.rerender(
      <AgentTimeline events={list} windowSize={0} windowOverscan={0} />,
    );
    await tick();
    instance.unmount();
    // Only the appended event renders live (then graduates) — never the
    // whole history again.
    expect(rowRenders.count).toBe(1);
  });

  it("heterogeneous_graduation_keeps_output_ordered", async () => {
    const list: AgentEvent[] = [
      ...events(5),
      {
        id: "tool-mid",
        kind: "tool",
        name: "build",
        status: "success",
        output: "compiled 40 modules\nwrote dist/",
      },
      ...Array.from({ length: 5 }, (_, i) =>
        message(`late${i}`, `late-${i} body`),
      ),
    ];
    const frame = await renderFrame(
      <AgentTimeline events={list} windowSize={2} windowOverscan={0} />,
    );
    const cardIndex = frame.indexOf("compiled 40 modules");
    const earlyIndex = frame.indexOf("event-4 body");
    const lateIndex = frame.indexOf("late-0 body");
    expect(cardIndex).toBeGreaterThan(earlyIndex);
    expect(lateIndex).toBeGreaterThan(cardIndex);
  });

  it("negative_window_knobs_clamp_to_zero", async () => {
    // EC-6: M1 clamp parity — negative knobs behave exactly like 0/0.
    const frame = await renderFrame(
      <AgentTimeline events={events(3)} windowSize={-3} windowOverscan={-1} />,
    );
    expect(frame).toContain("event-0 body");
    expect(frame).toContain("event-1 body");
    expect(frame).toContain("event-2 body");
  });

  it("in_place_push_on_same_array_pins_hybrid_behavior", async () => {
    // EC-8: same-ref push — pinned behavior, NOT a supported pattern
    // (JSDoc says always pass a new array).
    const list = events(3);
    const instance = render(
      <AgentTimeline events={list} windowSize={8} windowOverscan={4} />,
    );
    await tick();
    rowRenders.count = 0;
    list.push(message("pushed", "pushed body"));
    instance.rerender(
      <AgentTimeline events={list} windowSize={8} windowOverscan={4} />,
    );
    await tick();
    const frame = instance.lastFrame() ?? "";
    instance.unmount();
    // Same reference: React sees equal props per row (memo hits), but the
    // length change re-runs the component — the pushed row renders.
    expect(frame).toContain("pushed body");
    expect(rowRenders.count).toBe(1);
  });
});

describe("AgentTimeline — representative turn (T3.1, roadmap DoD-3)", () => {
  it("representative_turn_matches_snapshot", async () => {
    // Running spinner pinned to dots frame[0] by renderFrame's 0ms tick —
    // NO added awaits (EC-14 coupling; plan Drawbacks).
    const turn: AgentEvent[] = [
      { id: "th1", kind: "thinking", text: "inspecting the failing test" },
      { id: "tl1", kind: "tool", name: "vitest", status: "running" },
      {
        id: "tl2",
        kind: "tool",
        name: "eslint",
        status: "success",
        output: "0 problems",
      },
      { id: "ms1", kind: "message", role: "assistant", text: "All green now." },
    ];
    const frame = await renderFrame(
      <Box width={40}>
        <AgentTimeline events={turn} />
      </Box>,
    );
    expect(frame).toContain("inspecting");
    expect(frame).toContain("⠋");
    expect(frame).toContain("✓");
    expect(frame).toContain("All green now.");
    expect(frame).toMatchSnapshot("agent-turn");
  });
});
