import { beforeEach, describe, expect, it } from "vitest";

import { assertValidEvents, resetIncrementalValidation } from "../src/agent/agent-timeline.js";

const ev = (id: string, text: string) =>
  ({ id, kind: "message", role: "assistant", text }) as never;
const bad = (id: string) => ({ id, kind: "does-not-exist", role: "assistant", text: "x" }) as never;

/**
 * M92 T5.1 — incremental validation **must not** stop catching invalid input.
 *
 * `assertValidEvents` now validates only the tail when the new array is a prefix extension of the
 * previous one — the history frozen in `<Static>` does not change, and re-sweeping it per render is
 * O(N) per token over data the structure guarantees immutable.
 *
 * The risk of the optimisation is this file: a validation that got fast by **no longer validating**
 * is worse than the slowness. Hence the fallback (an array that is not an extension → full sweep),
 * and hence every path being exercised with invalid input.
 *
 * Testing through a render does not work, and that was measured: the throw happens inside the render
 * and ink does not propagate it — `renderFrame` of an invalid event **resolves**. The function is
 * exported so the proof can exist.
 */
describe("M92 — assertValidEvents on both paths", () => {
  beforeEach(() => {
    resetIncrementalValidation();
  });

  it("EXTENSION — a duplicate id in the tail is still caught", () => {
    assertValidEvents([ev("a", "one")]);
    expect(() => assertValidEvents([ev("a", "one"), ev("a", "two")])).toThrow(/duplicate event id/);
  });

  it("EXTENSION — an unknown kind in the tail is still caught", () => {
    assertValidEvents([ev("b1", "one")]);
    expect(() => assertValidEvents([ev("b1", "one"), bad("b2")])).toThrow(/unknown event kind/);
  });

  it("NON-EXTENSION — an invalid event in the MIDDLE falls back and is still caught", () => {
    assertValidEvents([ev("c1", "one"), ev("c2", "two")]);
    // A completely different array: not an extension, so the full sweep has to run.
    expect(() => assertValidEvents([bad("d1"), ev("d2", "three")])).toThrow(/unknown event kind/);
  });

  it("NON-EXTENSION — a duplicate in the middle of a new array is still caught", () => {
    assertValidEvents([ev("e1", "one")]);
    expect(() => assertValidEvents([ev("x", "a"), ev("x", "b")])).toThrow(/duplicate event id/);
  });

  it("a valid EXTENSION is NOT rejected — the optimisation does not break the legitimate case", () => {
    assertValidEvents([ev("f1", "one")]);
    expect(() => assertValidEvents([ev("f1", "one"), ev("f2", "two")])).not.toThrow();
  });

  it("after a REJECTION, the invalid array does NOT become a trusted prefix", () => {
    // The SAME array reference in both calls — which is what React does on a re-render with no change.
    //
    // The first version of this test created two distinct literals, and for that reason COULD NOT
    // fail: different identities are never a prefix extension, so the fallback ran and the invalid
    // event was caught by the wrong path. The mutant "record the prefix before validating" survived,
    // and only the mutation showed it.
    const good = ev("g1", "one");
    const invalidArray = [good, bad("g2")];
    assertValidEvents([good]);
    expect(() => assertValidEvents(invalidArray)).toThrow();
    // If the array that threw had become the prefix, this call would skip the check that just
    // failed — the tail would be empty and nothing would be validated.
    expect(() => assertValidEvents(invalidArray)).toThrow(/unknown event kind/);
  });

  it("SHRINKING the array is not an extension — it falls back", () => {
    assertValidEvents([ev("h1", "one"), ev("h2", "two")]);
    expect(() => assertValidEvents([bad("h1")])).toThrow(/unknown event kind/);
  });
});

/**
 * Issue #58 — `explored` is a PUBLIC member of the union (and exported), so a direct consumer of
 * `AgentTimeline` (without going through `messagesToAgentEvents`) reaches this path. Before, the
 * event fell outside every check: nested ids did not enter the duplicate set (React complained about
 * a duplicate `key` mid-render, where ink's error boundary swallows the throw), `tools: []` rendered
 * a bare "Explored (0)" header, and status/exclusivity/maxLines of the nested entries passed freely —
 * contradicting the contract documented on the props ("unique ids (duplicates throw)").
 */
const tool = (id: string, extra: Record<string, unknown> = {}) =>
  ({
    id,
    kind: "tool",
    name: "read_file",
    status: "success",
    ...extra,
  }) as never;
const explored = (id: string, tools: unknown[]) => ({ id, kind: "explored", tools }) as never;

describe("issue #58 — assertValidEvents descends into 'explored' events", () => {
  beforeEach(() => {
    resetIncrementalValidation();
  });

  it("a duplicate nested id inside the SAME block throws", () => {
    expect(() => assertValidEvents([explored("e1", [tool("t1"), tool("t1")])])).toThrow(
      /duplicate event id "t1"/,
    );
  });

  it("a nested id colliding with a TOP-LEVEL id throws", () => {
    // The id set is shared: nested and top level live in the same namespace.
    expect(() => assertValidEvents([ev("t1", "one"), explored("e1", [tool("t1")])])).toThrow(
      /duplicate event id "t1"/,
    );
  });

  it("an empty 'explored' block throws instead of rendering 'Explored (0)'", () => {
    expect(() => assertValidEvents([explored("e1", [])])).toThrow(/at least one/);
  });

  it("an invalid status on a nested entry throws", () => {
    // `not-a-status` must stay OUTSIDE `TOOL_CALL_STATUSES` (pending/running/success/failed).
    // The Portuguese original used "pendente", and translating it to "pending" made the fixture
    // VALID — the test then asserted a throw that could never happen. Whoever edits this line next:
    // the value has to be one the union rejects, or this test stops testing anything.
    expect(() =>
      assertValidEvents([explored("e1", [tool("t1", { status: "not-a-status" })])]),
    ).toThrow(/invalid status/);
  });

  it("output/shell/diff exclusivity applies to nested entries", () => {
    expect(() =>
      assertValidEvents([explored("e1", [tool("t1", { output: "x", diff: "y" })])]),
    ).toThrow(/only one of/);
  });

  it("an invalid maxLines on a nested entry throws", () => {
    expect(() => assertValidEvents([explored("e1", [tool("t1", { maxLines: 0 })])])).toThrow(
      /maxLines must be an integer/,
    );
  });

  it("a valid 'explored' block is NOT rejected", () => {
    expect(() => assertValidEvents([explored("e1", [tool("t1"), tool("t2")])])).not.toThrow();
  });

  it("EXTENSION — nested ids from the prefix stay reserved in the tail", () => {
    // M92's optimisation reuses the id set from the previous render. If nested ids did not enter it,
    // an id already used inside a frozen block would become acceptable again at the top level.
    const block = explored("e1", [tool("t1")]);
    assertValidEvents([block]);
    expect(() => assertValidEvents([block, ev("t1", "collides")])).toThrow(
      /duplicate event id "t1"/,
    );
  });
});
