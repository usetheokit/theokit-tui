import { Box, Text } from "ink";
import { render } from "ink-testing-library";
import spinners from "cli-spinners";
import stringWidth from "string-width";
import { beforeAll, describe, expect, it } from "vitest";

import { renderFrame } from "../../tests/fixtures/helpers.js";
import { preloadHighlighter } from "../markdown/code-block.js";
import { ToolCall, formatArgs, formatToolName } from "./tool-call.js";
import { ToolCallCard } from "./tool-call-card.js";
import { TheoTUIProvider } from "../theme/theme.js";
import { stripAnsi } from "../format/ansi.js";

/** cli-spinners `dots` frame[0] — deterministic at renderFrame's 0ms tick (D6). */
const DOTS_FRAME_0 = "⠋";

/** Compound-SGR-safe strip (SEPA phase-1 F7). */
// eslint-disable-next-line no-control-regex

describe("formatArgs (M26 name(args) header)", () => {
  it("formats_a_present_summary_in_parens", () => {
    expect(formatArgs("src/**")).toBe("(src/**)");
  });
  it("returns_empty_string_for_undefined_or_empty", () => {
    expect(formatArgs(undefined)).toBe("");
    expect(formatArgs("")).toBe("");
  });
});

describe("formatToolName (PascalCase display standard)", () => {
  it("pascalizes_snake_case_identifiers", () => {
    expect(formatToolName("git_diff")).toBe("GitDiff");
    expect(formatToolName("read_file")).toBe("ReadFile");
    expect(formatToolName("apply_patch")).toBe("ApplyPatch");
  });
  it("capitalizes_single_word_and_camel_case", () => {
    expect(formatToolName("bash")).toBe("Bash");
    expect(formatToolName("readFile")).toBe("ReadFile");
  });
  it("splits_hyphenated_identifiers", () => {
    expect(formatToolName("web-search")).toBe("WebSearch");
  });
  it("leaves_already_pascal_names_untouched", () => {
    expect(formatToolName("Bash")).toBe("Bash");
    expect(formatToolName("Update")).toBe("Update");
  });
  it("leaves_names_with_whitespace_untouched", () => {
    // App-supplied human headers ("Ran node --test") are NOT identifiers —
    // never mangled.
    expect(formatToolName("Ran node --test")).toBe("Ran node --test");
  });
  it("empty_string_stays_empty", () => {
    expect(formatToolName("")).toBe("");
  });

  it("header_renders_the_pascalized_name", async () => {
    const frame = await renderFrame(
      <ToolCall name="git_diff" status="success" summary="src/**" />,
    );
    expect(stripAnsi(frame)).toContain("GitDiff(src/**)");
    expect(stripAnsi(frame)).not.toContain("git_diff");
  });
});

