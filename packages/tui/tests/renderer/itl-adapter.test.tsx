import { Box, Static, Text } from "ink";
import { createElement } from "react";
import { describe, expect, it } from "vitest";

import { useInput } from "../../src/renderer/input/use-input.js";
import { render } from "./itl-adapter.js";

// M20 T2.1 (plan m20-scrollback-cutover, ADR D2): the itl-adapter contract —
// lastFrame reflects the emulator screen, stdin.write drives useInput, and
// lastFrame reproduces Ink's scrollback-prefix + live-frame concatenation.

describe("itl-adapter over the new renderer (M20 T2.1)", () => {
  it("lastFrame_matches_the_rendered_screen", async () => {
    const app = render(createElement(Box, null, createElement(Text, {}, "hello")), {
      columns: 20,
      rows: 6,
    });
    await app.flush();
    expect(app.lastFrame()).toContain("hello");
    app.unmount();
  });

  it("stdin_write_drives_a_useInput_handler", async () => {
    let received = "";
    function Probe() {
      useInput((input) => {
        received += input;
      });
      return createElement(Text, {}, "probe");
    }
    const app = render(createElement(Probe), { columns: 20, rows: 6 });
    await app.flush();
    app.stdin.write("k");
    expect(received).toBe("k");
    app.unmount();
  });

  it("lastFrame_includes_the_scrollback_prefix_above_the_live_frame", async () => {
    function App({ items }: { items: string[] }) {
      return createElement(
        Box,
        { flexDirection: "column" },
        createElement(Static, {
          items,
          children: (item: unknown) =>
            createElement(Text, { key: String(item) }, `H:${String(item)}`),
        }),
        createElement(Text, {}, `LIVE:${items.length}`),
      );
    }
    const app = render(createElement(App, { items: ["a", "b"] }), {
      columns: 30,
      rows: 10,
    });
    await app.flush();
    const frame = app.lastFrame();
    // graduated history (scrollback) precedes the live frame in lastFrame.
    expect(frame).toContain("H:a");
    expect(frame).toContain("H:b");
    expect(frame.indexOf("H:a")).toBeLessThan(frame.indexOf("LIVE:2"));
    app.unmount();
  });
});
