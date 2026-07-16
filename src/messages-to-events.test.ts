import { describe, expect, it } from "vitest";

import { readTurnUsage, type UIMessageLike } from "./messages-to-events.js";

// `readTurnUsage` reads the per-turn usage the agent stream rides on the ai-sdk finish chunk's
// messageMetadata (which lands on UIMessage.metadata via readUIMessageStream) — the seam a TUI status
// bar / cost meter renders. Structural + defensive: never throws on a message without well-formed usage.

const withMetadata = (metadata: unknown): UIMessageLike => ({
  id: "a1",
  role: "assistant",
  parts: [{ type: "text", text: "hi" }],
  metadata,
});

describe("readTurnUsage", () => {
  it("reads usage + cost + durationMs from a well-formed metadata", () => {
    const usage = readTurnUsage(
      withMetadata({
        usage: { inputTokens: 12, outputTokens: 34, totalTokens: 46, reasoningTokens: 5 },
        cost: 0.0021,
        durationMs: 1234,
      }),
    );
    expect(usage).toEqual({
      inputTokens: 12,
      outputTokens: 34,
      totalTokens: 46,
      reasoningTokens: 5,
      cost: 0.0021,
      durationMs: 1234,
    });
  });

  it("omits absent optional fields (cost/reasoning) rather than fabricating zeros", () => {
    const usage = readTurnUsage(
      withMetadata({ usage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 }, durationMs: 9 }),
    );
    expect(usage).toEqual({ inputTokens: 1, outputTokens: 2, totalTokens: 3, durationMs: 9 });
  });

  it("returns undefined for a message with no metadata (a user turn, or a run without done)", () => {
    expect(readTurnUsage({ id: "u1", role: "user", parts: [] })).toBeUndefined();
    expect(readTurnUsage(withMetadata(undefined))).toBeUndefined();
  });

  it("returns undefined for malformed metadata (defensive — never throws)", () => {
    expect(readTurnUsage(withMetadata({ usage: "nope" }))).toBeUndefined();
    expect(readTurnUsage(withMetadata({ usage: { inputTokens: "x" } }))).toBeUndefined();
    expect(readTurnUsage(withMetadata(42))).toBeUndefined();
  });
});
