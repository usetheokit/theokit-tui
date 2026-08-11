/**
 * Modal keypress routing — B-104's second slice, and the one deferred until the design held up.
 *
 * A terminal agent has several things on screen at once: a help panel, a running turn, a confirmation
 * gate, a login flow, a composer. Ctrl-C and Escape mean something different in each, and the code
 * that decides is invariably a hand-written if-chain whose ORDER is the whole contract and is written
 * nowhere. The bug class is quiet by nature — the key appears to do nothing, or does the other thing.
 *
 * The mechanism is generic and the vocabulary is not. Which states exist, which keys matter and what
 * the actions are belong entirely to the product; they arrive as type parameters and as data. What
 * the framework owns is: layers are tried in DECLARED order, the first whose `when` holds claims the
 * key exclusively, and the result says WHICH layer claimed it.
 *
 * That last part is why this is worth extracting rather than left as an if-chain. Naming the claiming
 * layer makes precedence observable — and precedence that cannot be observed cannot be tested, which
 * is exactly what a sibling router in the consumer turned out to suffer from: three mutations
 * reordering its chain left every case green.
 */

import { describe, expect, it } from "vitest";

import { routeThroughLayers, type KeyLayer } from "./layer-router.js";

interface State {
  readonly helpOpen: boolean;
  readonly streaming: boolean;
  readonly locked: boolean;
}

type Action = "close-help" | "interrupt" | "type";

const LAYERS: readonly KeyLayer<State, string, Action>[] = [
  // Claims and produces nothing: the key is swallowed, deliberately.
  { name: "locked", when: (s) => s.locked, route: () => [] },
  { name: "help", when: (s) => s.helpOpen, route: () => ["close-help"] },
  { name: "turn", when: (s) => s.streaming, route: () => ["interrupt"] },
  { name: "composer", when: () => true, route: () => ["type"] },
];

const IDLE: State = { helpOpen: false, streaming: false, locked: false };

describe("routeThroughLayers — the first claiming layer wins", () => {
  it("test_the_only_matching_layer_routes_the_key", () => {
    const out = routeThroughLayers(LAYERS, "esc", { ...IDLE, helpOpen: true });

    expect(out.layer).toBe("help");
    expect(out.actions).toEqual(["close-help"]);
  });

  it("test_an_earlier_layer_outranks_a_later_one_that_also_matches", () => {
    // The reason order is declared rather than incidental: both `help` and `turn` match here, and
    // which one answers is a product decision that must not depend on how the code was typed.
    const out = routeThroughLayers(LAYERS, "esc", { ...IDLE, helpOpen: true, streaming: true });

    expect(out.layer).toBe("help");
    expect(out.actions).toEqual(["close-help"]);
  });

  it("test_reordering_the_layers_changes_the_answer", () => {
    // Anti-vacuity for the case above, and the property that makes precedence OBSERVABLE: if order
    // did not matter, both cases would pass while the contract was unenforced.
    const reordered = [LAYERS[2]!, LAYERS[1]!, LAYERS[3]!];
    const out = routeThroughLayers(reordered, "esc", { ...IDLE, helpOpen: true, streaming: true });

    expect(out.layer).toBe("turn");
    expect(out.actions).toEqual(["interrupt"]);
  });

  it("test_a_later_layer_answers_when_no_earlier_one_matches", () => {
    const out = routeThroughLayers(LAYERS, "a", IDLE);

    expect(out.layer).toBe("composer");
    expect(out.actions).toEqual(["type"]);
  });
});

describe("routeThroughLayers — claiming and producing nothing are different", () => {
  it("test_a_layer_that_claims_and_returns_no_action_still_consumes_the_key", () => {
    // The swallow case, and the one an if-chain gets wrong. A confirmation gate or a login flow must
    // absorb Ctrl-C rather than let the composer see it — and "absorbed" is not "unhandled".
    const out = routeThroughLayers(LAYERS, "c", { ...IDLE, locked: true, helpOpen: true });

    expect(out.layer, "the key fell through a layer that was supposed to swallow it").toBe("locked");
    expect(out.actions).toEqual([]);
  });

  it("test_no_layer_matching_is_reported_as_unclaimed_rather_than_as_an_empty_claim", () => {
    // A caller that logs unhandled keys needs to tell these apart. Collapsing them is how a
    // swallowed key becomes indistinguishable from a missing binding.
    const out = routeThroughLayers([LAYERS[1]!], "a", IDLE);

    expect(out.layer).toBeNull();
    expect(out.actions).toEqual([]);
  });
});

describe("routeThroughLayers — what the layers are given", () => {
  it("test_a_layer_routes_using_both_the_key_and_the_state", () => {
    const layers: readonly KeyLayer<State, string, Action>[] = [
      { name: "composer", when: () => true, route: (k, s) => (k === "c" && s.streaming ? ["interrupt"] : ["type"]) },
    ];

    expect(routeThroughLayers(layers, "c", { ...IDLE, streaming: true }).actions).toEqual(["interrupt"]);
    expect(routeThroughLayers(layers, "c", IDLE).actions).toEqual(["type"]);
  });

  it("test_a_layer_that_does_not_claim_is_never_asked_to_route", () => {
    // `route` may be expensive or may assume the layer's own preconditions. Calling it on a layer
    // whose `when` said no would run code in a state it never expects.
    let routed = 0;
    const layers: readonly KeyLayer<State, string, Action>[] = [
      { name: "never", when: () => false, route: () => { routed += 1; return []; } },
      { name: "composer", when: () => true, route: () => ["type"] },
    ];

    routeThroughLayers(layers, "a", IDLE);
    expect(routed).toBe(0);
  });

  it("test_no_layer_after_the_claiming_one_is_consulted", () => {
    let consulted = 0;
    const layers: readonly KeyLayer<State, string, Action>[] = [
      { name: "first", when: () => true, route: () => ["type"] },
      { name: "second", when: () => { consulted += 1; return true; }, route: () => [] },
    ];

    routeThroughLayers(layers, "a", IDLE);
    expect(consulted).toBe(0);
  });
});

describe("routeThroughLayers — degenerate input", () => {
  it("test_no_layers_at_all_is_unclaimed_rather_than_a_throw", () => {
    expect(routeThroughLayers([], "a", IDLE)).toEqual({ layer: null, actions: [] });
  });

  it("test_the_returned_actions_are_a_snapshot_of_what_the_layer_produced", () => {
    // The caller may hold the result while the layer's own array is reused across presses; a view
    // would answer with a later keypress's actions.
    const produced: Action[] = ["type"];
    const layers: readonly KeyLayer<State, string, Action>[] = [
      { name: "composer", when: () => true, route: () => produced },
    ];

    const out = routeThroughLayers(layers, "a", IDLE);
    produced.push("interrupt");

    expect(out.actions).toEqual(["type"]);
  });
});
