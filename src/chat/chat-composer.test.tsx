import { render } from "ink-testing-library";
import { describe, expect, it, vi } from "vitest";
import {
  waitFor as waitForCondition,
  WAIT_BUDGET_MS,
} from "../../tests/fixtures/wait-for.js";

import {
  ChatComposer,
  isNewlineChord,
  parseShellCommand,
} from "./chat-composer.js";
import { TheoTUIProvider } from "../theme/theme.js";

// Exact stdin byte sequences from ink's own test suite (blueprint Corner 1;
// SEPA brief: never trust prose renderings of control bytes).
const ENTER = "\r";
const CTRL_J = "\n";
const LEFT_ARROW = "\u001B[D";
const UP_ARROW = "\u001B[A";
const DOWN_ARROW = "\u001B[B";
const TAB = "\t";
const ESC = "\u001B";
const RIGHT_ARROW = "\u001B[C";
const BACKSPACE = "\u007F";

const tick = async () => new Promise((resolve) => setTimeout(resolve, 0));
// B-125 — a FIXED 50ms sleep per write is what made this file fail about one full-suite run in
// twenty (`multichar_input_burst_inserts_atomically`, measured over 20 consecutive runs). The
// file's own note two lines up already said a fixed sleep is flaky under load and that polling is
// the answer; `type()` just never used the polling helper.
//
// This waits for the frame to STOP CHANGING instead of guessing how long that takes: two identical
// consecutive reads mean Ink has flushed and settled. Unloaded it returns in ~2 ticks, faster than
// the old sleep; loaded it waits as long as it needs, up to a ceiling well above the 50ms that was
// failing. The ceiling exists so a genuinely stuck render fails the test rather than hanging it.
// B-057 — extracted so the RULE can be tested against an injected frame source, with no timing
// dependency. The behaviour here is unchanged by the extraction; T1.2 is what changes it.
// How long to keep waiting before concluding that nothing is coming. It is NOT the correctness
// mechanism — detecting the reaction is — and it is only ever paid by an input that legitimately
// changes nothing (an ignored key). Measured: Ink reacts in **8-16 ms** unloaded over eight
// keystrokes, so 200 ms is ~12x the observed latency.
//
// It was 400 ms, and that cost was not free: review measured this file 2.8x slower on a test that
// types an ignored ESC (223 ms -> 621 ms), and under concurrent load that test reached 11.2 s
// against a 15 s budget and failed one `pnpm gates` run in three. Halving the ceiling halves the
// no-reaction penalty while keeping an order of magnitude of margin over the measured latency.
const CEILING_MS = 200;

const settleWatching = async (
  readFrame: () => string | undefined,
  before?: string,
) => {
  let previous: string | undefined;
  // B-057 — the fix, and it is one boolean. Stability alone was never the condition: the frame is
  // trivially "stable" in the window between the write and Ink's render, which is exactly when the
  // old helper returned. A reaction must be OBSERVED first — either the frame differs from what it
  // was before the write, or (when no baseline was captured) the caller is not waiting on one.
  let reacted = before === undefined;
  for (let elapsed = 0; elapsed < CEILING_MS; elapsed += 10) {
    // duration is the subject: this is a POLL INTERVAL inside a bounded condition-wait, not a
    // sleep-then-assert. It is already the idiom B-033 converts other sites TO.
    await new Promise((resolve) => setTimeout(resolve, 10));
    const frame = readFrame();
    if (!reacted && frame !== undefined && frame !== before) reacted = true;
    if (reacted && frame !== undefined && frame === previous) return;
    previous = frame;
  }
  // The ceiling stays, and stays a quiet return rather than a throw (ADR D3 keeps it BOUNDED; the
  // assertion that follows is what reports the failure, with the frame it actually saw). An input
  // that legitimately changes nothing burns it — measured as rare enough that the file got FASTER
  // overall, 27.4s -> 23.9s, because the common case now returns as soon as the change lands.
};

// B-057, second review pass — the invariant is ORDER, and a required parameter cannot express it.
//
// The first fix made `before` a required argument so that `tsc` would catch a caller dropping it.
// Review then defeated that in two lines: MOVE the capture to AFTER the write and every call site
// silently reverts to the stale-read behaviour, passing all 57 tests AND `tsc --noEmit`, because
// arity is all a signature pins.
//
// So the ordering is no longer available to get wrong: capturing, writing and settling happen
// inside ONE function, and callers hand it the write to perform rather than performing it
// themselves. There is no baseline parameter left to misplace.
const settleAround = async (
  write: () => void,
  readFrame: () => string | undefined,
) => {
  const before = readFrame();
  write();
  await settleWatching(readFrame, before);
};

const writeThenSettle = async (
  instance: { stdin: { write: (data: string) => void } },
  chunk: string,
) => settleAround(() => instance.stdin.write(chunk), lastRenderedFrame);

/** Settle with no baseline — for the sites where no write precedes it, so no reaction is owed. */
const settle = async () => settleWatching(lastRenderedFrame, undefined);

