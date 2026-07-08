import { describe, expect, it } from "vitest";

import {
  editorReducer,
  initialEditorState,
  type EditorAction,
  type EditorState,
} from "./composer-editor.js";

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

  it("dedups_a_consecutive_identical_submit_and_caps_the_ring", () => {
    let s = run([type("same"), { type: "submit", entry: "same" }]);
    s = run([type("same"), { type: "submit", entry: "same" }]);
    expect(s.history).toEqual(["same"]);
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
});
