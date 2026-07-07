import { render } from "ink-testing-library";
import { createElement } from "react";
import { describe, expect, it } from "vitest";

import {
  agentStreamReducer,
  initialAgentStreamState,
} from "./agent-stream-reducer.js";
import type { AgentStreamEvent } from "./agent-stream-event.js";
import { AgentTimeline } from "./agent-timeline.js";

// T1.2 (plan m7-stream-adapter, ADRs D2/D9): the mapping fold. The mirror's
// fold-helper idiom; every discriminator branch PLUS the sub-paths the
// mirror leaves untested (testing.md § 4.1 — both lenses).

/** Fold a sequence of stream events through the reducer (mirror idiom). */
function fold(...events: AgentStreamEvent[]) {
  return events.reduce(agentStreamReducer, initialAgentStreamState);
}

const delta = (text: string): AgentStreamEvent => ({
  type: "text-delta",
  text,
});
const thinkDelta = (text: string): AgentStreamEvent => ({
  type: "thinking-delta",
  text,
});
const assistantMsg = (text: string): AgentStreamEvent => ({
  type: "assistant",
  message: { content: [{ type: "text", text }] },
});
const toolRunning = (callId: string, name: string): AgentStreamEvent => ({
  type: "tool_call",
  call_id: callId,
  name,
  status: "running",
});
const toolCompleted = (callId: string, result: unknown): AgentStreamEvent => ({
  type: "tool_call",
  call_id: callId,
  name: "t",
  status: "completed",
  result,
});
const errEvt = (error?: AgentStreamEvent["error"]): AgentStreamEvent => ({
  type: "error",
  ...(error === undefined ? {} : { error }),
});
const doneEvt = (): AgentStreamEvent => ({ type: "done" });

function find(state: ReturnType<typeof fold>, id: string) {
  return state.events.find((e) => e.id === id);
}

/** M3-boundary oracle: the folded events must NEVER trip AgentTimeline's
 * validation (unique ids, valid kinds/statuses, output⊕shell) — real render,
 * so the boundary throw propagates. */
function passesBoundary(state: ReturnType<typeof fold>): boolean {
  const { unmount } = render(
    createElement(AgentTimeline, { events: state.events }),
  );
  unmount();
  return true;
}

