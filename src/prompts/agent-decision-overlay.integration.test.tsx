import { Text } from "ink";
import { describe, expect, it } from "vitest";

import { render, type ItlInstance } from "../../tests/renderer/itl-adapter.js";
import { ApprovalPrompt } from "./approval-prompt.js";
import { useFocus } from "../renderer/hooks/use-focus.js";
import { OverlayProvider, useOverlay } from "../renderer/hooks/use-overlay.js";
import { useInput } from "../renderer/input/use-input.js";
import { WAIT_BUDGET_MS } from "../../tests/fixtures/wait-for.js";

// M23 T4.1 — the overlay-integration edge case (blueprint edge case 5, ADR D7):
// an ApprovalPrompt pushed as an overlay (the realistic trigger-driven pattern,
// mirroring the M22 example). While overlaid the prompt is focused and
// interactive (Enter commits). Esc is arbitrated: it BOTH emits the prompt's
// safe-default `reject` AND pops the overlay (Esc = "reject and close") — and it
// never leaks to the background. Deterministic oracle.

async function waitForFrame(
  app: ItlInstance,
  substring: string,
  present = true,
  timeoutMs = WAIT_BUDGET_MS,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if ((app.lastFrame() ?? "").includes(substring) === present) return;
    await app.flush();
  }
  throw new Error(
    `frame ${present ? "never contained" : "still contained"} ${JSON.stringify(substring)} — got:\n${app.lastFrame()}`,
  );
}

function Trigger({ decisions }: { decisions: string[] }) {
  const { push } = useOverlay();
  const { isFocused } = useFocus({ autoFocus: true });
  useInput(
    (input) => {
      if (input === "o") {
        push(
          <ApprovalPrompt
            title="Approve overlay?"
            onDecision={(d) => decisions.push(d)}
          >
            <Text>$ do the thing</Text>
          </ApprovalPrompt>,
        );
      }
    },
    { isActive: isFocused },
  );
  return <Text>bg:{isFocused ? "ON" : "off"}</Text>;
}

describe("ApprovalPrompt overlay integration (M23 T4.1)", () => {
  it("commits_a_decision_while_overlaid", async () => {
    const decisions: string[] = [];
    const app = render(
      <OverlayProvider>
        <Trigger decisions={decisions} />
      </OverlayProvider>,
    );
    await waitForFrame(app, "bg:ON");
    app.stdin.write("o"); // trigger the overlay
    await waitForFrame(app, "Approve overlay?");
    expect(app.lastFrame()).toContain("Allow once");
    // The ChoiceRow subscribes a couple renders after the overlay mounts (the
    // focus round-trip); Enter can land before it is listening. Retry until a
    // decision is captured — the loop stops on the FIRST success (no double).
    for (
      let attempt = 0;
      attempt < 20 && decisions.length === 0;
      attempt += 1
    ) {
      app.stdin.write("\r"); // Enter → commit the active choice (once)
      await app.flush();
    }
    expect(decisions).toEqual(["once"]);
    app.unmount();
  });

  it("esc_emits_reject_and_pops_the_overlay", async () => {
    const decisions: string[] = [];
    const app = render(
      <OverlayProvider>
        <Trigger decisions={decisions} />
      </OverlayProvider>,
    );
    await waitForFrame(app, "bg:ON");
    app.stdin.write("o");
    await waitForFrame(app, "Approve overlay?");
    // Ensure the ChoiceRow is subscribed before Esc — the idempotent digit jump
    // to "always" is observable, so retrying it until the marker moves proves the
    // prompt is listening (else Esc would pop the overlay before reject fired).
    for (
      let attempt = 0;
      attempt < 20 && !(app.lastFrame() ?? "").includes("❯ Allow always");
      attempt += 1
    ) {
      app.stdin.write("2");
      await app.flush();
    }
    expect(app.lastFrame()).toContain("❯ Allow always");

    app.stdin.write("\x1b"); // a lone ESC (held ~20ms)
    // B-033 — the sleep was redundant: `waitForFrame` below already polls for this frame, so the
    // 40 ms only delayed a wait that was already correct.
    await waitForFrame(app, "Approve overlay?", false); // overlay popped
    // Esc is a coherent "reject and close": the prompt emits its safe default…
    expect(decisions).toEqual(["reject"]);
    // …and focus returns to the background (no key leaked past the overlay).
    expect(app.lastFrame()).toContain("bg:ON");
    app.unmount();
  });
});
