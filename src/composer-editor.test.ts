import { describe, expect, it } from "vitest";

import {
  editorActionForChord,
  editorReducer,
  initialEditorState,
  type EditorAction,
  type EditorState,
} from "./composer-editor.js";
import type { Key } from "./renderer/input/key.js";

// M21 T3.1 — the pure editor reducer: kill-ring coalescing, yank/yank-pop, undo
// (coalesced), and history recall. Fully deterministic (no refs, no timers).

function run(actions: EditorAction[], start = initialEditorState): EditorState {
  return actions.reduce((s, a) => editorReducer(s, a), start);
}

const type = (text: string): EditorAction => ({
  type: "buffer",
  action: { type: "insert", text },
});

describe("editorReducer — kill-ring (M21 T3.1)", () => {
  it("kills_to_line_end_and_yanks_it_back", () => {
    const s = run([
      type("hello world"),
      { type: "buffer", action: { type: "move-home" } },
      { type: "buffer", action: { type: "move-word-right" } }, // cursor after "hello"
      { type: "kill", kind: "line-end" }, // kills " world"
    ]);
    expect(s.buffer.text).toBe("hello");
    expect(s.ring[s.ring.length - 1]).toBe(" world");
    const yanked = editorReducer(s, { type: "yank" });
    expect(yanked.buffer.text).toBe("hello world");
  });

  it("coalesces_consecutive_kills_into_one_ring_entry", () => {
    // Type "a b c", go home, then two forward word-kills accumulate.
    const s = run([
      type("foobar"),
      { type: "buffer", action: { type: "move-home" } },
      { type: "kill", kind: "line-end" }, // kills "foobar"
      { type: "kill", kind: "line-end" }, // empty (nothing left) — no new entry
    ]);
    expect(s.ring.length).toBe(1);
    expect(s.ring[0]).toBe("foobar");
  });

  it("coalesces_two_non_empty_backward_kills_by_prepending", () => {
    const s = run([
      type("foo bar"), // cursor at end
      { type: "kill", kind: "word-back" }, // kills "bar" → ring ["bar"]
      { type: "kill", kind: "word-back" }, // kills "foo " → prepend → "foo bar"
    ]);
    expect(s.buffer.text).toBe("");
    expect(s.ring[s.ring.length - 1]).toBe("foo bar");
    expect(s.ring.length).toBe(1);
  });

  it("yank_with_an_empty_ring_is_a_no_op", () => {
    const s = editorReducer(initialEditorState, { type: "yank" });
    expect(s).toBe(initialEditorState);
  });

  it("yank_pop_cycles_to_an_older_entry", () => {
    let s = run([
      type("one"),
      { type: "buffer", action: { type: "move-home" } },
      { type: "kill", kind: "line-end" }, // ring: ["one"]
    ]);
    s = run(
      [
        type("two"),
        { type: "buffer", action: { type: "move-home" } },
        { type: "kill", kind: "line-end" }, // ring: ["one","two"]
      ],
      s,
    );
    s = editorReducer(s, { type: "yank" }); // inserts "two"
    expect(s.buffer.text).toBe("two");
    s = editorReducer(s, { type: "yank-pop" }); // replaces with "one"
    expect(s.buffer.text).toBe("one");
  });
});

describe("editorReducer — undo (M21 T3.1)", () => {
  it("undoes_a_word_run_as_one_step_then_a_kill", () => {
    let s = run([type("hello")]); // one coalesced insert run
    s = run([{ type: "kill", kind: "word-back" }], s); // kills "hello"
    expect(s.buffer.text).toBe("");
    s = editorReducer(s, { type: "undo" }); // undo the kill → "hello"
    expect(s.buffer.text).toBe("hello");
    s = editorReducer(s, { type: "undo" }); // undo the insert run → ""
    expect(s.buffer.text).toBe("");
  });

  it("undo_on_an_empty_stack_is_a_no_op", () => {
    const s = editorReducer(initialEditorState, { type: "undo" });
    expect(s).toEqual(initialEditorState);
  });

  it("caps_the_undo_stack_at_100_snapshots", () => {
    // Non-word inserts (spaces) never coalesce, so each pushes an undo snapshot.
    let s = initialEditorState;
    for (let i = 0; i < 130; i++) {
      s = editorReducer(s, {
        type: "buffer",
        action: { type: "insert", text: " " },
      });
    }
    expect(s.undo.length).toBe(100);
  });
});

