import { render } from "ink-testing-library";
import { describe, expect, it } from "vitest";
import { stripAnsi } from "../format/ansi.js";
import { TheoTUIProvider, themes } from "../theme/theme.js";
import { MarkdownText } from "./markdown-text.js";

// M13 T2.1 (plan m13-markdown-renderer, ADR D2): render oracles — nodes →
// ink tree with THEME tokens (blueprint Corner 1 d/e/f). Snapshot budget
// for the whole milestone: <= 2, both in this suite, both anchored.

const RICH = [
  "# Title",
  "",
  "Intro with **bold**, *italic* and `pnpm test`.",
  "",
  "- first item",
  "1. ordered item",
  "",
  "```ts",
  "const x = 1;",
  "```",
  "",
  "See [docs](https://theo.dev) or https://raw.url",
].join("\n");

function renderMarkdown(text: string): string {
  const instance = render(<MarkdownText text={text} />);
  const frame = instance.lastFrame() ?? "";
  instance.unmount();
  return frame;
}

describe("MarkdownText (M13 T2.1)", () => {
  it("renders_heading_bold_and_fence_scene", () => {
    const frame = renderMarkdown(RICH);
    expect(frame).not.toContain("**");
    expect(frame).not.toContain("```");
    expect(frame).toContain("const x = 1");
    expect(frame).toContain("Title");
    expect(frame).toContain("first item");
    expect(frame).toMatchSnapshot("markdown-rich-scene");
  });

  it("inline_code_takes_accent_and_stays_verbatim", () => {
    // EC-2 at render level: styling markers INSIDE backticks stay literal.
    const frame = renderMarkdown("run `pnpm **test**` now");
    expect(stripAnsi(frame)).toContain("pnpm **test**");
    // Accent SGR present around the span (dark theme accent = cyan).
    expect(frame).toContain("\u001B[36m");
  });

  it("link_renders_text_then_url", () => {
    const frame = stripAnsi(renderMarkdown("see [docs](https://theo.dev)"));
    expect(frame).toContain("docs (https://theo.dev)");
    expect(frame).not.toContain("[docs]");
  });

  it("list_prefixes_and_indentation_render", () => {
    const frame = stripAnsi(renderMarkdown("- a\n  - nested\n2. b"));
    expect(frame).toContain("- a");
    expect(frame).toContain("- nested");
    expect(frame).toContain("2. b");
    const lines = frame.split("\n");
    const top = lines.find((l) => l.includes("- a")) ?? "";
    const nested = lines.find((l) => l.includes("- nested")) ?? "";
    expect(nested.indexOf("-")).toBeGreaterThan(top.indexOf("-"));
  });

  it("monochrome_theme_drops_color_keeps_attributes", () => {
    // EC-4: bold/italic are ATTRIBUTES (legal under monochrome); color
    // SGR classes must be absent (house no_color idiom).
    const instance = render(
      <TheoTUIProvider theme={themes["no-color"]}>
        <MarkdownText text={"# H\n**b** and `c`"} />
      </TheoTUIProvider>,
    );
    const frame = instance.lastFrame() ?? "";
    instance.unmount();
    const colorSgr = frame.match(/\u001B\[(3[0-8]|4[0-8]|9[0-7]|10[0-7])m/g);
    expect(colorSgr).toBeNull();
    expect(frame).toContain("\u001B[1m"); // bold survives
    expect(frame).toMatchSnapshot("markdown-monochrome");
  });

  it("hr_and_spacer_render_minimal", () => {
    const frame = stripAnsi(renderMarkdown("a\n\n---\nb"));
    expect(frame).toContain("---");
    const lines = frame.split("\n").map((l) => l.trim());
    expect(lines.filter((l) => l === "").length).toBeGreaterThanOrEqual(1);
  });

  it("empty_text_renders_nothing", () => {
    const frame = renderMarkdown("");
    expect(frame).toBe("");
  });

  it("non_string_text_throws_typed", () => {
    const bad = () => MarkdownText({ text: 42 as unknown as string });
    expect(bad).toThrow(TypeError);
    expect(bad).toThrow(/MarkdownText/);
  });
});
