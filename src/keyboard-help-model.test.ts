/**
 * T3.4 — the keyboard-help list, derived from what the surface can actually do.
 *
 * The footer that reads `↑/↓ navigate · enter select · esc cancel` was a hand-written literal in
 * every product, sitting next to the key handler it is supposed to describe. Nothing keeps the two
 * in step, so the failure is silent and one-directional: a shortcut is removed or rebound and the
 * help keeps advertising it. The user presses the advertised key and nothing happens.
 *
 * Deriving the list from the same capability declarations the surface binds means the help cannot
 * describe a key that is not bound — not because someone remembered, but because there is nothing
 * to derive it from.
 */
import { describe, expect, it } from "vitest";

import { keyboardHelpFor } from "./keyboard-help-model.js";

describe("keyboardHelpFor", () => {
  it("test_a_capability_with_a_bound_key_is_listed", () => {
    expect(
      keyboardHelpFor([{ id: "select", label: "select", key: "enter" }]),
    ).toEqual([{ key: "enter", label: "select" }]);
  });

  it("test_a_capability_with_no_bound_key_is_omitted_not_rendered_blank", () => {
    // The whole point. A row reading "  cancel" with an empty key column tells the user a shortcut
    // exists and refuses to say which — worse than not mentioning it.
    const help = keyboardHelpFor([
      { id: "select", label: "select", key: "enter" },
      { id: "cancel", label: "cancel" },
    ]);
    expect(help).toEqual([{ key: "enter", label: "select" }]);
  });

  it("test_a_capability_with_a_blank_key_is_omitted_too", () => {
    // `key: ""` is the same absence wearing a different type, and it is what a config file produces.
    expect(keyboardHelpFor([{ id: "a", label: "go", key: "   " }])).toEqual([]);
  });

  it("test_a_disabled_capability_is_omitted", () => {
    // A surface that turns a capability off for this state must not keep advertising its key —
    // that is the same lie as an unbound one, arriving later.
    const help = keyboardHelpFor([
      { id: "select", label: "select", key: "enter" },
      { id: "delete", label: "delete", key: "d", enabled: false },
    ]);
    expect(help.map((h) => h.key)).toEqual(["enter"]);
  });

  it("test_declaration_order_is_preserved", () => {
    // The order is the surface's editorial decision — which shortcut matters most here. Sorting it
    // alphabetically would silently overrule that.
    const help = keyboardHelpFor([
      { id: "z", label: "last", key: "z" },
      { id: "a", label: "first", key: "a" },
    ]);
    expect(help.map((h) => h.label)).toEqual(["last", "first"]);
  });

  it("test_several_capabilities_sharing_a_key_are_all_listed", () => {
    // Not this model's business to arbitrate: context-dependent bindings are legitimate, and a
    // model that silently dropped one would hide a genuine conflict from the author.
    const help = keyboardHelpFor([
      { id: "a", label: "accept", key: "enter" },
      { id: "b", label: "submit", key: "enter" },
    ]);
    expect(help).toHaveLength(2);
  });

  it("test_an_empty_capability_list_yields_an_empty_help_list", () => {
    expect(keyboardHelpFor([])).toEqual([]);
  });

  it("test_the_result_does_not_alias_the_input", () => {
    const capabilities = [{ id: "a", label: "go", key: "g" }];
    const help = keyboardHelpFor(capabilities);
    expect(help[0]).not.toBe(capabilities[0]);
  });
});
