import { Text } from "ink";
import { cleanup, render } from "ink-testing-library";
import { createElement, type ReactNode, useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { WAIT_BUDGET_MS, waitFor as waitForCondition } from "../../../tests/fixtures/wait-for.js";

import { createFakeStdin } from "../../../tests/renderer/fake-stdin.js";
import { createInputSource } from "../../../src/renderer/input/input-source.js";
import { InputContext, useInput } from "../../../src/renderer/input/use-input.js";
import { FocusProvider, useFocus, useFocusManager } from "../../../src/renderer/hooks/use-focus.js";

afterEach(cleanup); // unmount each tree so leftover focus arbiters don't cross-talk

// M20 T2.1 (plan m20-scrollback-cutover): the focus arbiter. Rendered through
// ink-testing-library (fast, Ink draws the tree) but driven by OUR InputSource +
// FocusProvider, so Tab/Shift+Tab/ESC exercise our arbiter and isFocused comes
// from OUR FocusContext. The arbiter runs on the priority channel — before any
// component useInput — the exact ordering the composer relies on for ESC-refocus.

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));
// `tickEsc` — a fixed 40 ms past the InputSource's ~20 ms flush delay — was removed by B-033. Its
// one caller now waits for the CONDITION the assertion checks, so nothing needs to know the number.

/**
 * Poll `lastFrame()` until it contains `substring` (or does not, when
 * `present=false`), up to a deadline — deterministic under load, unlike a fixed
 * sleep + immediate assert (the M15/M19 flake lesson, testing.md §6). Accounts
 * for the ESC flush delay in the deadline.
 */
async function waitForFocus(
  lastFrame: () => string | undefined,
  substring: string,
  present = true,
  timeoutMs = WAIT_BUDGET_MS,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if ((lastFrame() ?? "").includes(substring) === present) {
      return;
    }
    await tick();
  }
  throw new Error(
    `focus frame ${present ? "never contained" : "still contained"} ${JSON.stringify(substring)} — got:\n${lastFrame()}`,
  );
}

function Focusable({
  label,
  autoFocus,
  id,
  isActive = true,
}: {
  label: string;
  autoFocus?: boolean;
  id: string;
  isActive?: boolean;
}) {
  const { isFocused } = useFocus({ autoFocus, id, isActive });
  return createElement(Text, {}, `${label}:${isFocused ? "ON" : "off"}`);
}

function mount(children: ReactNode): {
  stdin: ReturnType<typeof createFakeStdin>;
  lastFrame: () => string | undefined;
} {
  const stdin = createFakeStdin();
  const source = createInputSource(stdin);
  source.start();
  const { lastFrame } = render(
    createElement(
      InputContext.Provider,
      { value: source },
      createElement(FocusProvider, null, children),
    ),
  );
  return { stdin, lastFrame };
}

