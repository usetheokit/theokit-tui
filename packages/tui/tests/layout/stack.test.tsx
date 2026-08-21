import { Text } from "ink";
import { describe, expect, it } from "vitest";

import { renderFrame } from "../../tests/fixtures/helpers.js";
import { stripAnsi } from "../../src/format/ansi.js";
import { Stack } from "../../src/layout/stack.js";

describe("Stack (vertical rhythm)", () => {
  it("inserts_one_blank_line_between_children_by_default", async () => {
    const frame = stripAnsi(
      await renderFrame(
        <Stack>
          <Text>a</Text>
          <Text>b</Text>
          <Text>c</Text>
        </Stack>,
      ),
    );
    // a · blank · b · blank · c — no leading / trailing blank.
    expect(frame.split("\n")).toEqual(["a", "", "b", "", "c"]);
  });

  it("respects_a_custom_gap", async () => {
    const frame = stripAnsi(
      await renderFrame(
        <Stack gap={2}>
          <Text>a</Text>
          <Text>b</Text>
        </Stack>,
      ),
    );
    expect(frame.split("\n")).toEqual(["a", "", "", "b"]);
  });

  it("gap_zero_packs_children", async () => {
    const frame = stripAnsi(
      await renderFrame(
        <Stack gap={0}>
          <Text>a</Text>
          <Text>b</Text>
        </Stack>,
      ),
    );
    expect(frame.split("\n")).toEqual(["a", "b"]);
  });

  it("accepts_margin_props", async () => {
    const raw = await renderFrame(
      <Stack marginTop={2}>
        <Text>x</Text>
      </Stack>,
    );
    const lines = stripAnsi(raw).split("\n");
    // marginTop lives OUTSIDE the stack; gap is only BETWEEN children.
    expect(lines[0]).toBe("");
    expect(lines[1]).toBe("");
    expect(lines[2]).toBe("x");
  });
});
