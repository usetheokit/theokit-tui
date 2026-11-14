import { describe, expect, it } from "vitest";
import { messagesToAgentEvents, sessionMessagesToThread } from "../../src/index.js";
import type { StoredMessage } from "../../src/index.js";

const call: StoredMessage = {
  role: "assistant",
  text: "running",
  parts: [
    { type: "text", text: "running" },
    { type: "tool_use", id: "c1", name: "shell_exec", input: { cmd: "ls" } },
  ],
};
const result = (content: unknown, isError?: boolean): StoredMessage => ({
  role: "user",
  text: "",
  parts: [{ type: "tool_result", toolUseId: "c1", content, ...(isError ? { isError } : {}) }],
});

describe("sessionMessagesToThread", () => {
  it("pairs a result from the next message and drops the carrier", () => {
    const thread = sessionMessagesToThread([call, result("ok")]);
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
    const part = sessionMessagesToThread([call, result("boom", true)])[0]?.parts[1];
    expect(part).toMatchObject({ state: "output-error", errorText: "boom" });
  });

  it("marks a call without a result input-available", () => {
    expect(sessionMessagesToThread([call])[0]?.parts[1]).toMatchObject({
      state: "input-available",
    });
  });

  it("stringifies non-string content", () => {
    const part = sessionMessagesToThread([call, result({ a: 1 })])[0]?.parts[1];
    expect(part).toMatchObject({ output: '{"a":1}' });
  });

  it("yields a success tool event through messagesToAgentEvents", () => {
    const events = messagesToAgentEvents(sessionMessagesToThread([call, result("ok")]));
    expect(events.find((e) => e.kind === "tool")).toMatchObject({ id: "c1", status: "success" });
  });

  it("drops an orphan result and skips unknown part types without throwing", () => {
    const orphan: StoredMessage = {
      role: "user",
      text: "",
      parts: [{ type: "tool_result", toolUseId: "nope", content: "x" }, { type: "image" } as never],
    };
    expect(sessionMessagesToThread([orphan])).toEqual([]);
  });

  it("falls back to text, drops empty messages and honours idPrefix", () => {
    const thread = sessionMessagesToThread(
      [
        { role: "user", text: "hi" },
        { role: "assistant", text: "" },
        { role: "assistant", text: "yo" },
      ],
      { idPrefix: "r" },
    );
    expect(thread.map((m) => m.id)).toEqual(["r-0", "r-2"]);
    expect(thread[0]?.parts).toEqual([{ type: "text", text: "hi" }]);
  });
});
