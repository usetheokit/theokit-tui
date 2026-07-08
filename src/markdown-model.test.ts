import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { parseInlineSegments, parseMarkdown } from "./markdown-model.js";
import type { MarkdownNode } from "./markdown-model.js";

// M13 T1.1 (plan m13-markdown-renderer, ADR D1): grammar unit oracles for
// the PURE parser — the gemini-proven line-scanner + inline tokenizer
// (blueprint Corner 4 citations). No ink anywhere in this suite.

const kindsOf = (nodes: MarkdownNode[]): string[] => nodes.map((n) => n.kind);

describe("markdown-model blocks (M13 T1.1)", () => {
  it("parses_each_block_kind", () => {
    const nodes = parseMarkdown(
      "# H1\n## H2\n### H3\n#### H4\n- a\n1. b\n---\npara",
    );
    expect(kindsOf(nodes)).toEqual([
      "heading",
      "heading",
      "heading",
      "heading",
      "list-item",
      "list-item",
      "hr",
      "paragraph",
    ]);
    const h1 = nodes[0];
    if (h1?.kind !== "heading") throw new Error("expected heading");
    expect(h1.level).toBe(1);
    const ul = nodes[4];
    if (ul?.kind !== "list-item") throw new Error("expected list-item");
    expect(ul.ordered).toBe(false);
    const ol = nodes[5];
    if (ol?.kind !== "list-item") throw new Error("expected list-item");
    expect(ol.ordered).toBe(true);
    expect(ol.marker).toBe("1");
  });

  it("fence_accumulates_verbatim_and_matches_close_length", () => {
    // Close fence longer than the open is a valid close (gemini
    // MarkdownDisplay.tsx:91-116); inner markdown stays VERBATIM.
    const nodes = parseMarkdown("```ts\ncode **not bold**\n````\nafter");
    const fence = nodes[0];
    if (fence?.kind !== "code") throw new Error("expected code");
    expect(fence.language).toBe("ts");
    expect(fence.lines.join("")).toContain("**not bold**");
    const after = nodes.at(-1);
    expect(after?.kind).toBe("paragraph");
  });

  it("shorter_or_wrong_char_fence_does_not_close", () => {
    // A ``` block is NOT closed by ~~~ nor by `` (negative case,
    // testing.md § 4.1).
    const nodes = parseMarkdown("```\ncode\n~~~\nstill code\n```\ndone");
    const fence = nodes[0];
    if (fence?.kind !== "code") throw new Error("expected code");
    expect(fence.lines).toContain("~~~");
    expect(fence.lines).toContain("still code");
  });

  it("unclosed_fence_at_eof_still_emits_code", () => {
    // EC-1 streaming safety — gemini MarkdownDisplay.tsx:287-300.
    const nodes = parseMarkdown("before\n```js\ntail");
    const last = nodes.at(-1);
    expect(last?.kind).toBe("code");
    if (last?.kind !== "code") throw new Error("expected code");
    expect(last.language).toBe("js");
    expect(last.lines).toEqual(["tail"]);
  });

  it("consecutive_blank_lines_collapse", () => {
    // gemini MarkdownDisplay.tsx:268-274 — one spacer, not three.
    const nodes = parseMarkdown("a\n\n\n\nb");
    expect(kindsOf(nodes)).toEqual(["paragraph", "spacer", "paragraph"]);
  });

  it("list_indentation_is_preserved", () => {
    const nodes = parseMarkdown("- top\n  - nested");
    const nested = nodes[1];
    if (nested?.kind !== "list-item") throw new Error("expected list-item");
    expect(nested.indent).toBe(2);
  });

  it("trailing_blank_lines_render_nothing", () => {
    const nodes = parseMarkdown("a\n\n");
    expect(kindsOf(nodes)).toEqual(["paragraph"]);
  });

  it("model_module_is_pure_no_ink_import", () => {
    const source = readFileSync(
      new URL("./markdown-model.ts", import.meta.url),
      "utf8",
    );
    const inkImports = source.match(/from "ink"/g) ?? [];
    expect(inkImports).toHaveLength(0);
  });
});

describe("markdown-model inline (M13 T1.1)", () => {
  it("inline_bold_italic_nesting_and_boundaries", () => {
    const segs = parseInlineSegments("**b** *i* ***bi*** intra*word*stays");
    const bold = segs.find((s) => s.text === "b");
    expect(bold?.styles.bold).toBe(true);
    const italic = segs.find((s) => s.text === "i");
    expect(italic?.styles.italic).toBe(true);
    const both = segs.find((s) => s.text === "bi");
    expect(both?.styles.bold).toBe(true);
    expect(both?.styles.italic).toBe(true);
    // Word-boundary guards (gemini markdownParsingUtils.ts:168-180): the
    // intra-word asterisk run stays literal.
    const flat = segs.map((s) => s.text).join("");
    expect(flat).toContain("intra*word*stays");
  });

  it("inline_code_is_verbatim", () => {
    // EC-2: no styling inside backticks; double-backtick spans keep an
    // inner backtick (gemini markdownParsingUtils.ts:206-210).
    const segs = parseInlineSegments("`**x**` and ``a`b``");
    const code1 = segs.find((s) => s.text === "**x**");
    expect(code1?.styles.code).toBe(true);
    expect(code1?.styles.bold).toBeUndefined();
    const code2 = segs.find((s) => s.text === "a`b");
    expect(code2?.styles.code).toBe(true);
  });

  it("link_and_bare_url_segments", () => {
    const segs = parseInlineSegments("[t](https://u) and https://w");
    const link = segs.find((s) => s.styles.link !== undefined);
    expect(link?.text).toBe("t");
    expect(link?.styles.link).toBe("https://u");
    const bare = segs.find((s) => s.text === "https://w");
    expect(bare?.styles.link).toBe("https://w");
  });

  it("strikethrough_segment", () => {
    const segs = parseInlineSegments("~~gone~~ kept");
    const struck = segs.find((s) => s.text === "gone");
    expect(struck?.styles.strikethrough).toBe(true);
  });

  it("malformed_markers_fall_through_as_literal", () => {
    // Negative case (testing.md § 4.1): unclosed markers never style and
    // never crash — the text survives verbatim.
    const segs = parseInlineSegments("**unclosed and ~~half");
    const styled = segs.filter(
      (s) => s.styles.bold || s.styles.strikethrough || s.styles.italic,
    );
    expect(styled).toHaveLength(0);
    expect(segs.map((s) => s.text).join("")).toBe("**unclosed and ~~half");
  });

  it("pathological_input_stays_linear", () => {
    // Backtracking guard: a long marker soup parses in bounded time.
    const soup = "*a".repeat(2000) + "`" + "b*".repeat(2000);
    const started = performance.now();
    const segs = parseInlineSegments(soup);
    const elapsed = performance.now() - started;
    expect(segs.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(1000);
  });
});