describe("useFocus / useFocusManager arbiter (M20 T2.1)", () => {
  it("autofocus_focuses_the_marked_component", async () => {
    const { lastFrame } = mount([
      createElement(Focusable, {
        key: "a",
        label: "a",
        autoFocus: true,
        id: "a",
      }),
      createElement(Focusable, { key: "b", label: "b", id: "b" }),
    ]);
    await waitForFocus(lastFrame, "a:ON");
    expect(lastFrame()).toContain("b:off");
  });

  it("tab_cycles_focus_forward", async () => {
    const { stdin, lastFrame } = mount([
      createElement(Focusable, {
        key: "a",
        label: "a",
        autoFocus: true,
        id: "a",
      }),
      createElement(Focusable, { key: "b", label: "b", id: "b" }),
    ]);
    await tick();
    stdin.send("\t"); // Tab
    await waitForFocus(lastFrame, "a:off");
    expect(lastFrame()).toContain("b:ON");
  });

  it("shift_tab_cycles_focus_backward", async () => {
    const { stdin, lastFrame } = mount([
      createElement(Focusable, { key: "a", label: "a", id: "a" }),
      createElement(Focusable, {
        key: "b",
        label: "b",
        autoFocus: true,
        id: "b",
      }),
    ]);
    await tick();
    stdin.send("\x1b[Z"); // Shift+Tab
    await waitForFocus(lastFrame, "a:ON");
    expect(lastFrame()).toContain("b:off");
  });

  it("esc_blurs_the_active_component", async () => {
    const { stdin, lastFrame } = mount([
      createElement(Focusable, {
        key: "a",
        label: "a",
        autoFocus: true,
        id: "a",
      }),
    ]);
    await waitForFocus(lastFrame, "a:ON");
    stdin.send("\x1b"); // ESC
    await waitForFocus(lastFrame, "a:off");
  });

  it("focus_manager_focus_moves_focus_to_a_given_id", async () => {
    function Mover() {
      const mgr = useFocusManager();
      useInput((input) => {
        if (input === "x") {
          mgr.focus("b");
        }
      });
      return null;
    }
    const { stdin, lastFrame } = mount([
      createElement(Focusable, {
        key: "a",
        label: "a",
        autoFocus: true,
        id: "a",
      }),
      createElement(Focusable, { key: "b", label: "b", id: "b" }),
      createElement(Mover, { key: "m" }),
    ]);
    await tick();
    stdin.send("x");
    await waitForFocus(lastFrame, "b:ON");
    expect(lastFrame()).toContain("a:off");
  });

  it("disable_focus_stops_tab_then_enable_restores_it", async () => {
    // The Toggle renders its mode so a poll can observe the disable/enable
    // LANDED (same React batch as the mgr call) before the next Tab — no fixed
    // sleep between two state-changing sends (the load-flake source).
    function Toggle() {
      const mgr = useFocusManager();
      const [mode, setMode] = useState("init");
      useInput((input) => {
        if (input === "d") {
          mgr.disableFocus();
          setMode("disabled");
        }
        if (input === "e") {
          mgr.enableFocus();
          setMode("enabled");
        }
      });
      return createElement(Text, {}, `mode:${mode}`);
    }
    const { stdin, lastFrame } = mount([
      createElement(Focusable, {
        key: "a",
        label: "a",
        autoFocus: true,
        id: "a",
      }),
      createElement(Focusable, { key: "b", label: "b", id: "b" }),
      createElement(Toggle, { key: "t" }),
    ]);
    await waitForFocus(lastFrame, "a:ON");
    stdin.send("d"); // disable focus
    await waitForFocus(lastFrame, "mode:disabled"); // disable has landed
    stdin.send("\t"); // Tab is ignored while focus is disabled
    await tick();
    expect(lastFrame()).toContain("a:ON");
    stdin.send("e"); // re-enable
    await waitForFocus(lastFrame, "mode:enabled"); // enable has landed
    stdin.send("\t");
    await waitForFocus(lastFrame, "b:ON");
  });

  it("an_inactive_focusable_is_skipped_by_tab", async () => {
    const { stdin, lastFrame } = mount([
      createElement(Focusable, {
        key: "a",
        label: "a",
        autoFocus: true,
        id: "a",
      }),
      createElement(Focusable, {
        key: "b",
        label: "b",
        id: "b",
        isActive: false,
      }),
    ]);
    await tick();
    stdin.send("\t"); // b is inactive → focus stays on a (the only active one)
    await waitForFocus(lastFrame, "a:ON");
    expect(lastFrame()).toContain("b:off");
  });

  it("tab_wraps_around_at_both_ends", async () => {
    const { stdin, lastFrame } = mount([
      createElement(Focusable, { key: "a", label: "a", id: "a" }),
      createElement(Focusable, {
        key: "b",
        label: "b",
        autoFocus: true,
        id: "b",
      }),
    ]);
    await tick();
    stdin.send("\t"); // Tab from the last → wraps forward to the first
    await waitForFocus(lastFrame, "a:ON");
    stdin.send("\x1b[Z"); // Shift+Tab from the first → wraps back to the last
    await waitForFocus(lastFrame, "b:ON");
  });

  it("focus_provider_without_an_input_source_does_not_crash", async () => {
    // No InputContext → the arbiter's `!source` guard short-circuits; autoFocus
    // still works via the effect path.
    const { lastFrame } = render(
      createElement(
        FocusProvider,
        null,
        createElement(Focusable, {
          key: "a",
          label: "a",
          autoFocus: true,
          id: "a",
        }),
      ),
    );
    await waitForFocus(lastFrame, "a:ON");
  });

  it("tab_with_no_focusables_registered_is_a_safe_no_op", async () => {
    const { stdin, lastFrame } = mount(createElement(Text, {}, "static-text"));
    await tick();
    stdin.send("\t"); // focusNext over an empty registry → no-op
    stdin.send("\x1b[Z"); // focusPrevious over an empty registry → no-op
    await waitForFocus(lastFrame, "static-text");
  });

  it("esc_arbiter_runs_before_component_useInput_subscribers", async () => {
    // The mechanism the composer's ESC-refocus depends on: the priority channel
    // fires before onKey. Assert ordering at the source (no React noise).
    const stdin = createFakeStdin();
    const source = createInputSource(stdin);
    source.start();
    const order: string[] = [];
    source.onKey(() => order.push("subscriber"));
    source.onKeyPriority(() => order.push("arbiter"));
    stdin.send("\x1b");
    // B-033 — was `tickEsc()`, a fixed 40 ms past the InputSource flush delay. The condition is
    // the assertion below: both handlers have run.
    await waitForCondition(() => order.length === 2, {
      describe: "both key handlers to run after the lone ESC flushes",
    });
    expect(order).toEqual(["arbiter", "subscriber"]);
    source.stop();
  });
});
