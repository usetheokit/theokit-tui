import { createElement } from "react";
import { describe, expect, it } from "vitest";

import { render } from "../tests/renderer/itl-adapter.js";
import { MultiStepProgress } from "./multi-step-progress.js";
import type { TodoItem } from "./todo-list.js";

// M24 T2.1 — MultiStepProgress over the itl-adapter. Reuses the TodoList row
// (DRY) + an n-of-m header; a `current` step gives a "step i of m" counter; a
// `groupLabel` + per-step labels render the subagent-lane variant.

const STEPS: TodoItem[] = [
  { id: "1", label: "clone", status: "done" },
  { id: "2", label: "build", status: "active" },
  { id: "3", label: "test", status: "pending" },
  { id: "4", label: "ship", status: "pending" },
];

describe("MultiStepProgress (M24 T2.1)", () => {
  it("renders_steps_with_an_n_of_m_counter", async () => {
    const app = render(createElement(MultiStepProgress, { steps: STEPS }));
    await app.flush();
    const frame = app.lastFrame();
    expect(frame).toContain("1 of 4"); // 1 done of 4
    expect(frame).toContain("☑ clone");
    expect(frame).toContain("◐ build");
    app.unmount();
  });

  it("current_shows_a_step_i_of_m_counter", async () => {
    const app = render(
      createElement(MultiStepProgress, { steps: STEPS, current: 1 }),
    );
    await app.flush();
    expect(app.lastFrame()).toContain("step 2 of 4"); // current index 1 → step 2
    app.unmount();
  });

  it("all_done_shows_the_full_count", async () => {
    const done = STEPS.map((s) => ({ ...s, status: "done" as const }));
    const app = render(createElement(MultiStepProgress, { steps: done }));
    await app.flush();
    expect(app.lastFrame()).toContain("4 of 4");
    app.unmount();
  });

  it("empty_steps_shows_zero_of_zero", async () => {
    const app = render(createElement(MultiStepProgress, { steps: [] }));
    await app.flush();
    expect(app.lastFrame()).toContain("0 of 0");
    app.unmount();
  });

  it("current_out_of_range_does_not_crash", async () => {
    const app = render(
      createElement(MultiStepProgress, { steps: STEPS, current: 99 }),
    );
    await app.flush();
    // Clamped to the last step; no NaN / out-of-range render.
    expect(app.lastFrame()).toContain("step 4 of 4");
    app.unmount();
  });

  it("subagent_group_label_and_lane_labels_render", async () => {
    const lanes: TodoItem[] = [
      { id: "a", label: "researcher", status: "done" },
      { id: "b", label: "coder", status: "active" },
    ];
    const app = render(
      createElement(MultiStepProgress, {
        steps: lanes,
        groupLabel: "2 agents",
      }),
    );
    await app.flush();
    const frame = app.lastFrame();
    expect(frame).toContain("2 agents"); // group header
    expect(frame).toContain("☑ researcher"); // lane label + status
    expect(frame).toContain("◐ coder");
    app.unmount();
  });
});