describe("ToolCall — status lifecycle (T1.1)", () => {
  it("renders_pending_with_status_bullet", async () => {
    const frame = await renderFrame(
      <ToolCall name="search" status="pending" />,
    );
    // M26: the status bullet `⏺` is the INDICATOR (positional oracle, SEPA F3).
    expect(stripAnsi(frame).startsWith("⏺")).toBe(true);
    expect(frame).toContain("Search");
  });

  it("renders_success_with_status_bullet", async () => {
    const frame = await renderFrame(
      <ToolCall name="search" status="success" />,
    );
    expect(stripAnsi(frame).startsWith("⏺")).toBe(true);
  });

  it("renders_failed_with_status_bullet", async () => {
    const frame = await renderFrame(<ToolCall name="search" status="failed" />);
    expect(stripAnsi(frame).startsWith("⏺")).toBe(true);
  });

  it("running_shows_spinner_first_frame", async () => {
    // EC-14 canary: pins the coupling between renderFrame's 0ms tick and
    // cli-spinners' 80ms dots interval — see tests/helpers.tsx.
    const frame = await renderFrame(
      <ToolCall name="search" status="running" />,
    );
    expect(frame).toContain(DOTS_FRAME_0);
  });

  it("each_status_frame_matches_snapshot", async () => {
    for (const status of ["pending", "running", "success", "failed"] as const) {
      const frame = await renderFrame(
        <Box width={40}>
          <ToolCall name="grep" status={status} summary="src/**" />
        </Box>,
      );
      expect(frame).toMatchSnapshot(`tool-call-${status}`);
    }
  });

  it("invalid_status_throws_typed_error", () => {
    const call = () => ToolCall({ name: "x", status: "done" as never });
    expect(call).toThrow(TypeError);
    expect(call).toThrow(
      'ToolCall: invalid status "done" — expected "pending" | "running" | "success" | "failed"',
    );
  });

  it("summary_renders_as_args_in_parens_after_name", async () => {
    // M26: `name(args)` — the summary is the arg detail, in dim parens.
    const frame = await renderFrame(
      <ToolCall name="grep" status="success" summary="in 3 files" />,
    );
    expect(stripAnsi(frame)).toContain("Grep(in 3 files)");
  });

  it("empty_name_renders_indicator_only", async () => {
    // EC-9: empty-but-valid name is legal — indicator still renders.
    // Frames carry ANSI (FORCE_COLOR=1 pin) — strip before the exact-equality.
    const frame = await renderFrame(<ToolCall name="" status="success" />);
    expect(stripAnsi(frame).trim()).toBe("⏺");
  });

  it("header_without_summary_shows_the_bare_name_no_parens", async () => {
    const frame = await renderFrame(<ToolCall name="grep" status="success" />);
    expect(stripAnsi(frame)).toContain("Grep");
    expect(stripAnsi(frame)).not.toContain("()");
  });

  it("long_name_args_truncate_to_width_never_overflow", async () => {
    // Width-matrix oracle: the header row never exceeds the terminal columns.
    for (const columns of [80, 40, 20]) {
      const frame = await renderFrame(
        <Box width={columns}>
          <ToolCall
            name="Bash"
            status="running"
            summary={"cd /very/long/path && git add -A && ".repeat(4)}
          />
        </Box>,
      );
      for (const line of stripAnsi(frame).split("\n")) {
        // Display width (string-width), not codepoint count — the repo's oracle
        // (markdown-table-render.test.tsx:62); catches a real CJK-arg overflow.
        expect(stringWidth(line)).toBeLessThanOrEqual(columns);
      }
    }
  });

  it("name_with_newline_renders_single_header_line", async () => {
    // EC-8: the header is ONE line by contract — newlines sanitized to spaces.
    const frame = await renderFrame(
      <ToolCall name={"rm\n-rf"} status="failed" />,
    );
    expect(frame.split("\n")).toHaveLength(1);
    expect(frame).toContain("rm -rf");
  });

  it("summary_with_newline_renders_single_header_line", async () => {
    // EC-8 summary path (SEPA phase-1 F4) — mutation-visible without this.
    const frame = await renderFrame(
      <ToolCall name="grep" status="success" summary={"a\nb"} />,
    );
    expect(frame.split("\n")).toHaveLength(1);
    expect(frame).toContain("a b");
  });
});

