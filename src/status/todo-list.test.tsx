import { createElement } from "react";
import { describe, expect, it } from "vitest";

import { render } from "../../tests/renderer/itl-adapter.js";
import { renderFrame } from "../../tests/fixtures/helpers.js";
import { TodoList, todoRowStyle, type TodoItem } from "./todo-list.js";
import { TheoTUIProvider, themes } from "../theme/theme.js";

// M24 T1.2 — TodoList over the itl-adapter. A live checklist keyed by stable id
// (☐ pending / ◐ active / ☑ done), replace-item in place, duplicate-id throw,
// glyph-distinct under monochrome (no color-only differentiation). Pure/declarative.

const ITEMS: TodoItem[] = [
  { id: "a", label: "scaffold", status: "done" },
  { id: "b", label: "wire up", status: "active" },
  { id: "c", label: "test", status: "pending" },
];

describe("TodoList (M24 T1.2)", () => {
  it("renders_items_with_status_glyphs", async () => {
    const app = render(createElement(TodoList, { items: ITEMS }));
    await app.flush();
    const frame = app.lastFrame();
    expect(frame).toContain("☑ scaffold"); // done
    expect(frame).toContain("◐ wire up"); // active
    expect(frame).toContain("☐ test"); // pending
    app.unmount();
  });

  it("replace_item_updates_in_place", async () => {
    const app = render(createElement(TodoList, { items: ITEMS }));
    await app.flush();
    expect(app.lastFrame()).toContain("◐ wire up");
    // A NEW items array with a NEW object for id "b" flips it to done.
    const next: TodoItem[] = [
      ITEMS[0]!,
      { id: "b", label: "wire up", status: "done" },
      ITEMS[2]!,
    ];
    app.rerender(createElement(TodoList, { items: next }));
    await app.flush();
    expect(app.lastFrame()).toContain("☑ wire up");
    expect(app.lastFrame()).not.toContain("◐ wire up");
    app.unmount();
  });

  it("status_can_revert_done_to_active", async () => {
    const app = render(
      createElement(TodoList, {
        items: [{ id: "x", label: "step", status: "done" }],
      }),
    );
    await app.flush();
    expect(app.lastFrame()).toContain("☑ step");
    app.rerender(
      createElement(TodoList, {
        items: [{ id: "x", label: "step", status: "active" }],
      }),
    );
    await app.flush();
    expect(app.lastFrame()).toContain("◐ step"); // fully-live: revert repaints
    app.unmount();
  });

  it("reorder_keeps_items_keyed", async () => {
    const app = render(createElement(TodoList, { items: ITEMS }));
    await app.flush();
    const reordered: TodoItem[] = [ITEMS[2]!, ITEMS[0]!, ITEMS[1]!];
    app.rerender(createElement(TodoList, { items: reordered }));
    await app.flush();
    const frame = app.lastFrame();
    // All three still present with their own status (no wrong-row remount).
    expect(frame).toContain("☐ test");
    expect(frame).toContain("☑ scaffold");
    expect(frame).toContain("◐ wire up");
    app.unmount();
  });

  it("duplicate_id_throws_a_typed_error", () => {
    // Call the component directly: `assertUniqueIds` is the first line (before any
    // hook), so the throw propagates synchronously (the ChatThread test idiom —
    // Ink otherwise swallows a child render throw at the boundary).
    const bad = (): unknown =>
      TodoList({
        items: [
          { id: "dup", label: "one", status: "pending" },
          { id: "dup", label: "two", status: "pending" },
        ],
      });
    expect(bad).toThrow(TypeError);
    expect(bad).toThrow('TodoList: duplicate item id "dup"');
  });

  it("empty_id_is_legal", async () => {
    const app = render(
      createElement(TodoList, {
        items: [{ id: "", label: "nameless", status: "active" }],
      }),
    );
    await app.flush();
    expect(app.lastFrame()).toContain("◐ nameless");
    app.unmount();
  });

  it("empty_items_renders_nothing_extra", async () => {
    const app = render(createElement(TodoList, { items: [] }));
    await app.flush();
    expect(app.lastFrame()).not.toContain("☐");
    app.unmount();
  });

  it("glyphs_survive_a_monochrome_theme_ladder", async () => {
    // Under no-color the accent is stripped, but ☐/◐/☑ are glyph-distinct so the
    // status is still legible (M6 degrade-as-data — the glyph carries the signal).
    const app = render(
      createElement(TheoTUIProvider, {
        theme: themes["no-color"],
        children: createElement(TodoList, { items: ITEMS }),
      }),
    );
    await app.flush();
    const frame = app.lastFrame();
    expect(frame).toContain("☑ scaffold");
    expect(frame).toContain("◐ wire up");
    expect(frame).toContain("☐ test");
    app.unmount();
  });
});

describe("todoRowStyle (M26.1 Claude Code parity)", () => {
  it("done_is_dim_and_struck_through", () => {
    expect(todoRowStyle("done")).toEqual({
      dimColor: true,
      strikethrough: true,
    });
  });
  it("active_is_bold", () => {
    expect(todoRowStyle("active")).toEqual({ bold: true });
  });
  it("pending_has_no_emphasis", () => {
    expect(todoRowStyle("pending")).toEqual({});
  });
});

describe("TodoList render attributes (SGR — ink harness)", () => {
  it("a_done_row_renders_the_strikethrough_SGR", async () => {
    // itl-adapter strips SGR; the ink renderFrame preserves it — assert the
    // strikethrough attribute (SGR 9) actually reaches the terminal bytes.
    const frame = await renderFrame(
      <TodoList items={[{ id: "a", label: "shipped", status: "done" }]} />,
    );
    expect(frame).toMatch(/\[[0-9;]*9m/); // strikethrough opened
    expect(frame).toContain("shipped");
  });

  it("an_active_row_renders_the_bold_SGR", async () => {
    const frame = await renderFrame(
      <TodoList items={[{ id: "a", label: "working", status: "active" }]} />,
    );
    expect(frame).toMatch(/\[[0-9;]*1m/); // bold opened
  });
});
