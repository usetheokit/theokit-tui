import { createElement } from "react";
import { describe, expect, it } from "vitest";

import { type ItlInstance, render } from "../../tests/renderer/itl-adapter.js";
import { Pager } from "../../src/layout/pager.js";

// M22 T3.1 — the Pager component over the itl-adapter (OUR renderer/input/focus,
// with useStdout providing the terminal height). Deterministic keyboard oracle.

const CONTENT = Array.from({ length: 30 }, (_, i) => `line${i}`).join("\n");

async function settle(app: ItlInstance): Promise<void> {
  await app.flush();
  await app.flush();
}

describe("Pager component (M22 T3.1)", () => {
  it("shows_the_first_window_and_a_status_line", async () => {
    const app = render(
      createElement(Pager, { content: CONTENT, onClose: () => {} }),
      { columns: 40, rows: 8 }, // viewportHeight = 7
    );
    await settle(app);
    const frame = app.lastFrame();
    expect(frame).toContain("line0");
    expect(frame).toContain("line6"); // 7 rows visible
    expect(frame).not.toContain("line7");
    expect(frame).toContain("of 30");
    expect(frame).toContain("0%");
    app.unmount();
  });

  it("scrolls_down_with_j_and_page_down_with_f", async () => {
    const app = render(createElement(Pager, { content: CONTENT, onClose: () => {} }), {
      columns: 40,
      rows: 8,
    });
    await settle(app);
    app.stdin.write("j"); // line-down → offset 1
    await settle(app);
    expect(app.lastFrame()).not.toContain("line0");
    app.stdin.write("f"); // page-down → offset 1 + 7 = 8
    await settle(app);
    expect(app.lastFrame()).toContain("line8");
    app.unmount();
  });

  it("goto_bottom_shows_100_percent", async () => {
    const app = render(createElement(Pager, { content: CONTENT, onClose: () => {} }), {
      columns: 40,
      rows: 8,
    });
    await settle(app);
    app.stdin.write("G"); // goto-bottom
    await settle(app);
    const frame = app.lastFrame();
    expect(frame).toContain("line29"); // last line visible
    expect(frame).toContain("100%");
    app.unmount();
  });

  it("b_pages_up_and_g_goes_to_top", async () => {
    const app = render(createElement(Pager, { content: CONTENT, onClose: () => {} }), {
      columns: 40,
      rows: 8,
    });
    await settle(app);
    app.stdin.write("G"); // bottom
    await settle(app);
    app.stdin.write("b"); // page-up
    await settle(app);
    expect(app.lastFrame()).not.toContain("100%");
    app.stdin.write("g"); // goto-top
    await settle(app);
    expect(app.lastFrame()).toContain("line0");
    expect(app.lastFrame()).toContain("0%");
    app.unmount();
  });

  it("ctrl_d_half_pages_down_and_blank_lines_render", async () => {
    const withBlank = "top\n\n\n\n\n\n\n\n\nbottom-ish";
    const app = render(createElement(Pager, { content: withBlank, onClose: () => {} }), {
      columns: 40,
      rows: 6,
    });
    await settle(app);
    app.stdin.write("\x04"); // Ctrl+D → half-down
    await settle(app);
    expect(app.lastFrame()).toContain("of 10"); // 10 lines incl. blanks
    app.unmount();
  });

  it("pageup_and_pagedown_keys_scroll_a_page", async () => {
    const app = render(createElement(Pager, { content: CONTENT, onClose: () => {} }), {
      columns: 40,
      rows: 8,
    });
    await settle(app);
    app.stdin.write("\x1b[6~"); // PgDn → page-down (offset 0 → 7)
    await settle(app);
    expect(app.lastFrame()).toContain("line7");
    app.stdin.write("\x1b[5~"); // PgUp → page-up (back to 0)
    await settle(app);
    expect(app.lastFrame()).toContain("line0");
    app.unmount();
  });

  it("status_line_stays_one_row_on_a_narrow_terminal", async () => {
    const app = render(
      createElement(Pager, { content: CONTENT, onClose: () => {} }),
      { columns: 12, rows: 6 }, // viewportHeight = 5; status would wrap unclipped
    );
    await settle(app);
    const frame = app.lastFrame();
    // The first 5 content lines are all present (status did not steal a row).
    for (const i of [0, 1, 2, 3, 4]) {
      expect(frame).toContain(`line${i}`);
    }
    app.unmount();
  });

  it("q_calls_onClose", async () => {
    let closed = 0;
    const app = render(createElement(Pager, { content: CONTENT, onClose: () => closed++ }), {
      columns: 40,
      rows: 8,
    });
    await settle(app);
    app.stdin.write("q");
    await settle(app);
    expect(closed).toBe(1);
    app.unmount();
  });

  it("up_arrow_and_ctrl_u_scroll_up", async () => {
    const app = render(createElement(Pager, { content: CONTENT, onClose: () => {} }), {
      columns: 40,
      rows: 8,
    });
    await settle(app);
    app.stdin.write("G"); // bottom
    await settle(app);
    app.stdin.write("\x1b[A"); // up arrow → line-up
    await settle(app);
    app.stdin.write("\x15"); // Ctrl+U → half-up
    await settle(app);
    expect(app.lastFrame()).not.toContain("100%"); // scrolled back up
    app.unmount();
  });
});
