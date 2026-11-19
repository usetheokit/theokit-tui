import { describe, expect, it } from "vitest";
import type { AgentEvent } from "../../src/agent/agent-event.js";
import { AgentTimeline } from "../../src/agent/agent-timeline.js";
import { defaultToolHeader, messagesToAgentEvents } from "../../src/agent/messages-to-events.js";
import { stripAnsi } from "../../src/format/ansi.js";
import { ToolCall } from "../../src/tools/tool-call.js";
import { renderFrame } from "../fixtures/helpers.js";

const refused = (refusal: Extract<AgentEvent, { kind: "tool" }>["refusal"]): AgentEvent[] => [
  {
    id: "t1",
    kind: "tool",
    name: "shell_exec",
    status: "failed",
    ...(refusal ? { refusal } : {}),
  },
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
      parts: [
        {
          type: toolType,
          toolCallId: "c1",
          state: "output-error",
          refusal,
        } as never,
      ],
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

  it("keeps_explicit_refusal_wording_without_a_second_verb", async () => {
    const events = messagesToAgentEvents(msg({ by: "human" }), {
      formatRefusalHeader: () => "Blocked by you: command",
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

  it("corrects_an_execution_header_from_formatToolHeader_on_a_refused_call", async () => {
    const seen: unknown[] = [];
    const events = messagesToAgentEvents(msg({ by: "human" }), {
      formatToolHeader: (e) => {
        seen.push(e);
        return { name: "Ran node x" };
      },
    });
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ refusal: { by: "human" } });
    const out = stripAnsi(await renderFrame(<AgentTimeline events={events} />));
    expect(out).toContain("Rejected node x");
    expect(out).not.toContain("Ran");
  });

  it("corrects_a_directly_supplied_Ran_name_in_ToolCall_and_AgentTimeline", async () => {
    const out = stripAnsi(
      await renderFrame(<ToolCall name="Ran node x" status="failed" refusal={{ by: "policy" }} />),
    );
    expect(out).toContain("Blocked node x");
    expect(out).not.toContain("Ran");
    const ev: AgentEvent[] = [
      { id: "t", kind: "tool", name: "Ran node x", status: "failed", refusal: { by: "human" } },
    ];
    expect(stripAnsi(await renderFrame(<AgentTimeline events={ev} />))).toContain(
      "Rejected node x",
    );
  });

  it("keeps_a_header_that_already_carries_the_refusal_verb", async () => {
    const events = messagesToAgentEvents(msg({ by: "human" }), {
      formatToolHeader: (e) => (e.refusal ? { name: "Rejected node x" } : undefined),
    });
    const out = stripAnsi(await renderFrame(<AgentTimeline events={events} />));
    expect(out).toContain("Rejected node x");
    expect(out).not.toContain("Rejected Rejected");
  });

  it("a_formatter_destructuring_every_field_still_gets_a_corrected_header", async () => {
    const events = messagesToAgentEvents(msg({ by: "human" }), {
      formatToolHeader: ({ id, kind, name, status, input, summary, output, refusal }) => {
        void [id, kind, name, status, input, summary, output, refusal];
        return { name: "Ran node x" };
      },
    });
    const out = stripAnsi(await renderFrame(<AgentTimeline events={events} />));
    expect(out).toContain("Rejected node x");
  });

  it("forces_failed_status_when_a_refusal_is_accepted_on_any_state", () => {
    for (const state of ["output-available", "input-streaming", "input-available"]) {
      const [ev] = messagesToAgentEvents([
        {
          id: "m",
          role: "assistant" as const,
          parts: [{ type: "tool-x", toolCallId: "c", state, refusal: { by: "hook" } } as never],
        },
      ]);
      expect(ev).toMatchObject({ status: "failed", refusal: { by: "hook" } });
    }
  });

  it("ignores_a_refusal_whose_property_access_throws", () => {
    const hostile = new Proxy(
      {},
      {
        get: () => {
          throw new Error("boom");
        },
      },
    );
    const getter = {
      get by(): string {
        throw new Error("boom");
      },
    };
    const reason = {
      by: "human",
      get reason(): string {
        throw new Error("boom");
      },
    };
    for (const refusal of [hostile, getter, reason]) {
      const [ev] = messagesToAgentEvents(msg(refusal));
      expect(ev).not.toHaveProperty("refusal");
    }
  });

  it("keeps_explicit_wording_unchanged", async () => {
    for (const name of ["Denied", "Read blocked by policy"]) {
      const events = messagesToAgentEvents(msg({ by: "policy" }), {
        formatRefusalHeader: () => name,
      });
      const out = stripAnsi(await renderFrame(<AgentTimeline events={events} />));
      expect(out).toContain(name);
      expect(out).not.toContain(`Blocked ${name}`);
      expect(out).not.toContain("Rejected");
    }
  });

  it("calls_the_refusal_formatter_once_on_the_real_event_and_never_for_a_normal_call", () => {
    const seen: unknown[] = [];
    const normal = [
      {
        id: "m",
        role: "assistant" as const,
        parts: [
          {
            type: "tool-x",
            toolCallId: "n",
            state: "output-available",
          } as never,
        ],
      },
    ];
    const opts = { formatRefusalHeader: (e: unknown) => void seen.push(e) };
    messagesToAgentEvents(normal, opts);
    expect(seen).toEqual([]);
    const [event] = messagesToAgentEvents(msg({ by: "human" }), opts);
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ id: "c1", refusal: { by: "human" } });
    expect(event).toMatchObject({ refusal: { by: "human" } });
  });

  it("keeps_the_chronological_order_of_refused_calls_in_an_explored_event", async () => {
    const tool = (id: string, name: string, refusal?: { by: "policy" }) =>
      ({
        id,
        kind: "tool",
        name,
        status: refusal ? "failed" : "success",
        ...(refusal ? { refusal } : {}),
      }) as const;
    const events: AgentEvent[] = [
      {
        id: "e",
        kind: "explored",
        tools: [tool("a", "read_file"), tool("b", "grep", { by: "policy" }), tool("c", "list_dir")],
      },
    ];
    const out = stripAnsi(await renderFrame(<AgentTimeline events={events} />));
    expect(out.indexOf("Blocked")).toBeGreaterThan(out.indexOf("Explored"));
    expect(out.indexOf("List .")).toBeGreaterThan(out.indexOf("Blocked"));
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
