import { render } from "ink-testing-library";
import { describe, expect, it, vi } from "vitest";

import {
  ChatComposer,
  isNewlineChord,
  parseShellCommand,
} from "./chat-composer.js";
import { TheoTUIProvider } from "./theme.js";

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

// Poll the frame until `substring` is present (or absent), up to a deadline.
// Ink's render is time-throttled; a fixed `settle` sleep is flaky under load
// (testing.md §6). Polling resolves as soon as the frame settles and waits as
// long as needed — deterministic regardless of machine load.
async function waitForFrame(
  instance: Awaited<ReturnType<typeof mount>>,
  substring: string,
  present = true,
  timeoutMs = 2000,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if ((instance.lastFrame() ?? "").includes(substring) === present) {
      return;
    }
    await tick();
  }
  throw new Error(
    `frame ${present ? "never contained" : "still contained"} ${JSON.stringify(
      substring,
    )} — got:\n${instance.lastFrame()}`,
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
    await settle();
    instance.stdin.write("!");
    await settle();
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