describe("agentStreamReducer", () => {
  it("initial_state_is_idle_and_empty", () => {
    const s = initialAgentStreamState;
    expect(s.status).toBe("idle");
    expect(s.events).toEqual([]);
    expect(s.streaming.active).toBe(false);
    expect(s.seq).toBe(0);
  });

  it("text_delta_opens_live_tail_message", () => {
    const s = fold(delta("he"));
    expect(s.events).toHaveLength(1);
    expect(s.events[0]).toMatchObject({
      kind: "message",
      role: "assistant",
      text: "he",
      id: "msg-1",
    });
    expect(s.status).toBe("streaming");
    expect(s.streaming.active).toBe(true);
  });

  it("text_delta_replaces_tail_by_identity", () => {
    // Same id — the M3 streaming replace anchor; new object each fold.
    const s = fold(delta("he"), delta("llo"));
    expect(s.events).toHaveLength(1);
    expect(s.events[0]).toMatchObject({ id: "msg-1", text: "hello" });
  });

  it("assistant_finalizes_live_message_in_place", () => {
    const s = fold(delta("hi"), assistantMsg("hi there"));
    expect(s.events).toHaveLength(1);
    expect(s.events[0]).toMatchObject({ id: "msg-1", text: "hi there" });
    // Status stays streaming — mirror parity (done/error are the closers).
    expect(s.status).toBe("streaming");
  });

  it("assistant_without_live_message_appends_fresh", () => {
    const s = fold(assistantMsg("solo"));
    expect(s.events[0]).toMatchObject({ id: "msg-1", text: "solo" });
  });

  it("assistant_empty_text_falls_back_to_buffer_then_mints_nothing", () => {
    const s1 = fold(delta("buf"), {
      type: "assistant",
      message: { content: [] },
    });
    expect(s1.events[0]).toMatchObject({ text: "buf" });
    const s2 = fold({ type: "assistant", message: { content: [] } });
    expect(s2.events).toHaveLength(0);
    // tool_use-only assistants mint nothing — lifecycle comes from tool_call
    // events (EC-11).
    const s3 = fold({
      type: "assistant",
      message: { content: [{ type: "tool_use" }] },
    });
    expect(s3.events).toHaveLength(0);
  });

  it("second_delta_run_opens_fresh_message", () => {
    // EC-5: liveMessageId cleared on finalize — msg-1 never resurrected.
    const s = fold(delta("a"), assistantMsg("a"), delta("b"));
    expect(s.events).toHaveLength(2);
    expect(s.events[0]).toMatchObject({ id: "msg-1", text: "a" });
    expect(s.events[1]).toMatchObject({ id: "msg-2", text: "b" });
  });

  it("thinking_accumulates_in_streaming_thought", () => {
    const s = fold(thinkDelta("pond"), thinkDelta("ering"));
    expect(s.streaming.thought).toBe("pondering");
    expect(s.events).toHaveLength(0);
  });

  it("thinking_graduates_once_on_transition", () => {
    // D9: graduation at the first EFFECTFUL non-thinking fold; thought clears.
    const s = fold(thinkDelta("plan"), delta("hi"));
    expect(s.events[0]).toMatchObject({
      kind: "thinking",
      id: "think-1",
      text: "plan",
    });
    expect(s.events[1]).toMatchObject({ kind: "message" });
    expect(s.streaming.thought).toBeUndefined();
  });

  it("coarse_thinking_event_folds_like_accumulation", () => {
    const s = fold({ type: "thinking", text: "replayed" }, doneEvt());
    expect(s.events[0]).toMatchObject({ kind: "thinking", text: "replayed" });
  });

  it("tool_running_appends_namespaced_id", () => {
    const s = fold(toolRunning("c1", "build"));
    expect(s.events[0]).toMatchObject({
      kind: "tool",
      id: "tool-c1",
      name: "build",
      status: "running",
    });
  });

  it("tool_fold_closes_open_live_message", () => {
    // EC-1 close-on-effectful-fold — the live message is ALWAYS the tail
    // while open (the M3 only-the-tail rule holds literally).
    const s = fold(delta("he"), toolRunning("c1", "t"), delta("llo"));
    expect(s.events.map((e) => e.id)).toEqual(["msg-1", "tool-c1", "msg-2"]);
    expect(s.events[0]).toMatchObject({ text: "he" });
    expect(s.events[2]).toMatchObject({ text: "llo" });
  });

  it("tool_completed_upserts_same_slot_with_shell_passthrough", () => {
    const s = fold(
      delta("x"),
      toolRunning("c1", "sh"),
      toolCompleted("c1", { stdout: "ok", stderr: "", exitCode: 0 }),
    );
    const tool = find(s, "tool-c1");
    expect(tool).toMatchObject({
      status: "success",
      shell: { stdout: "ok", exitCode: 0 },
    });
    expect(tool).not.toHaveProperty("output");
    // msg-1 was CLOSED at "x" by the tool fold (EC-1).
    expect(find(s, "msg-1")).toMatchObject({ text: "x" });
  });

  it("tool_nonzero_exit_still_success_status_completed", () => {
    // The SDK never constructs status:"error" — failures ARE completed +
    // exitCode ≠ 0; the exit badge renders the failure.
    const s = fold(
      toolRunning("c1", "t"),
      toolCompleted("c1", { stdout: "", stderr: "boom", exitCode: 2 }),
    );
    expect(find(s, "tool-c1")).toMatchObject({
      status: "success",
      shell: { exitCode: 2 },
    });
  });

  it("tool_sdk_error_status_maps_to_failed", () => {
    // Declared member honored even if unconstructed today.
    const s = fold(toolRunning("c1", "t"), {
      type: "tool_call",
      call_id: "c1",
      name: "t",
      status: "error",
    });
    expect(find(s, "tool-c1")).toMatchObject({ status: "failed" });
  });

  it("tool_missing_call_id_gets_anon_namespaced_id", () => {
    // The # prefix cannot collide with a producer call_id "anon-N" (EC-9);
    // never the mirror's shared "tool" collapse.
    const noId: AgentStreamEvent = {
      type: "tool_call",
      name: "x",
      status: "running",
    };
    const s = fold(noId, { ...noId });
    expect(s.events).toHaveLength(2);
    expect(new Set(s.events.map((e) => e.id)).size).toBe(2);
    expect(s.events[0]!.id).toMatch(/^tool-#/);
  });

  it("tool_completion_for_unknown_id_appends_terminal", () => {
    // Mirror parity — no throw, no running phase.
    const s = fold(
      toolCompleted("ghost", { stdout: "", stderr: "", exitCode: 0 }),
    );
    expect(s.events[0]).toMatchObject({ id: "tool-ghost", status: "success" });
  });

  it("non_shell_result_uses_output_ladder", () => {
    const plain = fold(toolCompleted("a", "plain"));
    expect(find(plain, "tool-a")).toMatchObject({ output: "plain" });
    const textField = fold(toolCompleted("b", { text: "t" }));
    expect(find(textField, "tool-b")).toMatchObject({ output: "t" });
    const weird = fold(toolCompleted("c", { weird: 1 }));
    expect(find(weird, "tool-c")).toMatchObject({ output: '{"weird":1}' });
    expect(find(weird, "tool-c")).not.toHaveProperty("shell");
  });

  it("error_fails_open_tools_and_closes_live_message", () => {
    // EC-6 — never the mirror's frozen spinner / silently lost text.
    const s = fold(
      delta("partial"),
      toolRunning("c1", "t"),
      errEvt({ message: "boom" }),
    );
    expect(s.status).toBe("error");
    expect(s.error?.message).toBe("boom");
    expect(find(s, "tool-c1")).toMatchObject({ status: "failed" });
    expect(find(s, "msg-1")).toMatchObject({ text: "partial" });
    expect(s.streaming.active).toBe(false);
  });

  it("error_string_form_and_fallback_message", () => {
    const s1 = fold(errEvt("plain"));
    expect(s1.error?.message).toBe("plain");
    const s2 = fold(errEvt());
    expect((s2.error?.message ?? "").length).toBeGreaterThan(0);
  });

  it("done_finalizes_and_drops_later_events", () => {
    // Drop-after-terminal — the mirror's resurrection rejected.
    const s = fold(
      delta("hi"),
      doneEvt(),
      delta("ZOMBIE"),
      toolRunning("z", "t"),
    );
    expect(s.status).toBe("done");
    expect(s.events).toHaveLength(1);
    expect(s.events[0]).toMatchObject({ text: "hi" });
  });

  it("done_fails_non_terminal_tools", () => {
    // EC-2 — cancel's terminal action rides this branch.
    const s = fold(toolRunning("c1", "t"), doneEvt());
    expect(find(s, "tool-c1")).toMatchObject({ status: "failed" });
  });

  it("error_state_drops_later_events", () => {
    // EC-3 — terminal means terminal for the PUBLIC reducer too.
    const s = fold(errEvt("boom"), delta("ZOMBIE"), toolRunning("z", "t"));
    expect(s.status).toBe("error");
    expect(s.events).toHaveLength(0);
  });

  it("unknown_and_ignored_kinds_are_noops", () => {
    // Cloud status NEVER folds as tool status; a task.text NEVER folds as
    // thinking (EC-10).
    const s = fold(
      { type: "system" },
      { type: "user" },
      { type: "status", status: "RUNNING", message: "cloud" },
      { type: "task", text: "not thinking" },
      { type: "thinking-completed" },
      { type: "wat" },
    );
    expect(s).toEqual({ ...initialAgentStreamState });
  });

  it("folded_state_always_passes_the_m3_boundary", () => {
    const scenarios = [
      fold(delta("a"), delta("b")),
      fold(thinkDelta("t"), delta("m"), toolRunning("c1", "x"), doneEvt()),
      fold(
        delta("x"),
        toolRunning("c1", "sh"),
        toolCompleted("c1", { stdout: "ok", stderr: "", exitCode: 0 }),
        assistantMsg("final"),
        doneEvt(),
      ),
      fold(delta("p"), toolRunning("c1", "t"), errEvt({ message: "e" })),
      fold(toolCompleted("ghost", "out"), doneEvt()),
    ];
    for (const state of scenarios) {
      expect(passesBoundary(state)).toBe(true);
    }
  });
});
