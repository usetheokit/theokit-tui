import { describe, expect, it } from "vitest";
import { WAIT_BUDGET_MS } from "../../tests/fixtures/wait-for.js";
import { type ItlInstance, render } from "../../tests/renderer/itl-adapter.js";
import type { PlanDecision } from "../../src/agent/agent-decision.js";
import { PlanApproval } from "../../src/prompts/plan-approval.js";

// M23 T3.1 — PlanApproval over the itl-adapter. A markdown plan body (M13
// MarkdownText) + a ChoiceRow of approve/revise; `revise` reveals a feedback
// text input. Esc never auto-approves (safe default → revise). The decision
// leaves via one `onDecision(PlanDecision)` callback. Deterministic oracle.

const PLAN = "# Plan\n\n1. Add the widget\n2. Wire the callback\n";

async function waitForFrame(
  app: ItlInstance,
  substring: string,
  timeoutMs = WAIT_BUDGET_MS,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if ((app.lastFrame() ?? "").includes(substring)) return;
    await app.flush();
  }
  throw new Error(`frame never contained ${JSON.stringify(substring)} — got:\n${app.lastFrame()}`);
}

/** Type an atomic key burst, retrying until it echoes (subscribe lags focus). */
async function typeWhenReady(app: ItlInstance, text: string): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    app.stdin.write(text);
    try {
      await waitForFrame(app, text, 300);
      return;
    } catch {
      /* not subscribed yet — retry the atomic burst */
    }
  }
  throw new Error(`input never accepted ${JSON.stringify(text)}`);
}

/** Press a key, retrying until `done()` — used for submits with no echo. */
async function pressUntil(app: ItlInstance, bytes: string, done: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 20 && !done(); attempt += 1) {
    app.stdin.write(bytes);
    await app.flush();
  }
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
    const app = render(<PlanApproval plan={PLAN} onDecision={(d) => decisions.push(d)} />);
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

  it("esc_from_the_feedback_input_returns_to_the_choice_bar", async () => {
    // review HIGH-2: the free-text branch is not a dead end — Esc cancels back.
    const decisions: PlanDecision[] = [];
    const app = render(<PlanApproval plan={PLAN} onDecision={(d) => decisions.push(d)} />);
    await app.flush();
    app.stdin.write("\x1b[C"); // → revise
    await app.flush();
    app.stdin.write("\r"); // → feedback mode
    await waitForFrame(app, "Type feedback:");
    await typeWhenReady(app, "z"); // ensure the input is focused before Esc
    app.stdin.write("\x1b"); // Esc → cancel back to the choice bar
    // B-033 — the sleep was redundant: `waitForFrame` below already polls for this exact frame,
    // so the 40 ms only delayed a wait that was already correct.
    await waitForFrame(app, "Approve"); // the choice bar is back
    expect(app.lastFrame()).toContain("Revise");
    expect(app.lastFrame()).not.toContain("Type feedback:");
    expect(decisions).toEqual([]); // Esc-cancel is not a decision
    app.unmount();
  });

  it("revise_with_feedback_emits_the_feedback", async () => {
    const decisions: PlanDecision[] = [];
    const app = render(<PlanApproval plan={PLAN} onDecision={(d) => decisions.push(d)} />);
    await app.flush();
    app.stdin.write("\x1b[C"); // → revise
    await app.flush();
    app.stdin.write("\r"); // → feedback mode
    await waitForFrame(app, "Type feedback:");
    await typeWhenReady(app, "add tests"); // subscribe lags focus — retry
    app.stdin.write("\r"); // submit feedback
    expect(decisions).toEqual([{ kind: "revise", feedback: "add tests" }]);
    app.unmount();
  });

  it("revise_with_empty_feedback_is_allowed", async () => {
    const decisions: PlanDecision[] = [];
    const app = render(<PlanApproval plan={PLAN} onDecision={(d) => decisions.push(d)} />);
    await app.flush();
    app.stdin.write("\x1b[C"); // → revise
    await app.flush();
    app.stdin.write("\r"); // → feedback mode
    await waitForFrame(app, "Type feedback:");
    await pressUntil(app, "\r", () => decisions.length > 0); // submit empty
    expect(decisions).toEqual([{ kind: "revise", feedback: "" }]);
    app.unmount();
  });

  it("escape_never_auto_approves", async () => {
    const decisions: PlanDecision[] = [];
    const app = render(<PlanApproval plan={PLAN} onDecision={(d) => decisions.push(d)} />);
    await app.flush();
    app.stdin.write("\x1b"); // a lone ESC (held ~20ms) on the choice bar
    // duration is the subject: this asserts that something does NOT happen. A condition-wait can
    // only wait for a state to ARRIVE, so there is nothing to poll for — the window itself is what
    // gives the assertion meaning. Kept deliberately (B-033 § Scope).
    await new Promise((resolve) => setTimeout(resolve, 40));
    await app.flush();
    // Esc must NOT approve — the safe default is revise (with no feedback yet).
    expect(decisions.some((d) => d.kind === "approve")).toBe(false);
    app.unmount();
  });

  it("streaming_a_longer_plan_keeps_the_choice_bar_responsive", async () => {
    const decisions: PlanDecision[] = [];
    const app = render(<PlanApproval plan={PLAN} onDecision={(d) => decisions.push(d)} />);
    await app.flush();
    app.rerender(
      <PlanApproval
        plan={`${PLAN}3. Extra step streamed in later\n`}
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
