import { Box } from "ink";
import { describe, expect, it, vi } from "vitest";

import { renderFrame } from "../tests/helpers.js";
import { CodeBlock, ensureHighlighter, highlightLine } from "./code-block.js";

/** Compound-SGR-safe strip (M2 idiom). */
// eslint-disable-next-line no-control-regex
const stripAnsi = (s: string): string => s.replace(/\u001B\[[0-9;]*m/g, "");

const SNIPPET = ["const x = 1;", "function f() {", "  return x;", "}"].join(
  "\n",
);

const lines12 = Array.from({ length: 12 }, (_, i) => `line-${i}`).join("\n");

describe("CodeBlock — highlight pipeline (T2.1, ADR D2/D6)", () => {
  it("renders_plain_before_highlighter_loads", async () => {
    // First frame may precede the dynamic import resolving — text is intact.
    const frame = await renderFrame(<CodeBlock code={SNIPPET} />);
    expect(stripAnsi(frame)).toContain("const x = 1;");
  });

  it("highlight_preserves_text_exactly", async () => {
    // D8 text invariance: highlighting may only change color bytes.
    await ensureHighlighter();
    const hi = await renderFrame(
      <CodeBlock code={SNIPPET} language="typescript" />,
    );
    const plain = await renderFrame(<CodeBlock code={SNIPPET} />);
    expect(stripAnsi(hi)).toBe(stripAnsi(plain));
  });

  it("highlighted_snapshot_is_stable", async () => {
    await ensureHighlighter();
    const frame = await renderFrame(
      <Box width={60}>
        <CodeBlock code={"const x = 1;"} language="typescript" />
      </Box>,
    );
    expect(frame).toMatchSnapshot("code-block-highlighted");
  });

  it("highlighted_frame_contains_color_bytes", async () => {
    await ensureHighlighter();
    const frame = await renderFrame(
      <CodeBlock code={SNIPPET} language="typescript" />,
    );
    expect(frame).toMatch(/\[3[0-9]m/);
  });

  it("unknown_language_renders_plain", async () => {
    await ensureHighlighter();
    const frame = await renderFrame(
      <CodeBlock code={SNIPPET} language="nope-lang" />,
    );
    const plain = await renderFrame(<CodeBlock code={SNIPPET} />);
    expect(frame).toBe(plain);
  });

  it("no_language_renders_plain", async () => {
    await ensureHighlighter();
    const frame = await renderFrame(<CodeBlock code={SNIPPET} />);
    expect(frame).not.toMatch(/\[3[0-9]m/);
  });

  it("max_lines_caps_code_head_retained", async () => {
    // EC-5: HEAD retention — documents rule (D5 addenda).
    const frame = await renderFrame(<CodeBlock code={lines12} maxLines={5} />);
    const plain = stripAnsi(frame);
    expect(plain).toContain("… (+");
    expect(plain).toContain("line-0");
    expect(plain).not.toContain("line-11");
  });

  it("capped_head_line_numbers_stay_original", async () => {
    // EC-11: original numbering on the visible head.
    const frame = await renderFrame(
      <CodeBlock code={lines12} maxLines={5} showLineNumbers />,
    );
    const plain = stripAnsi(frame);
    expect(plain).toMatch(/^ *1 line-0/m);
    expect(plain).toMatch(/^ *4 line-3/m);
  });

  it("line_numbers_render_dim_right_aligned", async () => {
    const frame = await renderFrame(
      <CodeBlock code={SNIPPET} showLineNumbers />,
    );
    expect(stripAnsi(frame)).toMatch(/^ *1 const/m);
  });

  it("trailing_newline_adds_no_phantom_row", async () => {
    // M2 EC-7 parity.
    const frame = await renderFrame(<CodeBlock code={"a\nb\n"} />);
    expect(stripAnsi(frame).split("\n")).toHaveLength(2);
  });

  it("empty_code_renders_nothing", async () => {
    const frame = await renderFrame(<CodeBlock code="" />);
    expect(frame).toBe("");
  });

  it("whitespace_only_code_renders_trimmed_empty_row", async () => {
    // EC-26 pinned to REALITY: Ink trims trailing whitespace per line
    // (M0 lesson), so a whitespace-only row renders empty — same visible
    // output as empty code, by the renderer's own contract.
    const frame = await renderFrame(<CodeBlock code=" " />);
    expect(stripAnsi(frame)).toBe("");
  });

  it("invalid_max_lines_throws_typed_error", () => {
    const call = () => CodeBlock({ code: SNIPPET, maxLines: 0 });
    expect(call).toThrow(TypeError);
    expect(call).toThrow("maxLines must be an integer >= 1");
  });

  it("code_with_ansi_is_sanitized", async () => {
    // EC-16: agent output embeds escapes — stripped before render/highlight.
    const frame = await renderFrame(
      <CodeBlock code={"\u001B[31mred\u001B[39m text"} />,
    );
    expect(stripAnsi(frame)).toBe("red text");
  });

  it("ensure_highlighter_is_single_flight", () => {
    // EC-15.
    expect(ensureHighlighter()).toBe(ensureHighlighter());
  });

  it("unmount_before_load_does_not_set_state", async () => {
    // EC-14.
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const { render } = await import("ink-testing-library");
      const instance = render(
        <CodeBlock code={SNIPPET} language="typescript" />,
      );
      instance.unmount();
      await ensureHighlighter();
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(errorSpy).not.toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("language_change_after_load_keeps_text_invariant", async () => {
    // EC-25.
    await ensureHighlighter();
    const js = await renderFrame(
      <CodeBlock code={SNIPPET} language="javascript" />,
    );
    const py = await renderFrame(
      <CodeBlock code={SNIPPET} language="python" />,
    );
    expect(stripAnsi(js)).toBe(stripAnsi(py));
  });

  it("fallback_ladder_empty_root_and_throw_return_raw_line", () => {
    // D6 ladder levels 2 (empty root) and 3 (highlight throw) — stubbed:
    // real lowlight rarely produces either on common languages.
    const emptyRoot = {
      registered: () => true,
      highlight: () => ({ children: [] }),
    };
    expect(highlightLine("raw line", "ts", emptyRoot, "k")).toBe("raw line");
    const throwing = {
      registered: () => true,
      highlight: () => {
        throw new Error("boom");
      },
    };
    expect(highlightLine("raw line", "ts", throwing, "k")).toBe("raw line");
    // Unknown hast node types render as null (renderHast fallthrough).
    const weirdNode = {
      registered: () => true,
      highlight: () => ({ children: [{ type: "comment" }] }),
    };
    expect(highlightLine("x", "ts", weirdNode, "k")).not.toBe("x");
  });

  it("interior_blank_line_occupies_a_row", async () => {
    // M2 EC-11 parity: a blank interior line keeps its row.
    const frame = await renderFrame(<CodeBlock code={"a\n\nb"} />);
    expect(stripAnsi(frame).split("\n")).toHaveLength(3);
  });

  it("tab_renders_as_four_spaces", async () => {
    // EC-7 render layer.
    const frame = await renderFrame(<CodeBlock code={"\tx"} />);
    expect(stripAnsi(frame)).toBe("    x");
  });
});
