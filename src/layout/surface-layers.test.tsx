import { Text } from "ink";
import { describe, expect, it, vi } from "vitest";

import { type SurfaceLayer, selectSurface } from "./surface-layers.js";

interface State {
  readonly gated: boolean;
  readonly asking: boolean;
}

// B-007 (plan b007-surface-layers, ADRs D1-D3): the render twin of the key router.
describe("selectSurface", () => {
  it("the_first_matching_layer_claims_and_later_predicates_are_not_evaluated", () => {
    const secondPredicate = vi.fn(() => true);
    const layers: readonly SurfaceLayer<State>[] = [
      { name: "gate", when: (s) => s.gated, render: () => <Text>gate</Text> },
      { name: "question", when: secondPredicate, render: () => <Text>q</Text> },
    ];
    const selected = selectSurface(layers, { gated: true, asking: true });
    expect(selected.layer).toBe("gate");
    // Exclusive: a later layer is not consulted at all, so its predicate never runs. This is what
    // makes the LIST the contract — reading it top to bottom answers "what owns the input line?".
    expect(secondPredicate).not.toHaveBeenCalled();
  });

  // EC-1 — a thunk makes "the loser did not render" trivially true, so the assertion is narrower:
  // ZERO renders at selection time, exactly one after calling it, and that one is the winner's.
  it("selection_invokes_no_render_and_the_thunk_invokes_exactly_the_winners", () => {
    const winner = vi.fn(() => <Text>win</Text>);
    const loser = vi.fn(() => <Text>lose</Text>);
    const layers: readonly SurfaceLayer<State>[] = [
      { name: "loser", when: () => false, render: loser },
      { name: "winner", when: () => true, render: winner },
    ];

    const selected = selectSurface(layers, { gated: false, asking: false });
    expect(winner).not.toHaveBeenCalled();
    expect(loser).not.toHaveBeenCalled();

    selected.render();
    expect(winner).toHaveBeenCalledTimes(1);
    expect(loser).not.toHaveBeenCalled();
  });

  it("no_matching_layer_yields_a_null_claimant_and_renders_nothing", () => {
    const layers: readonly SurfaceLayer<State>[] = [
      { name: "gate", when: () => false, render: () => <Text>gate</Text> },
    ];
    const selected = selectSurface(layers, { gated: false, asking: false });
    expect(selected.layer).toBeNull();
    expect(selected.render()).toBeNull();
  });

  it("an_empty_layer_list_matches_the_no_layer_case", () => {
    const selected = selectSurface<State>([], { gated: true, asking: true });
    expect(selected.layer).toBeNull();
    expect(selected.render()).toBeNull();
  });

  // EC-2 — the key router has the same exposure and does not guard it. Asserting the throw
  // propagates makes the behaviour chosen rather than inherited (error-handling.md § 2).
  it("a_throwing_predicate_propagates", () => {
    const layers: readonly SurfaceLayer<State>[] = [
      {
        name: "broken",
        when: () => {
          throw new TypeError("state was not ready");
        },
        render: () => <Text>never</Text>,
      },
    ];
    expect(() => selectSurface(layers, { gated: false, asking: false })).toThrow(TypeError);
  });
});
