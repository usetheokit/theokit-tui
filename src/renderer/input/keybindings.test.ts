import { describe, expect, it } from "vitest";

import { chordOf, defaultKeymap, resolveAction } from "./keybindings.js";
import { projectKey } from "./key.js";

// M19 T2.1 (plan m19-input-stack, ADR from blueprint §4): the remappable emacs
// keybindings registry — chord → action. `chordOf(input, key)` builds a chord
// string; `resolveAction(keymap, chord)` looks up the bound action.

describe("keybindings (M19 T2.1)", () => {
  it("chord_of_builds_ctrl_and_alt_and_arrow_chords", () => {
    expect(chordOf(...tuple("\x17"))).toBe("ctrl+w"); // Ctrl+W
    expect(chordOf(...tuple("\x1bf"))).toBe("alt+f"); // Alt+F
    expect(chordOf(...tuple("\x1b[D"))).toBe("left"); // Left arrow
    expect(chordOf(...tuple("\x7f"))).toBe("backspace");
  });

  it("default_keymap_has_emacs_bindings", () => {
    expect(resolveAction(defaultKeymap, "ctrl+w")).toBe("delete-word-back");
    expect(resolveAction(defaultKeymap, "ctrl+u")).toBe("delete-to-line-start");
    expect(resolveAction(defaultKeymap, "ctrl+k")).toBe("delete-to-line-end");
    expect(resolveAction(defaultKeymap, "alt+f")).toBe("move-word-forward");
    expect(resolveAction(defaultKeymap, "alt+b")).toBe("move-word-back");
    expect(resolveAction(defaultKeymap, "ctrl+a")).toBe("move-line-start");
    expect(resolveAction(defaultKeymap, "ctrl+e")).toBe("move-line-end");
  });

  it("unbound_chord_resolves_to_undefined", () => {
    expect(resolveAction(defaultKeymap, "ctrl+z")).toBeUndefined();
  });

  it("keymap_is_remappable", () => {
    const custom = new Map(defaultKeymap);
    custom.set("ctrl+w", "move-line-start"); // override
    expect(resolveAction(custom, "ctrl+w")).toBe("move-line-start");
    // The default is unchanged (a copy, not a mutation).
    expect(resolveAction(defaultKeymap, "ctrl+w")).toBe("delete-word-back");
  });

  it("plain_printable_char_has_no_chord", () => {
    // A printable key ("a") is not a chord — it inserts, not commands.
    expect(chordOf(...tuple("a"))).toBeUndefined();
  });
});

/** Helper: project a raw sequence into the (input, key) tuple chordOf expects. */
function tuple(
  sequence: string,
): [string, ReturnType<typeof projectKey>["key"]] {
  const { input, key } = projectKey(sequence);
  return [input, key];
}

/**
 * Home/End are chords in their own right, like the arrows. They resolve to the SAME actions
 * ctrl+a/ctrl+e already resolve to — no new action, no new reducer case: the capability was built
 * and only the keys were missing (TheoCode B-068).
 */
describe("Home and End are named chords", () => {
  it("home_and_end_build_their_own_chords", () => {
    expect(chordOf("", projectKey("\x1b[H").key)).toBe("home");
    expect(chordOf("", projectKey("\x1b[F").key)).toBe("end");
  });

  it("home_and_end_are_bound_to_the_line_motions", () => {
    expect(resolveAction(defaultKeymap, "home")).toBe("move-line-start");
    expect(resolveAction(defaultKeymap, "end")).toBe("move-line-end");
  });

  it("the_emacs_equivalents_keep_working", () => {
    // The floor: binding the named keys must not displace ctrl+a/ctrl+e, which are the only way
    // to reach these motions on a terminal that sends no Home/End at all.
    expect(resolveAction(defaultKeymap, "ctrl+a")).toBe("move-line-start");
    expect(resolveAction(defaultKeymap, "ctrl+e")).toBe("move-line-end");
  });
});
