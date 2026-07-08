import { render } from "ink-testing-library";
import { homedir } from "node:os";
import { describe, expect, it } from "vitest";

import { AppStatusBar } from "./app-status-bar.js";
import { TheoTUIProvider, themes } from "./theme.js";

// M14 T1.2 (plan m14-status-bar, ADR D1): the slot row oracles — order,
// separator emission between PRESENT slots only, width priority, degrade.
// Snapshot budget for the milestone: <= 2, both here, both anchored.

// eslint-disable-next-line no-control-regex
const ANSI_RE = /\u001B\[[0-9;]*m/g;
const stripAnsi = (value: string): string => value.replace(ANSI_RE, "");

function renderBar(element: React.ReactElement): string {
  const instance = render(element);
  const frame = instance.lastFrame() ?? "";
  instance.unmount();
  return frame;
}

const FULL = (
  <AppStatusBar
    model="gpt-x"
    cwd="/tmp/demo/project"
    tokens={{ used: 12300, limit: 128000 }}
    state="streaming"
  />
);

describe("AppStatusBar (M14 T1.2)", () => {
  it("all_slots_render_in_order_with_separators", () => {
    const frame = stripAnsi(renderBar(FULL));
    const iModel = frame.indexOf("gpt-x");
    const iCwd = frame.indexOf("project");
    const iTokens = frame.indexOf("12.3k");
    const iState = frame.indexOf("streaming");
    expect(iModel).toBeGreaterThanOrEqual(0);
    expect(iModel).toBeLessThan(iCwd);
    expect(iCwd).toBeLessThan(iTokens);
    expect(iTokens).toBeLessThan(iState);
    const seps = frame.split("·").length - 1;
    expect(seps).toBe(3);
  });

  it("missing_slots_emit_no_dangling_separator", () => {
    // EC-1: only model + state ⇒ exactly ONE separator, never "· ·".
    const frame = stripAnsi(
      renderBar(<AppStatusBar model="gpt-x" state="idle" />),
    );
    const seps = frame.split("·").length - 1;
    expect(seps).toBe(1);
    expect(frame).not.toContain("· ·");
    expect(frame).not.toMatch(/^\s*·/);
    expect(frame).not.toMatch(/·\s*$/);
  });

  it("single_slot_renders_bare", () => {
    const frame = stripAnsi(renderBar(<AppStatusBar state="idle" />));
    expect(frame.trim()).toBe("idle");
  });

  it("tokens_render_compacted", () => {
    const frame = stripAnsi(
      renderBar(<AppStatusBar tokens={{ used: 12300, limit: 128000 }} />),
    );
    expect(frame).toContain("12.3k/128k");
  });

  it("cwd_tildeifies_home_prefix", () => {
    const frame = stripAnsi(
      renderBar(<AppStatusBar cwd={`${homedir()}/work/repo`} />),
    );
    expect(frame).toContain("~/work/repo");
    expect(frame).not.toContain(homedir());
  });

  it("narrow_width_keeps_cwd_tail_and_state_intact", () => {
    // EC-3: the cwd slot shrinks (truncate-start keeps the TAIL); state
    // never truncates.
    const instance = render(
      <AppStatusBar
        model="m"
        cwd="/very/long/path/that/will/not/fit/at/thirty/columns/repo-name"
        state="idle"
      />,
    );
    Object.defineProperty(instance.stdout, "columns", { get: () => 30 });
    instance.rerender(
      <AppStatusBar
        key="narrow"
        model="m"
        cwd="/very/long/path/that/will/not/fit/at/thirty/columns/repo-name"
        state="idle"
      />,
    );
    const frame = stripAnsi(instance.lastFrame() ?? "");
    instance.unmount();
    expect(frame).toContain("repo-name");
    expect(frame).toContain("idle");
  });

  it("monochrome_theme_keeps_separators_drops_color", () => {
    const instance = render(
      <TheoTUIProvider theme={themes["no-color"]}>{FULL}</TheoTUIProvider>,
    );
    const frame = instance.lastFrame() ?? "";
    instance.unmount();
    const colorSgr = frame.match(
      // eslint-disable-next-line no-control-regex
      /\u001B\[(3[0-8]|4[0-8]|9[0-7]|10[0-7])m/g,
    );
    expect(colorSgr).toBeNull();
    expect(stripAnsi(frame)).toContain("·");
    expect(frame).toMatchSnapshot("status-bar-monochrome");
  });

  it("full_bar_scene_snapshot", () => {
    const frame = renderBar(FULL);
    expect(frame).toContain("gpt-x");
    expect(frame).toMatchSnapshot("status-bar-full");
  });

  it("invalid_tokens_throw_typed", () => {
    // Negative case (testing.md § 4.1): fail-fast with a typed error.
    const bad = () => AppStatusBar({ tokens: { used: -1, limit: 0 } });
    expect(bad).toThrow(TypeError);
    expect(bad).toThrow(/AppStatusBar/);
  });
});
