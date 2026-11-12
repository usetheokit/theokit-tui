import { describe, expect, it } from "vitest";
import { parseV4APatchFiles } from "../../src/tools/v4a-patch.js";

const PATCH = [
  "*** Begin Patch",
  "*** Add File: a.ts",
  "+x",
  "*** Update File: b.ts",
  "*** Move to: c.ts",
  "@@",
  "-a",
  "+b",
  "*** Delete File: d.ts",
  "*** End Patch",
].join("\n");

describe("parseV4APatchFiles", () => {
  it("test_lists_add_update_move_delete_in_order", () => {
    expect(parseV4APatchFiles(PATCH)).toEqual([
      { path: "a.ts", op: "add" },
      { path: "c.ts", op: "move", from: "b.ts" },
      { path: "d.ts", op: "delete" },
    ]);
  });

  it("test_non_v4a_text_returns_empty", () => {
    expect(parseV4APatchFiles("--- a\n+++ b")).toEqual([]);
    expect(parseV4APatchFiles("")).toEqual([]);
  });

  it("test_never_throws_on_a_non_string", () => {
    expect(parseV4APatchFiles(undefined as unknown as string)).toEqual([]);
  });

  it("test_handles_crlf_and_ignores_a_move_without_an_update", () => {
    expect(parseV4APatchFiles("*** Add File: a.ts\r\n*** Move to: z.ts\r\n")).toEqual([
      { path: "a.ts", op: "add" },
    ]);
  });
});
