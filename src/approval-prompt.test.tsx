import { Text } from "ink";
import { describe, expect, it } from "vitest";

import { render } from "../tests/renderer/itl-adapter.js";
import { ApprovalPrompt } from "./approval-prompt.js";
import { DiffViewer } from "./diff-viewer.js";

// M23 T1.2 — ApprovalPrompt over the itl-adapter. A titled pending-action card:
// the preview is a `children` slot (the app composes DiffViewer / a command line
// / any body — NEVER a diff-prop union, ADR D1), choices default to
// once/always/reject (ADR D3), the decision leaves via one `onDecision` callback
// (ADR D2), Esc → reject (ADR D5). Deterministic keyboard oracle.

const PATCH = [
  "--- a/x.ts",
  "+++ b/x.ts",
  "@@ -1,3 +1,3 @@",
  " line one",
  "-old two",
  "+new two",
  " line three",
  "",
].join("\n");

describe("ApprovalPrompt component (M23 T1.2)", () => {
  it("renders_the_title_and_a_children_preview", async () => {
    const app = render(
      <ApprovalPrompt title="Run command?" onDecision={() => {}}>
        <Text>$ rm -rf ./build</Text>
      </ApprovalPrompt>,
    );
    await app.flush();
    const frame = app.lastFrame();
    expect(frame).toContain("Run command?");
    expect(frame).toContain("$ rm -rf ./build");
    app.unmount();
  });

  it("default_choices_are_once_always_reject", async () => {
    const app = render(
      <ApprovalPrompt title="Approve?" onDecision={() => {}}>
        <Text>body</Text>
      </ApprovalPrompt>,
    );
    await app.flush();
    const frame = app.lastFrame();
    expect(frame).toContain("Allow once");
    expect(frame).toContain("Allow always");
    expect(frame).toContain("Reject");
    app.unmount();
  });

  it("enter_on_always_emits_always", async () => {
    const decisions: string[] = [];
    const app = render(
      <ApprovalPrompt
        title="Approve?"
        onDecision={(d) => {
          decisions.push(d);
        }}
      >
        <Text>body</Text>
      </ApprovalPrompt>,
    );
    await app.flush();
    app.stdin.write("\x1b[C"); // → always
    await app.flush();
    app.stdin.write("\r"); // enter
    expect(decisions).toEqual(["always"]);
    app.unmount();
  });

  it("escape_emits_reject", async () => {
    const decisions: string[] = [];
    const app = render(
      <ApprovalPrompt
        title="Approve?"
        onDecision={(d) => {
          decisions.push(d);
        }}
      >
        <Text>body</Text>
      </ApprovalPrompt>,
    );
    await app.flush();
    app.stdin.write("\x1b"); // a lone ESC is held ~20ms…
    await new Promise((resolve) => setTimeout(resolve, 40));
    await app.flush();
    expect(decisions).toEqual(["reject"]);
    app.unmount();
  });

  it("custom_choices_override_the_default", async () => {
    const decisions: string[] = [];
    const app = render(
      <ApprovalPrompt
        title="Yes or no?"
        choices={[
          { value: "yes", label: "Yes" },
          { value: "no", label: "No" },
        ]}
        onDecision={(d) => {
          decisions.push(d);
        }}
      >
        <Text>body</Text>
      </ApprovalPrompt>,
    );
    await app.flush();
    expect(app.lastFrame()).not.toContain("Allow once");
    app.stdin.write("\r"); // enter on the first custom choice → yes
    expect(decisions).toEqual(["yes"]);
    app.unmount();
  });

  it("composes_a_DiffViewer_child_without_forwarding_patch", async () => {
    // The app composes the diff as a child; ApprovalPrompt never touches `patch`.
    const app = render(
      <ApprovalPrompt title="Apply edit?" onDecision={() => {}}>
        <DiffViewer patch={PATCH} />
      </ApprovalPrompt>,
    );
    await app.flush();
    const frame = app.lastFrame();
    expect(frame).toContain("Apply edit?");
    expect(frame).toContain("new two"); // the diff rendered inside the approval
    expect(frame).toContain("Allow once"); // choices still present below it
    app.unmount();
  });

  it("emits_exactly_one_decision_per_commit_and_holds_no_state", async () => {
    const decisions: string[] = [];
    const app = render(
      <ApprovalPrompt
        title="Approve?"
        onDecision={(d) => {
          decisions.push(d);
        }}
      >
        <Text>body</Text>
      </ApprovalPrompt>,
    );
    await app.flush();
    app.stdin.write("\r"); // once
    await app.flush();
    app.stdin.write("\r"); // a second commit still just re-fires the callback
    await app.flush();
    // The component holds no "already-approved" memory — each Enter is a fresh
    // decision (the app owns lifecycle; the prompt is stateless re: the decision).
    expect(decisions).toEqual(["once", "once"]);
    app.unmount();
  });
});
