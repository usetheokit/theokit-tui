import { describe, expect, it } from "vitest";
import type { ToolCardResult } from "./tool-card-result.js";
import { assertToolCardResult } from "./tool-card-result.js";

// M16 T1.1 (plan m16-tool-card-variants, ADR D1): the union's kind
// validation — REACHABLE from JS callers, so an explicit boundary check
// (not a dead `never` guard; the M13 v8-ignore lesson).

describe("tool-card-result (M16 T1.1)", () => {
  it("accepts_each_declared_kind", () => {
    const diff: ToolCardResult = { kind: "diff", patch: "--- a\n+++ b" };
    const output: ToolCardResult = {
      kind: "output",
      shell: { stdout: "ok", stderr: "", exitCode: 0 },
    };
    const preview: ToolCardResult = { kind: "preview", text: "x" };
    expect(() => assertToolCardResult(diff)).not.toThrow();
    expect(() => assertToolCardResult(output)).not.toThrow();
    expect(() => assertToolCardResult(preview)).not.toThrow();
  });

  it("unknown_kind_throws_typed", () => {
    const bogus = { kind: "bogus" } as unknown as ToolCardResult;
    const bad = () => assertToolCardResult(bogus);
    expect(bad).toThrow(TypeError);
    expect(bad).toThrow(/ToolCallCard/);
    expect(bad).toThrow(/bogus/);
  });

  it("non_object_throws_typed", () => {
    const bad = () => assertToolCardResult("diff" as unknown as ToolCardResult);
    expect(bad).toThrow(TypeError);
  });
});
