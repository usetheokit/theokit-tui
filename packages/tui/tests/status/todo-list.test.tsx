import { render as inkRender } from "ink-testing-library";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { renderFrame } from "../../tests/fixtures/helpers.js";
import { waitFor as waitForCondition } from "../../tests/fixtures/wait-for.js";
import { render } from "../../tests/renderer/itl-adapter.js";
import { TheoTUIProvider, themes } from "../../src/theme/theme.js";
import { type TodoItem, TodoList, todoRowStyle } from "../../src/status/todo-list.js";

// M24 T1.2 — TodoList over the itl-adapter. A live checklist keyed by stable id
// (☐ pending / ◐ active / ☑ done), replace-item in place, duplicate-id throw,
// glyph-distinct under monochrome (no color-only differentiation). Pure/declarative.

const ITEMS: TodoItem[] = [
  { id: "a", label: "scaffold", status: "done" },
  { id: "b", label: "wire up", status: "active" },
  { id: "c", label: "test", status: "pending" },
];

/** `ESC [ 30m` .. `ESC [ 37m` — the eight basic foreground colours (B-087). */
const SGR_COLOURS = Array.from({ length: 8 }, (_, n) => `\u001B[3${String(n)}m`);

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
    const next: TodoItem[] = [ITEMS[0]!, { id: "b", label: "wire up", status: "done" }, ITEMS[2]!];
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

  it("the_glyphs_carry_the_status_once_the_monochrome_theme_drops_the_colour", async () => {
    // B-087 — rendered through the itl-adapter and asserted plain text. MEASURED: with
    // `TheoTUIProvider` mutated to ignore its `theme` prop entirely, this and its three siblings
    // stayed GREEN (65 passed). The adapter reads xterm's `translateToString`, so COLOUR NEVER
    // REACHES THAT FRAME and the assertion was satisfied by the renderer rather than by the theme.
    //
    // Renders through ink now, and asserts the PAIR. One frame proves nothing on its own: absence
    // of colour under `no-color` is equally true of a theme system that was deleted.
    const frameFor = async (theme: unknown): Promise<string> => {
      const app = inkRender(
        createElement(TheoTUIProvider, {
          theme: theme as never,
          children: createElement(TodoList, { items: ITEMS }),
        }),
      );
      await waitForCondition(() => (app.lastFrame() ?? "").includes("scaffold"), {
        describe: "the todo list to render its first item",
      });
      const frame = app.lastFrame() ?? "";
      app.unmount();
      return frame;
    };

    const dark = await frameFor(themes.dark);
    const mono = await frameFor(themes["no-color"]);

    // MEASURED, and sharper than expected: under `dark` only the GLYPH is coloured
    // (`\u001B[36m◐\u001B[39m`), never the label. So the monochrome frame is the one where
    // glyph and label sit adjacent, and asserting that adjacency in BOTH would have been wrong.
    expect(dark).toContain("\u001B[36m◐\u001B[39m wire up");
    expect(mono).toContain("◐ wire up");

    // The glyphs carry the status in both — the degrade-as-data property this test is named for.
    for (const frame of [dark, mono]) {
      expect(frame).toContain("☑ scaffold");
      expect(frame).toContain("☐ test");
      expect(frame).toContain("◐");
    }

    // And colour is the only thing that differs, which is what makes the line above mean anything.
    // A colour SGR is `ESC [ 3n m`. Probed as a substring set rather than a RegExp literal: an
    // escape byte inside a RegExp trips `no-control-regex`, and the disable comment would be a
    // suppression where a plainer expression does the same job.
    const hasColour = (frame: string): boolean => SGR_COLOURS.some((code) => frame.includes(code));
    expect(hasColour(mono)).toBe(false);
    expect(hasColour(dark)).toBe(true);
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
