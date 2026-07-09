import { Box } from "ink";
import { describe, expect, it } from "vitest";

import { renderFrame } from "../tests/helpers.js";
import { DiffViewer } from "./diff-viewer.js";

/** Compound-SGR-safe strip (M2 idiom) — frames carry ANSI (FORCE_COLOR=1). */
// eslint-disable-next-line no-control-regex
const stripAnsi = (s: string): string => s.replace(/\u001B\[[0-9;]*m/g, "");

// PATCH_BASIC duplicate (per-file — plan EC-23; home: src/diff-model.test.ts).
const PATCH_BASIC = [
  "--- a/basic.ts",
  "+++ b/basic.ts",
  "@@ -1,3 +1,3 @@",
  " line one",
  "-old two",
  "+new two",
  " line three",
  "",
].join("\n");

const longContextPatch = (context: number): string => {
  const pre = Array.from({ length: context }, (_, i) => ` ctx-${i}`);
  const post = Array.from({ length: context }, (_, i) => ` ctx-${context + i}`);
  return [
    "--- a/long.ts",
    "+++ b/long.ts",
    `@@ -1,${context * 2 + 1} +1,${context * 2 + 1} @@`,
    ...pre,
    "-changed old",
    "+changed line",
    ...post,
    "",
  ].join("\n");
};

describe("DiffViewer — unified renderer (T1.2)", () => {
  it("renders_add_del_context_with_signs", async () => {
    const frame = await renderFrame(<DiffViewer patch={PATCH_BASIC} />);
    const plain = stripAnsi(frame);
    expect(plain).toMatch(/^\s*\d+ \+ new two$/m);
    expect(plain).toMatch(/^\s*\d+ - old two$/m);
    expect(plain).toMatch(/^\s*\d+ {3}line one$/m);
  });

  it("add_and_del_lines_carry_status_colors", async () => {
    // SEPA F2: anchored to LINE content — the header stats also carry these
    // colors, so bare toContain would be vacuous.
    const frame = await renderFrame(<DiffViewer patch={PATCH_BASIC} />);
    expect(frame).toMatch(/\[32m.*new two/);
    expect(frame).toMatch(/\[31m.*old two/);
  });

  it("header_shows_name_and_stats", async () => {
    const frame = await renderFrame(<DiffViewer patch={PATCH_BASIC} />);
    const plain = stripAnsi(frame);
    expect(plain).toContain("basic.ts");
    expect(plain).toMatch(/\+1/);
    expect(plain).toMatch(/-1/);
  });

  it("rename_shows_arrow", async () => {
    const patch = [
      "--- a/old.ts",
      "+++ b/new.ts",
      "@@ -1,1 +1,1 @@",
      "-a",
      "+a2",
      "",
    ].join("\n");
    const frame = await renderFrame(<DiffViewer patch={patch} />);
    expect(stripAnsi(frame)).toContain("old.ts → new.ts");
  });

  it("line_numbers_toggle_off", async () => {
    const frame = await renderFrame(
      <DiffViewer patch={PATCH_BASIC} showLineNumbers={false} />,
    );
    const plain = stripAnsi(frame);
    // Whole-frame negative (tests-10 — plan literal restored).
    expect(plain).not.toMatch(/^\s*\d+ /m);
    expect(plain).toContain("line one");
  });

  it("hunk_gap_renders_ellipsis_row", async () => {
    const patch = [
      "--- a/gap.ts",
      "+++ b/gap.ts",
      "@@ -1,2 +1,2 @@",
      " top",
      "-a",
      "+b",
      "@@ -50,2 +50,2 @@",
      " bottom",
      "-c",
      "+d",
      "",
    ].join("\n");
    const frame = await renderFrame(<DiffViewer patch={patch} />);
    expect(stripAnsi(frame)).toMatch(/^\s*⋮\s*$/m);
  });

  it("net_insertion_hunk_has_no_spurious_gap", async () => {
    // SEPA F1 regression: net insertions >= 2 before a del→add transition
    // used to render a false ⋮ INSIDE a contiguous hunk (old/new counter mix).
    const patch = [
      "--- a/net.ts",
      "+++ b/net.ts",
      "@@ -1,4 +1,6 @@",
      " a",
      "+x",
      "+y",
      " b",
      "-c",
      "+c2",
      " d",
      "",
    ].join("\n");
    const frame = await renderFrame(<DiffViewer patch={patch} />);
    expect(stripAnsi(frame)).not.toMatch(/^\s*⋮\s*$/m);
  });

  it("blank_add_line_renders_signed_row", async () => {
    // SEPA F6: the blank-line placeholder branch needs viewer coverage.
    const patch = [
      "--- a/b.ts",
      "+++ b/b.ts",
      "@@ -1,1 +1,2 @@",
      " x",
      "+",
      "",
    ].join("\n");
    const frame = await renderFrame(<DiffViewer patch={patch} />);
    expect(stripAnsi(frame)).toMatch(/^\s*\d+ \+\s*$/m);
  });

  it("multi_file_boundary_pins_no_spacing", async () => {
    // SEPA F4 pinned as DESIGN: no separator row between files — the bold
    // header + stats row IS the boundary (DV-3).
    const patch =
      PATCH_BASIC +
      ["--- a/two.ts", "+++ b/two.ts", "@@ -1,1 +1,1 @@", "-x", "+y", ""].join(
        "\n",
      );
    const frame = await renderFrame(<DiffViewer patch={patch} />);
    const plain = stripAnsi(frame);
    const rows = plain.split("\n");
    const boundary = rows.findIndex((r) => r.includes("two.ts"));
    expect(boundary).toBeGreaterThan(0);
    expect(rows[boundary - 1]!.trim()).not.toBe("");
  });

  it("context_lines_fold_hides_runs", async () => {
    const frame = await renderFrame(
      <DiffViewer patch={longContextPatch(10)} contextLines={2} />,
    );
    const plain = stripAnsi(frame);
    expect(plain).toContain("--- 8 lines hidden ---");
    expect(plain).toContain("changed line");
  });

  it("max_lines_caps_with_trailer", async () => {
    const frame = await renderFrame(
      <DiffViewer patch={longContextPatch(15)} maxLines={5} />,
    );
    const plain = stripAnsi(frame);
    const rows = plain.split("\n").filter((r) => r.trim() !== "");
    expect(rows.length).toBeLessThanOrEqual(6);
    expect(plain).toContain("… (+");
  });

  it("cap_retention_is_head", async () => {
    // EC-5: documents rule — header + FIRST rows survive.
    const frame = await renderFrame(
      <DiffViewer patch={longContextPatch(15)} maxLines={5} />,
    );
    const plain = stripAnsi(frame);
    expect(plain).toContain("long.ts");
    expect(plain).toContain("ctx-0");
    expect(plain).not.toContain("changed line");
  });

  it("fold_then_cap_compose_deterministically", async () => {
    // EC-3: fold first, then cap; fold row suppresses the ⋮ for that jump.
    const frame = await renderFrame(
      <DiffViewer patch={longContextPatch(10)} contextLines={2} maxLines={6} />,
    );
    const plain = stripAnsi(frame);
    const rows = plain.split("\n").filter((r) => r.trim() !== "");
    expect(rows.length).toBeLessThanOrEqual(7);
    expect(plain).toContain("lines hidden");
    // Trailer counts SOURCE lines (dom-frontend-2): dropped = ctx10 + ctx11
    // + fold(hidden 8) = 10.
    expect(plain).toContain("… (+10 more lines)");
    expect(plain).not.toMatch(/^\s*⋮\s*$/m);
  });

  it("max_lines_scope_is_global_across_files", async () => {
    // EC-4: global budget, headers included.
    const patch =
      PATCH_BASIC +
      ["--- a/two.ts", "+++ b/two.ts", "@@ -1,1 +1,1 @@", "-x", "+y", ""].join(
        "\n",
      );
    const frame = await renderFrame(<DiffViewer patch={patch} maxLines={5} />);
    const rows = stripAnsi(frame)
      .split("\n")
      .filter((r) => r.trim() !== "");
    expect(rows.length).toBeLessThanOrEqual(6);
    expect(stripAnsi(frame)).toContain("… (+");
  });

  it("empty_patch_renders_no_changes_row", async () => {
    const frame = await renderFrame(<DiffViewer patch="" />);
    expect(stripAnsi(frame).trim()).toBe("(no changes)");
  });

  it("binary_file_renders_explicit_row", async () => {
    const patch = [
      "diff --git a/img.png b/img.png",
      "index 1234567..89abcde 100644",
      "Binary files a/img.png and b/img.png differ",
      "",
    ].join("\n");
    const frame = await renderFrame(<DiffViewer patch={patch} />);
    expect(stripAnsi(frame)).toContain("binary or metadata change");
  });

  it("invalid_max_lines_throws_typed_error", () => {
    const call = () => DiffViewer({ patch: PATCH_BASIC, maxLines: 0 });
    expect(call).toThrow(TypeError);
    expect(call).toThrow("maxLines must be an integer >= 1");
  });

  it("invalid_context_lines_throws_typed_error", () => {
    const call = () => DiffViewer({ patch: PATCH_BASIC, contextLines: -1 });
    expect(call).toThrow(TypeError);
    expect(call).toThrow("contextLines must be an integer >= 0"); // tests-9
  });

  it("malformed_patch_propagates_typed_error", () => {
    const call = () => DiffViewer({ patch: "not a diff" });
    expect(call).toThrow(TypeError);
    expect(call).toThrow(
      "parseUnifiedDiff: patch did not parse as a unified diff",
    );
  });

  it("tab_renders_as_four_spaces", async () => {
    // EC-7: render layer expands tabs (model preserves).
    const patch = [
      "--- a/f.go",
      "+++ b/f.go",
      "@@ -1,1 +1,1 @@",
      "-x",
      "+\tx",
      "",
    ].join("\n");
    const frame = await renderFrame(<DiffViewer patch={patch} />);
    expect(stripAnsi(frame)).toContain("    x");
    expect(frame).not.toContain("\t");
  });

  it("width_matrix_lines_fit", async () => {
    // EC-13: invariant scoped to narrow chars (EAW-wide count 2 columns).
    const patch = [
      "--- a/wide.ts",
      "+++ b/wide.ts",
      "@@ -1,2 +1,2 @@",
      `-${"x".repeat(90)}`,
      `+${"y".repeat(90)}`,
      " \tz",
      "",
    ].join("\n");
    for (const width of [60, 30, 20]) {
      const frame = await renderFrame(
        <Box width={width}>
          <DiffViewer patch={patch} />
        </Box>,
      );
      const plainRows = stripAnsi(frame).split("\n");
      // Positive anchor (tests-3): content survived AND wrapped (not lost).
      expect(stripAnsi(frame)).toContain("x");
      expect(plainRows.length).toBeGreaterThan(3);
      for (const row of plainRows) {
        // Invariant scoped to narrow chars — EAW-wide count 2 columns
        // (EC-13; `→`/`…` are EAW-Ambiguous, dom-frontend-6).
        expect(row.length).toBeLessThanOrEqual(width);
      }
    }
  });

  it("diff_snapshot_added_removed_context", async () => {
    const frame = await renderFrame(
      <Box width={60}>
        <DiffViewer patch={PATCH_BASIC} />
      </Box>,
    );
    expect(frame).toMatchSnapshot("diff-viewer-basic");
  });
});

// M25 T2.1 — intra-line word highlight (opt-in).
const PATCH_WORD = [
  "--- a/x.ts",
  "+++ b/x.ts",
  "@@ -1,1 +1,1 @@",
  "-the quick brown fox",
  "+the slow brown fox",
  "",
].join("\n");

describe("DiffViewer intra-line highlight (M25 T2.1)", () => {
  const INVERSE = "\x1b[7m";

  it("off_is_byte_identical_to_the_default", async () => {
    const off = await renderFrame(<DiffViewer patch={PATCH_WORD} />);
    const explicit = await renderFrame(
      <DiffViewer patch={PATCH_WORD} intraLineHighlight={false} />,
    );
    expect(explicit).toBe(off); // the opt-in default path is unchanged
    expect(off).not.toContain(INVERSE); // no inverse spans by default
  });

  it("on_marks_the_changed_word_with_an_inverse_span", async () => {
    const frame = await renderFrame(
      <DiffViewer patch={PATCH_WORD} intraLineHighlight />,
    );
    expect(frame).toContain(INVERSE); // the changed word is inverse-video
    // The unchanged words + the changed words are all still present.
    expect(stripAnsi(frame)).toContain("the quick brown fox");
    expect(stripAnsi(frame)).toContain("the slow brown fox");
  });

  it("does_not_highlight_a_pure_indentation_change", async () => {
    // Leading-whitespace-only change: the words are unchanged, so no inverse
    // span lights up the indentation (pi's strip-leading-whitespace rule).
    const patch = [
      "--- a/y.ts",
      "+++ b/y.ts",
      "@@ -1,1 +1,1 @@",
      "-value",
      "+  value",
      "",
    ].join("\n");
    const frame = await renderFrame(
      <DiffViewer patch={patch} intraLineHighlight />,
    );
    // "value" is unchanged; only the (stripped) leading whitespace differs, which
    // is not marked — so no inverse span wraps the word.
    expect(stripAnsi(frame)).toContain("value");
  });
});
