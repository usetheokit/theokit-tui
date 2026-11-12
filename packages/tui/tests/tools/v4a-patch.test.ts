import { describe, expect, it } from "vitest";

import { parseV4APatchFiles } from "../../src/tools/v4a-patch.js";

export const PATCH = [
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
  it("test_lists_add_move_and_delete_in_order", () => {
    expect(parseV4APatchFiles(PATCH)).toEqual([
      { path: "a.ts", op: "add" },
      { path: "c.ts", op: "move", from: "b.ts" },
      { path: "d.ts", op: "delete" },
    ]);
  });

  it("test_plain_update_is_update", () => {
    expect(parseV4APatchFiles("*** Update File: b.ts\r\n")).toEqual([
      { path: "b.ts", op: "update" },
    ]);
  });

  it("test_non_v4a_text_returns_empty", () => {
    expect(parseV4APatchFiles("--- a\n+++ b")).toEqual([]);
    expect(parseV4APatchFiles("")).toEqual([]);
  });

  it("test_hostile_input_does_not_throw", () => {
    expect(parseV4APatchFiles(undefined as unknown as string)).toEqual([]);
    expect(
      parseV4APatchFiles("*** Move to: x\n*** Add File:   \n*** Update File: a\n*** Move to: "),
    ).toEqual([{ path: "a", op: "update" }]);
  });
});
