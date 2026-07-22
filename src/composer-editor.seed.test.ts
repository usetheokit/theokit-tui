import { describe, expect, it } from "vitest";

import { initialEditorState, seedEditorState } from "./composer-editor.js";

describe("seedEditorState (M54 backtrack initialValue)", () => {
  it("seeds_text_with_cursor_at_end", () => {
    const s = seedEditorState("olá mund");
    expect(s.buffer.text).toBe("olá mund");
    expect(s.buffer.cursorOffset).toBe([..."olá mund"].length); // grapheme-aware, fim
  });

  it("empty_or_undefined_is_pristine", () => {
    expect(seedEditorState(undefined)).toEqual(initialEditorState);
    expect(seedEditorState("")).toEqual(initialEditorState);
  });
});
