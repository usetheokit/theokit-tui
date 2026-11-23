import { describe, expect, it } from "vitest";
import { agentKeyLayers } from "../../src/keys/index.js";
import { routeThroughLayers } from "../../src/keys/layer-router.js";

function setup(streaming: boolean) {
  const calls: string[] = [];
  let t = 0;
  const ctl = { streaming };
  const layers = agentKeyLayers({
    isStreaming: () => ctl.streaming,
    interrupt: () => calls.push("interrupt"),
    exit: () => calls.push("exit"),
    now: () => t,
  });
  const press = (key: string) => routeThroughLayers(layers, key, { key });
  return { calls, press, ctl, advance: (ms: number) => (t += ms) };
}

describe("agentKeyLayers", () => {
  it("escape_while_streaming_interrupts_once", () => {
    const s = setup(true);
    s.press("escape");
    expect(s.calls).toEqual(["interrupt"]);
  });

  it("escape_while_idle_does_nothing_and_falls_through", () => {
    const s = setup(false);
    expect(s.press("escape").layer).toBeNull();
    expect(s.calls).toEqual([]);
  });

  it("second_ctrl_c_within_window_exits", () => {
    const s = setup(true);
    s.press("ctrl+c");
    s.advance(500);
    s.press("ctrl+c");
    expect(s.calls).toEqual(["interrupt", "exit"]);
  });

  it("idle_first_ctrl_c_only_arms", () => {
    const s = setup(false);
    s.press("ctrl+c");
    expect(s.calls).toEqual([]);
    s.press("ctrl+c");
    expect(s.calls).toEqual(["exit"]);
  });

  it("ctrl_c_after_window_re_arms_instead_of_exiting", () => {
    const s = setup(false);
    s.press("ctrl+c");
    s.advance(5000);
    s.press("ctrl+c");
    expect(s.calls).toEqual([]);
  });

  it("other_keys_fall_through", () => {
    expect(setup(true).press("a").layer).toBeNull();
  });

  it("overlays_claim_keys_before_the_preset", () => {
    const calls: string[] = [];
    const layers = agentKeyLayers({
      isStreaming: () => true,
      interrupt: () => calls.push("interrupt"),
      exit: () => calls.push("exit"),
      overlays: [{ name: "gate", when: () => true, route: () => [] }],
    });
    expect(routeThroughLayers(layers, "escape", { key: "escape" }).layer).toBe("gate");
    expect(calls).toEqual([]);
  });
});
