import { render } from "ink-testing-library";
import { describe, expect, it } from "vitest";

import { AgentTimeline, firstUnsettledIndex } from "../../src/agent/agent-timeline.js";
import type { AgentEvent, AgentToolEvent } from "../../src/agent/agent-event.js";
import { stripAnsi } from "../../src/format/ansi.js";

/**
 * usetheokit/theokit-tui#52 — a non-terminal tool row must never graduate into `<Static>`.
 *
 * `<Static>` is append-only scrollback: whatever it prints has been printed, and Ink cannot take it
 * back. A tool row that graduated while `running` is therefore frozen mid-flight — MEASURED under
 * ink-testing-library, the spinner glyph `⠋` stays in the transcript and the `success` shape never
 * appears at all. Widen the window so nothing graduates and the same sequence ends on `⏺`. Same
 * events, same order, two different transcripts, and the only difference is whether the row
 * happened to cross the boundary before it settled.
 *
 * (The issue reports the same root cause as a DOUBLE render — `Running X` above `Ran X`. Which of
 * the two a reader sees depends on how the host repaints; both are the row being committed before
 * it was final, and both stop happening for the same reason.)
 *
 * The downstream workaround was lossy in the other direction: a consumer dropped every non-terminal
 * tool event so a command appeared only once it finished, which removes the running indicator
 * entirely. Neither is what the transcript should say.
 *
 * These tests drive a real streaming sequence, because the defect only exists ACROSS renders: a
 * single frame of a `running` row is correct, and it is the later frames that reveal whether that
 * frame was committed.
 */

const tool = (id: string, status: AgentToolEvent["status"]): AgentToolEvent => ({
  id,
  kind: "tool",
  name: "run_shell",
  status,
  input: { command: "ls" },
});

const message = (id: string): AgentEvent => ({
  id,
  kind: "message",
  role: "assistant",
  text: `filler-${id}`,
});

/**
 * Renders `frames` in sequence and returns the last frame.
 *
 * `<Static>` output only accumulates across renders of the SAME instance, which is why this cannot
 * be done with independent renders — a fresh mount would print the final state once and pass.
 */
function renderSequence(frames: AgentEvent[][], windowSize = 2, windowOverscan = 0): string {
  const first = frames[0] ?? [];
  const instance = render(
    <AgentTimeline events={first} windowSize={windowSize} windowOverscan={windowOverscan} />,
  );
  // NO `key` on the rerenders. A changing key remounts the timeline, which resets `<Static>` and
  // hides the very thing under test — the first version of this file did exactly that and passed
  // against the unfixed code.
  for (const events of frames.slice(1)) {
    instance.rerender(
      <AgentTimeline events={events} windowSize={windowSize} windowOverscan={windowOverscan} />,
    );
  }
  const frame = stripAnsi(instance.lastFrame() ?? "");
  instance.unmount();
  return frame;
}

/** How many rows name this tool — one per commit, so two means it was printed twice. */
const rowsNaming = (frame: string, needle: string): number =>
  frame.split("\n").filter((row) => row.includes(needle)).length;

/** The row naming this tool, whichever region it ended up in. */
const rowFor = (frame: string, needle: string): string =>
  frame.split("\n").find((row) => row.includes(needle)) ?? "";

/** Braille spinner cells — the shape a row wears only while it is still in flight. */
const SPINNER = /[\u2800-\u28FF]/;

