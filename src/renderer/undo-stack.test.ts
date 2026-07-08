import { describe, expect, it } from "vitest";

import { UndoStack } from "./undo-stack.js";

// M21 T3.1 — the generic clone-on-push undo stack.

describe("UndoStack (M21 T3.1)", () => {
  it("pops_snapshots_last_in_first_out", () => {
    const stack = new UndoStack<{ text: string }>();
    stack.push({ text: "a" });
    stack.push({ text: "ab" });
    expect(stack.length).toBe(2);
    expect(stack.pop()).toEqual({ text: "ab" });
    expect(stack.pop()).toEqual({ text: "a" });
    expect(stack.pop()).toBeUndefined();
  });

  it("clones_on_push_so_later_mutation_does_not_corrupt_a_snapshot", () => {
    const stack = new UndoStack<{ text: string }>();
    const live = { text: "a" };
    stack.push(live);
    live.text = "MUTATED";
    expect(stack.pop()).toEqual({ text: "a" });
  });

  it("clears_all_snapshots", () => {
    const stack = new UndoStack<number>();
    stack.push(1);
    stack.push(2);
    stack.clear();
    expect(stack.length).toBe(0);
    expect(stack.pop()).toBeUndefined();
  });
});
