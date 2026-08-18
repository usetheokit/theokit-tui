import { describe, expect, it } from "vitest";

import { messagesToAgentEvents } from "../src/agent/messages-to-events.js";

const msg = (id: string, text: string) => ({
  id,
  role: "assistant" as const,
  parts: [{ type: "text" as const, text }],
});

/**
 * M92 T5.1 — `assertValidEvents` stops re-scanning the history on every render.
 *
 * The function swept the whole array **per render**, including the lines already frozen in
 * `<Static>` — which by construction do not change. In a long session that is O(N) work per token
 * over immutable data.
 *
 * Validation is internal to the module (not exported), so what these tests exercise is the
 * observable behaviour: rendering a prefix extension keeps accepting the valid case and **keeps
 * rejecting the invalid one** — which is the half the fallback exists to guarantee. A validation
 * optimisation that stopped catching an invalid case would be worse than the slowness.
 */
describe("M92 — the derivation is incremental (DoD item 4)", () => {
  /**
   * Comparing `id` was NOT a gate — and the M92 review measured exactly that.
   *
   * The first version of these tests asserted `b[0]!.id === a[0]!.id`. Ids are derived from
   * `(message.id, part index)`, so they **pass with no cache at all**: two freshly allocated objects
   * carry the same id. DoD item 4 was left unimplemented and the test stayed green regardless.
   *
   * What proves the cache is **referential identity** (`toBe`), and that is the part that matters:
   * without stable objects, item 5's `assertValidEvents` never detects a prefix extension — the
   * review measured the fast path firing on **0 of 5 renders**. The two items are one mechanism seen
   * from two sides.
   */
  it("the SAME message returns the SAME event by identity — not merely the same id", () => {
    const m = msg("m1", "hello");
    const a = messagesToAgentEvents([m]);
    const b = messagesToAgentEvents([m]);
    expect(b[0]).toBe(a[0]);
  });

  it("appending a message does NOT invalidate the earlier ones — which is what makes the extension detectable", () => {
    const m1 = msg("m1", "hello");
    const a = messagesToAgentEvents([m1]);
    const b = messagesToAgentEvents([m1, msg("m2", "world")]);
    expect(b[0]).toBe(a[0]);
    expect(b).toHaveLength(2);
  });

  it("a NEW message with different content produces a new event", () => {
    const m = {
      id: "m1",
      role: "assistant" as const,
      parts: [{ type: "text" as const, text: "a" }],
    };
    const a = messagesToAgentEvents([m]);
    const other = { ...m, parts: [{ type: "text" as const, text: "b" }] };
    const b = messagesToAgentEvents([other]);
    expect(b[0]).not.toBe(a[0]);
  });

  /**
   * The case that keying on PART identity exists to catch.
   *
   * The previous version of this test created a new object (`{ ...m, parts }`), so the `WeakMap`
   * missed the key anyway and the mutant "ignore part identity" **survived**. The real scenario is
   * different: the SAME message by reference with its parts array swapped — which is what a store
   * does while accumulating token deltas into a reused object.
   */
  it("the SAME message by reference with SWAPPED parts invalidates the cache", () => {
    const m: {
      id: string;
      role: "assistant";
      parts: { type: "text"; text: string }[];
    } = {
      id: "m1",
      role: "assistant",
      parts: [{ type: "text", text: "a" }],
    };
    const a = messagesToAgentEvents([m]);
    m.parts = [{ type: "text", text: "ab" }];
    const b = messagesToAgentEvents([m]);
    expect(b[0]).not.toBe(a[0]);
  });

  it("ids stay stable by (message id, part index)", () => {
    const events = messagesToAgentEvents([msg("m1", "hello")]);
    expect(events[0]!.id).toBe("m1::m0");
  });

  it("an empty thread returns an empty list — the base case of the extension", () => {
    expect(messagesToAgentEvents([])).toEqual([]);
  });
});

const read = (id: string, path: string) => ({
  type: "tool-read_file" as const,
  toolCallId: id,
  state: "output-available" as const,
  output: "x",
  input: { path },
});

/**
 * Issue #59 item 11 (F-tui-8) — an exploration run crossing the `<Static>` boundary.
 *
 * What graduation requires is that the already-frozen PREFIX does not change: stable ids and order
 * as the turn grows. These tests pin what was MEASURED, not what is assumed — and one of those
 * measurements became a separate issue: the `explored` object is rebuilt on every projection, so it
 * does NOT take part in M92's fast path (`events[i] === previous[i]`). See #66.
 */