describe("editorReducer — history (M21 T3.1)", () => {
  it("recalls_previous_entries_and_restores_the_draft", () => {
    let s = run([type("first"), { type: "submit", entry: "first" }]);
    s = run([type("second"), { type: "submit", entry: "second" }], s);
    s = run([type("dr")], s); // a live draft
    s = editorReducer(s, { type: "history-prev" }); // → "second"
    expect(s.buffer.text).toBe("second");
    s = editorReducer(s, { type: "history-prev" }); // → "first"
    expect(s.buffer.text).toBe("first");
    s = editorReducer(s, { type: "history-next" }); // → "second"
    expect(s.buffer.text).toBe("second");
    s = editorReducer(s, { type: "history-next" }); // past newest → draft
    expect(s.buffer.text).toBe("dr");
  });

  it("dedups_a_consecutive_identical_submit", () => {
    let s = run([type("same"), { type: "submit", entry: "same" }]);
    s = run([type("same"), { type: "submit", entry: "same" }], s); // thread state
    expect(s.history).toEqual(["same"]); // second identical submit deduped
  });

  it("history_prev_with_no_history_is_a_no_op", () => {
    const s = editorReducer(initialEditorState, { type: "history-prev" });
    expect(s).toEqual(initialEditorState);
  });

  it("history_next_on_the_live_draft_is_a_no_op", () => {
    const s = editorReducer(initialEditorState, { type: "history-next" });
    expect(s).toEqual(initialEditorState);
  });

  it("yank_pop_with_fewer_than_two_entries_is_a_no_op", () => {
    let s = run([type("only")]);
    s = run([{ type: "kill", kind: "word-back" }], s); // ring: ["only"]
    const before = s;
    s = editorReducer(s, { type: "yank-pop" });
    expect(s).toBe(before); // unchanged reference
  });

  it("caps_the_history_ring_at_100_entries", () => {
    // B1 companion (review M2): actually exercise the HISTORY_CAP slice + the
    // undo cap, which the dedup-only test never did.
    let s = initialEditorState;
    for (let i = 0; i < 130; i++) {
      s = run([type(`entry${i}`), { type: "submit", entry: `entry${i}` }], s);
    }
    expect(s.history.length).toBe(100);
    expect(s.history[s.history.length - 1]).toBe("entry129");
    expect(s.history[0]).toBe("entry30"); // oldest 30 dropped
  });
});

describe("editorActionForChord (M21 T4.1)", () => {
  const key = (over: Partial<Key> = {}): Key =>
    ({ ctrl: false, meta: false, shift: false, ...over }) as Key;

  it("resolves_emacs_chords_and_undo", () => {
    expect(editorActionForChord("\x1f", key())).toEqual({ type: "undo" });
    expect(editorActionForChord("w", key({ ctrl: true }))).toEqual({
      type: "kill",
      kind: "word-back",
    });
    expect(editorActionForChord("y", key({ ctrl: true }))).toEqual({
      type: "yank",
    });
    expect(editorActionForChord("z", key())).toBeUndefined(); // not a chord
  });
});

describe("editorReducer — yank-pop guard (M21 review B1)", () => {
  function ringOfTwo(): EditorState {
    const s = run([
      type("one"),
      { type: "buffer", action: { type: "move-home" } },
      { type: "kill", kind: "line-end" }, // ring: ["one"]
    ]);
    return run(
      [
        type("two"),
        { type: "buffer", action: { type: "move-home" } },
        { type: "kill", kind: "line-end" }, // ring: ["one","two"]
      ],
      s,
    );
  }

  it("yank_pop_after_a_cursor_move_is_a_no_op_not_corruption", () => {
    let s = editorReducer(ringOfTwo(), { type: "yank" }); // "two"
    s = editorReducer(s, { type: "buffer", action: { type: "move-left" } });
    const before = s.buffer;
    s = editorReducer(s, { type: "yank-pop" }); // NOT immediately after a yank
    expect(s.buffer).toEqual(before); // buffer untouched (was corruption pre-fix)
  });

  it("yank_pop_after_typing_is_a_no_op", () => {
    let s = editorReducer(ringOfTwo(), { type: "yank" }); // "two"
    s = editorReducer(s, type("X")); // typed → breaks the yank chain
    const before = s.buffer.text;
    s = editorReducer(s, { type: "yank-pop" });
    expect(s.buffer.text).toBe(before);
  });

  it("yank_pop_immediately_after_a_yank_still_cycles", () => {
    let s = editorReducer(ringOfTwo(), { type: "yank" }); // "two"
    s = editorReducer(s, { type: "yank-pop" }); // valid → "one"
    expect(s.buffer.text).toBe("one");
  });
});
