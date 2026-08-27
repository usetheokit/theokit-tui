import { describe, expect, it } from "vitest";

import { TurnDone, WHIMSY_VERBS, whimsyVerb } from "../../src/agent/turn-done.js";
import { stripAnsi } from "../../src/format/ansi.js";
import { renderFrame } from "../../tests/fixtures/helpers.js";

/**
 * #62 item 1 — the line a finished turn leaves behind.
 *
 * What is pinned here is that it is STATIC and DETERMINISTIC. Both are load-bearing: this row is
 * meant to graduate into `<Static>`, which is already-printed terminal scrollback, so a row whose
 * text can change after mount would disagree with what the terminal shows.
 */

const frameOf = async (element: Parameters<typeof renderFrame>[0]) =>
  stripAnsi(await renderFrame(element)).trim();

describe("TurnDone", () => {
  it("test_renders_the_glyph_verb_and_elapsed", async () => {
    expect(await frameOf(<TurnDone seconds={5} verb="Baked" />)).toBe("✻  Baked for 5s");
  });

  it("test_the_default_verb_is_a_function_of_the_duration", async () => {
    // Same duration, same word — twice, from two independent renders. A random pick would
    // eventually disagree with itself, and in scrollback that disagreement is permanent.
    const first = await frameOf(<TurnDone seconds={7} />);
    const second = await frameOf(<TurnDone seconds={7} />);
    expect(first).toBe(second);
    expect(first).toContain(whimsyVerb(7));
  });

  it("test_different_durations_get_different_words", async () => {
    // Anti-vacuity for the test above: a constant verb would also be "deterministic".
    const words = new Set([0, 1, 2, 3].map((s) => whimsyVerb(s)));
    expect(words.size).toBe(4);
  });

  it("test_an_explicit_verb_wins_over_the_default", async () => {
    // The whimsy is the app's voice; a library that hardcoded it would put its personality in
    // every consumer's product.
    expect(await frameOf(<TurnDone seconds={7} verb="Deployed" />)).toContain("Deployed for");
  });

  it("test_the_verb_index_wraps_instead_of_running_off_the_table", async () => {
    const long = whimsyVerb(WHIMSY_VERBS.length * 3 + 1);
    expect(WHIMSY_VERBS).toContain(long);
    expect(long).toBe(WHIMSY_VERBS[1]);
  });

  it("test_a_fractional_duration_still_lands_on_a_verb", async () => {
    // Elapsed time arrives as a float more often than not.
    expect(WHIMSY_VERBS).toContain(whimsyVerb(3.7));
  });

  it("test_a_negative_duration_throws_at_the_boundary", () => {
    // Fail-fast at the prop rather than rendering "Baked for -3s". `renderFrame` is not used
    // because ink's error boundary swallows render-time throws.
    expect(() => TurnDone({ seconds: -3 })).toThrow(/seconds must be >= 0/);
  });

  it("test_a_non_finite_duration_throws_too", () => {
    expect(() => TurnDone({ seconds: Number.NaN })).toThrow(/seconds must be >= 0/);
  });
});
