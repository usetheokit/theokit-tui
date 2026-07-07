import { render } from "ink-testing-library";
import { describe, expect, it, vi } from "vitest";

import { ChatComposer, isNewlineChord } from "./chat-composer.js";
import { TheoTUIProvider } from "./theme.js";

// Exact stdin byte sequences from ink's own test suite (blueprint Corner 1;
// SEPA brief: never trust prose renderings of control bytes).
const ENTER = "\r";
const CTRL_J = "\n";
const LEFT_ARROW = "\u001B[D";
const RIGHT_ARROW = "\u001B[C";
const BACKSPACE = "\u007F";

const tick = async () => new Promise((resolve) => setTimeout(resolve, 0));
// Empirically, frames from writes landing in the same Ink flush window never
// reach lastFrame() (verified live in review); settle 50ms per write — the
// ink-ui test idiom — so each event flushes its own frame.
const settle = async () => new Promise((resolve) => setTimeout(resolve, 50));

// SEPA brief (MAJOR): useFocus assigns focus in mount EFFECTS — a write
// immediately after render() is silently dropped. Always settle after mount.
async function mount(ui: Parameters<typeof render>[0]) {
  const instance = render(ui);
  await tick();
  await tick();
  return instance;
}

async function type(
  instance: Awaited<ReturnType<typeof mount>>,
  chunks: string[],
) {
  for (const chunk of chunks) {
    instance.stdin.write(chunk);
    await settle();
  }
}

