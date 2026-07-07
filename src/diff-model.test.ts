import { describe, expect, it } from "vitest";

import { foldDiffLines, parseUnifiedDiff } from "./diff-model.js";
import type { DiffLine } from "./diff-model.js";

// PATCH_BASIC fixture — DEFINED here (plan EC-23), duplicated per-file where
// its exact line numbers are load-bearing.
export const PATCH_BASIC = [
  "--- a/basic.ts",
  "+++ b/basic.ts",
  "@@ -1,3 +1,3 @@",
  " line one",
  "-old two",
  "+new two",
  " line three",
  "",
].join("\n");

const ctx = (n: number): DiffLine => ({
  kind: "context",
  oldLine: n,
  newLine: n,
  text: `c${n}`,
});
const add = (n: number): DiffLine => ({
  kind: "add",
  newLine: n,
  text: `a${n}`,
});

describe("parseUnifiedDiff — pure model (T1.1, ADR D1/D7)", () => {
  it("parses_single_hunk_with_line_numbers", () => {
    const files = parseUnifiedDiff(PATCH_BASIC);
    expect(files).toHaveLength(1);
    expect(files[0]!.lines[0]).toEqual({
      kind: "context",
      oldLine: 1,
      newLine: 1,
      text: "line one",
    });
  });

  it("parses_add_and_del_kinds_with_counters", () => {
    const files = parseUnifiedDiff(PATCH_BASIC);
    const del = files[0]!.lines[1];
    const added = files[0]!.lines[2];
    expect(del).toEqual({ kind: "del", oldLine: 2, text: "old two" });
    expect(added).toEqual({ kind: "add", newLine: 2, text: "new two" });
    expect(files[0]!.additions).toBe(1);
    expect(files[0]!.deletions).toBe(1);
  });

  it("parses_multi_file_patch", () => {
    const patch =
      PATCH_BASIC +
      [
        "--- a/second.ts",
        "+++ b/second.ts",
        "@@ -1,1 +1,1 @@",
        "-x",
        "+y",
        "",
      ].join("\n");
    const files = parseUnifiedDiff(patch);
    expect(files).toHaveLength(2);
    // parse-diff strips the a/ b/ prefixes (probed behavior — logged
    // deviation DV-1 vs the plan's prefixed literals; semantics identical).
    expect(files[1]!.newName).toBe("second.ts");
  });

  it("maps_dev_null_to_absent_names", () => {
    const patch = [
      "--- /dev/null",
      "+++ b/new.ts",
      "@@ -0,0 +1,1 @@",
      "+hello",
      "",
    ].join("\n");
    const files = parseUnifiedDiff(patch);
    expect(files[0]!.oldName).toBeUndefined();
    expect(files[0]!.newName).toBe("new.ts");
  });

  it("maps_deleted_file_to_absent_new_name", () => {
    const patch = [
      "--- a/gone.ts",
      "+++ /dev/null",
      "@@ -1,1 +0,0 @@",
      "-bye",
      "",
    ].join("\n");
    const files = parseUnifiedDiff(patch);
    expect(files[0]!.oldName).toBe("gone.ts");
    expect(files[0]!.newName).toBeUndefined();
  });

  it("detects_rename_names", () => {
    const patch = [
      "--- a/old.ts",
      "+++ b/new.ts",
      "@@ -1,1 +1,1 @@",
      "-a",
      "+a2",
      "",
    ].join("\n");
    const files = parseUnifiedDiff(patch);
    expect(files[0]!.oldName).toBe("old.ts");
    expect(files[0]!.newName).toBe("new.ts");
  });

  it("strips_crlf_from_lines", () => {
    const patch = "--- a/f.ts\r\n+++ b/f.ts\r\n@@ -1,1 +1,1 @@\r\n-a\r\n+b\r\n";
    const files = parseUnifiedDiff(patch);
    expect(files[0]!.lines.every((l) => !l.text.includes("\r"))).toBe(true);
  });

  it("suppresses_no_newline_marker", () => {
    const patch = [
      "--- a/f.ts",
      "+++ b/f.ts",
      "@@ -1,1 +1,1 @@",
      "-a",
      "+b",
      "\\ No newline at end of file",
      "",
    ].join("\n");
    const files = parseUnifiedDiff(patch);
    expect(files[0]!.lines.some((l) => l.text.includes("No newline"))).toBe(
      false,
    );
    expect(files[0]!.lines).toHaveLength(2);
  });

  it("preserves_blank_add_and_del_lines", () => {
    const patch = [
      "--- a/f.ts",
      "+++ b/f.ts",
      "@@ -1,2 +1,2 @@",
      "-",
      "+",
      " x",
      "",
    ].join("\n");
    const files = parseUnifiedDiff(patch);
    expect(files[0]!.lines[0]!.text).toBe("");
    expect(files[0]!.lines[1]!.text).toBe("");
  });

  it("empty_patch_returns_empty_array", () => {
    expect(parseUnifiedDiff("")).toEqual([]);
    expect(parseUnifiedDiff("  \n")).toEqual([]);
  });

  it("malformed_patch_throws_typed_error", () => {
    const call = () => parseUnifiedDiff("this is not a diff at all");
    expect(call).toThrow(TypeError);
    expect(call).toThrow(
      "parseUnifiedDiff: patch did not parse as a unified diff",
    );
  });

  it("binary_file_yields_zero_lines_with_names", () => {
    const patch = [
      "diff --git a/img.png b/img.png",
      "index 1234567..89abcde 100644",
      "Binary files a/img.png and b/img.png differ",
      "",
    ].join("\n");
    const files = parseUnifiedDiff(patch);
    expect(files).toHaveLength(1);
    expect(files[0]!.lines).toHaveLength(0);
  });

  it("mode_change_only_patch_yields_zero_lines", () => {
    // EC-8: distinct fixture from git-binary.
    const patch = [
      "diff --git a/script.sh b/script.sh",
      "old mode 100644",
      "new mode 100755",
      "",
    ].join("\n");
    const files = parseUnifiedDiff(patch);
    expect(files[0]!.lines).toHaveLength(0);
    expect(files[0]!.oldName).toBe("script.sh");
  });

  it("trailing_garbage_after_valid_file_is_pinned", () => {
    // EC-1: parse-diff is LENIENT — garbage tail dropped (documented).
    const files = parseUnifiedDiff(PATCH_BASIC + "\nrandom garbage tail here");
    expect(files).toHaveLength(1);
  });

  it("preserves_tabs_in_model_text", () => {
    // EC-7: model preserves \t — render layers expand.
    const patch = [
      "--- a/f.go",
      "+++ b/f.go",
      "@@ -1,1 +1,1 @@",
      "-x",
      "+\tindented",
      "",
    ].join("\n");
    const files = parseUnifiedDiff(patch);
    expect(files[0]!.lines[1]!.text).toBe("\tindented");
  });

  it("windows_paths_and_quoted_unicode_names_pass_verbatim", () => {
    // EC-21/22: no crash; names verbatim (post parse-diff normalization).
    const patch = [
      '--- "a/caf\\303\\251.ts"',
      '+++ "b/caf\\303\\251.ts"',
      "@@ -1,1 +1,1 @@",
      "-a",
      "+b",
      "",
    ].join("\n");
    expect(() => parseUnifiedDiff(patch)).not.toThrow();
  });
});

