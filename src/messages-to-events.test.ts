import { describe, expect, it } from "vitest";

import {
  findPendingApproval,
  messagesToAgentEvents,
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
const approvalRequestedMsg = (
  approvalId: string,
  toolName: string,
): UIMessageLike => ({
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
        parts: [
          {
            type: "dynamic-tool",
            toolName: "t",
            toolCallId: "c1",
            state: "output-available",
          },
        ],
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
        usage: {
          inputTokens: 12,
          outputTokens: 34,
          totalTokens: 46,
          reasoningTokens: 5,
        },
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
      withMetadata({
        usage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 },
        durationMs: 9,
      }),
    );
    expect(usage).toEqual({
      inputTokens: 1,
      outputTokens: 2,
      totalTokens: 3,
      durationMs: 9,
    });
  });

  it("returns undefined for a message with no metadata (a user turn, or a run without done)", () => {
    expect(
      readTurnUsage({ id: "u1", role: "user", parts: [] }),
    ).toBeUndefined();
    expect(readTurnUsage(withMetadata(undefined))).toBeUndefined();
  });

  it("returns undefined for malformed metadata (defensive — never throws)", () => {
    expect(readTurnUsage(withMetadata({ usage: "nope" }))).toBeUndefined();
    expect(
      readTurnUsage(withMetadata({ usage: { inputTokens: "x" } })),
    ).toBeUndefined();
    expect(readTurnUsage(withMetadata(42))).toBeUndefined();
  });
});

// The tool-result projection: `useAgent().thread` delivers a tool's result on
// the `output-available` part. The in-process SDK serializes a shell envelope
// {stdout,stderr,exitCode} to a JSON STRING — so without routing it to the
// `shell` field the timeline dumps raw `{"stdout":...}` instead of firing
// ToolResult's shell renderer (the observed UX gap vs Codex).
const toolMsg = (output: unknown, state = "output-available"): UIMessageLike => ({
  id: "a1",
  role: "assistant",
  parts: [{ type: "tool-run_shell", toolCallId: "c1", state, output }],
});

const firstTool = (msg: UIMessageLike) => {
  const ev = messagesToAgentEvents([msg]).find((e) => e.kind === "tool");
  if (ev === undefined || ev.kind !== "tool") throw new Error("no tool event");
  return ev;
};

describe("messagesToAgentEvents tool-result routing", () => {
  it("routes a JSON-string shell envelope to the shell field", () => {
    const ev = firstTool(
      toolMsg('{"stdout":"MCP_SUM=111","stderr":"","exitCode":0}'),
    );
    expect(ev.shell).toEqual({ stdout: "MCP_SUM=111", stderr: "", exitCode: 0 });
    expect(ev.output).toBeUndefined();
  });

  it("routes a shell-envelope OBJECT to the shell field", () => {
    const ev = firstTool(
      toolMsg({ stdout: "", stderr: "boom\n", exitCode: 127 }),
    );
    expect(ev.shell).toEqual({ stdout: "", stderr: "boom\n", exitCode: 127 });
    expect(ev.output).toBeUndefined();
  });

  it("keeps a plain non-JSON string as output (file/grep/dir listings)", () => {
    const ev = firstTool(toolMsg("README.md\ncalc.mjs"));
    expect(ev.output).toBe("README.md\ncalc.mjs");
    expect(ev.shell).toBeUndefined();
  });

  it("keeps a non-envelope JSON string as output (no regression)", () => {
    const ev = firstTool(toolMsg('{"weird":1}'));
    expect(ev.output).toBe('{"weird":1}');
    expect(ev.shell).toBeUndefined();
  });

  it("routes a unified-diff result (apply_patch) to the diff field", () => {
    // apply_patch returns a unified diff; the SDK wraps it in the shell envelope
    // JSON string. A clean diff (no stderr, exit 0) renders as a colored inline
    // diff — not shell output, not raw JSON.
    const diff =
      "Index: a.ts\n===\n--- a.ts\n+++ a.ts\n@@ -1 +1 @@\n-old\n+new\n";
    const ev = firstTool(
      toolMsg(JSON.stringify({ stdout: diff, stderr: "", exitCode: 0 })),
    );
    expect(ev.diff).toContain("@@");
    expect(ev.diff).toContain("-old");
    expect(ev.diff).toContain("+new");
    expect(ev.output).toBeUndefined();
    expect(ev.shell).toBeUndefined();
  });

  it("routes a bare unified-diff string to the diff field", () => {
    const diff = "--- a.ts\n+++ a.ts\n@@ -1 +1 @@\n-old\n+new\n";
    const ev = firstTool(toolMsg(diff));
    expect(ev.diff).toContain("@@");
    expect(ev.output).toBeUndefined();
  });

  it("keeps a diff-looking stdout as shell when the command also failed", () => {
    // Guard: a non-clean envelope (stderr present) is NOT an apply_patch edit —
    // it stays a shell result so the failure is visible.
    const ev = firstTool(
      toolMsg(
        JSON.stringify({
          stdout: "--- a\n+++ a\n@@ -1 +1 @@\n-x\n+y",
          stderr: "boom",
          exitCode: 1,
        }),
      ),
    );
    expect(ev.shell).toBeDefined();
    expect(ev.diff).toBeUndefined();
  });

  it("surfaces an output-error as output text", () => {
    const ev = messagesToAgentEvents([
      {
        id: "a1",
        role: "assistant",
        parts: [
          {
            type: "tool-run_shell",
            toolCallId: "c1",
            state: "output-error",
            errorText: "command failed",
          },
        ],
      },
    ]).find((e) => e.kind === "tool");
    expect(ev).toMatchObject({ output: "command failed", status: "failed" });
  });
});
