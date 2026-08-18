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
const toolMsg = (
  output: unknown,
  state = "output-available",
): UIMessageLike => ({
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
    expect(ev.shell).toEqual({
      stdout: "MCP_SUM=111",
      stderr: "",
      exitCode: 0,
    });
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

  it("collapses consecutive read-only tools into one explored group", () => {
    const events = messagesToAgentEvents([
      {
        id: "m1",
        role: "assistant",
        parts: [
          {
            type: "tool-list_dir",
            toolCallId: "c1",
            state: "output-available",
            output: "a\nb",
            input: { path: "agents/tools" },
          },
          {
            type: "tool-grep",
            toolCallId: "c2",
            state: "output-available",
            output: "x",
            input: { pattern: "foo" },
          },
          {
            type: "tool-read_file",
            toolCallId: "c3",
            state: "output-available",
            output: "1\tcode",
            input: { path: "chat.ts" },
          },
        ],
      },
    ]);
    expect(events).toHaveLength(1);
    const grouped = events[0] as {
      kind: string;
      tools: { name: string; input?: unknown }[];
    };
    expect(grouped.kind).toBe("explored");
    expect(grouped.tools.map((t) => t.name)).toEqual([
      "list_dir",
      "grep",
      "read_file",
    ]);
    expect(grouped.tools[2]?.input).toEqual({ path: "chat.ts" }); // input captured for the summary
  });

  it("leaves a LONE read-only tool as a normal card (only ≥2 collapse)", () => {
    const events = messagesToAgentEvents([
      {
        id: "m1",
        role: "assistant",
        parts: [
          {
            type: "tool-read_file",
            toolCallId: "c1",
            state: "output-available",
            output: "x",
            input: { path: "x.ts" },
          },
        ],
      },
    ]);
    expect(events).toHaveLength(1);
    expect(events[0]?.kind).toBe("tool");
  });

  // Issue #59 item 8 (F-tests-7): the `explorable` predicate requires status
  // `success` OR `running`. Both branches were untested — only the `success` path was
  // exercised, so replacing the predicate with `status === "success"` (or dropping the
  // in-flight read from the group) went unnoticed.
  it("a FAILED read-only tool stays a discrete card and breaks the run", () => {
    const events = messagesToAgentEvents([
      {
        id: "m1",
        role: "assistant",
        parts: [
          {
            type: "tool-list_dir",
            toolCallId: "c1",
            state: "output-available",
            output: "a",
            input: { path: "src" },
          },
          {
            type: "tool-read_file",
            toolCallId: "c2",
            state: "output-available",
            output: "x",
            input: { path: "a.ts" },
          },
          {
            type: "tool-read_file",
            toolCallId: "c3",
            state: "output-error",
            errorText: "ENOENT",
            input: { path: "missing.ts" },
          },
        ],
      },
    ]);
    // The first two group; the one that failed does NOT — a read that went wrong is
    // information the user needs to see, not a summarised row.
    expect(events).toHaveLength(2);
    const grouped = events[0] as { kind: string; tools: { id: string }[] };
    expect(grouped.kind).toBe("explored");
    expect(grouped.tools.map((t) => t.id)).toEqual(["c1", "c2"]);
    expect(events[1]).toMatchObject({
      kind: "tool",
      id: "c3",
      status: "failed",
    });
  });

  it("a RUNNING read-only tool joins the group", () => {
    const events = messagesToAgentEvents([
      {
        id: "m1",
        role: "assistant",
        parts: [
          {
            type: "tool-list_dir",
            toolCallId: "c1",
            state: "output-available",
            output: "a",
            input: { path: "src" },
          },
          {
            type: "tool-read_file",
            toolCallId: "c2",
            state: "input-available",
            input: { path: "in-flight.ts" },
          },
        ],
      },
    ]);
    expect(events).toHaveLength(1);
    const grouped = events[0] as {
      kind: string;
      tools: { id: string; status: string }[];
    };
    expect(grouped.kind).toBe("explored");
    expect(grouped.tools.map((t) => t.id)).toEqual(["c1", "c2"]);
    expect(grouped.tools[1]?.status).toBe("running");
  });

  it("a message between reads breaks the run (no group)", () => {
    const events = messagesToAgentEvents([
      {
        id: "m1",
        role: "assistant",
        parts: [
          {
            type: "tool-read_file",
            toolCallId: "c1",
            state: "output-available",
            output: "a",
            input: { path: "a" },
          },
          { type: "text", text: "now the second" },
          {
            type: "tool-read_file",
            toolCallId: "c2",
            state: "output-available",
            output: "b",
            input: { path: "b" },
          },
        ],
      },
    ]);
    expect(events.filter((e) => e.kind === "explored")).toHaveLength(0);
    expect(events.filter((e) => e.kind === "tool")).toHaveLength(2);
  });

  it("does not group non-explore tools (run_shell stays discrete cards)", () => {
    const events = messagesToAgentEvents([
      {
        id: "m1",
        role: "assistant",
        parts: [
          {
            type: "tool-run_shell",
            toolCallId: "c1",
            state: "output-available",
            output: "1",
          },
          {
            type: "tool-run_shell",
            toolCallId: "c2",
            state: "output-available",
            output: "2",
          },
        ],
      },
    ]);
    expect(events.filter((e) => e.kind === "explored")).toHaveLength(0);
    expect(events.filter((e) => e.kind === "tool")).toHaveLength(2);
  });

  it("exploreTools: [] disables grouping (back-compat opt-out)", () => {
    const parts = [
      {
        type: "tool-read_file",
        toolCallId: "c1",
        state: "output-available",
        output: "a",
        input: { path: "a" },
      },
      {
        type: "tool-read_file",
        toolCallId: "c2",
        state: "output-available",
        output: "b",
        input: { path: "b" },
      },
    ];
    const events = messagesToAgentEvents(
      [{ id: "m1", role: "assistant", parts }],
      { exploreTools: [] },
    );
    expect(events.filter((e) => e.kind === "explored")).toHaveLength(0);
    expect(events.filter((e) => e.kind === "tool")).toHaveLength(2);
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

describe("messagesToAgentEvents — formatToolResult (result-body seam)", () => {
  const jsonMsg = (name: string, output: unknown): UIMessageLike => ({
    id: "m1",
    role: "assistant",
    parts: [
      {
        type: `tool-${name}`,
        toolCallId: "c1",
        state: "output-available",
        output,
      },
    ],
  });

  it("maps a raw JSON result to a clean output body (overrides the default raw-JSON dump)", () => {
    const raw = JSON.stringify({
      ok: true,
      output: "print(6*7)\r\n42\r\n>>> ",
      alive: true,
    });
    const [ev] = messagesToAgentEvents([jsonMsg("write_stdin", raw)], {
      formatToolResult: (_e, r) => {
        const p =
          typeof r === "string" ? JSON.parse(r) : (r as { output?: unknown });
        return typeof p?.output === "string" ? { output: p.output } : undefined;
      },
    });
    expect(ev).toMatchObject({
      kind: "tool",
      output: "print(6*7)\r\n42\r\n>>> ",
    });
    expect((ev as { output?: string }).output).not.toContain('"ok":true');
  });

  it("undefined keeps the default routing (unmapped tools unchanged)", () => {
    const raw = JSON.stringify({ ok: true, replacements: 1 });
    const [ev] = messagesToAgentEvents([jsonMsg("edit_file", raw)], {
      formatToolResult: () => undefined,
    });
    expect((ev as { output?: string }).output).toContain("replacements");
  });

  it("clears the exclusive output/shell/diff before applying the override (display-only)", () => {
    const [ev] = messagesToAgentEvents(
      [jsonMsg("interactive_shell", "plain\nlines")],
      {
        formatToolResult: () => ({ output: "OVERRIDDEN" }),
      },
    );
    expect((ev as { output?: string }).output).toBe("OVERRIDDEN");
  });
});

describe("messagesToAgentEvents — formatToolHeader (header seam)", () => {
  const toolMsg = (name: string, toolCallId: string): UIMessageLike => ({
    id: "m1",
    role: "assistant",
    parts: [
      {
        type: `tool-${name}`,
        toolCallId,
        state: "output-available",
        output: "ok",
      },
    ],
  });

  it("overrides name and summary with the app-supplied header", () => {
    const [ev] = messagesToAgentEvents([toolMsg("run_shell", "c1")], {
      formatToolHeader: () => ({ name: "Ran", summary: "node --test" }),
    });
    expect(ev).toMatchObject({
      kind: "tool",
      name: "Ran",
      summary: "node --test",
    });
  });

  it("partial override (name only) leaves summary absent", () => {
    const [ev] = messagesToAgentEvents([toolMsg("run_shell", "c1")], {
      formatToolHeader: () => ({ name: "Ran" }),
    });
    expect(ev).toMatchObject({ kind: "tool", name: "Ran" });
    expect(ev).not.toHaveProperty("summary");
  });

  it("undefined leaves the raw tool name untouched", () => {
    const [ev] = messagesToAgentEvents([toolMsg("run_shell", "c1")], {
      formatToolHeader: () => undefined,
    });
    expect(ev).toMatchObject({ kind: "tool", name: "run_shell" });
  });

  it("the formatted header receives the fully-routed event (id, status, body)", () => {
    const seen: string[] = [];
    messagesToAgentEvents([toolMsg("run_shell", "c9")], {
      formatToolHeader: (event) => {
        seen.push(`${event.id}:${event.status}`);
        return undefined;
      },
    });
    expect(seen).toEqual(["c9:success"]);
  });

  // Documented contract (review F-tui-6): grouping matches the (possibly
  // overridden) event name — renaming an explore tool opts it OUT of the
  // explored collapse; unmapped explore tools still group.
  it("renaming an explore tool via the header opts it out of explored grouping", () => {
    const msgs = [toolMsg("read_file", "c1"), toolMsg("read_file", "c2")];
    // Unmapped: two consecutive reads collapse into one explored group.
    const grouped = messagesToAgentEvents([
      { id: "m1", role: "assistant", parts: msgs.flatMap((m) => m.parts) },
    ]);
    expect(grouped.map((e) => e.kind)).toEqual(["explored"]);
    // Mapped (renamed): the overridden name no longer matches exploreTools.
    const renamed = messagesToAgentEvents(
      [{ id: "m1", role: "assistant", parts: msgs.flatMap((m) => m.parts) }],
      { formatToolHeader: () => ({ name: "Read config" }) },
    );
    expect(renamed.map((e) => e.kind)).toEqual(["tool", "tool"]);
  });
});
