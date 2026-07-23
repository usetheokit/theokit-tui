import { describe, expect, it } from "vitest";

import {
  editorReducer,
  initialEditorState,
  seedEditorState,
} from "./composer-editor.js";

describe("seedEditorState (M54 backtrack initialValue)", () => {
  it("seeds_text_with_cursor_at_end", () => {
    const s = seedEditorState("olá mund");
    expect(s.buffer.text).toBe("olá mund");
    // cursorOffset is a UTF-16 CODE-UNIT offset (text-buffer.ts contract) —
    // end-of-text is text.length, the same unit loadText uses.
    expect(s.buffer.cursorOffset).toBe("olá mund".length);
  });

  it("empty_or_undefined_is_pristine", () => {
    expect(seedEditorState(undefined)).toEqual(initialEditorState);
    expect(seedEditorState("")).toEqual(initialEditorState);
  });

  // Review H1 regression (F-arch-1/F-tests-1/F-wire-1/F-tui-1): an astral
  // (surrogate-pair) tail must NOT leave the cursor mid-surrogate — typing
  // after seeding an emoji-bearing draft corrupted the text (mojibake).
  it("astral_tail_seeds_cursor_in_code_units_not_code_points", () => {
    const text = "ok 👋"; // 4 code points, 5 UTF-16 code units
    const s = seedEditorState(text);
    expect(s.buffer.cursorOffset).toBe(text.length); // 5 — never 4
  });

  it("insert_after_astral_seed_appends_and_stays_well_formed", () => {
    const seeded = seedEditorState("ok 👋");
    const next = editorReducer(seeded, {
      type: "buffer",
      action: { type: "insert", text: "!" },
    });
    // Exact equality proves well-formedness: the pre-fix output was the
    // corrupted "ok \ud83d!\udc4b" (insert spliced between surrogate halves).
    expect(next.buffer.text).toBe("ok 👋!");
  });
});
