import { describe, expect, it } from "vitest";

import { renderFrame } from "../tests/helpers.js";
import { ChoiceRow } from "./choice-row.js";
import { MultiStepProgress } from "./multi-step-progress.js";
import { QuestionPrompt } from "./question-prompt.js";
import { SelectList } from "./select-list.js";
import { TodoList } from "./todo-list.js";

// Issue #50 — the list/menu components expose an opt-in `gap` (default 0),
// mirroring Stack, so a consumer can add vertical breathing room BETWEEN items
// without changing the tight default (which matches Claude Code). Purely
// additive: gap unset ⇒ rows are flush (the current behavior).

/** Blank-line count strictly between the first hit of `a` and of `b`. */
function gapBetween(frame: string, a: string, b: string): number {
  const lines = frame.split("\n");
  const ia = lines.findIndex((l) => l.includes(a));
  const ib = lines.findIndex((l) => l.includes(b));
  expect(ia).toBeGreaterThanOrEqual(0);
  expect(ib).toBeGreaterThan(ia);
  return ib - ia - 1;
}

describe("row gap (issue #50) — opt-in inter-item spacing", () => {
  it("TodoList_default_is_flush_gap_one_spaces_rows", async () => {
    const items = [
      { id: "a", label: "Alpha", status: "pending" as const },
      { id: "b", label: "Beta", status: "pending" as const },
    ];
    const flush = await renderFrame(<TodoList items={items} />);
    expect(gapBetween(flush, "Alpha", "Beta")).toBe(0);
    const spaced = await renderFrame(<TodoList items={items} gap={1} />);
    expect(gapBetween(spaced, "Alpha", "Beta")).toBe(1);
  });

  it("SelectList_gap_one_spaces_items", async () => {
    const items = [
      { value: "a", label: "Alpha" },
      { value: "b", label: "Beta" },
    ];
    const flush = await renderFrame(
      <SelectList items={items} onSubmit={() => {}} autoFocus={false} />,
    );
    expect(gapBetween(flush, "Alpha", "Beta")).toBe(0);
    const spaced = await renderFrame(
      <SelectList
        items={items}
        onSubmit={() => {}}
        autoFocus={false}
        gap={1}
      />,
    );
    expect(gapBetween(spaced, "Alpha", "Beta")).toBe(1);
  });

  it("MultiStepProgress_forwards_gap_to_its_lanes", async () => {
    const steps = [
      { id: "a", label: "Plan", status: "done" as const },
      { id: "b", label: "Generate", status: "active" as const },
    ];
    const spaced = await renderFrame(
      <MultiStepProgress steps={steps} gap={1} />,
    );
    expect(gapBetween(spaced, "Plan", "Generate")).toBe(1);
  });

  it("QuestionPrompt_forwards_gap_to_its_options", async () => {
    const spaced = await renderFrame(
      <QuestionPrompt
        header="Pick"
        question="Which one?"
        options={[
          { value: "a", label: "Alpha" },
          { value: "b", label: "Beta" },
        ]}
        onAnswer={() => {}}
        autoFocus={false}
        gap={1}
      />,
    );
    expect(gapBetween(spaced, "Alpha", "Beta")).toBe(1);
  });

  it("ChoiceRow_vertical_gap_spaces_choices", async () => {
    const choices = [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" },
    ];
    const spaced = await renderFrame(
      <ChoiceRow
        choices={choices}
        onCommit={() => {}}
        orientation="vertical"
        numbered
        autoFocus={false}
        gap={1}
      />,
    );
    expect(gapBetween(spaced, "Yes", "No")).toBe(1);
  });
});
