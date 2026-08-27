import { Text } from "ink";
import { describe, expect, it } from "vitest";
import type { AgentEvent, AgentToolEvent } from "../../src/agent/agent-event.js";
import { AgentTimeline } from "../../src/agent/agent-timeline.js";
import { stripAnsi } from "../../src/format/ansi.js";
import { renderFrame } from "../../tests/fixtures/helpers.js";

// #61 — the collapsed transcript and the `verbose` toggle surface. The cards themselves are
// covered by agent-timeline.test.tsx; what is pinned here is WHEN they give way to a count line
// and what that line says.

const tool = (id: string, name: string): AgentToolEvent => ({
  id,
  kind: "tool",
  name,
  status: "success",
  input: { path: "src/index.ts" },
});

const message = (id: string, text: string): AgentEvent => ({
  id,
  kind: "message",
  role: "assistant",
  text,
});

// `verbose` is OMITTED rather than passed as undefined when the default is under test —
// `exactOptionalPropertyTypes` is on, and an explicit undefined is not the call an app makes.
const frameOf = async (events: AgentEvent[], verbose?: boolean) =>
  stripAnsi(
    await renderFrame(
      verbose === undefined ? (
        <AgentTimeline events={events} />
      ) : (
        <AgentTimeline events={events} verbose={verbose} />
      ),
    ),
  );

/**
 * The frame's non-blank lines, trimmed.
 *
 * Collapsed lines are asserted whole rather than with `toContain`: "Ran 1 shell command" is a
 * PREFIX of "Ran 1 shell commands", so a substring assertion cannot tell a working singular from a
 * broken one (caught by mutating the pluralization away — the substring version survived it).
 */
const linesOf = async (events: AgentEvent[], verbose?: boolean) =>
  (await frameOf(events, verbose))
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");

describe("AgentTimeline — collapsed tool summaries (#61)", () => {
  it("verbose_defaults_to_on_so_an_existing_consumer_still_gets_cards", async () => {
    const frame = await frameOf([tool("t1", "run_shell")]);
    // The card's own header, which the collapsed line never renders.
    expect(frame).toContain("RunShell");
    expect(frame).not.toContain("Ran 1 shell command");
  });

  it("collapsed_mode_replaces_the_card_with_a_verb_count_line", async () => {
    const lines = await linesOf([tool("t1", "run_shell")], false);
    expect(lines).toEqual(["Ran 1 shell command"]);
  });

  it("the_noun_is_singular_for_one_call_and_plural_beyond", async () => {
    expect(await linesOf([tool("t1", "run_shell")], false)).toEqual(["Ran 1 shell command"]);
    expect(await linesOf([tool("t1", "run_shell"), tool("t2", "bash")], false)).toEqual([
      "Ran 2 shell commands",
    ]);
  });

  it("adjacent_calls_of_DIFFERENT_verbs_get_one_line_each_in_first_seen_order", async () => {
    const lines = await linesOf(
      [tool("t1", "read_file"), tool("t2", "run_shell"), tool("t3", "read_file")],
      false,
    );
    // A shell call hiding inside a run of reads is exactly what a single merged
    // "3 tool calls" would conceal, so each verb keeps its own line — in the
    // order the verbs were first seen, not alphabetical, not by count.
    expect(lines).toEqual(["Read 2 files", "Ran 1 shell command"]);
  });

  it("prose_between_two_runs_breaks_them_into_separate_collapsed_rows", async () => {
    const lines = await linesOf(
      [tool("t1", "run_shell"), message("m1", "midway"), tool("t2", "run_shell")],
      false,
    );
    // Two rows of one, NOT one row of two — the calls did not happen adjacently.
    expect(lines.filter((l) => l === "Ran 1 shell command")).toHaveLength(2);
    expect(lines.some((l) => l.includes("midway"))).toBe(true);
  });

  it("an_explored_block_collapses_into_the_same_count_line", async () => {
    const lines = await linesOf(
      [
        {
          id: "e1",
          kind: "explored",
          tools: [tool("t1", "read_file"), tool("t2", "read_file")],
        },
      ],
      false,
    );
    // The "Explored (2)" block header belongs to verbose mode; collapsed mode
    // generalizes it into the same count line every other tool kind gets.
    expect(lines).toEqual(["Read 2 files"]);
  });

  it("an_explored_block_merges_with_an_adjacent_bare_tool_call", async () => {
    const lines = await linesOf(
      [{ id: "e1", kind: "explored", tools: [tool("t1", "read_file")] }, tool("t2", "read_file")],
      false,
    );
    expect(lines).toEqual(["Read 2 files"]);
  });

  it("an_unknown_tool_is_still_counted_rather_than_dropped", async () => {
    // No verb mapping exists for it — but a collapsed transcript that silently
    // omits a call is worse than one that names it vaguely.
    expect(await linesOf([tool("t1", "deploy_to_prod")], false)).toEqual(["Used 1 tool"]);
    expect(await linesOf([tool("t1", "deploy_to_prod"), tool("t2", "sync_db")], false)).toEqual([
      "Used 2 tools",
    ]);
  });

  it("the_footer_slot_renders_below_the_last_row", async () => {
    const lines = (
      await renderFrame(
        <AgentTimeline
          events={[tool("t1", "run_shell")]}
          verbose={false}
          footer={<Text>Showing detailed transcript</Text>}
        />,
      )
    )
      .split("\n")
      .map((line) => stripAnsi(line).trim())
      .filter((line) => line !== "");
    expect(lines).toEqual(["Ran 1 shell command", "Showing detailed transcript"]);
  });

  it("omitting_the_footer_adds_no_row", async () => {
    expect(await linesOf([tool("t1", "run_shell")], false)).toEqual(["Ran 1 shell command"]);
  });

  it("collapsing_does_not_change_which_events_graduate_into_Static", async () => {
    // The windowing math runs on the RAW events; a toggle must not pull a
    // graduated row back or push an extra one out.
    const events: AgentEvent[] = Array.from({ length: 12 }, (_, i) =>
      message(`m${i}`, `line-${i}`),
    );
    const verboseFrame = await frameOf(events, true);
    const collapsedFrame = await frameOf(events, false);
    expect(collapsedFrame).toBe(verboseFrame);
  });
});