/** Set by `mount`, so `settle` can watch the instance under test without threading it through. */
let currentInstance: { lastFrame: () => string | undefined } | undefined;
const lastRenderedFrame = () => currentInstance?.lastFrame();

// SEPA brief (MAJOR): useFocus assigns focus in mount EFFECTS — a write
// immediately after render() is silently dropped. Always settle after mount.
async function mount(ui: Parameters<typeof render>[0]) {
  const instance = render(ui);
  currentInstance = instance;
  await tick();
  await tick();
  return instance;
}

async function type(
  instance: Awaited<ReturnType<typeof mount>>,
  chunks: string[],
) {
  for (const chunk of chunks) {
    await writeThenSettle(instance, chunk);
  }
}

// Poll the frame until `substring` is present (or absent), up to a deadline.
// Ink's render is time-throttled; a fixed `settle` sleep is flaky under load
// (testing.md §6). Polling resolves as soon as the frame settles and waits as
// long as needed — deterministic regardless of machine load.
async function waitForFrame(
  instance: Awaited<ReturnType<typeof mount>>,
  substring: string,
  present = true,
  timeoutMs: number | undefined = undefined,
): Promise<void> {
  // B-033 — delegates to the shared helper so the BOUND lives in one place. This loop's own 2000ms
  // was the measured defect: at load 26 it expired on a frame that was correct, and the same number
  // was copied into a second helper further down this very file.
  await waitForCondition(
    () => (instance.lastFrame() ?? "").includes(substring) === present,
    {
      describe: `the frame to ${present ? "contain" : "stop containing"} ${JSON.stringify(substring)} — last frame:\n${instance.lastFrame() ?? ""}`,
      ...(timeoutMs === undefined ? {} : { timeoutMs }),
    },
  );
}