describe("ToolCallCard — header + indented body (T1.2)", () => {
  // The per-kind ⎿ test renders diff/preview bodies which need the highlighter.
  beforeAll(async () => {
    await preloadHighlighter();
  });

  it("card_renders_header_and_body_under_a_corner_connector", async () => {
    const frame = await renderFrame(
      <ToolCallCard name="grep" status="success">
        <Text>12 matches</Text>
      </ToolCallCard>,
    );
    expect(stripAnsi(frame).startsWith("⏺")).toBe(true);
    expect(frame).toContain("12 matches");
    // M26: the body renders under a `⎿` corner connector (Claude Code tree).
    expect(frame).toContain("⎿");
    expect(stripAnsi(frame).split("\n")[1]).toMatch(/⎿ .*12 matches/);
  });

  it("multiline_body_shows_the_connector_once_and_indents_continuation", async () => {
    const frame = await renderFrame(
      <Box width={40}>
        <ToolCallCard name="cat" status="success">
          <Text>{"line one\nline two"}</Text>
        </ToolCallCard>
      </Box>,
    );
    const lines = stripAnsi(frame).split("\n");
    const connectorLines = lines.filter((l) => l.includes("⎿"));
    expect(connectorLines).toHaveLength(1); // connector shows exactly once
    const two = lines.find((l) => l.includes("line two")) ?? "";
    expect(two.includes("⎿")).toBe(false); // continuation aligns under the body
    expect(two.startsWith(" ")).toBe(true);
  });

  it("bodyless_card_omits_the_connector", async () => {
    const frame = await renderFrame(
      <ToolCallCard name="grep" status="success" />,
    );
    expect(frame).not.toContain("⎿");
  });

  it("each_result_kind_renders_under_the_connector", async () => {
    const diff = await renderFrame(
      <Box width={70}>
        <ToolCallCard
          name="edit"
          status="success"
          summary="retry.ts"
          result={{ kind: "diff", patch: VALID_PATCH }}
        />
      </Box>,
    );
    expect(diff).toContain("⎿");
    const output = await renderFrame(
      <Box width={70}>
        <ToolCallCard
          name="bash"
          status="failed"
          summary="pnpm test"
          result={{
            kind: "output",
            shell: { stdout: "1 failing", stderr: "", exitCode: 1 },
          }}
        />
      </Box>,
    );
    expect(output).toContain("⎿");
    const preview = await renderFrame(
      <Box width={70}>
        <ToolCallCard
          name="read"
          status="success"
          summary="notes.md"
          result={{ kind: "preview", text: "hello\nworld" }}
        />
      </Box>,
    );
    expect(preview).toContain("⎿");
  });

  it("card_without_children_equals_row", async () => {
    const rowFrame = await renderFrame(
      <ToolCall name="grep" status="success" />,
    );
    const cardFrame = await renderFrame(
      <ToolCallCard name="grep" status="success" />,
    );
    expect(cardFrame).toBe(rowFrame);
  });

  it("card_frame_matches_snapshot", async () => {
    const frame = await renderFrame(
      <Box width={40}>
        <ToolCallCard name="grep" status="failed" summary="src/**">
          <Text>no matches found</Text>
        </ToolCallCard>
      </Box>,
    );
    expect(frame).toMatchSnapshot("tool-call-card");
  });

  it("card_with_string_children_renders_body", async () => {
    // EC-4: a raw string inside Ink's <Box> throws — the most natural consumer
    // call must not crash; string children are auto-wrapped in <Text>.
    const frame = await renderFrame(
      <ToolCallCard name="ls" status="success">
        {"12 matches"}
      </ToolCallCard>,
    );
    expect(frame).toContain("12 matches");
  });

  it("card_with_empty_string_children_equals_row", async () => {
    // EC-4: empty-string child is content-less — collapses to the bare row.
    const rowFrame = await renderFrame(<ToolCall name="ls" status="success" />);
    const cardFrame = await renderFrame(
      <ToolCallCard name="ls" status="success">
        {""}
      </ToolCallCard>,
    );
    expect(cardFrame).toBe(rowFrame);
  });
});

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Unique spinner cells rendered so far (ink-ui exhaust+dedup idiom). */
const uniqueSpinnerCells = (frames: readonly string[]): string[] => {
  const cells = new Set<string>();
  for (const frame of frames) {
    for (const candidate of spinners.dots.frames) {
      if (frame.includes(candidate)) {
        cells.add(candidate);
      }
    }
  }
  return [...cells];
};

