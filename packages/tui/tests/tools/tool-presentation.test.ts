/**
 * T3.1 — how a tool call is presented, keyed by the tool names the framework defines.
 *
 * `ToolResult`, `ToolCallCard`, `ShellEnvelope`, `CostMeter` and `TokenUsageChart` already ship
 * here. What did not was the mapping from a tool NAME to how it reads: the consumer's
 * `tool-header.ts` is 292 LOC holding `HEADERS_BY_TOOL`, `BODY_BY_TOOL` and `APPROVAL_LABELS`, all
 * keyed by names the framework's factories own — with a hand-written `tool_name_mismatch` throw in
 * their registry to keep the two halves in sync by discipline.
 *
 * Both halves are ours: the factories own the names, this package owns the rendering. It is the only
 * place they can be kept together.
 *
 * ## The key set is duplicated knowledge, deliberately
 *
 * This package does NOT depend on `@theokit/agents`, and must not — that would invert the dependency
 * direction (`rules/system-design-guardrails.md` § G1). So the names are a literal list, and the
 * drift risk is real. It is recorded as a test against a measured list rather than solved by adding
 * the dependency, because a wrong key renders a generic header while a wrong dependency edge is
 * permanent.
 */
import { describe, expect, it } from "vitest";

import {
  DEFAULT_TOOL_PRESENTATION,
  KNOWN_TOOL_NAMES,
  toolPresentation,
} from "../../src/tools/tool-presentation.js";

describe("DEFAULT_TOOL_PRESENTATION", () => {
  it("test_every_known_tool_name_has_a_header", () => {
    for (const name of KNOWN_TOOL_NAMES) {
      const entry = DEFAULT_TOOL_PRESENTATION.get(name);
      expect(entry, `no presentation for '${name}'`).toBeDefined();
      expect(entry?.header({}, true).length, `empty header for '${name}'`).toBeGreaterThan(0);
    }
  });

  it("test_the_header_distinguishes_running_from_finished", () => {
    const shell = DEFAULT_TOOL_PRESENTATION.get("shell_exec");
    expect(shell?.header({ command: "ls -la" }, true)).not.toBe(
      shell?.header({ command: "ls -la" }, false),
    );
  });

  it("test_every_header_distinguishes_running_from_finished_including_subject_less_ones", () => {
    // Regression: `verbPair` first returned a one-argument function, so TypeScript bound `input` to
    // the `active` slot and every subject-less tool ("Checking the time") rendered its running form
    // forever. The earlier tests missed it because they asserted the header was non-empty, and it
    // was — always the same non-empty string. Asserting the DIFFERENCE is what catches it.
    for (const name of KNOWN_TOOL_NAMES) {
      const entry = DEFAULT_TOOL_PRESENTATION.get(name);
      const input = {
        path: "a.ts",
        command: "ls",
        url: "u",
        query: "q",
        pattern: "p",
      };
      expect(
        entry?.header(input, true),
        `'${name}' reads the same whether it is running or finished`,
      ).not.toBe(entry?.header(input, false));
    }
  });

  it("test_the_header_names_what_the_call_is_about", () => {
    // A row reading "Reading" with no filename is a progress bar, not a log.
    const read = DEFAULT_TOOL_PRESENTATION.get("read_file");
    expect(read?.header({ path: "src/app.ts" }, true)).toContain("src/app.ts");
  });

  it("test_a_malformed_input_still_renders_a_header", () => {
    // Input crosses from a model, so it can be anything. A crash in the renderer takes the whole
    // session down over a string the model got wrong.
    const read = DEFAULT_TOOL_PRESENTATION.get("read_file");
    expect(() => read?.header(null, true)).not.toThrow();
    expect(() => read?.header({ path: 42 }, false)).not.toThrow();
    expect((read?.header(undefined, true) ?? "").length).toBeGreaterThan(0);
  });
});

