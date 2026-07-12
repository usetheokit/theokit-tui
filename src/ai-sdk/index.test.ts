import type { UIMessage } from "ai";
import { describe, expect, it } from "vitest";

import { uiMessagesToAgentEvents, uiMessagesToChatThread } from "./index.js";

// ---- test data factories -------------------------------------------------

const userText = (id: string, text: string): UIMessage => ({
  id,
  role: "user",
  parts: [{ type: "text", text }],
});

const assistantText = (id: string, text: string): UIMessage => ({
  id,
  role: "assistant",
  parts: [{ type: "text", text }],
});

/** An assistant turn carrying reasoning + text + a completed tool call (the realistic streamed shape). */
const richAssistant = (id: string): UIMessage => ({
  id,
  role: "assistant",
  parts: [
    { type: "reasoning", text: "let me check" },
    { type: "text", text: "Done." },
    {
      type: "dynamic-tool",
      toolName: "search",
      toolCallId: "call-1",
      state: "output-available",
      input: { q: "x" },
      output: { hits: 2 },
    },
  ],
});

// ---- uiMessagesToChatThread ----------------------------------------------

describe("uiMessagesToChatThread", () => {
  it("empty_input_yields_empty_thread", () => {
    expect(uiMessagesToChatThread([])).toEqual([]);
  });

  it("maps_id_role_and_concatenated_text", () => {
    const thread = uiMessagesToChatThread([
      userText("u1", "hello"),
      {
        id: "a1",
        role: "assistant",
        parts: [
          { type: "text", text: "hi " },
          { type: "text", text: "there" },
        ],
      },
    ]);
    expect(thread).toEqual([
      { id: "u1", role: "user", content: "hello" },
      { id: "a1", role: "assistant", content: "hi there" },
    ]);
  });

  it("skips_tool_or_reasoning_only_turns_no_empty_bubble", () => {
    const toolOnly: UIMessage = {
      id: "a1",
      role: "assistant",
      parts: [
        {
          type: "dynamic-tool",
          toolName: "search",
          toolCallId: "c1",
          state: "input-available",
          input: {},
        },
      ],
    };
    const reasoningOnly: UIMessage = {
      id: "a2",
      role: "assistant",
      parts: [{ type: "reasoning", text: "thinking" }],
    };
    const thread = uiMessagesToChatThread([
      userText("u1", "q"),
      toolOnly,
      reasoningOnly,
    ]);
    expect(thread).toEqual([{ id: "u1", role: "user", content: "q" }]);
  });

  it("keeps_text_from_a_mixed_turn", () => {
    const thread = uiMessagesToChatThread([richAssistant("a1")]);
    expect(thread).toEqual([{ id: "a1", role: "assistant", content: "Done." }]);
  });
});

// ---- uiMessagesToAgentEvents ---------------------------------------------

describe("uiMessagesToAgentEvents", () => {
  it("empty_input_yields_empty_timeline", () => {
    expect(uiMessagesToAgentEvents([])).toEqual([]);
  });

  it("text_part_becomes_a_message_event_carrying_role", () => {
    const events = uiMessagesToAgentEvents([
      userText("u1", "hello"),
      assistantText("a1", "hi"),
    ]);
    expect(events).toEqual([
      { id: "u1::m0", kind: "message", role: "user", text: "hello" },
      { id: "a1::m0", kind: "message", role: "assistant", text: "hi" },
    ]);
  });

  it("reasoning_part_becomes_a_thinking_event", () => {
    const events = uiMessagesToAgentEvents([
      {
        id: "a1",
        role: "assistant",
        parts: [{ type: "reasoning", text: "hmm" }],
      },
    ]);
    expect(events).toEqual([{ id: "a1::r0", kind: "thinking", text: "hmm" }]);
  });

  it("completed_tool_becomes_a_success_event_with_stringified_output", () => {
    const events = uiMessagesToAgentEvents([richAssistant("a1")]);
    expect(events).toEqual([
      { id: "a1::r0", kind: "thinking", text: "let me check" },
      { id: "a1::m1", kind: "message", role: "assistant", text: "Done." },
      {
        id: "call-1",
        kind: "tool",
        name: "search",
        status: "success",
        output: '{\n  "hits": 2\n}',
      },
    ]);
  });

  it("maps_every_tool_state_to_a_status", () => {
    const states: Array<[string, string]> = [
      ["input-streaming", "pending"],
      ["input-available", "running"],
      ["approval-requested", "pending"],
      ["approval-responded", "pending"],
      ["output-available", "success"],
      ["output-error", "failed"],
    ];
    for (const [state, expected] of states) {
      const part = {
        type: "dynamic-tool",
        toolName: "t",
        toolCallId: `c-${state}`,
        state,
        input: {},
      } as UIMessage["parts"][number];
      const events = uiMessagesToAgentEvents([
        { id: "a1", role: "assistant", parts: [part] },
      ]);
      expect(events[0], state).toMatchObject({
        kind: "tool",
        name: "t",
        status: expected,
      });
    }
  });

  it("output_error_uses_errorText_as_output", () => {
    const part = {
      type: "dynamic-tool",
      toolName: "t",
      toolCallId: "c1",
      state: "output-error",
      input: {},
      errorText: "boom",
    } as UIMessage["parts"][number];
    const events = uiMessagesToAgentEvents([
      { id: "a1", role: "assistant", parts: [part] },
    ]);
    expect(events[0]).toMatchObject({
      kind: "tool",
      status: "failed",
      output: "boom",
    });
  });

  it("static_tool_part_derives_name_from_the_type_suffix", () => {
    const part = {
      type: "tool-weather",
      toolCallId: "c1",
      state: "output-available",
      input: {},
      output: "sunny",
    } as UIMessage["parts"][number];
    const events = uiMessagesToAgentEvents([
      { id: "a1", role: "assistant", parts: [part] },
    ]);
    expect(events[0]).toEqual({
      id: "c1",
      kind: "tool",
      name: "weather",
      status: "success",
      output: "sunny",
    });
  });

  it("ignores_non_renderable_parts_and_keeps_ids_unique", () => {
    const events = uiMessagesToAgentEvents([
      {
        id: "a1",
        role: "assistant",
        parts: [
          { type: "step-start" },
          { type: "text", text: "one" },
          { type: "text", text: "two" },
        ],
      },
    ]);
    expect(events).toEqual([
      { id: "a1::m1", kind: "message", role: "assistant", text: "one" },
      { id: "a1::m2", kind: "message", role: "assistant", text: "two" },
    ]);
    expect(new Set(events.map((e) => e.id)).size).toBe(events.length);
  });
});
