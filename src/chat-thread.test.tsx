import { render } from "ink-testing-library";
import { describe, expect, it, vi } from "vitest";

import { renderFrame } from "../tests/helpers.js";
import type { ChatThreadMessage } from "./chat-thread.js";

// Row-render spy: wrap the real ChatMessage so repaint-scope assertions can
// count row renders without polluting the public API (plan T2.1/T2.2, D2).
const rowRenders = vi.hoisted(() => ({ count: 0 }));
vi.mock("./chat-message.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./chat-message.js")>();
  return {
    ...actual,
    ChatMessage: (props: Parameters<typeof actual.ChatMessage>[0]) => {
      rowRenders.count += 1;
      return actual.ChatMessage(props);
    },
  };
});

const { ChatThread } = await import("./chat-thread.js");

const msg = (
  i: number,
  role: ChatThreadMessage["role"] = "user",
  content = `msg-${i} content`,
): ChatThreadMessage => ({ id: `m${i}`, role, content });

const thread = (n: number): ChatThreadMessage[] =>
  Array.from({ length: n }, (_, i) =>
    msg(i, i % 2 === 0 ? "user" : "assistant"),
  );

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
    const frame = await renderFrame(
      <ChatThread messages={thread(20)} windowSize={4} windowOverscan={2} />,
    );
    // Static output accumulates into the frame (ink test contract).
    expect(frame).toContain("msg-0 content");
    expect(frame).toContain("msg-19 content");
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
    const instance = render(
      <ChatThread messages={thread(20)} windowSize={4} windowOverscan={2} />,
    );
    await new Promise((r) => setTimeout(r, 0));
    // Static prefix rows render ONCE (14) + live tail rows (6) = 20 on mount;
    // the boundary assertion: live tail is exactly windowSize + overscan.
    const mountRenders = rowRenders.count;
    expect(mountRenders).toBe(20);
    rowRenders.count = 0;
    instance.rerender(
      <ChatThread messages={thread(20)} windowSize={4} windowOverscan={2} />,
    );
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
