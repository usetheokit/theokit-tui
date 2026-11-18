import { describe, expect, it } from "vitest";
import type { AgentEvent } from "../../src/agent/agent-event.js";
import { AgentTimeline } from "../../src/agent/agent-timeline.js";
import { defaultToolHeader, messagesToAgentEvents } from "../../src/agent/messages-to-events.js";
import { stripAnsi } from "../../src/format/ansi.js";
import { ToolCall } from "../../src/tools/tool-call.js";
import { renderFrame } from "../fixtures/helpers.js";

const refused = (refusal: Extract<AgentEvent, { kind: "tool" }>["refusal"]): AgentEvent[] => [
  { id: "t1", kind: "tool", name: "shell_exec", status: "failed", ...(refusal ? { refusal } : {}) },
];

describe("refused tool call (#192)", () => {
  it("renders_Rejected_and_nothing_ran_for_human", async () => {
    const out = stripAnsi(await renderFrame(<AgentTimeline events={refused({ by: "human" })} />));
    expect(out).toContain("Rejected ShellExec");
    expect(out).toContain("nothing ran");
    expect(out).not.toContain("Ran");
  });

  it("renders_Rejected_for_timeout", async () => {
    const out = stripAnsi(
      await renderFrame(<ToolCall name="shell_exec" status="failed" refusal={{ by: "timeout" }} />),
    );
    expect(out).toContain("Rejected");
  });

  it("renders_Blocked_with_reason_for_policy_and_hook", async () => {
    for (const by of ["policy", "hook"] as const) {
      const out = stripAnsi(
        await renderFrame(
          <AgentTimeline events={refused({ by, reason: "path outside workspace" })} />,
        ),
      );
      expect(out).toContain("Blocked");
      expect(out).toContain("nothing ran: path outside workspace");
    }
  });

  it("keeps_a_refused_call_visible_when_not_verbose", async () => {
    const out = stripAnsi(
      await renderFrame(<AgentTimeline events={refused({ by: "human" })} verbose={false} />),
    );
    expect(out).toContain("Rejected");
    expect(out).not.toContain("Ran 1");
  });

  const msg = (refusal: unknown, toolType = "tool-run_shell") => [
    {
      id: "m",
      role: "assistant" as const,
      parts: [{ type: toolType, toolCallId: "c1", state: "output-error", refusal } as never],
    },
  ];

  it("defaultToolHeader_does_not_produce_Ran_for_a_refused_call", async () => {
    const events = messagesToAgentEvents(msg({ by: "human" }), {
      formatToolHeader: defaultToolHeader,
    });
    const out = stripAnsi(await renderFrame(<AgentTimeline events={events} />));
    expect(out).toContain("Rejected RunShell");
    expect(out).not.toContain("Ran");
  });

  it("keeps_an_app_formatter_wording_without_a_second_verb", async () => {
    const events = messagesToAgentEvents(msg({ by: "human" }), {
      formatToolHeader: (e) => (e.refusal ? { name: "Blocked by you: command" } : undefined),
    });
    const out = stripAnsi(await renderFrame(<AgentTimeline events={events} />));
    expect(out).toContain("Blocked by you: command");
    expect(out).not.toContain("Rejected");
  });

  it("calls_formatToolResult_for_a_refusal_without_a_raw_result", async () => {
    const events = messagesToAgentEvents(msg({ by: "policy" }), {
      formatToolResult: (e) => (e.refusal ? { output: "custom wording" } : undefined),
    });
    const out = stripAnsi(await renderFrame(<AgentTimeline events={events} />));
    expect(out).toContain("custom wording");
    expect(out).not.toContain("nothing ran");
  });

  it("default_body_wins_over_supplied_output_shell_and_diff", async () => {
    const base = {
      id: "t",
      kind: "tool",
      name: "shell_exec",
      status: "failed",
      refusal: { by: "human" },
    } as const;
    for (const extra of [
      { output: "stale output" },
      { output: "" },
      { shell: { stdout: "stale shell", stderr: "", exitCode: 0 } },
      { diff: "--- a/x\n+++ b/x\n@@ -1 +1 @@\n-a\n+stale diff\n" },
    ]) {
      const out = stripAnsi(await renderFrame(<AgentTimeline events={[{ ...base, ...extra }]} />));
      expect(out).toContain("nothing ran");
      expect(out).not.toContain("stale");
    }
  });

  it("prefixes_an_ordinary_formatted_header_and_drops_Ran", async () => {
    const events = messagesToAgentEvents(msg({ by: "human" }), {
      formatToolHeader: () => ({ name: "Ran node x" }),
    });
    const out = stripAnsi(await renderFrame(<AgentTimeline events={events} />));
    expect(out).toContain("Rejected node x");
    expect(out).not.toContain("Ran");
  });

  it("keeps_an_explicit_refusal_header_like_Declined_command", async () => {
    const events = messagesToAgentEvents(msg({ by: "human" }), {
      formatToolHeader: (e) => (e.refusal ? { name: "Declined command" } : undefined),
    });
    const out = stripAnsi(await renderFrame(<AgentTimeline events={events} />));
    expect(out).toContain("Declined command");
    expect(out).not.toContain("Rejected");
    expect(out).not.toContain("Ran");
  });

  it("labels_ordinary_action_headers_as_refused", async () => {
    for (const name of ["Read file.ts", "Edited file.ts"]) {
      const events = messagesToAgentEvents(msg({ by: "policy" }), {
        formatToolHeader: () => ({ name }),
      });
      const out = stripAnsi(await renderFrame(<AgentTimeline events={events} />));
      expect(out).toContain(`Blocked ${name}`);
    }
  });

  it("keeps_refused_tools_of_an_explored_event_visible", async () => {
    const tool = (id: string, refusal?: { by: "policy"; reason: string }) =>
      ({
        id,
        kind: "tool",
        name: "read_file",
        status: refusal ? "failed" : "success",
        ...(refusal ? { refusal } : {}),
      }) as const;
    const events: AgentEvent[] = [
      {
        id: "e",
        kind: "explored",
        tools: [tool("a"), tool("b", { by: "policy", reason: "outside workspace" })],
      },
    ];
    for (const verbose of [true, false]) {
      const out = stripAnsi(await renderFrame(<AgentTimeline events={events} verbose={verbose} />));
      expect(out).toContain("Blocked");
      expect(out).toContain("nothing ran: outside workspace");
    }
  });
});