describe("toolPresentation", () => {
  it("test_an_unknown_tool_name_gets_a_generic_entry_never_a_crash", () => {
    const map = toolPresentation();
    const entry = map.get("a_tool_nobody_registered");
    expect(entry, "an unregistered tool must still render").toBeDefined();
    expect(entry?.header({}, true)).toContain("a_tool_nobody_registered");
    expect(entry?.header({}, false)).toContain("a_tool_nobody_registered");
  });

  it("test_overriding_one_entry_leaves_the_others_at_their_defaults", () => {
    const map = toolPresentation({
      shell_exec: {
        header: (_input, active) => (active ? "Executando…" : "Executado"),
      },
    });
    expect(map.get("shell_exec")?.header({}, true)).toBe("Executando…");
    expect(
      map.get("read_file")?.header({ path: "a.ts" }, true),
      "restating 19 entries to change one is not an override, it is a fork",
    ).toBe(DEFAULT_TOOL_PRESENTATION.get("read_file")?.header({ path: "a.ts" }, true));
  });

  it("test_a_partial_override_keeps_the_rest_of_that_entry", () => {
    const map = toolPresentation({
      shell_exec: { approvalLabel: () => "Rodar?" },
    });
    expect(map.get("shell_exec")?.approvalLabel?.({})).toBe("Rodar?");
    expect(map.get("shell_exec")?.header({ command: "ls" }, true)).toBe(
      DEFAULT_TOOL_PRESENTATION.get("shell_exec")?.header({ command: "ls" }, true),
    );
  });

  it("test_the_defaults_are_not_mutated_by_an_override", () => {
    const before = DEFAULT_TOOL_PRESENTATION.get("shell_exec")?.header({ command: "ls" }, true);
    toolPresentation({ shell_exec: { header: () => "hijacked" } });
    expect(
      DEFAULT_TOOL_PRESENTATION.get("shell_exec")?.header({ command: "ls" }, true),
      "one surface's override must not reach another surface's map",
    ).toBe(before);
  });

  it("test_an_override_for_an_unknown_name_is_honoured", () => {
    // A product with its own tool should be able to describe it here rather than fork the map.
    const map = toolPresentation({
      my_custom_tool: { header: () => "Doing my thing" },
    });
    expect(map.get("my_custom_tool")?.header({}, true)).toBe("Doing my thing");
  });
});

describe("approval labels", () => {
  it("test_the_tools_that_change_things_carry_an_approval_label", () => {
    // The label is what a human reads before saying yes. Every tool that writes or executes must
    // have one; a generic "Allow?" for `apply_patch` tells the human nothing about what changes.
    for (const name of ["shell_exec", "apply_patch", "write_file", "edit_file"]) {
      const label = DEFAULT_TOOL_PRESENTATION.get(name)?.approvalLabel;
      expect(label, `${name} changes things and must say what it will do`).toBeDefined();
      expect(label?.({ command: "rm -rf /", path: "a.ts" }).length).toBeGreaterThan(0);
    }
  });

  it("test_a_read_only_tool_needs_no_approval_label", () => {
    expect(DEFAULT_TOOL_PRESENTATION.get("read_file")?.approvalLabel).toBeUndefined();
  });
});

describe("body", () => {
  it("test_a_patch_producing_tool_renders_as_a_diff_card", () => {
    const body = DEFAULT_TOOL_PRESENTATION.get("apply_patch")?.body;
    expect(body).toBeDefined();
    const card = body?.({ patch: "--- a\n+++ b\n@@ -1 +1 @@\n-x\n+y\n" });
    expect(card?.kind).toBe("diff");
  });

  it("test_a_shell_tool_renders_as_an_output_card", () => {
    const card = DEFAULT_TOOL_PRESENTATION.get("shell_exec")?.body?.({
      stdout: "hi",
      stderr: "",
      exitCode: 0,
    });
    expect(card?.kind).toBe("output");
  });

  it("test_a_body_given_a_shape_it_does_not_recognise_falls_back_to_preview", () => {
    // Tool output crosses from a subprocess and a model. Rendering nothing is better than throwing,
    // and a preview shows the human what actually came back so they can see the mismatch.
    const card = DEFAULT_TOOL_PRESENTATION.get("apply_patch")?.body?.({
      unexpected: true,
    });
    expect(card?.kind).toBe("preview");
  });
});
