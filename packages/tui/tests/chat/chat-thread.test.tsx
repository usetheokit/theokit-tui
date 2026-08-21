import { Text } from "ink";
import { render } from "ink-testing-library";
import { describe, expect, it, vi } from "vitest";

import { renderFrame } from "../../tests/fixtures/helpers.js";
import { stripAnsi } from "../../src/format/ansi.js";
import type { ChatThreadMessage } from "../../src/chat/chat-thread.js";

// Row-render spy: wrap the real ChatMessage so repaint-scope assertions can
// count row renders without polluting the public API (plan T2.1/T2.2, D2).
const rowRenders = vi.hoisted(() => ({ count: 0 }));
vi.mock("../../src/chat/chat-message.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/chat/chat-message.js")>();
  return {
    ...actual,
    ChatMessage: (props: Parameters<typeof actual.ChatMessage>[0]) => {
      rowRenders.count += 1;
      return actual.ChatMessage(props);
    },
  };
});

const { ChatThread } = await import("../../src/chat/chat-thread.js");

const msg = (
  i: number,
  role: ChatThreadMessage["role"] = "user",
  content = `msg-${i} content`,
): ChatThreadMessage => ({ id: `m${i}`, role, content });

const thread = (n: number): ChatThreadMessage[] =>
  Array.from({ length: n }, (_, i) => msg(i, i % 2 === 0 ? "user" : "assistant"));

describe("ChatThread (T2.1)", () => {
  it("renders_all_roles_in_order", async () => {
    const frame = await renderFrame(
      <ChatThread
        messages={[
          { id: "a", role: "user", content: "first" },
          { id: "b", role: "assistant", content: "second" },
          { id: "c", role: "system", content: "third" },
        ]}
      />,
    );
    expect(frame).toContain("first");
    expect(frame).toContain("·");
    expect(frame.indexOf("first")).toBeLessThan(frame.indexOf("second"));
    expect(frame.indexOf("second")).toBeLessThan(frame.indexOf("third"));
  });

  it("long_thread_splits_history_into_static_prefix", async () => {
    rowRenders.count = 0;
    const instance = render(<ChatThread messages={thread(20)} windowSize={4} windowOverscan={2} />);
    await new Promise((r) => setTimeout(r, 0));
    const frame = instance.lastFrame() ?? "";
    // Static output accumulates into the frame (ink test contract).
    expect(frame).toContain("msg-0 content");
    expect(frame).toContain("msg-19 content");
    // Split proof (review F-dom-5): rerender with the SAME array — static
    // prefix rows never re-render; memoized live rows also skip.
    rowRenders.count = 0;
    instance.rerender(
      <ChatThread messages={instance ? thread(20) : []} windowSize={4} windowOverscan={2} />,
    );
    await new Promise((r) => setTimeout(r, 0));
    // New objects → ONLY the live tail (4+2) repaints; the 14 static rows do not.
    expect(rowRenders.count).toBe(6);
    instance.unmount();
  });

  it("short_thread_renders_without_static_and_memoizes_rerenders", async () => {
    const messages = thread(3);
    rowRenders.count = 0;
    const instance = render(<ChatThread messages={messages} />);
    await new Promise((r) => setTimeout(r, 0));
    expect(rowRenders.count).toBe(3);
    instance.rerender(<ChatThread messages={messages} />);
    await new Promise((r) => setTimeout(r, 0));
    // Same array, same message identities — memo rows skip re-render.
    expect(rowRenders.count).toBe(3);
    instance.unmount();
  });

  it("window_boundary_row_count_is_exact", async () => {
    rowRenders.count = 0;
    const instance = render(<ChatThread messages={thread(20)} windowSize={4} windowOverscan={2} />);
    await new Promise((r) => setTimeout(r, 0));
    // Static prefix rows render ONCE (14) + live tail rows (6) = 20 on mount;
    // the boundary assertion: live tail is exactly windowSize + overscan.
    const mountRenders = rowRenders.count;
    expect(mountRenders).toBe(20);
    rowRenders.count = 0;
    instance.rerender(<ChatThread messages={thread(20)} windowSize={4} windowOverscan={2} />);
    await new Promise((r) => setTimeout(r, 0));
    // thread(20) builds NEW message objects → all 6 live rows repaint; the 14
    // static-prefix rows never re-render (Static watermark).
    expect(rowRenders.count).toBe(6);
    instance.unmount();
  });

  it("duplicate_message_ids_throw_typed_error", () => {
    expect(() =>
      ChatThread({
        messages: [msg(1), { ...msg(2), id: "m1" }],
      }),
    ).toThrow(TypeError);
    expect(() =>
      ChatThread({
        messages: [msg(1), { ...msg(2), id: "m1" }],
      }),
    ).toThrow('ChatThread: duplicate message id "m1"');
  });

  it("empty_messages_render_empty_frame", async () => {
    const frame = await renderFrame(<ChatThread messages={[]} />);
    expect(frame.trim()).toBe("");
  });

  it("window_size_zero_keeps_overscan_tail_live", async () => {
    // Review F-tests-5: overscan-only live tail.
    rowRenders.count = 0;
    const instance = render(<ChatThread messages={thread(10)} windowSize={0} windowOverscan={2} />);
    await new Promise((r) => setTimeout(r, 0));
    rowRenders.count = 0;
    instance.rerender(<ChatThread messages={thread(10)} windowSize={0} windowOverscan={2} />);
    await new Promise((r) => setTimeout(r, 0));
    // New objects → the overscan-only live tail (2 rows) repaints.
    expect(rowRenders.count).toBe(2);
    instance.unmount();
  });

  it("empty_string_id_is_legal", async () => {
    // Review F-tests-5 / EC-4: only DUPLICATES throw.
    const frame = await renderFrame(
      <ChatThread messages={[{ id: "", role: "user", content: "anonymous id" }]} />,
    );
    expect(frame).toContain("anonymous id");
  });

  it("inserts_a_blank_line_between_turns_not_before_the_first", async () => {
    // M27.1 Claude Code parity: turns are separated by one blank line so the
    // conversation breathes — but there is NO leading blank above the first
    // turn (the thread starts flush at the top).
    const raw = await renderFrame(
      <ChatThread
        messages={[
          { id: "a", role: "user", content: "first turn" },
          { id: "b", role: "assistant", content: "second turn" },
        ]}
      />,
    );

    const frame = stripAnsi(raw);
    const lines = frame.split("\n");
    const iFirst = lines.findIndex((l) => l.includes("first turn"));
    const iSecond = lines.findIndex((l) => l.includes("second turn"));
    expect(iFirst).toBe(0); // no leading blank before the first turn
    // A blank line sits between the two turns.
    expect(iSecond - iFirst).toBeGreaterThanOrEqual(2);
    expect(lines.slice(iFirst + 1, iSecond).some((l) => l.trim() === "")).toBe(true);
  });

  it("negative_window_values_clamp_to_zero", async () => {
    // EC-2 (negative case): invalid numbers degrade to "everything static".
    const frame = await renderFrame(
      <ChatThread messages={thread(6)} windowSize={-5} windowOverscan={-1} />,
    );
    for (let i = 0; i < 6; i++) {
      expect(frame).toContain(`msg-${i} content`);
    }
  });
});

