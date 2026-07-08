import { Text } from "ink";
import { cleanup, render } from "ink-testing-library";
import { createElement, type ReactNode } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { createFakeStdin } from "../../../tests/renderer/fake-stdin.js";
import { createInputSource } from "../input/input-source.js";
import { InputContext } from "../input/use-input.js";
import { useInput } from "../input/use-input.js";
import { FocusProvider, useFocus, useFocusManager } from "./use-focus.js";

afterEach(cleanup); // unmount each tree so leftover focus arbiters don't cross-talk

// M20 T2.1 (plan m20-scrollback-cutover): the focus arbiter. Rendered through
// ink-testing-library (fast, Ink draws the tree) but driven by OUR InputSource +
// FocusProvider, so Tab/Shift+Tab/ESC exercise our arbiter and isFocused comes
// from OUR FocusContext. The arbiter runs on the priority channel — before any
// component useInput — the exact ordering the composer relies on for ESC-refocus.

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));
// A lone ESC is delivered after the InputSource's ~20ms flush delay.
const tickEsc = (): Promise<void> => new Promise((r) => setTimeout(r, 40));

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
    await tick();
    expect(lastFrame()).toContain("a:ON");
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
    await tick();
    expect(lastFrame()).toContain("a:off");
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
    await tick();
    expect(lastFrame()).toContain("a:ON");
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
    await tick();
    expect(lastFrame()).toContain("a:ON");
    stdin.send("\x1b"); // ESC
    await tickEsc();
    expect(lastFrame()).toContain("a:off");
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
    await tick();
    expect(lastFrame()).toContain("b:ON");
    expect(lastFrame()).toContain("a:off");
  });

  it("disable_focus_stops_tab_then_enable_restores_it", async () => {
    function Toggle() {
      const mgr = useFocusManager();
      useInput((input) => {
        if (input === "d") {
          mgr.disableFocus();
        }
        if (input === "e") {
          mgr.enableFocus();
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
      createElement(Toggle, { key: "t" }),
    ]);
    await tick();
    stdin.send("d"); // disable focus
    await tickEsc();
    stdin.send("\t"); // Tab is ignored while focus is disabled
    await tickEsc();
    expect(lastFrame()).toContain("a:ON");
    stdin.send("e"); // re-enable
    await tickEsc();
    stdin.send("\t");
    await tickEsc();
    expect(lastFrame()).toContain("b:ON");
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
    await tick();
    expect(lastFrame()).toContain("a:ON");
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
    await tick();
    expect(lastFrame()).toContain("a:ON");
    stdin.send("\x1b[Z"); // Shift+Tab from the first → wraps back to the last
    await tick();
    expect(lastFrame()).toContain("b:ON");
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
    await tick();
    expect(lastFrame()).toContain("a:ON");
  });

  it("tab_with_no_focusables_registered_is_a_safe_no_op", async () => {
    const { stdin, lastFrame } = mount(createElement(Text, {}, "static-text"));
    await tick();
    stdin.send("\t"); // focusNext over an empty registry → no-op
    stdin.send("\x1b[Z"); // focusPrevious over an empty registry → no-op
    await tick();
    expect(lastFrame()).toContain("static-text");
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
    await tickEsc(); // lone ESC flushes after the delay
    expect(order).toEqual(["arbiter", "subscriber"]);
    source.stop();
  });
});
