import { Box, Text } from "ink";
import { describe, expect, it } from "vitest";

import { renderFrame } from "../../tests/fixtures/helpers.js";
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
  // U-8 — the mode row for a product whose permission vocabulary is not this one.
  //
  // `ModeIndicator` already solved this with `label`, and deliberately kept `mode`
  // a CLOSED union so a typo is still caught. What was missing is that the composed
  // footer never forwarded it, so the escape hatch sat one level down and out of
  // reach: a consumer using `StatusFooter` had to stuff its mode into `left` and
  // lose the row entirely.
  it("forwards_a_custom_mode_label_to_the_mode_row", async () => {
    const frame = strip(
      await renderFrame(
        <StatusFooter
          left={<Text>main</Text>}
          modeLabel="\u23f5\u23f5 full-auto on"
        />,
      ),
    );

    expect(frame).toContain("full-auto on");
    expect(
      frame,
      "the cycle hint belongs to the row, not the vocabulary",
    ).toContain("shift+tab to cycle");
    expect(frame, "the agents hint is part of the mode row").toContain(
      "for agents",
    );
  });

  it("a_custom_mode_label_replaces_the_default_hint_row", async () => {
    const frame = strip(
      await renderFrame(
        <StatusFooter left={<Text>main</Text>} modeLabel="suggest on" />,
      ),
    );

    expect(
      frame,
      "the shortcuts hint still occupied the mode row",
    ).not.toContain("? for shortcuts");
  });

  it("a_label_does_not_switch_off_the_closed_union_check_on_mode", async () => {
    // The closed union is enforced in `ModeIndicator` and already has its own negative test
    // there (`invalid_mode_throws_typed_error`); re-asserting the throw through this harness
    // is not possible anyway, because it swallows a render-time error into an empty frame.
    //
    // What IS this component's responsibility is FORWARDING `mode` even when `modeLabel` is
    // given, so the check still runs. That is observable: with a typo'd mode the row must not
    // render at all. Drop `mode={mode}` from the forwarding and the label appears — which is
    // precisely the silent-degradation `modeLabel` must not introduce.
    const frame = strip(
      await renderFrame(
        <StatusFooter
          left={<Text>main</Text>}
          mode={"plna" as never}
          modeLabel="suggest on"
        />,
      ),
    );

    expect(
      frame,
      "a typo'd mode rendered anyway once a label was passed",
    ).not.toContain("suggest on");
  });

  it("footer_without_the_new_prop_is_unchanged", async () => {
    // Backward-compatibility guard: `modeLabel` is opt-in.
    const frame = strip(
      await renderFrame(<StatusFooter left={<Text>main</Text>} />),
    );

    expect(frame).toContain("? for shortcuts");
  });
});
