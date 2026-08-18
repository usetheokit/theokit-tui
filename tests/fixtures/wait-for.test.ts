import { describe, expect, it } from "vitest";

import { waitFor } from "./wait-for.js";

// B-033 T1.1 — waiting for a CONDITION instead of for a number of milliseconds.
//
// The defect this replaces: 13 test files await a fixed duration and then assert, which encodes
// "the effect completes within N ms". Measured 2026-08-18 — the run of `run_validation.py`
// immediately after B-020's fix landed:
//
//   tests/contract/public-api.integration.test.tsx:103
//     expect(onSubmit).toHaveBeenCalledWith("hey")  ->  Number of calls: 0
//
// It writes to stdin, sleeps 50 ms, asserts. It passes in isolation (18/18) and fails inside a
// loaded gate, which is the same shape B-020 fixed for `renderFrame` — except these sites wait on
// REAL round trips, so freezing the clock would prevent the very thing being awaited.
//
// The helper's value is entirely in behaviour that is invisible when it passes: that it stops as
// soon as the condition holds, and that its failure says what never happened. Both are asserted
// here, before it exists.

describe("waitFor (B-033 T1.1)", () => {
  it("test_waitFor_returns_as_soon_as_the_condition_holds", async () => {
    let attempts = 0;
    await waitFor(
      () => {
        attempts += 1;
        return true;
      },
      { describe: "an already-satisfied condition" },
    );

    // An already-true predicate must not cost a poll interval. A sleeping wait always costs its
    // full duration; this is the half of the trade that makes the suite FASTER on an idle machine.
    expect(attempts).toBe(1);
  });

  it("test_waitFor_resolves_for_an_already_true_predicate", async () => {
    const result = await waitFor(() => true, { describe: "trivially true" });
    expect(result).toBeUndefined();
  });

  it("test_waitFor_succeeds_when_the_condition_becomes_true_late", async () => {
    let ready = false;
    setTimeout(() => {
      ready = true;
    }, 30);

    // The point of the helper: it does not need to know that 30 ms is the number. On a loaded
    // machine this takes longer and still passes, which a fixed 30 ms wait would not.
    await waitFor(() => ready, { describe: "the late flag to flip" });
    expect(ready).toBe(true);
  });

  it("test_waitFor_fails_naming_what_never_happened", async () => {
    let message = "";
    try {
      await waitFor(() => false, {
        describe: "the submit handler to fire",
        timeoutMs: 50,
      });
    } catch (err) {
      message = (err as Error).message;
    }

    // `.claude/rules/error-handling.md` § 5 bans the generic message, and "timeout" is the generic
    // message of a polling helper. The existing `waitForFrame` in chat-composer.test.tsx already
    // names what it wanted and what it got; this generalises that.
    expect(message).toContain("the submit handler to fire");
    expect(message).toMatch(/\d+ ?ms/);
  });

  it("test_waitFor_propagates_a_predicate_error", async () => {
    // A predicate that throws is a broken test, not a slow one. Converting it into a timeout would
    // report "the condition never held" and hide a TypeError — the swallow this repo keeps finding.
    await expect(
      waitFor(
        () => {
          throw new Error("boom");
        },
        { describe: "a predicate that throws" },
      ),
    ).rejects.toThrow("boom");
  });
});
