import { describe, expect, it } from "vitest";
import type { UIMessageLike } from "../../src/agent/messages-to-events.js";
import { messagesToAgentEvents } from "../../src/agent/messages-to-events.js";

// #156 — a consumer's `formatToolResult` was never called for a FAILED tool call.
//
// `toToolEvent` gated the override on `tool.output`, while `toolResultContent` fills an errored part
// from `tool.errorText`. So on the failure path — the path where a formatted body matters most —
// the gate short-circuited and the raw payload reached the user verbatim.
//
// Measured in TheoCode by rejecting a real approval:
//
//     ⎿ {"stdout":"","stderr":"Tool 'run_shell' denied by human approver","exitCode":126}
//
// Its formatter handled that shape and was never invoked, while `formatToolHeader` — which has no
// such gate — fired normally, so the header WAS customised and the body was not. Nothing indicated
// why.

const DENIED = JSON.stringify({
  stdout: "",
  stderr: "Tool 'run_shell' denied by human approver",
  exitCode: 126,
});

function messageWith(part: Record<string, unknown>): UIMessageLike[] {
  return [{ id: "m1", role: "assistant", parts: [part as never] }];
}

const failedPart = {
  type: "tool-run_shell",
  toolCallId: "call-1",
  state: "output-error",
  input: { command: "echo hi" },
  errorText: DENIED,
};

const okPart = {
  type: "tool-run_shell",
  toolCallId: "call-2",
  state: "output-available",
  input: { command: "echo hi" },
  output: JSON.stringify({ stdout: "hi\n", exit_code: 0 }),
};

describe("#156 — formatToolResult reaches the failure path", () => {
  it("test_the_formatter_is_called_for_a_FAILED_tool_call", () => {
    const seen: unknown[] = [];

    messagesToAgentEvents(messageWith(failedPart), {
      formatToolResult: (_event, raw) => {
        seen.push(raw);
        return { output: "formatted" };
      },
    });

    expect(seen, "the formatter was never called for a failed tool call").toHaveLength(1);
    expect(
      seen[0],
      "the formatter received something other than the payload the event carries",
    ).toBe(DENIED);
  });

  it("test_its_output_replaces_the_raw_payload", () => {
    const [event] = messagesToAgentEvents(messageWith(failedPart), {
      formatToolResult: () => ({ output: "you rejected this call" }),
    });

    expect(event).toMatchObject({
      kind: "tool",
      status: "failed",
      output: "you rejected this call",
    });
  });

  it("test_a_formatter_returning_undefined_still_leaves_the_raw_payload", () => {
    // `undefined` means "keep the default routing" and must not blank the body — a formatter that
    // declines to handle one tool should not erase what the user would otherwise have seen.
    const [event] = messagesToAgentEvents(messageWith(failedPart), {
      formatToolResult: () => undefined,
    });

    expect(event).toMatchObject({ output: DENIED });
  });

  it("test_the_success_path_is_unchanged", () => {
    // The fix must not alter which value a successful call hands the formatter.
    const seen: unknown[] = [];

    messagesToAgentEvents(messageWith(okPart), {
      formatToolResult: (_event, raw) => {
        seen.push(raw);
        return { output: "ok" };
      },
    });

    expect(seen).toEqual([okPart.output]);
  });

  it("test_a_failed_call_with_no_error_text_does_not_invoke_the_formatter", () => {
    // Nothing populated the body, so there is nothing to format. Calling it with `undefined` would
    // make every formatter grow a null check for a case that carries no information.
    const seen: unknown[] = [];

    messagesToAgentEvents(messageWith({ ...failedPart, errorText: undefined }), {
      formatToolResult: (_event, raw) => {
        seen.push(raw);
        return { output: "x" };
      },
    });

    expect(seen).toHaveLength(0);
  });
});
