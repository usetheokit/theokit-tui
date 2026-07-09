import { describe, expect, it } from "vitest";

import { render, type ItlInstance } from "../tests/renderer/itl-adapter.js";
import { PlanApproval } from "./plan-approval.js";
import type { PlanDecision } from "./agent-decision-model.js";

// M23 T3.1 — PlanApproval over the itl-adapter. A markdown plan body (M13
// MarkdownText) + a ChoiceRow of approve/revise; `revise` reveals a feedback
// text input. Esc never auto-approves (safe default → revise). The decision
// leaves via one `onDecision(PlanDecision)` callback. Deterministic oracle.

const PLAN = "# Plan\n\n1. Add the widget\n2. Wire the callback\n";

async function waitForFrame(
  app: ItlInstance,
  substring: string,
  timeoutMs = 2000,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if ((app.lastFrame() ?? "").includes(substring)) return;
    await app.flush();
  }
  throw new Error(
    `frame never contained ${JSON.stringify(substring)} — got:\n${app.lastFrame()}`,
  );
}

describe("PlanApproval component (M23 T3.1)", () => {
  it("renders_the_plan_markdown_body_and_choices", async () => {
    const app = render(<PlanApproval plan={PLAN} onDecision={() => {}} />);
    await app.flush();
    const frame = app.lastFrame();
    expect(frame).toContain("Plan"); // heading
    expect(frame).toContain("Add the widget");
    expect(frame).toContain("Approve");
    expect(frame).toContain("Revise");
    app.unmount();
  });

  it("approve_emits_approve", async () => {
    const decisions: PlanDecision[] = [];
    const app = render(
      <PlanApproval plan={PLAN} onDecision={(d) => decisions.push(d)} />,
    );
    await app.flush();
    app.stdin.write("\r"); // first choice = approve
    expect(decisions).toEqual([{ kind: "approve" }]);
    app.unmount();
  });

  it("revise_reveals_a_feedback_input", async () => {
    const app = render(<PlanApproval plan={PLAN} onDecision={() => {}} />);
    await app.flush();
    app.stdin.write("\x1b[C"); // → revise
    await app.flush();
    app.stdin.write("\r"); // select revise → feedback mode
    await waitForFrame(app, "Type feedback:");
    expect(app.lastFrame().toLowerCase()).toContain("feedback");
    app.unmount();
  });

  it("revise_with_feedback_emits_the_feedback", async () => {
    const decisions: PlanDecision[] = [];
    const app = render(
      <PlanApproval plan={PLAN} onDecision={(d) => decisions.push(d)} />,
    );
    await app.flush();
    app.stdin.write("\x1b[C"); // → revise
    await app.flush();
    app.stdin.write("\r"); // → feedback mode
    await waitForFrame(app, "Type feedback:");
    app.stdin.write("add tests");
    await waitForFrame(app, "add tests");
    app.stdin.write("\r"); // submit feedback
    expect(decisions).toEqual([{ kind: "revise", feedback: "add tests" }]);
    app.unmount();
  });

  it("revise_with_empty_feedback_is_allowed", async () => {
    const decisions: PlanDecision[] = [];
    const app = render(
      <PlanApproval plan={PLAN} onDecision={(d) => decisions.push(d)} />,
    );
    await app.flush();
    app.stdin.write("\x1b[C"); // → revise
    await app.flush();
    app.stdin.write("\r"); // → feedback mode
    await waitForFrame(app, "Type feedback:");
    app.stdin.write("\r"); // submit with no text
    expect(decisions).toEqual([{ kind: "revise", feedback: "" }]);
    app.unmount();
  });

  it("escape_never_auto_approves", async () => {
    const decisions: PlanDecision[] = [];
    const app = render(
      <PlanApproval plan={PLAN} onDecision={(d) => decisions.push(d)} />,
    );
    await app.flush();
    app.stdin.write("\x1b"); // a lone ESC (held ~20ms) on the choice bar
    await new Promise((resolve) => setTimeout(resolve, 40));
    await app.flush();
    // Esc must NOT approve — the safe default is revise (with no feedback yet).
    expect(decisions.some((d) => d.kind === "approve")).toBe(false);
    app.unmount();
  });

  it("streaming_a_longer_plan_keeps_the_choice_bar_responsive", async () => {
    const decisions: PlanDecision[] = [];
    const app = render(
      <PlanApproval plan={PLAN} onDecision={(d) => decisions.push(d)} />,
    );
    await app.flush();
    app.rerender(
      <PlanApproval
        plan={PLAN + "3. Extra step streamed in later\n"}
        onDecision={(d) => decisions.push(d)}
      />,
    );
    await app.flush();
    expect(app.lastFrame()).toContain("Extra step streamed in later");
    app.stdin.write("\r"); // choice bar still responds → approve
    expect(decisions).toEqual([{ kind: "approve" }]);
    app.unmount();
  });
});