describe("ToolCall — animation + transitions (T3.1, ADR D6)", () => {
  it("spinner_animates_through_dots_frames", { timeout: 5000 }, async () => {
    // Real timers — the ONLY animation test (gemini mocks; ink-ui exhausts).
    const instance = render(<ToolCall name="fetch" status="running" />);
    const seen: string[] = [];
    const budget = spinners.dots.frames.length * spinners.dots.interval + 50;
    const step = spinners.dots.interval;
    for (let elapsed = 0; elapsed < budget; elapsed += step) {
      await delay(step);
      seen.push(instance.lastFrame() ?? "");
    }
    instance.unmount();
    const cells = uniqueSpinnerCells(seen);
    expect(cells.length).toBeGreaterThan(1);
    for (const cell of cells) {
      expect(spinners.dots.frames).toContain(cell);
    }
  });

  it("transition_running_to_success_swaps_indicator", async () => {
    const instance = render(<ToolCall name="build" status="running" />);
    await delay(0);
    instance.rerender(<ToolCall name="build" status="success" />);
    await delay(0);
    const frame = instance.lastFrame() ?? "";
    instance.unmount();
    expect(stripAnsi(frame).startsWith("⏺")).toBe(true);
    expect(frame).not.toContain(DOTS_FRAME_0);
  });

  it("transition_running_to_failed_swaps_indicator", async () => {
    const instance = render(<ToolCall name="build" status="running" />);
    await delay(0);
    instance.rerender(<ToolCall name="build" status="failed" />);
    await delay(0);
    const frame = instance.lastFrame() ?? "";
    instance.unmount();
    expect(stripAnsi(frame).startsWith("⏺")).toBe(true);
  });

  it(
    "same_status_rerender_does_not_reset_spinner",
    { timeout: 5000 },
    async () => {
      // EC-10: identical props must not remount/reset the interval — the
      // spinner cell immediately after the same-props rerender must be the
      // MID-CYCLE cell it was before, not frame[0] again (review tests-2).
      const instance = render(<ToolCall name="fetch" status="running" />);
      const half = Math.ceil(spinners.dots.frames.length / 2);
      await delay(half * spinners.dots.interval + 20);
      const cellBefore = uniqueSpinnerCells([instance.lastFrame() ?? ""])[0];
      instance.rerender(<ToolCall name="fetch" status="running" />);
      const cellAfter = uniqueSpinnerCells([instance.lastFrame() ?? ""])[0];
      expect(cellBefore).toBeDefined();
      // B-020 — this asserted `cellAfter === cellBefore`, i.e. that the frame had not CHANGED.
      // That conflates two things: "the rerender did not reset the interval", which is the
      // behaviour under test, and "no wall-clock time passed", which is not ours to guarantee.
      // Under contention the interval legitimately fires between the two reads and the test failed
      // with `expected '⠴' to be '⠼'` — one frame apart, which is time passing, not a defect.
      //
      // The invariant is the line below and always was: a reset would show frame[0]. Adding the
      // membership check keeps the rest of the coverage — a rerender that broke the spinner
      // entirely would produce a cell that is not a `dots` frame at all.
      expect(spinners.dots.frames).toContain(cellAfter);
      expect(cellAfter).not.toBe(spinners.dots.frames[0]);
      instance.unmount();
    },
  );
});

// M6 T2.1: STATUS_VISUALS migrated to theme.toolStatus — tokens drive render.
describe("ToolCall — toolStatus tokens (M6 T2.1)", () => {
  it("tool_status_tokens_drive_render", async () => {
    const frame = await renderFrame(
      <TheoTUIProvider
        theme={{ toolStatus: { failed: { glyph: "✗", color: "magenta" } } }}
      >
        <ToolCall name="t" status="failed" />
      </TheoTUIProvider>,
    );
    expect(frame).toContain("✗");
    expect(frame).toContain("[35m");
  });
});

// M16 T1.1 (plan m16-tool-card-variants, ADRs D1-D2): per-kind result
// bodies — pure composition of DiffViewer/ToolResult/CodeBlock inside the
// card's indent slot. Snapshot budget for the milestone: <= 3, all here.

// eslint-disable-next-line no-control-regex
const m16plain = (frame: string | undefined): string => stripAnsi(frame ?? "");

const VALID_PATCH = [
  "--- a/basic.ts",
  "+++ b/basic.ts",
  "@@ -1,3 +1,3 @@",
  " line one",
  "-removed line",
  "+added line",
  " line three",
  "",
].join("\n");