describe("#52 — a running tool row does not graduate into Static", () => {
  /** The reproduction: `t1` is pushed past a 2-event window while still `running`. */
  const RUN_THEN_SUCCEED: AgentEvent[][] = [
    [tool("t1", "running")],
    [tool("t1", "running"), message("m1")],
    [tool("t1", "running"), message("m1"), message("m2")],
    [tool("t1", "success"), message("m1"), message("m2")],
  ];

  it("test_the_row_that_survives_is_the_TERMINAL_one", () => {
    // The measured symptom: the row crossed the boundary wearing its spinner and stayed that way,
    // so the transcript never showed the result at all.
    const row = rowFor(renderSequence(RUN_THEN_SUCCEED), "RunShell");
    expect(row).not.toMatch(SPINNER);
  });

  it("test_the_transcript_does_not_depend_on_whether_the_row_crossed_the_boundary", () => {
    // The invariant behind the symptom, and the one worth pinning: same events, same order, two
    // window sizes — one where the row graduates mid-flight and one where nothing graduates at
    // all. A transcript that differs between them is reporting the window, not the turn.
    const narrow = rowFor(renderSequence(RUN_THEN_SUCCEED, 2, 0), "RunShell");
    const wide = rowFor(renderSequence(RUN_THEN_SUCCEED, 99, 99), "RunShell");
    expect(narrow).toBe(wide);
  });

  it("test_the_tool_is_named_exactly_once", () => {
    // The double-commit half of the same root cause.
    expect(rowsNaming(renderSequence(RUN_THEN_SUCCEED), "RunShell")).toBe(1);
  });

  it("test_a_pending_tool_holds_the_boundary_for_the_events_after_it_too", () => {
    // Graduating a LATER event while an earlier one is still in flight would print them out of
    // order once the earlier one settles: scrollback is append-only, so the late arrival lands
    // below rows that came after it.
    const frame = renderSequence([
      [tool("t1", "pending")],
      [tool("t1", "pending"), message("m1")],
      [tool("t1", "pending"), message("m1"), message("m2")],
      [tool("t1", "pending"), message("m1"), message("m2"), message("m3")],
      [tool("t1", "success"), message("m1"), message("m2"), message("m3")],
    ]);
    expect(rowFor(frame, "RunShell")).not.toMatch(SPINNER);
    expect(rowsNaming(frame, "RunShell")).toBe(1);
    expect(rowsNaming(frame, "filler-m1")).toBe(1);
    expect(rowsNaming(frame, "filler-m2")).toBe(1);
  });

  it("test_terminal_events_still_graduate_normally", () => {
    // Anti-vacuity: a fix that simply stopped graduating anything would pass every test above and
    // turn `<Static>` off. The windowing has to keep working for settled rows.
    const events = Array.from({ length: 10 }, (_, i) => message(`m${String(i)}`));
    const frame = renderSequence([events.slice(0, 4), events.slice(0, 7), events], 2, 0);
    // Every message is on screen exactly once — graduated ones from scrollback, the rest live.
    for (const event of events) {
      expect(rowsNaming(frame, `filler-${event.id}`)).toBe(1);
    }
  });

  it("test_a_settled_tool_graduates_like_any_other_event", () => {
    const frame = renderSequence([
      [tool("t1", "success")],
      [tool("t1", "success"), message("m1")],
      [tool("t1", "success"), message("m1"), message("m2")],
      [tool("t1", "success"), message("m1"), message("m2"), message("m3")],
    ]);
    expect(rowsNaming(frame, "RunShell")).toBe(1);
  });

  it("test_a_failed_tool_counts_as_terminal", () => {
    // `failed` is a settled state — the reducer's own terminal fold produces it, and holding the
    // boundary on it would mean a crashed tool froze graduation for the rest of the session.
    const frame = renderSequence([
      [tool("t1", "failed")],
      [tool("t1", "failed"), message("m1")],
      [tool("t1", "failed"), message("m1"), message("m2")],
      [tool("t1", "failed"), message("m1"), message("m2"), message("m3")],
    ]);
    expect(rowsNaming(frame, "RunShell")).toBe(1);
  });
});

/**
 * The boundary rule itself, tested directly.
 *
 * The rendered tests above cannot separate "graduated into `<Static>`" from "stayed in the live
 * tail" — both put exactly one row on screen. Mutation testing proved it: letting `pending`
 * graduate, and letting `failed` hold the boundary, each left all seven of them green. The
 * predicate is pure and exported, so the states it holds on are pinned where they are visible.
 */
describe("firstUnsettledIndex — which states hold the boundary", () => {
  it("test_running_holds_the_boundary", () => {
    expect(firstUnsettledIndex([tool("t1", "running"), message("m1")])).toBe(0);
  });

  it("test_pending_holds_it_too", () => {
    // An approval-gated tool sits at `pending` for as long as the human takes. Graduating it
    // commits an un-answered prompt to scrollback — the worst case the issue names.
    expect(firstUnsettledIndex([tool("t1", "pending"), message("m1")])).toBe(0);
  });

  it("test_success_does_not", () => {
    expect(firstUnsettledIndex([tool("t1", "success"), message("m1")])).toBe(2);
  });

  it("test_failed_does_not", () => {
    // `failed` is settled. Holding on it would mean one crashed tool froze graduation for the rest
    // of the session, and the reducer's terminal fold produces exactly this state at turn end.
    expect(firstUnsettledIndex([tool("t1", "failed"), message("m1")])).toBe(2);
  });

  it("test_prose_and_explored_blocks_never_hold_it", () => {
    // Neither has a lifecycle: an `explored` block groups calls the projection already saw finish.
    expect(
      firstUnsettledIndex([
        message("m1"),
        { id: "e1", kind: "explored", tools: [tool("t9", "success")] },
      ]),
    ).toBe(2);
  });

  it("test_it_reports_the_FIRST_unsettled_not_any_later_one", () => {
    // Scrollback has no insertion point: graduating past an in-flight row would print it below
    // rows that came after it once it settles.
    expect(
      firstUnsettledIndex([tool("t1", "success"), tool("t2", "running"), tool("t3", "running")]),
    ).toBe(1);
  });

  it("test_an_all_settled_timeline_puts_no_ceiling_on_the_window", () => {
    // `events.length` and not `-1`: the caller takes `Math.min` of this and the window start, so a
    // sentinel would clamp the boundary to zero and switch `<Static>` off entirely.
    const events = [message("m1"), message("m2")];
    expect(firstUnsettledIndex(events)).toBe(events.length);
    expect(firstUnsettledIndex([])).toBe(0);
  });
});
