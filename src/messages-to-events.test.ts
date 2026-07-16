import { describe, expect, it } from "vitest";

import {
  findPendingApproval,
  readTurnUsage,
  type UIMessageLike,
} from "./messages-to-events.js";

// `readTurnUsage` reads the per-turn usage the agent stream rides on the ai-sdk finish chunk's
// messageMetadata (which lands on UIMessage.metadata via readUIMessageStream) — the seam a TUI status
// bar / cost meter renders. Structural + defensive: never throws on a message without well-formed usage.

const withMetadata = (metadata: unknown): UIMessageLike => ({
  id: "a1",
  role: "assistant",
  parts: [{ type: "text", text: "hi" }],
  metadata,
});

// A gated tool pauses the run: ai-sdk reconstructs a tool part with `state: "approval-requested"` +
// `approval: { id }` (verified against readUIMessageStream). `findPendingApproval` surfaces it so the
// App renders an ApprovalPrompt and settles via `useAgent().approve(approvalId, decision)`.
const approvalRequestedMsg = (approvalId: string, toolName: string): UIMessageLike => ({
  id: "a2",
  role: "assistant",
  parts: [
    {
      type: "dynamic-tool",
      toolName,
      toolCallId: approvalId,
      state: "approval-requested",
      input: { to: "x@y.com" },
      approval: { id: approvalId },
    },
  ],
});

describe("findPendingApproval", () => {
  it("surfaces the approval id + tool name + input from an approval-requested part", () => {
    const thread: UIMessageLike[] = [
      { id: "u1", role: "user", parts: [{ type: "text", text: "email x" }] },
      approvalRequestedMsg("call-9", "send_email"),
    ];
    expect(findPendingApproval(thread)).toEqual({
      approvalId: "call-9",
      toolName: "send_email",
      input: { to: "x@y.com" },
    });
  });

  it("returns undefined when no part is awaiting approval (settled or none)", () => {
    const thread: UIMessageLike[] = [
      { id: "u1", role: "user", parts: [{ type: "text", text: "hi" }] },
      {
        id: "a1",
        role: "assistant",
        parts: [{ type: "dynamic-tool", toolName: "t", toolCallId: "c1", state: "output-available" }],
      },
    ];
    expect(findPendingApproval(thread)).toBeUndefined();
    expect(findPendingApproval([])).toBeUndefined();
  });

  it("returns the MOST RECENT pending approval when several exist", () => {
    const thread: UIMessageLike[] = [
      approvalRequestedMsg("call-1", "old_tool"),
      approvalRequestedMsg("call-2", "new_tool"),
    ];
    expect(findPendingApproval(thread)?.approvalId).toBe("call-2");
  });
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