describe("ToolCallCard result variants (M16 T1.1)", () => {
  // Determinism (fixes the review r1-F1 [NEEDS-REPRO] flake): the diff and
  // preview-with-language variants route through CodeBlock/DiffViewer, which
  // async-load lowlight via a module-cached promise and re-render
  // highlighted. Whether that re-render's microtask flushes inside
  // renderFrame's 0ms tick depends on whether a prior test in the same
  // vitest worker warmed the cache — pure parallel-ordering nondeterminism.
  // Preloading forces the highlight state ON before any render, so every
  // frame (and snapshot) is deterministic.
  beforeAll(async () => {
    await preloadHighlighter();
  });

  it("diff_result_renders_patch_inside_card_indent", async () => {
    const frame = await renderFrame(
      <Box width={70}>
        <ToolCallCard
          name="edit"
          status="success"
          result={{ kind: "diff", patch: VALID_PATCH }}
        />
      </Box>,
    );
    const stripped = m16plain(frame);
    // DiffViewer's real row shape: sign column + dim line-number gutter +
    // content (the sign is not adjacent to the text).
    // DiffViewer's REAL row shape (probed): number gutter, THEN the sign,
    // then content — `2 + added line`.
    const addedLine = stripped
      .split("\n")
      .find((line) => line.includes("added line"));
    expect(addedLine).toMatch(/\d+ \+ added line/);
    const removedLine = stripped
      .split("\n")
      .find((line) => line.includes("removed line"));
    expect(removedLine).toMatch(/\d+ - removed line/);
    // Diff rows sit inside the card indent (not at column 0).
    expect(addedLine?.startsWith("  ")).toBe(true);
    expect(frame).toMatchSnapshot("tool-card-diff");
  });

  it("output_result_renders_shell_envelope", async () => {
    const frame = await renderFrame(
      <Box width={70}>
        <ToolCallCard
          name="bash"
          status="failed"
          result={{
            kind: "output",
            shell: { stdout: "ok line", stderr: "warn line", exitCode: 1 },
          }}
        />
      </Box>,
    );
    const stripped = m16plain(frame);
    // ToolResult's envelope: stdout rows are UNLABELED; stderr carries the
    // single `stderr:` label; a non-zero exit renders the `exited N` badge.
    expect(stripped).toContain("ok line");
    expect(stripped).toContain("stderr:");
    expect(stripped).toContain("warn line");
    expect(stripped).toContain("exited 1");
    expect(frame).toMatchSnapshot("tool-card-output");
  });

  it("preview_result_caps_with_language_routing", async () => {
    const twenty = Array.from(
      { length: 20 },
      (_, i) => `const line${i} = ${i};`,
    ).join("\n");
    const frame = await renderFrame(
      <Box width={70}>
        <ToolCallCard
          name="read"
          status="success"
          result={{
            kind: "preview",
            text: twenty,
            language: "ts",
            maxLines: 5,
          }}
        />
      </Box>,
    );
    const stripped = m16plain(frame);
    expect(stripped).toContain("const line0 = 0;");
    expect(stripped).not.toContain("const line19");
    expect(stripped).toMatch(/more/);
    expect(frame).toMatchSnapshot("tool-card-preview");
  });

  it("preview_without_language_renders_plain_lines", async () => {
    // Anchored on ToolResult's DISTINCTIVE tail-retention trailer so the
    // language-routing mutant dies on BOTH branches (review r2-F5).
    const five = Array.from({ length: 5 }, (_, i) => `prose ${i}`).join("\n");
    const frame = await renderFrame(
      <ToolCallCard
        name="read"
        status="success"
        result={{ kind: "preview", text: five, maxLines: 2 }}
      />,
    );
    const stripped = m16plain(frame);
    expect(stripped).toContain("prose 4"); // tail survives
    expect(stripped).toMatch(/hidden/); // ToolResult trailer, not CodeBlock's
    expect(stripped).not.toMatch(/more lines/);
  });

  it("output_and_diff_passthroughs_reach_the_primitives", async () => {
    // Review r2-F6: the forwarded options must actually forward.
    const expanded = m16plain(
      await renderFrame(
        <ToolCallCard
          name="bash"
          status="success"
          result={{
            kind: "output",
            shell: {
              stdout: Array.from({ length: 8 }, (_, i) => `row ${i}`).join(
                "\n",
              ),
              stderr: "",
              exitCode: 0,
            },
            maxLines: 3,
            expanded: true,
          }}
        />,
      ),
    );
    expect(expanded).toContain("row 0"); // expanded bypasses the line cap
    expect(expanded).toContain("row 7");
    const capped = m16plain(
      await renderFrame(
        <ToolCallCard
          name="edit"
          status="success"
          result={{ kind: "diff", patch: VALID_PATCH, maxLines: 2 }}
        />,
      ),
    );
    expect(capped).toMatch(/more lines/); // DiffViewer HEAD-retained cap fired
  });

  it("result_and_children_coexist_children_below", async () => {
    const frame = await renderFrame(
      <ToolCallCard
        name="read"
        status="success"
        result={{ kind: "preview", text: "the preview body" }}
      >
        <Text>a child note</Text>
      </ToolCallCard>,
    );
    const stripped = m16plain(frame);
    expect(stripped.indexOf("the preview body")).toBeLessThan(
      stripped.indexOf("a child note"),
    );
  });

  it("malformed_patch_error_propagates", () => {
    // EC-1: a malformed patch throws the TYPED error at the CARD boundary, synchronously, so the
    // card validates the patch up-front and the failure is loud (error-handling.md § 2).
    //
    // This comment said a child render throw is swallowed by ink's error boundary "into a silent
    // empty frame". The empty frame is what `renderFrame` / `ink-testing-library` produces; against
    // a real `render()` that boundary prints an ERROR panel with a stack and the app exits (B-031).
    // The probe it cites went through the harness — the same generalisation B-025 v1 made, found
    // here while sweeping for it (B-025 v2 T1.3).
    const bad = () =>
      ToolCallCard({
        name: "edit",
        status: "success",
        result: { kind: "diff", patch: "not a diff at all" },
      });
    expect(bad).toThrow(TypeError);
    expect(bad).toThrow(/did not parse as a unified diff/);
  });

  it("unknown_kind_throws_typed_at_the_card_boundary", () => {
    const bad = () =>
      ToolCallCard({
        name: "x",
        status: "success",
        result: { kind: "bogus" } as never,
      });
    expect(bad).toThrow(TypeError);
    expect(bad).toThrow(/ToolCallCard/);
  });

  it("monochrome_keeps_signs_and_labels", async () => {
    const frame = await renderFrame(
      <TheoTUIProvider theme="no-color">
        <Box width={70}>
          <ToolCallCard
            name="edit"
            status="success"
            result={{ kind: "diff", patch: VALID_PATCH }}
          />
        </Box>
      </TheoTUIProvider>,
    );
    const colorSgr = frame.match(
      // eslint-disable-next-line no-control-regex
      /\u001B\[(3[0-8]|4[0-8]|9[0-7]|10[0-7])m/g,
    );
    expect(colorSgr).toBeNull();
    const stripped = m16plain(frame);
    const monoAdded = stripped
      .split("\n")
      .find((line) => line.includes("added line"));
    expect(monoAdded).toMatch(/\d+ \+ added line/);
    const monoRemoved = stripped
      .split("\n")
      .find((line) => line.includes("removed line"));
    expect(monoRemoved).toMatch(/\d+ - removed line/);
  });

  it("status_independence_of_the_result_body", async () => {
    const running = m16plain(
      await renderFrame(
        <ToolCallCard
          name="edit"
          status="running"
          result={{ kind: "preview", text: "same body" }}
        />,
      ),
    );
    const success = m16plain(
      await renderFrame(
        <ToolCallCard
          name="edit"
          status="success"
          result={{ kind: "preview", text: "same body" }}
        />,
      ),
    );
    const bodyOf = (frame: string) => frame.split("\n").slice(1).join("\n");
    expect(bodyOf(running)).toBe(bodyOf(success));
  });
});
