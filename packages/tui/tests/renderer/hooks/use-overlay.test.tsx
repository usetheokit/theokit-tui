import { createElement, useState } from "react";
import { describe, expect, it } from "vitest";

import { type ItlInstance, render } from "../../../tests/renderer/itl-adapter.js";
import { useInput } from "../../../src/renderer/input/use-input.js";
import { useFocus } from "../../../src/renderer/hooks/use-focus.js";
import { OverlayProvider, useOverlay } from "../../../src/renderer/hooks/use-overlay.js";

// M22 T2.1 — the overlay layer, driven through the itl-adapter (OUR renderer +
// InputSource + FocusProvider). Asserts focus capture, Esc-dismiss + restore,
// key capture, and the F-HIGH-1 nested push/pop depth guard.

async function waitFor(app: ItlInstance, substring: string): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < 2000) {
    await app.flush();
    if (app.lastFrame().includes(substring)) {
      return;
    }
  }
  throw new Error(
    `overlay frame never contained ${JSON.stringify(substring)} — got:\n${app.lastFrame()}`,
  );
}

function Bg() {
  const { isFocused } = useFocus({ autoFocus: true, id: "bg" });
  const [n, setN] = useState(0);
  useInput(() => setN((x) => x + 1), { isActive: isFocused });
  return createElement("ink-text", {}, `bg:${isFocused ? "ON" : "off"} bgkeys:${n}`);
}

function Overlay({ id }: { id: string }) {
  const { isFocused } = useFocus({ autoFocus: true, id });
  return createElement("ink-text", {}, `${id}:${isFocused ? "ON" : "off"}`);
}

function Trigger() {
  const { push, pop } = useOverlay();
  const counter = useState(0);
  useInput(
    (input) => {
      if (input === "o") {
        const n = counter[0];
        counter[1](n + 1);
        push(createElement(Overlay, { id: `ov${n}` }));
      }
      if (input === "p") {
        pop();
      }
    },
    { isActive: true },
  );
  return null;
}

function App() {
  return createElement(
    OverlayProvider,
    null,
    createElement(Bg, { key: "bg" }),
    createElement(Trigger, { key: "t" }),
  );
}

describe("OverlayProvider (M22 T2.1)", () => {
  it("pushing_an_overlay_blurs_the_background_and_captures", async () => {
    const app = render(createElement(App));
    await waitFor(app, "bg:ON");
    app.stdin.write("o"); // push overlay
    await waitFor(app, "ov0:ON"); // overlay captured focus
    expect(app.lastFrame()).toContain("bg:off"); // background inert
    app.unmount();
  });

  it("a_key_while_open_does_not_reach_the_background", async () => {
    const app = render(createElement(App));
    await waitFor(app, "bg:ON");
    app.stdin.write("o"); // bg was focused, so this key IS counted (bgkeys:1)
    await waitFor(app, "ov0:ON");
    expect(app.lastFrame()).toContain("bgkeys:1");
    app.stdin.write("z"); // now bg is inert — this key must NOT be counted
    await app.flush();
    await app.flush();
    expect(app.lastFrame()).toContain("bgkeys:1"); // unchanged → background captured
    app.unmount();
  });

  it("esc_dismisses_the_overlay_and_restores_background_focus", async () => {
    const app = render(createElement(App));
    await waitFor(app, "bg:ON");
    app.stdin.write("o");
    await waitFor(app, "ov0:ON");
    app.stdin.write("\x1b"); // ESC
    await waitFor(app, "bg:ON"); // background focus restored, overlay gone
    expect(app.lastFrame()).not.toContain("ov0");
    app.unmount();
  });

  it("pop_with_no_overlay_is_a_safe_no_op", async () => {
    const app = render(createElement(App));
    await waitFor(app, "bg:ON");
    app.stdin.write("p"); // pop with an empty stack
    await app.flush();
    expect(app.lastFrame()).toContain("bg:ON"); // still fine, background focused
    app.unmount();
  });

  it("nested_overlays_keep_the_background_inert_until_depth_zero", async () => {
    const app = render(createElement(App));
    await waitFor(app, "bg:ON");
    app.stdin.write("o"); // push ov0
    await waitFor(app, "ov0:ON");
    app.stdin.write("o"); // push ov1 (nested)
    await waitFor(app, "ov1:ON");
    app.stdin.write("\x1b"); // ESC → pop ov1 (depth 1)
    await waitFor(app, "ov0:ON"); // ov0 is the top again — pop LANDED
    expect(app.lastFrame()).toContain("bg:off"); // STILL inert at depth 1
    app.stdin.write("\x1b"); // ESC → pop ov0 (depth 0) — sent only after the 1st landed
    await waitFor(app, "bg:ON"); // now restored
    app.unmount();
  });
});
