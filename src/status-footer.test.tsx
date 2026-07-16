import { Box, Text } from "ink";
import { describe, expect, it } from "vitest";

import { renderFrame } from "../tests/helpers.js";
import { StatusFooter } from "./status-footer.js";

const strip = (v: string): string =>
  // eslint-disable-next-line no-control-regex
  v.replace(/\[[0-9;]*m/g, "");

describe("StatusFooter (#45 — two-line footer)", () => {
  it("top_row_is_justified_left_and_right", async () => {
    const frame = strip(
      await renderFrame(
        <Box width={50}>
          <StatusFooter
            left={<Text>main · plan</Text>}
            right={<Text>42% context · fix the bug</Text>}
          />
        </Box>,
      ),
    );
    const topLine = frame.split("\n").find((l) => l.includes("main"));
    expect(topLine).toContain("main · plan");
    expect(topLine).toContain("42% context · fix the bug");
    // space-between: the two are pushed to the row's edges (a gap between them).
    expect(topLine).toMatch(/main · plan\s{2,}42% context/);
  });

  it("bottom_row_shows_the_mode_and_the_agents_hint", async () => {
    const frame = strip(await renderFrame(<StatusFooter mode="auto-accept" />));
    expect(frame).toContain("⏵⏵ auto-accept edits on");
    expect(frame).toContain("← for agents");
  });

  it("default_mode_renders_only_the_hint_on_the_bottom_row", async () => {
    const frame = strip(await renderFrame(<StatusFooter mode="default" />));
    expect(frame).not.toContain("⏵⏵");
    expect(frame).toContain("? for shortcuts · ← for agents");
  });

  it("renders_two_rows", async () => {
    const frame = strip(
      await renderFrame(<StatusFooter left={<Text>L</Text>} mode="plan" />),
    );
    const lines = frame.split("\n").filter((l) => l.trim() !== "");
    expect(lines.length).toBe(2);
  });

  it("accepts_a_custom_hint", async () => {
    const frame = strip(
      await renderFrame(<StatusFooter hint="press ? for help" />),
    );
    expect(frame).toContain("press ? for help");
  });

  it("accepts_margin_props", async () => {
    const raw = await renderFrame(
      <Box>
        <StatusFooter left={<Text>x</Text>} marginTop={2} />
      </Box>,
    );
    expect(raw.split("\n")[0]?.trim()).toBe("");
  });
});