describe("ChatComposer (T3.2)", () => {
  it("typing_updates_frame_with_typed_text", async () => {
    // Char-by-char with settle > Ink's throttle window: each event flushes
    // (Ink drops intermediate frames of same-window bursts — no trailing).
    const instance = await mount(<ChatComposer onSubmit={() => {}} />);
    await type(instance, ["h", "i"]);
    expect(instance.lastFrame()).toContain("hi");
    instance.unmount();
  });

  it("enter_submits_trimmed_text_and_clears", async () => {
    const onSubmit = vi.fn();
    const instance = await mount(<ChatComposer onSubmit={onSubmit} />);
    await type(instance, ["hello", ENTER]);
    expect(onSubmit).toHaveBeenCalledWith("hello");
    expect(instance.lastFrame()).not.toContain("hello");
    instance.unmount();
  });

  it("whitespace_only_enter_is_noop", async () => {
    const onSubmit = vi.fn();
    const instance = await mount(<ChatComposer onSubmit={onSubmit} />);
    await type(instance, ["   ", ENTER]);
    expect(onSubmit).not.toHaveBeenCalled();
    instance.unmount();
  });

  it("ctrl_j_inserts_newline_in_multiline", async () => {
    const onSubmit = vi.fn();
    const instance = await mount(<ChatComposer onSubmit={onSubmit} />);
    await type(instance, ["ab", CTRL_J, "cd", ENTER]);
    expect(onSubmit).toHaveBeenCalledWith("ab\ncd");
    instance.unmount();
  });

  it("arrows_and_backspace_edit_at_cursor", async () => {
    const onSubmit = vi.fn();
    const instance = await mount(<ChatComposer onSubmit={onSubmit} />);
    await type(instance, ["abc", LEFT_ARROW, BACKSPACE, ENTER]);
    expect(onSubmit).toHaveBeenCalledWith("ac");
    instance.unmount();
  });

  it("placeholder_renders_when_empty", async () => {
    const instance = await mount(
      <ChatComposer onSubmit={() => {}} placeholder="Type a message" />,
    );
    expect(instance.lastFrame()).toContain("Type a message");
    instance.unmount();
  });

  it("single_line_mode_ignores_ctrl_j", async () => {
    const onSubmit = vi.fn();
    const instance = await mount(
      <ChatComposer onSubmit={onSubmit} multiLine={false} />,
    );
    await type(instance, ["ab", CTRL_J, "cd", ENTER]);
    expect(onSubmit).toHaveBeenCalledWith("abcd");
    instance.unmount();
  });

  it("cursor_never_splits_a_grapheme", async () => {
    // SEPA iteration-5 finding 1: slicing one code unit at the cursor breaks
    // surrogate pairs — the whole emoji must stay intact in the frame.
    const instance = await mount(<ChatComposer onSubmit={() => {}} />);
    await type(instance, ["a", "👍", LEFT_ARROW]);
    expect(instance.lastFrame()).toContain("👍");
    instance.unmount();
  });

  it("multichar_input_burst_inserts_atomically", async () => {
    // EC-3: bursts may arrive as one write (paste-like without bracketed
    // paste). The buffer truth is the submit value — frame flushes for
    // intra-window burst chars are dropped by Ink's no-trailing throttle.
    const onSubmit = vi.fn();
    const instance = await mount(<ChatComposer onSubmit={onSubmit} />);
    await type(instance, ["hello world", ENTER]);
    expect(onSubmit).toHaveBeenCalledWith("hello world");
    instance.unmount();
  });

  it("right_arrow_moves_cursor_back_over_text", async () => {
    const onSubmit = vi.fn();
    const instance = await mount(<ChatComposer onSubmit={onSubmit} />);
    await type(instance, ["ab", LEFT_ARROW, RIGHT_ARROW, BACKSPACE, ENTER]);
    expect(onSubmit).toHaveBeenCalledWith("a");
    instance.unmount();
  });

  it("cursor_renders_visibly_when_sitting_on_a_newline", async () => {
    // Exercises the raw === "\n" cursor branch (cell stays visible).
    const instance = await mount(<ChatComposer onSubmit={() => {}} />);
    await type(instance, ["a", CTRL_J, "b", LEFT_ARROW, LEFT_ARROW]);
    const frame = instance.lastFrame() ?? "";
    expect(frame).toContain("a");
    expect(frame).toContain("b");
    instance.unmount();
  });

  it("unfocused_composer_ignores_input", async () => {
    // Review F-tests-1 (plan T3.2 Deep Dives): isActive gating verified.
    const onSubmit = vi.fn();
    const instance = await mount(
      <ChatComposer onSubmit={onSubmit} autoFocus={false} />,
    );
    await type(instance, ["abc", ENTER]);
    expect(onSubmit).not.toHaveBeenCalled();
    instance.unmount();
  });

  it("enter_submits_payload_trimmed_of_surrounding_whitespace", async () => {
    // Review F-tests-3: the PAYLOAD is trimmed, not only the guard.
    const onSubmit = vi.fn();
    const instance = await mount(<ChatComposer onSubmit={onSubmit} />);
    await type(instance, [" ", "h", "i", " ", ENTER]);
    expect(onSubmit).toHaveBeenCalledWith("hi");
    instance.unmount();
  });

  it("throwing_onSubmit_propagates_and_preserves_the_draft", async () => {
    // Review F-dom-6 (frontend): EC-5 — the exception propagates SYNCHRONOUSLY
    // through the stdin emit chain, and the draft must survive it.
    const instance = await mount(
      <ChatComposer
        onSubmit={() => {
          throw new Error("caller boom");
        }}
      />,
    );
    await type(instance, ["h", "i"]);
    expect(() => instance.stdin.write(ENTER)).toThrow("caller boom");
    await settle();
    instance.stdin.write("!");
    await settle();
    expect(instance.lastFrame()).toContain("hi!");
    instance.unmount();
  });

  it("kitty_shift_return_counts_as_newline_chord", () => {
    // The kitty-only branch, unit-tested with a synthetic key (review
    // F-dom-4/testing — unreachable via test stdin, reachable as a function).
    const key = {
      return: true,
      shift: true,
      leftArrow: false,
      rightArrow: false,
      backspace: false,
      delete: false,
      ctrl: false,
      meta: false,
    };
    expect(isNewlineChord("", key, true)).toBe(true);
    expect(isNewlineChord("", key, false)).toBe(false);
    expect(isNewlineChord("", { ...key, shift: false }, true)).toBe(false);
  });
});

// M6 T3.1 (plan D8): the cursor is invisible at chalk level 0 (inverse is an
// attribute — the whole visual channel collapses). Under the no-color theme
// a visible marker carries the affordance.
describe("ChatComposer — no-color cursor fallback (M6 T3.1)", () => {
  it("no_color_focused_cursor_shows_marker", async () => {
    const instance = await mount(
      <TheoTUIProvider theme="no-color">
        <ChatComposer onSubmit={() => {}} />
      </TheoTUIProvider>,
    );
    await type(instance, ["h", "i"]);
    const frame = instance.lastFrame() ?? "";
    expect(frame).toContain("hi");
    expect(frame).toContain("▏");
    instance.unmount();
  });

  it("no_color_placeholder_cursor_visible", async () => {
    const instance = await mount(
      <TheoTUIProvider theme="no-color">
        <ChatComposer onSubmit={() => {}} placeholder="type…" />
      </TheoTUIProvider>,
    );
    const frame = instance.lastFrame() ?? "";
    expect(frame).toContain("type…");
    expect(frame).toContain("▏");
    instance.unmount();
  });

  it("colored_mode_bytes_unchanged", async () => {
    const instance = await mount(<ChatComposer onSubmit={() => {}} />);
    const frame = instance.lastFrame() ?? "";
    // The marker is no-color-only — colored mode keeps the inverse cursor.
    expect(frame).not.toContain("▏");
    instance.unmount();
  });
});