describe("foldDiffLines — pure fold math (T1.1, ADR D5)", () => {
  it("fold_keeps_context_window_and_counts_hidden", () => {
    const lines: DiffLine[] = [
      ...Array.from({ length: 20 }, (_, i) => ctx(i + 1)),
      add(21),
      ...Array.from({ length: 20 }, (_, i) => ctx(i + 22)),
    ];
    const folded = foldDiffLines(lines, 2);
    const folds = folded.filter((r) => r.kind === "fold");
    expect(folds).toHaveLength(2);
    expect(folds[0]!.hidden).toBe(18);
    expect(() => foldDiffLines(lines, -1)).toThrow(TypeError);
  });

  it("fold_overlapping_and_small_runs_never_fold", () => {
    // EC-2/EC-10: overlap → no fold; runs of <= 1 hidden are NOT folded.
    const three = [add(1), ctx(2), ctx(3), ctx(4), add(5)];
    expect(foldDiffLines(three, 2).some((r) => r.kind === "fold")).toBe(false);
    const five = [add(1), ...[2, 3, 4, 5, 6].map(ctx), add(7)];
    expect(foldDiffLines(five, 2).some((r) => r.kind === "fold")).toBe(false);
    const six = [add(1), ...[2, 3, 4, 5, 6, 7].map(ctx), add(8)];
    const folds = foldDiffLines(six, 2).filter((r) => r.kind === "fold");
    expect(folds).toHaveLength(1);
    expect(folds[0]!.hidden).toBe(2);
  });

  it("fold_at_file_edges_emits_no_empty_folds", () => {
    // EC-2: change at the very first/last line.
    const lines = [add(1), ctx(2), ctx(3)];
    const folded = foldDiffLines(lines, 2);
    expect(folded.some((r) => r.kind === "fold")).toBe(false);
  });

  it("fold_context_lines_zero_folds_all_context", () => {
    // EC-9: boundary of VALID.
    const lines = [...[1, 2, 3].map(ctx), add(4), ...[5, 6, 7].map(ctx)];
    const folded = foldDiffLines(lines, 0);
    const folds = folded.filter((r) => r.kind === "fold");
    const hidden = folds.reduce((a, f) => a + f.hidden, 0);
    expect(hidden).toBe(6);
    expect(folded.some((r) => r.kind === "context")).toBe(false);
  });
});
