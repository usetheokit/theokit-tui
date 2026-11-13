import { describe, expect, it } from "vitest";
import { messagesToAgentEvents } from "../../src/agent/messages-to-events.js";
import {
  type StoredMessage,
  sessionMessagesToThread,
} from "../../src/agent/session-messages-to-thread.js";

const call = (extra: Partial<StoredMessage> = {}): StoredMessage => ({
  role: "assistant",
  text: "",
  parts: [
    { type: "text", text: "running" },
    { type: "tool_use", id: "c1", name: "shell_exec", input: { command: "ls" } },
  ],
  ...extra,
});
const result = (content: unknown, isError?: boolean): StoredMessage => ({
  role: "user",
  text: "",
  parts: [
    {
      type: "tool_result",
      toolUseId: "c1",
      content,
      ...(isError === undefined ? {} : { isError }),
    },
  ],
});

describe("sessionMessagesToThread", () => {
  it("pairs a result in a later message and drops the carrier", () => {
    const thread = sessionMessagesToThread([call(), result("ok")]);
    expect(thread).toHaveLength(1);
    expect(thread[0]?.id).toBe("history-0");
    expect(thread[0]?.parts[1]).toMatchObject({
      type: "tool-shell_exec",
      toolCallId: "c1",
      state: "output-available",
      output: "ok",
    });
  });

  it("maps isError to output-error with errorText", () => {
    const thread = sessionMessagesToThread([call(), result("boom", true)]);
    expect(thread[0]?.parts[1]).toMatchObject({ state: "output-error", errorText: "boom" });
  });

  it("gives input-available when no result exists", () => {
    const thread = sessionMessagesToThread([call()]);
    expect(thread[0]?.parts[1]).toMatchObject({ state: "input-available" });
  });

  it("yields a success tool event through messagesToAgentEvents", () => {
    const events = messagesToAgentEvents(sessionMessagesToThread([call(), result("ok")]));
    const tool = events.find((e) => e.kind === "tool");
    expect(tool).toMatchObject({ id: "c1", status: "success" });
  });

  it("stringifies non-string content", () => {
    const thread = sessionMessagesToThread([call(), result({ a: 1 })]);
    expect(thread[0]?.parts[1]).toMatchObject({ output: '{"a":1}' });
  });

  it("drops a result naming no call and skips unknown part types", () => {
    const stray: StoredMessage = {
      role: "user",
      text: "",
      parts: [{ type: "tool_result", toolUseId: "nope", content: "x" }],
    };
    const weird = {
      role: "assistant",
      text: "",
      parts: [
        { type: "image", src: "x" },
        { type: "text", text: "hi" },
      ],
    } as unknown as StoredMessage;
    expect(sessionMessagesToThread([stray])).toEqual([]);
    const thread = sessionMessagesToThread([weird]);
    expect(thread[0]?.parts).toEqual([{ type: "text", text: "hi" }]);
  });

  it("falls back to text, drops empty messages, honours idPrefix", () => {
    const thread = sessionMessagesToThread(
      [
        { role: "user", text: "hello" },
        { role: "assistant", text: "" },
        { role: "assistant", text: "yo" },
      ],
      { idPrefix: "r" },
    );
    expect(thread.map((m) => m.id)).toEqual(["r-0", "r-2"]);
    expect(thread[0]?.parts).toEqual([{ type: "text", text: "hello" }]);
  });
});