describe("ChatThread streaming (T2.2)", () => {
  it("streaming_replace_last_updates_frame_progressively", async () => {
    const base = thread(3);
    const steps = ["He", "Hello", "Hello wor", "Hello world"];
    const instance = render(<ChatThread messages={base} />);
    await new Promise((r) => setTimeout(r, 0));
    for (const step of steps) {
      const last = base[base.length - 1];
      if (last === undefined) throw new Error("unreachable");
      const next = [...base.slice(0, -1), { ...last, content: step }];
      instance.rerender(<ChatThread messages={next} />);
      await new Promise((r) => setTimeout(r, 0));
      expect(instance.lastFrame()).toContain(step);
    }
    instance.unmount();
  });

  it("streaming_repaints_only_the_growing_row", async () => {
    const base = thread(5);
    const instance = render(<ChatThread messages={base} />);
    await new Promise((r) => setTimeout(r, 0));
    let current = base;
    for (const token of [" a", " b", " c"]) {
      const last = current[current.length - 1];
      if (last === undefined) throw new Error("unreachable");
      current = [...current.slice(0, -1), { ...last, content: last.content + token }];
      rowRenders.count = 0;
      instance.rerender(<ChatThread messages={current} />);
      await new Promise((r) => setTimeout(r, 0));
      // D2 contract: exactly ONE row (the replaced one) repaints per token.
      expect(rowRenders.count).toBe(1);
    }
    instance.unmount();
  });

  it("static_prefix_is_frozen_after_graduation", async () => {
    const base = thread(20);
    const instance = render(<ChatThread messages={base} windowSize={4} windowOverscan={2} />);
    await new Promise((r) => setTimeout(r, 0));
    // Replace a PREFIX message (id m1) with edited content — tail unchanged.
    const edited = base.map((m) => (m.id === "m1" ? { ...m, content: "EDITED CONTENT" } : m));
    instance.rerender(<ChatThread messages={edited} windowSize={4} windowOverscan={2} />);
    await new Promise((r) => setTimeout(r, 0));
    const frame = instance.lastFrame() ?? "";
    // ADR D1 contract: graduated messages are FROZEN — the edit is invisible.
    expect(frame).toContain("msg-1 content");
    expect(frame).not.toContain("EDITED CONTENT");
    instance.unmount();
  });
});

