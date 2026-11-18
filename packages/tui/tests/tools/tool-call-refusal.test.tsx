import { describe, expect, it } from "vitest";

import { AgentTimeline } from "../../src/agent/agent-timeline.js";
import type { AgentEvent } from "../../src/agent/agent-event.js";
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

  it("does_not_say_Ran_for_a_custom_Ran_header", async () => {
    const out = stripAnsi(
      await renderFrame(<ToolCall name="Ran node x" status="failed" refusal={{ by: "human" }} />),
    );
    expect(out).toContain("Rejected");
    expect(out).not.toContain("Ran");
  });

  it("keeps_a_refused_call_visible_when_not_verbose", async () => {
    const out = stripAnsi(
      await renderFrame(<AgentTimeline events={refused({ by: "human" })} verbose={false} />),
    );
    expect(out).toContain("Rejected");
    expect(out).not.toContain("Ran 1");
  });
});
