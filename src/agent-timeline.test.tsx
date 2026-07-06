import { describe, expect, it } from "vitest";

import { renderFrame } from "../tests/helpers.js";
import type { AgentEvent, AgentMessageEvent } from "./agent-event.js";
import { AgentTimeline } from "./agent-timeline.js";

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