describe("M92 + explored — prefix stability across graduation", () => {
  it("NESTED tools are stable by identity across projections", () => {
    // This is what per-message memoisation rests on: the block's content is not
    // reallocated, even when its wrapper is.
    const m1 = {
      id: "m1",
      role: "assistant" as const,
      parts: [read("c1", "a.ts"), read("c2", "b.ts")],
    };
    const a = messagesToAgentEvents([m1]);
    const b = messagesToAgentEvents([m1]);
    const at = (a[0] as unknown as { tools: unknown[] }).tools;
    const bt = (b[0] as unknown as { tools: unknown[] }).tools;
    expect(bt[0]).toBe(at[0]);
    expect(bt[1]).toBe(at[1]);
  });

  it("the OPEN run grows under the SAME id — the block does not split in two", () => {
    const m1 = {
      id: "m1",
      role: "assistant" as const,
      parts: [read("c1", "a.ts"), read("c2", "b.ts")],
    };
    const m2 = {
      id: "m2",
      role: "assistant" as const,
      parts: [read("c3", "c.ts")],
    };
    const p1 = messagesToAgentEvents([m1]);
    const p2 = messagesToAgentEvents([m1, m2]);
    expect(p1.map((e) => e.id)).toEqual(["explored-c1"]);
    expect(p2.map((e) => e.id)).toEqual(["explored-c1"]);
    expect((p2[0] as unknown as { tools: unknown[] }).tools).toHaveLength(3);
  });

  it("the explored block is STABLE by identity when its content did not change", () => {
    // Issue #66: the wrapper was a fresh literal on every projection, so M92's
    // prefix-extension check (`events[i] === previous[i]`) failed at the first
    // `explored` and EVERY render fell back to the full sweep — the very cost M92
    // exists to remove.
    const m1 = {
      id: "m1",
      role: "assistant" as const,
      parts: [read("c1", "a.ts"), read("c2", "b.ts")],
    };
    const a = messagesToAgentEvents([m1]);
    const b = messagesToAgentEvents([m1]);
    expect(a[0]!.kind).toBe("explored");
    expect(b[0]).toBe(a[0]);
    // The `tools` array too: reallocating it is enough on its own to break anyone
    // comparing line by line by identity.
    expect((b[0] as unknown as { tools: unknown[] }).tools).toBe(
      (a[0] as unknown as { tools: unknown[] }).tools,
    );
  });

  it("the block is NOT reused when the run grows — reuse is by CONTENT, not by id", () => {
    // The open run changes content on purpose under the same id. Reusing by id
    // would freeze the new read off-screen.
    const m1 = {
      id: "m1",
      role: "assistant" as const,
      parts: [read("c1", "a.ts"), read("c2", "b.ts")],
    };
    const m2 = {
      id: "m2",
      role: "assistant" as const,
      parts: [read("c3", "c.ts")],
    };
    const before = messagesToAgentEvents([m1]);
    const after = messagesToAgentEvents([m1, m2]);
    expect(after[0]!.id).toBe(before[0]!.id);
    expect(after[0]).not.toBe(before[0]);
    expect((after[0] as unknown as { tools: unknown[] }).tools).toHaveLength(3);
  });

  it("once the run closes, the PREFIX of ids and order stops changing", () => {
    const m1 = {
      id: "m1",
      role: "assistant" as const,
      parts: [read("c1", "a.ts"), read("c2", "b.ts")],
    };
    const m2 = {
      id: "m2",
      role: "assistant" as const,
      parts: [read("c3", "c.ts")],
    };
    // The SAME reference in both projections — per-message memoisation keys on
    // identity, so two equal literals are not the same case (that is what the first
    // version of this test got wrong, and the failure is what showed it).
    const m3 = msg("m3", "done");
    const closed = messagesToAgentEvents([m1, m2, m3]);
    const later = messagesToAgentEvents([m1, m2, m3, msg("m4", "and more")]);
    expect(closed.map((e) => e.id)).toEqual(["explored-c1", "m3::m0"]);
    expect(later.map((e) => e.id).slice(0, 2)).toEqual([
      "explored-c1",
      "m3::m0",
    ]);
    // The NON-explored event in the prefix is stable by identity — the contrast that
    // localises the #66 gap in the block's wrapper rather than in the memoisation.
    expect(later[1]).toBe(closed[1]);
  });
});