describe("ChatThread header slot (M11 T1.1)", () => {
  const HEADER = <Text>BANNER</Text>;

  async function ticks(count = 3): Promise<void> {
    for (let index = 0; index < count; index += 1) {
      await new Promise((resolve) => {
        setTimeout(resolve, 0);
      });
    }
  }

  it("header_stays_above_graduated_history", async () => {
    // The recorded M9 banner-sinking drawback proof (oracle a+b): the
    // header lives in the Static segment, above EVERY graduated row, even
    // though the prefix only grows after mount.
    const instance = render(
      <ChatThread header={HEADER} messages={thread(6)} windowSize={4} windowOverscan={2} />,
    );
    await ticks();
    for (const n of [12, 20]) {
      instance.rerender(
        <ChatThread header={HEADER} messages={thread(n)} windowSize={4} windowOverscan={2} />,
      );
      await ticks();
    }
    const frame = instance.lastFrame() ?? "";
    instance.unmount();
    const iBanner = frame.indexOf("BANNER");
    expect(iBanner).toBeGreaterThanOrEqual(0);
    expect(iBanner).toBeLessThan(frame.indexOf("msg-0 content"));
    expect(frame.indexOf("msg-0 content")).toBeLessThan(frame.indexOf("msg-19 content"));
    // print-once across successive graduation batches (oracle b).
    expect(frame.split("BANNER").length - 1).toBe(1);
  });

  it("header_change_is_ignored_after_mount", async () => {
    // SAME array both renders — isolates the header swap (rows memoized by
    // object identity would legitimately repaint on fresh objects).
    const msgs = thread(20);
    const instance = render(
      <ChatThread header={HEADER} messages={msgs} windowSize={4} windowOverscan={2} />,
    );
    await ticks();
    const rowsBefore = rowRenders.count;
    instance.rerender(
      <ChatThread
        header={<Text>CHANGED</Text>}
        messages={msgs}
        windowSize={4}
        windowOverscan={2}
      />,
    );
    await ticks();
    const frame = instance.lastFrame() ?? "";
    instance.unmount();
    expect(frame).toContain("BANNER");
    expect(frame).not.toContain("CHANGED");
    // Swapping the header element must not repaint rows (memo scope).
    expect(rowRenders.count).toBe(rowsBefore);
  });

  it("header_removal_is_ignored_and_loses_no_rows", async () => {
    // THE same-length trap (blueprint Corner 4): removal + graduation in
    // ONE rerender keeps items.length constant — a non-frozen design skips
    // the newly graduated row permanently.
    const instance = render(
      <ChatThread header={HEADER} messages={thread(10)} windowSize={4} windowOverscan={2} />,
    );
    await ticks();
    instance.rerender(<ChatThread messages={thread(11)} windowSize={4} windowOverscan={2} />);
    await ticks();
    instance.rerender(<ChatThread messages={thread(14)} windowSize={4} windowOverscan={2} />);
    await ticks();
    const frame = instance.lastFrame() ?? "";
    instance.unmount();
    for (let i = 0; i < 14; i += 1) {
      const count = frame.split(`msg-${i} content`).length - 1;
      expect(count, `msg-${i}`).toBe(1);
    }
    expect(frame.split("BANNER").length - 1).toBe(1);
  });

  it("late_header_is_ignored", async () => {
    // Mount-freeze contract: a header arriving AFTER mount never prepends
    // (the blueprint's late-arrival duplication trap).
    const instance = render(<ChatThread messages={thread(20)} windowSize={4} windowOverscan={2} />);
    await ticks();
    instance.rerender(
      <ChatThread
        header={<Text>LATE</Text>}
        messages={thread(22)}
        windowSize={4}
        windowOverscan={2}
      />,
    );
    await ticks();
    const frame = instance.lastFrame() ?? "";
    instance.unmount();
    expect(frame).not.toContain("LATE");
    for (let i = 0; i < 22; i += 1) {
      expect(frame.split(`msg-${i} content`).length - 1, `msg-${i}`).toBe(1);
    }
  });

  it("sentinel_key_collision_throws_typed", () => {
    const bad = () =>
      ChatThread({
        header: HEADER,
        messages: [{ id: "__theokit_tui_header__", role: "user", content: "x" }],
      });
    expect(bad).toThrow(TypeError);
    expect(bad).toThrow("__theokit_tui_header__");
  });
});

describe("ChatThread markdown routing (M13 T3.1)", () => {
  it("thread_message_markdown_flag_routes_to_row", () => {
    const instance = render(
      <ChatThread
        messages={[
          {
            id: "m1",
            role: "assistant",
            content: "**b** styled",
            markdown: true,
          },
          { id: "m2", role: "assistant", content: "**raw** markers" },
        ]}
      />,
    );
    const raw = instance.lastFrame() ?? "";
    instance.unmount();

    const frame = stripAnsi(raw);
    expect(frame).toContain("b styled");
    expect(frame).not.toContain("**b**");
    // Unflagged row keeps markers literally (default-off per message).
    expect(frame).toContain("**raw** markers");
  });
});