describe("ChatComposer (T3.2)", () => {
  it("typing_updates_frame_with_typed_text", async () => {
    // Char-by-char with settle > Ink's throttle window: each event flushes
    // (Ink drops intermediate frames of same-window bursts — no trailing).
    const instance = await mount(<ChatComposer onSubmit={() => {}} />);
    await type(instance, ["h", "i"]);
    await waitForFrame(instance, "hi");
    instance.unmount();
  });

  it("enter_submits_trimmed_text_and_clears", async () => {
    const onSubmit = vi.fn();
    const instance = await mount(<ChatComposer onSubmit={onSubmit} />);
    await type(instance, ["hello", ENTER]);
    expect(onSubmit).toHaveBeenCalledWith("hello");
    await waitForFrame(instance, "hello", false);
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
    await waitForFrame(instance, "Type a message");
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
    await waitForFrame(instance, "👍");
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
    // No baseline: the write THREW, so there is no reaction to wait for.
    await settle();
    await writeThenSettle(instance, "!");
    await waitForFrame(instance, "hi!");
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
      upArrow: false,
      downArrow: false,
      tab: false,
      escape: false,
      backspace: false,
      delete: false,
      ctrl: false,
      meta: false,
    };
    expect(isNewlineChord("", key, true)).toBe(true);
    expect(isNewlineChord("", key, false)).toBe(false);
    expect(isNewlineChord("", { ...key, shift: false }, true)).toBe(false);
  });

  it("alt_enter_counts_as_newline_chord_in_every_terminal", () => {
    // Alt+Enter arrives as `\x1b\r` → { return:true, meta:true } — the portable
    // "break the line" chord (Claude Code parity), unlike Shift+Enter (kitty only).
    const key = {
      return: true,
      shift: false,
      leftArrow: false,
      rightArrow: false,
      upArrow: false,
      downArrow: false,
      tab: false,
      escape: false,
      backspace: false,
      delete: false,
      ctrl: false,
      meta: true,
    };
    expect(isNewlineChord("", key, true)).toBe(true); // multiline → newline
    expect(isNewlineChord("", key, false)).toBe(false); // single-line ignores it
    expect(isNewlineChord("", { ...key, meta: false }, true)).toBe(false); // plain Enter
  });

  it("bordered_renders_a_box_around_the_input", async () => {
    const instance = await mount(
      <ChatComposer onSubmit={() => {}} bordered placeholder="type…" />,
    );
    const frame = plain(instance.lastFrame());
    // A rounded border corner is present (the Claude Code look).
    expect(frame).toMatch(/[╭┌]/);
    expect(frame).toContain("type…");
    instance.unmount();
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

  it("marker_survives_customized_no_color_base", async () => {
    // review arch-2/dom-frontend-1: the branch is DATA (isMonochrome), not
    // name identity — a customized no-color base (name "custom", colorless
    // values) keeps the visible cursor.
    const instance = await mount(
      <TheoTUIProvider
        theme={{
          base: "no-color",
          override: { role: { user: { glyph: ">> " } } },
        }}
      >
        <ChatComposer onSubmit={() => {}} placeholder="type…" />
      </TheoTUIProvider>,
    );
    const frame = instance.lastFrame() ?? "";
    expect(frame).toContain(">>");
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

// M15 T2.1 (plan m15-composer-autocomplete, ADR D2): the slash-menu
// keyboard protocol — fake-stdin scripts over the REAL useInput surface.
const COMMANDS = [
  { name: "clear", description: "clear the thread" },
  { name: "help", description: "show help" },
  { name: "hello", description: "greet" },
];
const MANY = Array.from({ length: 9 }, (_, i) => ({
  name: `cmd${i}`,
  description: `command ${i}`,
}));

// eslint-disable-next-line no-control-regex
const MENU_ANSI_RE = /\u001B\[[0-9;]*m/g;
const plain = (frame: string | undefined): string =>
  (frame ?? "").replace(MENU_ANSI_RE, "");

describe("ChatComposer slash menu (M15 T2.1)", () => {
  it("typing_slash_opens_menu_with_all_commands", async () => {
    const instance = await mount(
      <ChatComposer onSubmit={() => {}} commands={COMMANDS} />,
    );
    await type(instance, ["/"]);
    const frame = plain(instance.lastFrame());
    expect(frame).toContain("clear");
    expect(frame).toContain("help");
    expect(frame).toContain("hello");
    instance.unmount();
  });

  it("typing_narrows_and_zero_match_closes", async () => {
    const instance = await mount(
      <ChatComposer onSubmit={() => {}} commands={COMMANDS} />,
    );
    await type(instance, ["/", "h", "e"]);
    let frame = plain(instance.lastFrame());
    expect(frame).toContain("help");
    expect(frame).toContain("hello");
    expect(frame).not.toContain("clear the thread");
    await type(instance, ["z"]);
    frame = plain(instance.lastFrame());
    expect(frame).not.toContain("show help");
    instance.unmount();
  });

  it("mid_text_slash_never_opens", async () => {
    const instance = await mount(
      <ChatComposer onSubmit={() => {}} commands={COMMANDS} />,
    );
    await type(instance, ["hi ", "/", "w"]);
    const frame = plain(instance.lastFrame());
    expect(frame).toContain("hi /w"); // the input DID land (r2-F8 anchor)
    expect(frame).not.toContain("show help");
    instance.unmount();
  });

  it("arrows_move_selection_without_touching_buffer", async () => {
    const instance = await mount(
      <ChatComposer onSubmit={() => {}} commands={COMMANDS} />,
    );
    await type(instance, ["/", DOWN_ARROW, UP_ARROW, DOWN_ARROW, DOWN_ARROW]);
    // Buffer text still exactly "/" — arrows were consumed by the menu.
    const frame = plain(instance.lastFrame());
    expect(frame).toContain("/");
    expect(frame).toContain("hello"); // menu still open
    // Wrap: 3 commands, 3 downs go back to the first row.
    await type(instance, [DOWN_ARROW, TAB]);
    expect(plain(instance.lastFrame())).toContain("/clear ");
    instance.unmount();
  });

  it("window_slides_with_markers_and_counter", async () => {
    const instance = await mount(
      <ChatComposer onSubmit={() => {}} commands={MANY} />,
    );
    await type(instance, ["/"]);
    let frame = plain(instance.lastFrame());
    expect(frame).toContain("▼"); // overflow below at start
    expect(frame).not.toContain("▲");
    for (let i = 0; i < 8; i++) {
      await type(instance, [DOWN_ARROW]);
    }
    frame = plain(instance.lastFrame());
    expect(frame).toContain("▲");
    expect(frame).toContain("(9/9)");
    instance.unmount();
  });

  it("the_open_menu_renders_the_hidden_count_above_and_below", async () => {
    // B-052 — the third view over `windowFor`. `SelectList` (select-list.tsx:217,233) and
    // `WindowedList` (windowed-list.tsx:146,157) render `\u25B2 n` / `\u25BC n` from this same
    // model; the menus rendered a bare glyph over counts they already held. The UPPER edge is
    // asserted here because that is the edge B-022 shipped unpinned.
    const instance = await mount(
      <ChatComposer onSubmit={() => {}} commands={MANY} />,
    );
    await type(instance, ["/"]);
    // Row 0 of 9 in a 5-row window: four rows below, none above.
    expect(plain(instance.lastFrame())).toMatch(/\u25BC\s*4/);
    for (let i = 0; i < 8; i++) {
      await type(instance, [DOWN_ARROW]);
    }
    const frame = plain(instance.lastFrame());
    expect(frame).toMatch(/\u25B2\s*4/);
    expect(frame).not.toContain("\u25BC");
    instance.unmount();
  });

  it("tab_completes_to_command_with_trailing_space", async () => {
    const instance = await mount(
      <ChatComposer onSubmit={() => {}} commands={COMMANDS} />,
    );
    await type(instance, ["/", "h", "e", TAB, "x"]);
    // Typing after Tab proves the REAL trailing space (r2-F6 — the cursor
    // cell rendered a cosmetic space that masked the no-space mutant).
    expect(plain(instance.lastFrame())).toContain("/help x");
    instance.unmount();
  });

  it("enter_with_menu_completes_enter_without_matches_submits", async () => {
    const submitted: string[] = [];
    const instance = await mount(
      <ChatComposer
        onSubmit={(text) => {
          submitted.push(text);
        }}
        commands={COMMANDS}
      />,
    );
    await type(instance, ["/", "h", "e", ENTER]);
    expect(plain(instance.lastFrame())).toContain("/help ");
    expect(submitted).toHaveLength(0); // completion, not submit
    await type(instance, [ENTER]);
    expect(submitted).toEqual(["/help"]); // trimmed submit of the completed text
    instance.unmount();
  });

  it("enter_with_zero_matches_submits_raw", async () => {
    const submitted: string[] = [];
    const instance = await mount(
      <ChatComposer
        onSubmit={(text) => {
          submitted.push(text);
        }}
        commands={COMMANDS}
      />,
    );
    await type(instance, ["/", "z", "z", ENTER]);
    expect(submitted).toEqual(["/zz"]);
    instance.unmount();
  });

  it("escape_dismisses_and_typing_reopens", async () => {
    const instance = await mount(
      <ChatComposer onSubmit={() => {}} commands={COMMANDS} />,
    );
    await type(instance, ["/", "h", ESC]);
    // ink's escape parser holds a lone ESC briefly (meta-prefix window) — poll
    // until the menu is gone rather than a fixed sleep (flaky under load,
    // testing.md §6).
    await waitForFrame(instance, "show help", false);
    // r1-F3 (EC-4 second direction): with the menu dismissed, arrows reach
    // the BUFFER again — cursor moves left, next char inserts before "h".
    await type(instance, [LEFT_ARROW, "x"]);
    expect(plain(instance.lastFrame())).toContain("/xh");
    await type(instance, [RIGHT_ARROW, BACKSPACE, BACKSPACE, "h", "e"]);
    expect(plain(instance.lastFrame())).toContain("show help");
    instance.unmount();
  });

  it("bare_escape_without_menu_keeps_composer_focused_and_typing_lands", async () => {
    // Regression (78d4316 / review M2): ink's App handler BLURS the focused
    // input on a lone ESC — the interrupt scenario (no menu/shell open) left
    // the composer inert. The fix re-takes focus; typed chars must still land.
    const instance = await mount(<ChatComposer onSubmit={() => {}} />);
    await type(instance, ["h", "i", ESC]);
    // ESC meta-prefix window: poll until the frame still shows the draft,
    // then keep typing — without the refocus these keystrokes are dropped.
    await waitForFrame(instance, "hi", true);
    await type(instance, ["!", "?"]);
    expect(plain(instance.lastFrame())).toContain("hi!?");
    instance.unmount();
  });

  it("newline_chord_with_open_menu_closes_it_and_enter_submits", async () => {
    // r2-F3 composer-level: a multiline draft leaves command mode.
    const submitted: string[] = [];
    const instance = await mount(
      <ChatComposer
        onSubmit={(text) => {
          submitted.push(text);
        }}
        commands={COMMANDS}
      />,
    );
    await type(instance, ["/", "h", "e", CTRL_J, "x", ENTER]);
    expect(submitted).toEqual(["/he\nx"]);
    expect(plain(instance.lastFrame())).not.toContain("show help");
    instance.unmount();
  });

  it("long_description_truncates_instead_of_interleaving", async () => {
    // r2-F4: at width 40 a long description must not wrap into the name
    // column — one row per command.
    const instance = await mount(
      <ChatComposer
        onSubmit={() => {}}
        commands={[
          {
            name: "deploy",
            description:
              "deploys the current workspace to the remote environment with all checks",
          },
        ]}
      />,
    );
    Object.defineProperty(instance.stdout, "columns", { get: () => 40 });
    await type(instance, ["/"]);
    const frame = plain(instance.lastFrame());
    const menuRows = frame
      .split("\n")
      .filter((line) => line.includes("/deploy"));
    expect(menuRows).toHaveLength(1);
    // The single row FITS the 40 columns (truncation, not wrapping).
    expect((menuRows[0] ?? "").length).toBeLessThanOrEqual(40);
    instance.unmount();
  });

  it("slash_on_second_line_does_not_trigger", async () => {
    const instance = await mount(
      <ChatComposer onSubmit={() => {}} commands={COMMANDS} />,
    );
    await type(instance, ["a", CTRL_J, "/", "h"]);
    const frame = plain(instance.lastFrame());
    expect(frame).toContain("a"); // the multiline draft landed (r2-F8)
    expect(frame).toContain("/h");
    expect(frame).not.toContain("show help");
    instance.unmount();
  });

  it("monochrome_active_row_carries_marker", async () => {
    const instance = await mount(
      <TheoTUIProvider theme="no-color">
        <ChatComposer onSubmit={() => {}} commands={COMMANDS} />
      </TheoTUIProvider>,
    );
    await type(instance, ["/"]);
    const raw = instance.lastFrame() ?? "";
    const colorSgr = raw.match(
      // eslint-disable-next-line no-control-regex
      /\u001B\[(3[0-8]|4[0-8]|9[0-7]|10[0-7])m/g,
    );
    expect(colorSgr).toBeNull();
    expect(plain(raw)).toContain("❯");
    expect(raw).toMatchSnapshot("slash-menu-monochrome");
    instance.unmount();
  });

  it("menu_open_scene_snapshot", async () => {
    const instance = await mount(
      <ChatComposer onSubmit={() => {}} commands={COMMANDS} />,
    );
    await type(instance, ["/"]);
    const frame = instance.lastFrame() ?? "";
    expect(frame).toContain("help");
    expect(frame).toMatchSnapshot("slash-menu-open");
    instance.unmount();
  });

  it("hint_line_renders_dim", async () => {
    const instance = await mount(
      <ChatComposer onSubmit={() => {}} hint="esc cancels the turn" />,
    );
    const raw = instance.lastFrame() ?? "";
    expect(plain(raw)).toContain("esc cancels the turn");
    // The dimness itself (r2-F7): SGR 2 wraps the hint text.
    expect(raw).toContain("\u001B[2mesc cancels the turn");
    instance.unmount();
  });
});

describe("ChatComposer emacs editor keys (M21 T3.1)", () => {
  it("ctrl_k_kills_to_line_end_and_ctrl_y_yanks_it_back", async () => {
    const instance = await mount(<ChatComposer onSubmit={() => {}} />);
    await type(instance, ["h", "e", "l", "l", "o"]);
    await waitForFrame(instance, "hello");
    await type(instance, ["\x01"]); // C-a → line start
    await type(instance, ["\x0b"]); // C-k → kill "hello"
    await waitForFrame(instance, "hello", false);
    await type(instance, ["\x19"]); // C-y → yank it back
    await waitForFrame(instance, "hello");
    instance.unmount();
  });

  it("up_arrow_recalls_the_last_submitted_entry", async () => {
    const instance = await mount(<ChatComposer onSubmit={() => {}} />);
    await type(instance, ["h", "i"]);
    await type(instance, [ENTER]); // submit → buffer clears
    await waitForFrame(instance, "hi", false);
    await type(instance, [UP_ARROW]); // recall "hi"
    await waitForFrame(instance, "hi");
    instance.unmount();
  });

  it("ctrl_underscore_undoes_the_last_edit", async () => {
    const instance = await mount(<ChatComposer onSubmit={() => {}} />);
    await type(instance, ["a", "b", "c"]);
    await waitForFrame(instance, "abc");
    await type(instance, ["\x1f"]); // C-_ → undo the insert run
    await waitForFrame(instance, "abc", false);
    instance.unmount();
  });
});

describe("ChatComposer @-file mentions (M21 T4.1)", () => {
  const fakeSearch = async (query: string): Promise<string[]> =>
    ["src/foo.ts", "foo.md", "bar.ts"].filter((p) => p.includes(query));

  it("at_mention_opens_a_fuzzy_file_menu_and_completes_a_path", async () => {
    const instance = await mount(
      <ChatComposer onSubmit={() => {}} fileSearch={fakeSearch} />,
    );
    await type(instance, ["@", "f", "o"]);
    await waitForFrame(instance, "src/foo.ts"); // async candidates loaded
    expect(plain(instance.lastFrame())).toContain("foo.md");
    await type(instance, [ENTER]); // complete the top candidate
    await waitForFrame(instance, "foo.md", false); // menu closed
    expect(plain(instance.lastFrame())).toContain("src/foo.ts");
    instance.unmount();
  });

  it("renders_a_file_mention_row_without_a_leading_slash", async () => {
    // Parity nit: the mention menu reuses the slash renderer. A file path must
    // render bare (`❯ src/foo.ts`), NOT slash-prefixed (`/src/foo.ts`).
    const instance = await mount(
      <ChatComposer onSubmit={() => {}} fileSearch={fakeSearch} />,
    );
    await type(instance, ["@", "f", "o"]);
    await waitForFrame(instance, "src/foo.ts"); // menu open
    expect(plain(instance.lastFrame())).not.toContain("/src/foo.ts");
    instance.unmount();
  });

  it("the_mention_menu_renders_the_hidden_count_like_the_slash_menu", async () => {
    // B-052 review (F-wire-1) — the CHANGELOG says the `@` menu got the counts "for free" because
    // it shares `SlashMenu`. Structurally true, and until this test it was UNPINNED: zeroing only
    // the mention menu's counts at composer-footer.tsx:27 survived all 1650 tests, because
    // `fakeSearch` returns three candidates against a five-row window, so no mention menu in the
    // suite ever overflowed. A claim nothing can falsify is not a covered path.
    const manyFiles = Array.from({ length: 9 }, (_, i) => `src/deep${i}.ts`);
    const wideSearch = async (query: string): Promise<string[]> =>
      manyFiles.filter((p) => p.includes(query));
    const instance = await mount(
      <ChatComposer onSubmit={() => {}} fileSearch={wideSearch} />,
    );
    await type(instance, ["@", "d", "e"]);
    await waitForFrame(instance, "src/deep0.ts");
    // Row 0 of 9 in a 5-row window: four below, none above.
    expect(plain(instance.lastFrame())).toMatch(/\u25BC\s*4/);
    for (let i = 0; i < 8; i++) {
      await type(instance, [DOWN_ARROW]);
    }
    const frame = plain(instance.lastFrame());
    expect(frame).toMatch(/\u25B2\s*4/);
    expect(frame).not.toContain("\u25BC");
    instance.unmount();
  });

  it("slash_command_menu_still_works_unchanged", async () => {
    // ADR-C3 regression guard: the M15 `/` menu is untouched by the @ addition.
    const instance = await mount(
      <ChatComposer onSubmit={() => {}} commands={COMMANDS} />,
    );
    await type(instance, ["/", "h"]);
    await waitForFrame(instance, "show help");
    instance.unmount();
  });
});

describe("parseShellCommand (bang mode)", () => {
  it("returns_the_trimmed_command_after_the_bang", () => {
    expect(parseShellCommand("!git status")).toBe("git status");
    expect(parseShellCommand("!  ls -la  ")).toBe("ls -la");
  });
  it("returns_null_when_not_bang_prefixed", () => {
    expect(parseShellCommand("git status")).toBeNull();
    expect(parseShellCommand("")).toBeNull();
    expect(parseShellCommand(" !later")).toBeNull(); // bang not at the start
  });
  it("returns_empty_string_for_a_bare_bang", () => {
    expect(parseShellCommand("!")).toBe("");
  });
});

describe("ChatComposer bang mode (! quick command)", () => {
  it("runs_the_command_via_onShellCommand_not_onSubmit", async () => {
    const onSubmit = vi.fn();
    const onShellCommand = vi.fn();
    const instance = await mount(
      <ChatComposer onSubmit={onSubmit} onShellCommand={onShellCommand} />,
    );
    await type(instance, ["!", "g", "i", "t", ENTER]);
    expect(onShellCommand).toHaveBeenCalledWith("git");
    expect(onSubmit).not.toHaveBeenCalled();
    await waitForFrame(instance, "git", false); // buffer cleared after run
    instance.unmount();
  });

  it("shows_a_shell_mode_hint_while_bang_prefixed", async () => {
    const instance = await mount(
      <ChatComposer onSubmit={() => {}} onShellCommand={() => {}} />,
    );
    await type(instance, ["!"]);
    await waitForFrame(instance, "shell mode");
    instance.unmount();
  });

  it("esc_exits_shell_mode_by_clearing_the_draft", async () => {
    const instance = await mount(
      <ChatComposer onSubmit={() => {}} onShellCommand={() => {}} />,
    );
    await type(instance, ["!", "l", "s"]);
    await waitForFrame(instance, "ls");
    await type(instance, [ESC]);
    await waitForFrame(instance, "shell mode", false); // back to normal
    instance.unmount();
  });

  it("without_onShellCommand_a_bang_is_plain_text_submitted_normally", async () => {
    const onSubmit = vi.fn();
    const instance = await mount(<ChatComposer onSubmit={onSubmit} />);
    await type(instance, ["!", "x", ENTER]);
    expect(onSubmit).toHaveBeenCalledWith("!x");
    instance.unmount();
  });
});

describe("ChatComposer help toggle (?)", () => {
  it("question_mark_on_an_empty_buffer_toggles_help_and_is_not_typed", async () => {
    const onHelpToggle = vi.fn();
    const instance = await mount(
      <ChatComposer onSubmit={() => {}} onHelpToggle={onHelpToggle} />,
    );
    await type(instance, ["?"]);
    expect(onHelpToggle).toHaveBeenCalledTimes(1);
    await waitForFrame(instance, "?", false); // the `?` is consumed, not inserted
    instance.unmount();
  });

  it("question_mark_after_text_is_a_literal_char_not_a_toggle", async () => {
    const onHelpToggle = vi.fn();
    const instance = await mount(
      <ChatComposer onSubmit={() => {}} onHelpToggle={onHelpToggle} />,
    );
    await type(instance, ["h", "i", "?"]);
    await waitForFrame(instance, "hi?");
    expect(onHelpToggle).not.toHaveBeenCalled();
    instance.unmount();
  });

  it("without_onHelpToggle_a_question_mark_is_plain_text", async () => {
    const instance = await mount(<ChatComposer onSubmit={() => {}} />);
    await type(instance, ["?"]);
    await waitForFrame(instance, "?");
    instance.unmount();
  });
});

// Merged from chat-composer.onchange.test.tsx (ADR 0003): the qualifier segment
// said WHICH cases the file covered, not HOW it runs. That is a describe()
// block, and splitting it across files hid it from anyone reading the base.
const tickOnchange = () => new Promise((r) => setTimeout(r, 0));

// Poll-until-condition instead of a fixed sleep (review F-tests-8 — a fixed
// 50 ms settle is a flake surface under CI load; testing.md § 6).
/**
 * B-125 — write `input` until it lands, rather than assuming two ticks were enough to subscribe.
 *
 * `useInput` attaches AFTER the mount frame, so a write issued before that is silently dropped —
 * and "two ticks" is a guess about scheduling, not a fact about the component. Under a loaded suite
 * the guess is wrong about one run in twenty, and the symptom is this file's `waitFor` timing out
 * two seconds later, far from the cause.
 *
 * Re-writing is the right compensation because a dropped keystroke is exactly what happened: the
 * component never saw it, so sending it again is not a retry of a failed assertion but a resend of
 * a lost event.
 */
const typeUntil = async (
  inst: { stdin: { write: (s: string) => void } },
  input: string,
  landed: () => boolean,
  // B-034 — was 2000 ms, the third copy of that number in this file and the one B-033 did not
  // reach. It re-sends input between attempts, which `waitFor` does not, so it shares the BUDGET
  // rather than delegating the loop.
  timeoutMs = WAIT_BUDGET_MS,
) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    inst.stdin.write(input);
    for (let i = 0; i < 10; i += 1) {
      await tickOnchange();
      if (landed()) return;
    }
  }
};

/**
 * B-033 — the file's SECOND hand-rolled polling loop, now delegating to the shared helper.
 *
 * Two copies of the same idiom with the same unmeasured 2000ms bound existed in this one file. That
 * is what a per-file idiom becomes, and it is why the bound now lives in `tests/fixtures/wait-for`.
 */
/**
 * `describe` is REQUIRED here for the same reason the shared helper requires it, and this wrapper
 * defeated that requirement by supplying a constant: review measured a plausible off-by-one in
 * `chat-composer.tsx` failing as a 10.1 s timeout saying "a condition in chat-composer.test.tsx",
 * where the pre-B-033 local loop failed in 2.1 s saying `expected 'h' to be 'hi'`. A mandatory
 * field satisfied by a placeholder is an optional field with extra steps.
 */
const waitFor = async (
  predicate: () => boolean,
  describe: string,
  timeoutMs?: number,
) => {
  await waitForCondition(predicate, {
    describe,
    ...(timeoutMs === undefined ? {} : { timeoutMs }),
  });
};

/**
 * M54 (agent-builder backtrack) — `onChange` reports buffer text so the host can enforce a
 * composer-empty precondition (Codex `is_normal_backtrack_mode`); `initialValue` seeds the
 * draft being restored.
 */
describe("ChatComposer onChange", () => {
  it("fires_with_current_text_as_the_buffer_changes", async () => {
    const onChange = vi.fn();
    const inst = render(
      <TheoTUIProvider>
        <ChatComposer onSubmit={() => {}} onChange={onChange} />
      </TheoTUIProvider>,
    );
    await tickOnchange();
    await tickOnchange();
    inst.stdin.write("hi");
    // The last onChange reflects the typed text.
    await waitFor(
      () => onChange.mock.calls.at(-1)?.[0] === "hi",
      `onChange to report "hi" — last saw ${String(onChange.mock.calls.at(-1)?.[0])}`,
    );
    const calls = onChange.mock.calls.map((c) => c[0]);
    expect(calls.at(-1)).toBe("hi");
    inst.unmount();
  });

  // Review M3 (F-tests-4 / F-wire-6): the prop-to-reducer wiring and the
  // documented "fires after mount with the initial text" contract — the exact
  // composer-empty-precondition handshake the backtrack feature needs.
  it("initialValue_renders_seeded_text_and_onChange_fires_it_after_mount", async () => {
    const onChange = vi.fn();
    const inst = render(
      <TheoTUIProvider>
        <ChatComposer
          onSubmit={() => {}}
          onChange={onChange}
          initialValue="draft"
        />
      </TheoTUIProvider>,
    );
    await waitFor(
      () => onChange.mock.calls.length > 0,
      "onChange to fire at least once",
    );
    // (a) the seeded draft appears in the frame…
    expect(inst.lastFrame()).toContain("draft");
    // (b) …and onChange fired after mount with the initial text.
    expect(onChange.mock.calls[0]?.[0]).toBe("draft");
    // The seeded draft stays editable — typing appends at the seeded cursor.
    // Two ticks: the useInput subscription attaches after the mount frame
    // (same idiom as the sibling test above).
    await typeUntil(
      inst,
      "!",
      () => onChange.mock.calls.at(-1)?.[0] === "draft!",
    );
    expect(onChange.mock.calls.at(-1)?.[0]).toBe("draft!");
    inst.unmount();
  });
});

describe("issue #59 item 3 — an unstable onChange identity does not re-fire", () => {
  it("a re-render with a new INLINE callback and unchanged text does not call again", async () => {
    // F-arch-7 / F-tui-10: the effect depended on `[buffer.text, onChange]`, so an
    // `onChange={(t) => something(t)}` — the form every consumer writes — re-fired on
    // each host render with the text UNCHANGED. The documented contract is "after mount
    // with the initial text, and on every edit"; firing on an identity change is
    // neither of those.
    const spy = vi.fn();
    // The spy is stable, but the function PASSED IN is new on every render — the real case.
    const tree = () => (
      <TheoTUIProvider>
        <ChatComposer onSubmit={() => {}} onChange={(t) => spy(t)} />
      </TheoTUIProvider>
    );
    const inst = render(tree());
    await waitFor(
      () => spy.mock.calls.length > 0,
      "the submit spy to be called",
    );
    await tickOnchange();
    const antes = spy.mock.calls.length;

    inst.rerender(tree());
    await tickOnchange();
    await tickOnchange();

    expect(spy.mock.calls.length).toBe(antes);
    inst.unmount();
  });
});

// B-057 — the fourth class of B-034's load-sensitivity tail, pinned deterministically.
//
// `settle` returns when two consecutive reads are identical, and TWO IDENTICAL READS ARE SATISFIED
// TRIVIALLY BY NOTHING HAVING CHANGED YET. It cannot tell "settled after the write" from "has not
// started reacting to the write". Its decision point is the second poll, ~20ms in; under load that
// precedes Ink's throttled render, so it hands back a stale frame and the assertion reads it.
//
// The suite showed this as two `pnpm gates` runs failing on two DIFFERENT tests in this file, both
// green in isolation. That is not a regression test — it reproduces only under load. This one
// drives the helper through an INJECTED frame source, so it fails for the race itself, on any
// machine, with no timing dependency at all.
describe("settle (B-057)", () => {
  it("test_settle_does_not_return_before_the_frame_reacts", async () => {
    // Arrange — a source that reports the SAME frame for the first three reads (the component has
    // not reacted yet) and only then reports the reaction.
    const reads: string[] = [];
    let call = 0;
    const source = () => {
      call += 1;
      const frame = call <= 3 ? "before" : "after";
      reads.push(frame);
      return frame;
    };

    // Act — a baseline is passed, which is what `type()` does for every keystroke.
    await settleWatching(source, "before");

    // Assert — the helper must not have returned while the frame still read "before". Under the
    // old implementation reads 2 and 3 are identical, so it returns at read 3 and every assertion
    // after it sees the stale frame.
    expect(reads.at(-1)).toBe("after");
    // And promptly: without a bound here, a helper that polls to its ceiling every time passes this
    // test while making the file 5.8x slower — measured on a mutant that deleted the early return
    // (F-tests-3). Six reads is the reaction at 4 plus one stabilising pair.
    expect(reads.length).toBeLessThanOrEqual(6);
  });

  it("test_the_baseline_is_captured_before_the_write_not_after", async () => {
    // The invariant is ORDER, and neither a required parameter nor encapsulation pins it: review
    // moved the capture two lines down and every call site reverted while 57 tests and
    // `tsc --noEmit` stayed green (F-tests-2). Arity is all a signature can express.
    //
    // A test CAN express it. Give the write an immediate effect on the frame: captured BEFORE, the
    // baseline is the old value and the reaction is detected on the first read; captured AFTER, the
    // baseline is already the new value, no reaction is ever observed, and the helper polls to its
    // ceiling. So the ordering shows up as promptness.
    let frame = "before";
    let reads = 0;
    const readFrame = () => {
      reads += 1;
      return frame;
    };

    // Act — a write whose effect is already visible by the time it returns.
    await settleAround(() => {
      frame = "after";
    }, readFrame);

    // Assert — a handful of polls, not forty. Capturing after the write makes this 40.
    expect(reads).toBeLessThanOrEqual(6);
  });

  it("test_settle_does_not_return_while_the_frame_is_still_changing", async () => {
    // The OTHER half of the condition, and the first version of this block did not pin it: a mutant
    // dropping `frame === previous` — settling on the first change rather than on stability —
    // survived every test and made the suite FASTER, which is how a lost assertion disguises
    // itself (F-tests-1).
    //
    // Arrange — a source that changes, changes AGAIN, and only then holds still. Returning at the
    // first change would stop at "mid".
    const frames = ["before", "mid", "after", "after", "after"];
    let call = 0;
    const source = () => frames[Math.min(call++, frames.length - 1)];

    // Act
    await settleWatching(source, "before");

    // Assert — it waited past the intermediate frame for a stable one.
    expect(frames[Math.min(call - 1, frames.length - 1)]).toBe("after");
    expect(call).toBeGreaterThanOrEqual(4);
  });
});
