import { Box, Text } from "ink";
import { render } from "ink-testing-library";
import { describe, expect, it, vi } from "vitest";

import { renderFrame } from "../../tests/fixtures/helpers.js";
import { stripAnsi } from "../format/ansi.js";
import type { AgentEvent, AgentMessageEvent } from "./agent-event.js";

// Row-render spy (M1 idiom): wrap the real ChatMessage so repaint-scope
// assertions can count message-row renders (plan T1.2, D2).
const rowRenders = vi.hoisted(() => ({ count: 0 }));
vi.mock("../chat/chat-message.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../chat/chat-message.js")>();
  return {
    ...actual,
    ChatMessage: (props: Parameters<typeof actual.ChatMessage>[0]) => {
      rowRenders.count += 1;
      return actual.ChatMessage(props);
    },
  };
});

const { AgentTimeline } = await import("./agent-timeline.js");

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

/** Compound-SGR-safe strip (M2 idiom) — frames carry ANSI (FORCE_COLOR=1). */

const message = (id: string, text: string): AgentMessageEvent => ({
  id,
  kind: "message",
  role: "assistant",
  text,
});

describe("AgentTimeline — event dispatch (T1.1)", () => {
  it("message_event_dispatches_to_chat_message", async () => {
    const frame = await renderFrame(<AgentTimeline events={[message("m1", "hello there")]} />);
    expect(frame).toContain("⏺");
    expect(frame).toContain("hello there");
  });

  it("inserts_a_blank_line_between_event_blocks_not_before_the_first", async () => {
    // Claude Code cadence: every ⏺ block (message / thinking / tool) has one
    // blank line above it — except the very first rendered block.
    const raw = await renderFrame(
      <AgentTimeline events={[message("a", "first block"), message("b", "second block")]} />,
    );

    const frame = stripAnsi(raw);
    const lines = frame.split("\n");
    const iFirst = lines.findIndex((l) => l.includes("first block"));
    const iSecond = lines.findIndex((l) => l.includes("second block"));
    expect(iFirst).toBe(0); // no leading blank above the first block
    expect(iSecond - iFirst).toBeGreaterThanOrEqual(2);
    expect(lines.slice(iFirst + 1, iSecond).some((l) => l.trim() === "")).toBe(true);
  });

  it("thinking_event_renders_dim_italic_text", async () => {
    const frame = await renderFrame(
      <AgentTimeline events={[{ id: "t1", kind: "thinking", text: "planning the diff" }]} />,
    );
    // Line-anchored (tests-6 — M2 lesson): the leading glyph, not a substring.
    expect(stripAnsi(frame)).toMatch(/^•\s+planning the diff/m);
  });

  it("tool_event_dispatches_to_tool_card_with_result", async () => {
    const frame = await renderFrame(
      <AgentTimeline
        events={[
          {
            id: "x1",
            kind: "tool",
            name: "grep",
            status: "success",
            output: "3 matches",
          },
        ]}
      />,
    );
    expect(stripAnsi(frame)).toMatch(/^⏺\s+Grep/m); // line-anchored (tests-6)
    expect(frame).toContain("3 matches");
  });

  it("tool_event_with_diff_renders_inline_diff", async () => {
    const frame = await renderFrame(
      <AgentTimeline
        events={[
          {
            id: "x1",
            kind: "tool",
            name: "apply_patch",
            status: "success",
            diff: "--- a.ts\n+++ a.ts\n@@ -1 +1 @@\n-old line\n+new line\n",
          },
        ]}
      />,
    );
    // PascalCase display standard: the raw `apply_patch` renders as ApplyPatch.
    expect(stripAnsi(frame)).toMatch(/^⏺\s+ApplyPatch/m);
    // The DiffViewer renders the changed lines (colored +/- in a real terminal).
    // Asserted on the STRIPPED frame: the optional `lowlight` peer loads lazily,
    // so when it resolves before the 0ms tick the line comes back as
    // `+ [34mnew[39m line` and a raw-substring assert flakes on
    // timing alone (it flipped red merely by adding tests to this file).
    expect(stripAnsi(frame)).toContain("old line");
    expect(stripAnsi(frame)).toContain("new line");
    // NOT the raw unified-diff plumbing dumped as text.
    expect(stripAnsi(frame)).not.toContain("@@ -1 +1 @@");
  });

  it("explored_event_renders_grouped_codex_block", async () => {
    const frame = await renderFrame(
      <AgentTimeline
        events={[
          {
            id: "e1",
            kind: "explored",
            tools: [
              {
                id: "c1",
                kind: "tool",
                name: "read_file",
                status: "success",
                input: { path: "chat.ts" },
              },
              {
                id: "c2",
                kind: "tool",
                name: "grep",
                status: "success",
                input: { pattern: "foo" },
              },
              {
                id: "c3",
                kind: "tool",
                name: "list_dir",
                status: "success",
                input: { path: "agents" },
              },
            ],
          },
        ]}
      />,
    );
    const plain = stripAnsi(frame);
    expect(plain).toContain("Explored");
    expect(plain).toContain("(3)"); // count
    expect(plain).toContain("Read chat.ts"); // verb + target from input
    expect(plain).toContain('Search "foo"');
    expect(plain).toContain("List agents");
  });

  it("tool_event_without_output_renders_bare_row", async () => {
    const frame = await renderFrame(
      <AgentTimeline events={[{ id: "x1", kind: "tool", name: "grep", status: "success" }]} />,
    );
    expect(frame).toContain("⏺");
    expect(frame.split("\n")).toHaveLength(1);
  });

  it("empty_events_render_nothing", async () => {
    const frame = await renderFrame(<AgentTimeline events={[]} />);
    expect(frame).toBe("");
  });

  it("duplicate_event_ids_throw_typed_error", () => {
    const call = () => AgentTimeline({ events: [message("e1", "a"), message("e1", "b")] });
    expect(call).toThrow(TypeError);
    expect(call).toThrow('AgentTimeline: duplicate event id "e1"');
  });

  it("unknown_event_kind_throws_typed_error", () => {
    const call = () =>
      AgentTimeline({
        events: [{ id: "w1", kind: "weird", text: "x" } as never],
      });
    expect(call).toThrow(TypeError);
    expect(call).toThrow(
      'AgentTimeline: unknown event kind "weird" — expected "message" | "thinking" | "tool"',
    );
  });

  it("shell_tool_event_renders_envelope", async () => {
    const frame = await renderFrame(
      <AgentTimeline
        events={[
          {
            id: "s1",
            kind: "tool",
            name: "pnpm lint",
            status: "failed",
            shell: { stdout: "", stderr: "boom", exitCode: 1 },
          },
        ]}
      />,
    );
    expect(frame).toContain("stderr:");
    expect(frame).toContain("exited 1");
  });

  it("tool_event_with_output_and_shell_throws_typed_error", () => {
    // EC-1: mid-render ToolResult exclusivity would be swallowed by Ink's
    // boundary and name the wrong component — fail at OUR boundary.
    const call = () =>
      AgentTimeline({
        events: [
          {
            id: "x1",
            kind: "tool",
            name: "grep",
            status: "success",
            output: "a",
            shell: { stdout: "", stderr: "", exitCode: 0 },
          },
        ],
      });
    expect(call).toThrow(TypeError);
    expect(call).toThrow('AgentTimeline: tool event "x1" — provide only one of output | shell');
  });

  it("invalid_message_role_throws_at_boundary", () => {
    // EC-2: ChatMessage's own guard fires mid-render (swallowed) — the
    // boundary owns variant-field validation (D8).
    const call = () =>
      AgentTimeline({
        events: [{ id: "m1", kind: "message", role: "bot", text: "hi" } as never],
      });
    expect(call).toThrow(TypeError);
    expect(call).toThrow(/^AgentTimeline:/);
  });

  it("invalid_tool_status_throws_at_boundary", () => {
    const call = () =>
      AgentTimeline({
        events: [{ id: "x1", kind: "tool", name: "grep", status: "weird" } as never],
      });
    expect(call).toThrow(TypeError);
    expect(call).toThrow(/^AgentTimeline:/);
  });

  it("empty_string_id_is_legal_and_duplicate_empty_throws", async () => {
    // EC-5: M1 parity — empty-but-valid ids are legal, only DUPLICATES throw.
    const frame = await renderFrame(<AgentTimeline events={[message("", "solo")]} />);
    expect(frame).toContain("solo");
    const call = () => AgentTimeline({ events: [message("", "a"), message("", "b")] });
    expect(call).toThrow(TypeError);
    expect(call).toThrow('AgentTimeline: duplicate event id ""');
  });

  it("invalid_max_lines_throws_at_boundary", () => {
    // SEPA F1: ToolResult's guard would fire mid-render — boundary owns it.
    const call = () =>
      AgentTimeline({
        events: [
          {
            id: "x1",
            kind: "tool",
            name: "grep",
            status: "success",
            output: "a",
            maxLines: 0,
          },
        ],
      });
    expect(call).toThrow(TypeError);
    expect(call).toThrow(
      'AgentTimeline: tool event "x1" — maxLines must be an integer >= 1 — got 0',
    );
  });

  it("tool_output_inherits_m2_normalization", async () => {
    // SEPA F2: CRLF stripped (EC-6), trailing blank popped (EC-7).
    const frame = await renderFrame(
      <AgentTimeline
        events={[
          {
            id: "x1",
            kind: "tool",
            name: "build",
            status: "success",
            output: "a\r\nb\n",
          },
        ]}
      />,
    );
    expect(frame).not.toContain("\r");
    expect(frame.split("\n")).toHaveLength(3); // header + 2 rows, no phantom
  });

  it("empty_output_collapses_to_bare_row", async () => {
    const frame = await renderFrame(
      <AgentTimeline
        events={[
          {
            id: "x1",
            kind: "tool",
            name: "noop",
            status: "success",
            output: "",
          },
        ]}
      />,
    );
    expect(frame.split("\n")).toHaveLength(1);
  });

  it("thinking_row_is_actually_dim_and_italic", async () => {
    // SEPA F3: dispatching thinking → ChatMessage(system) would produce an
    // identical NO-ANSI frame — pin the styling bytes (FORCE_COLOR=1).
    const frame = await renderFrame(
      <AgentTimeline events={[{ id: "t1", kind: "thinking", text: "styled thought" }]} />,
    );
    expect(frame).toMatch(/\u001B\[2m/); // dim
    expect(frame).toMatch(/\u001B\[3m/); // italic
  });

  it("tool_event_max_lines_flows_into_truncation", async () => {
    const output = Array.from({ length: 8 }, (_, i) => `row-${i}`).join("\n");
    const frame = await renderFrame(
      <AgentTimeline
        events={[
          {
            id: "x1",
            kind: "tool",
            name: "cat",
            status: "success",
            output,
            maxLines: 3,
          },
        ]}
      />,
    );
    expect(frame).toContain("… +6 lines hidden");
    expect(frame).toContain("row-7");
    expect(frame).not.toContain("row-0");
  });

  it("extra_event_properties_are_tolerated", async () => {
    // EC-12: M7 adapters forward enriched objects — unknown extras pass.
    const enriched: AgentMessageEvent & { timestamp: number } = {
      ...message("m1", "enriched"),
      timestamp: 123,
    };
    const events: AgentEvent[] = [enriched];
    const frame = await renderFrame(<AgentTimeline events={events} />);
    expect(frame).toContain("enriched");
  });
});

describe("AgentTimeline — windowed Static history (T1.2)", () => {
  const events = (n: number): AgentEvent[] =>
    Array.from({ length: n }, (_, i) => message(`e${i}`, `event-${i} body`));

  it("only_tail_rows_repaint_on_identity_replace", async () => {
    let list = events(20);
    const instance = render(<AgentTimeline events={list} windowSize={8} windowOverscan={4} />);
    await tick();
    rowRenders.count = 0;
    const last = list[list.length - 1] as AgentMessageEvent;
    list = [...list.slice(0, -1), { ...last, text: `${last.text}!` }];
    instance.rerender(<AgentTimeline events={list} windowSize={8} windowOverscan={4} />);
    await tick();
    instance.unmount();
    expect(rowRenders.count).toBe(1);
  });

  it("tool_tail_identity_replace_repaints_only_that_row", async () => {
    // tests-1: the message spy misses tool/thinking repaints — assert the
    // frame transition AND that no MESSAGE row repainted (spy 0).
    const list: AgentEvent[] = [
      ...events(11),
      {
        id: "tl-tail",
        kind: "tool",
        name: "vitest",
        status: "running",
      },
    ];
    const instance = render(<AgentTimeline events={list} windowSize={8} windowOverscan={4} />);
    await tick();
    rowRenders.count = 0;
    const tail = list[list.length - 1];
    const next: AgentEvent[] = [
      ...list.slice(0, -1),
      { ...(tail as Extract<AgentEvent, { kind: "tool" }>), status: "success" },
    ];
    instance.rerender(<AgentTimeline events={next} windowSize={8} windowOverscan={4} />);
    await tick();
    const frame = instance.lastFrame() ?? "";
    instance.unmount();
    expect(stripAnsi(frame)).toMatch(/^⏺\s+Vitest/m);
    expect(rowRenders.count).toBe(0); // message rows untouched by memo
  });

  it("static_prefix_is_frozen_after_graduation", async () => {
    let list = events(20);
    const instance = render(<AgentTimeline events={list} windowSize={8} windowOverscan={4} />);
    await tick();
    // Mutate a GRADUATED event (index 0) via a new object, same id.
    const first = list[0] as AgentMessageEvent;
    list = [{ ...first, text: "MUTATED" }, ...list.slice(1)];
    instance.rerender(<AgentTimeline events={list} windowSize={8} windowOverscan={4} />);
    await tick();
    const frame = instance.lastFrame() ?? "";
    instance.unmount();
    expect(frame).not.toContain("MUTATED");
  });

  it("same_array_rerender_repaints_nothing", async () => {
    const list = events(20);
    const instance = render(<AgentTimeline events={list} windowSize={8} windowOverscan={4} />);
    await tick();
    rowRenders.count = 0;
    instance.rerender(<AgentTimeline events={list} windowSize={8} windowOverscan={4} />);
    await tick();
    instance.unmount();
    expect(rowRenders.count).toBe(0);
  });

  it("window_size_zero_graduates_everything", async () => {
    let list = events(3);
    const instance = render(<AgentTimeline events={list} windowSize={0} windowOverscan={0} />);
    await tick();
    const before = instance.lastFrame() ?? "";
    expect(before).toContain("event-0 body");
    expect(before).toContain("event-2 body");
    rowRenders.count = 0;
    list = [...list, message("e3", "event-3 body")];
    instance.rerender(<AgentTimeline events={list} windowSize={0} windowOverscan={0} />);
    await tick();
    instance.unmount();
    // Only the appended event renders live (then graduates) — never the
    // whole history again.
    expect(rowRenders.count).toBe(1);
  });

  it("heterogeneous_graduation_keeps_output_ordered", async () => {
    const list: AgentEvent[] = [
      ...events(5),
      {
        id: "tool-mid",
        kind: "tool",
        name: "build",
        status: "success",
        output: "compiled 40 modules\nwrote dist/",
      },
      ...Array.from({ length: 5 }, (_, i) => message(`late${i}`, `late-${i} body`)),
    ];
    const frame = await renderFrame(
      <AgentTimeline events={list} windowSize={2} windowOverscan={0} />,
    );
    const cardIndex = frame.indexOf("compiled 40 modules");
    const earlyIndex = frame.indexOf("event-4 body");
    const lateIndex = frame.indexOf("late-0 body");
    expect(cardIndex).toBeGreaterThan(earlyIndex);
    expect(lateIndex).toBeGreaterThan(cardIndex);
  });

  it("negative_window_knobs_clamp_to_zero", async () => {
    // EC-6: M1 clamp parity — negative knobs behave exactly like 0/0.
    const frame = await renderFrame(
      <AgentTimeline events={events(3)} windowSize={-3} windowOverscan={-1} />,
    );
    expect(frame).toContain("event-0 body");
    expect(frame).toContain("event-1 body");
    expect(frame).toContain("event-2 body");
  });

  it("in_place_push_on_same_array_pins_hybrid_behavior", async () => {
    // EC-8: same-ref push — pinned behavior, NOT a supported pattern
    // (JSDoc says always pass a new array).
    const list = events(3);
    const instance = render(<AgentTimeline events={list} windowSize={8} windowOverscan={4} />);
    await tick();
    rowRenders.count = 0;
    list.push(message("pushed", "pushed body"));
    instance.rerender(<AgentTimeline events={list} windowSize={8} windowOverscan={4} />);
    await tick();
    const frame = instance.lastFrame() ?? "";
    instance.unmount();
    // Same reference: React sees equal props per row (memo hits), but the
    // length change re-runs the component — the pushed row renders.
    expect(frame).toContain("pushed body");
    expect(rowRenders.count).toBe(1);
  });
});

describe("AgentTimeline — representative turn (T3.1, roadmap DoD-3)", () => {
  it("representative_turn_matches_snapshot", async () => {
    // Running spinner pinned to dots frame[0] by renderFrame's 0ms tick —
    // NO added awaits (EC-14 coupling; plan Drawbacks).
    const turn: AgentEvent[] = [
      { id: "th1", kind: "thinking", text: "inspecting the failing test" },
      { id: "tl1", kind: "tool", name: "vitest", status: "running" },
      {
        id: "tl2",
        kind: "tool",
        name: "eslint",
        status: "success",
        output: "0 problems",
      },
      { id: "ms1", kind: "message", role: "assistant", text: "All green now." },
    ];
    const frame = await renderFrame(
      <Box width={40}>
        <AgentTimeline events={turn} />
      </Box>,
    );
    expect(stripAnsi(frame)).toMatch(/^•\s+inspecting/m);
    expect(frame).toContain("⠋");
    expect(frame).toContain("⏺");
    expect(frame).toContain("All green now.");
    expect(frame).toMatchSnapshot("agent-turn");
  });
});

describe("AgentTimeline header slot (M11 T1.2)", () => {
  const HEADER = <Text>BANNER</Text>;
  const events = (n: number): AgentEvent[] =>
    Array.from({ length: n }, (_, i) => ({
      id: `e${i}`,
      kind: "message" as const,
      role: "assistant" as const,
      text: `row-${i} end`,
    }));

  async function ticks(count = 3): Promise<void> {
    for (let index = 0; index < count; index += 1) {
      await new Promise((resolve) => {
        setTimeout(resolve, 0);
      });
    }
  }

  it("header_above_heterogeneous_graduated_events", async () => {
    const list: AgentEvent[] = [
      ...events(5),
      { id: "tool-h", kind: "tool", name: "build", status: "success" },
      ...events(20).slice(6),
    ];
    const instance = render(
      <AgentTimeline header={HEADER} events={list} windowSize={4} windowOverscan={2} />,
    );
    await ticks();
    const frame = instance.lastFrame() ?? "";
    instance.unmount();
    const iBanner = frame.indexOf("BANNER");
    expect(iBanner).toBeGreaterThanOrEqual(0);
    // PascalCase display standard: the raw `build` renders as Build.
    expect(iBanner).toBeLessThan(frame.indexOf("Build"));
    const count = frame.split("BANNER").length - 1;
    expect(count).toBe(1);
  });

  it("timeline_header_mount_freeze_mirrors_chatthread", async () => {
    // late header ignored
    const late = render(<AgentTimeline events={events(20)} windowSize={4} windowOverscan={2} />);
    await ticks();
    late.rerender(
      <AgentTimeline
        header={<Text>LATE</Text>}
        events={events(22)}
        windowSize={4}
        windowOverscan={2}
      />,
    );
    await ticks();
    const lateFrame = late.lastFrame() ?? "";
    late.unmount();
    expect(lateFrame).not.toContain("LATE");
    // removal + append in ONE rerender loses no events (same-length trap)
    const inst = render(
      <AgentTimeline header={HEADER} events={events(10)} windowSize={4} windowOverscan={2} />,
    );
    await ticks();
    inst.rerender(<AgentTimeline events={events(11)} windowSize={4} windowOverscan={2} />);
    await ticks();
    inst.rerender(<AgentTimeline events={events(14)} windowSize={4} windowOverscan={2} />);
    await ticks();
    const frame = inst.lastFrame() ?? "";
    inst.unmount();
    for (let i = 0; i < 14; i += 1) {
      expect(frame.split(`row-${i} end`).length - 1, `row-${i}`).toBe(1);
    }
    expect(frame.split("BANNER").length - 1).toBe(1);
  });

  it("timeline_header_scene_matches_snapshot", async () => {
    // Also kills the drop-sentinel-key mutant: React would warn on a
    // missing list key inside Static (review F-1).
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const frame = await renderFrame(
      <Box width={60}>
        <AgentTimeline
          header={<Text>BANNER</Text>}
          events={[
            { id: "t1", kind: "thinking", text: "planning" },
            { id: "tool1", kind: "tool", name: "vitest", status: "success" },
            { id: "m1", kind: "message", role: "assistant", text: "done" },
          ]}
        />
      </Box>,
    );
    expect(frame).toContain("BANNER");
    expect(frame).toContain("⏺");
    expect(frame).toContain("done");
    expect(frame).toMatchSnapshot("timeline-header-scene");
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("reserved_event_id_throws_typed", () => {
    const bad = () =>
      AgentTimeline({
        header: HEADER,
        events: [
          {
            id: "__theokit_tui_header__",
            kind: "message",
            role: "user",
            text: "x",
          },
        ],
      });
    expect(bad).toThrow(TypeError);
    expect(bad).toThrow("__theokit_tui_header__");
  });
});

describe("issue #57 — the inline-diff branch needs a default line budget", () => {
  // A large diff result (apply_patch) renders EVERY line when `maxLines` is absent
  // from the event: `DiffViewer` has no default of its own, it only validates. The
  // same result carried as `output` goes through `ToolResult`, which caps at 10 — so
  // the transcript floods based on which FIELD the event used, not on its size.
  const bigDiff = [
    "--- a.ts",
    "+++ a.ts",
    "@@ -1,60 +1,60 @@",
    ...Array.from({ length: 60 }, (_, i) => `-old line ${i}`),
    ...Array.from({ length: 60 }, (_, i) => `+new line ${i}`),
  ].join("\n");

  const diffEvent = (maxLines?: number): AgentEvent => ({
    id: "d1",
    kind: "tool",
    name: "apply_patch",
    status: "success",
    diff: bigDiff,
    ...(maxLines !== undefined ? { maxLines } : {}),
  });

  it("diff_without_max_lines_is_capped_and_shows_the_truncation_trailer", async () => {
    const frame = await renderFrame(<AgentTimeline events={[diffEvent()]} />);
    const plain = stripAnsi(frame);
    // The DiffViewer trailer proves the cut happened (not that the patch was short).
    expect(plain).toMatch(/\(\+\d+ more lines\)/);
    // The budget is global (headers included) — the card frame adds few rows, so a
    // generous ceiling still kills the "renders all 120" case.
    expect(plain.split("\n").length).toBeLessThan(40);
    expect(plain).toContain("old line 0"); // HEAD retention: the start survives
    expect(plain).not.toContain("new line 59"); // ...and the tail does not
  });

  it("explicit_max_lines_still_overrides_the_default", async () => {
    const frame = await renderFrame(<AgentTimeline events={[diffEvent(3)]} />);
    const plain = stripAnsi(frame);
    expect(plain).toMatch(/\(\+\d+ more lines\)/);
    expect(plain).not.toContain("old line 5");
  });

  it("a_short_diff_renders_whole_with_no_trailer", async () => {
    // Non-regression: the default must not cut a diff that already fits.
    const frame = await renderFrame(
      <AgentTimeline
        events={[
          {
            id: "d2",
            kind: "tool",
            name: "apply_patch",
            status: "success",
            diff: "--- a.ts\n+++ a.ts\n@@ -1 +1 @@\n-old line\n+new line\n",
          },
        ]}
      />,
    );
    const plain = stripAnsi(frame);
    expect(plain).toContain("old line");
    expect(plain).toContain("new line");
    expect(plain).not.toMatch(/more lines/);
  });
});

describe("issue #59 item 5 — Explored rows keep their indentation when wrapping", () => {
  // The row is `  └ <summary>`. Because prefix and summary lived in the SAME <Text>,
  // a long target wrapped at COLUMN 0 and the continuation lined up with the block's
  // `⏺` rather than with the branch — DiffViewer's `lineRow` pattern (gutter with
  // flexShrink=0 + body with wrap="wrap") exists for exactly this.
  const longPath =
    "packages/agent-runtime/src/adapters/streaming/very-long-directory-name/deep-module.ts";

  const narrowFrame = async (): Promise<string> =>
    renderFrame(
      <Box width={40}>
        <AgentTimeline
          events={[
            {
              id: "e1",
              kind: "explored",
              tools: [
                {
                  id: "c1",
                  kind: "tool",
                  name: "read_file",
                  status: "success",
                  input: { path: longPath },
                },
                {
                  id: "c2",
                  kind: "tool",
                  name: "list_dir",
                  status: "success",
                  input: { path: "src" },
                },
              ],
            },
          ]}
        />
      </Box>,
    );

  it("the continuation of a long target does NOT start at column 0", async () => {
    const rows = stripAnsi(await narrowFrame())
      .split("\n")
      .filter((l) => l.trim() !== "");
    const branchIndex = rows.findIndex((l) => l.includes("└"));
    expect(branchIndex).toBeGreaterThanOrEqual(0);
    // The next row is the continuation (the following branch comes only after it).
    const continuation = rows[branchIndex + 1] ?? "";
    expect(continuation.includes("└")).toBe(false); // it did wrap
    expect(continuation).toMatch(/^\s{4}/); // indented under the branch
  });

  it("a short target still renders `  └ ` flush against the summary", async () => {
    // Byte-level non-regression: the common path must not change.
    const frame = stripAnsi(await narrowFrame());
    expect(frame).toContain("  └ List src");
  });
});
