import { describe, expect, it } from "vitest";

import { KillRing } from "./kill-ring.js";

// M21 T3.1 — the Emacs kill-ring: coalescing, yank (peek), yank-pop (rotate).

describe("KillRing (M21 T3.1)", () => {
  it("yanks_the_most_recent_kill", () => {
    const ring = new KillRing();
    ring.push("hello", { prepend: false });
    expect(ring.peek()).toBe("hello");
    expect(ring.length).toBe(1);
  });

  it("coalesces_consecutive_forward_kills_by_appending", () => {
    const ring = new KillRing();
    ring.push("foo", { prepend: false });
    ring.push("bar", { prepend: false, accumulate: true });
    expect(ring.peek()).toBe("foobar");
    expect(ring.length).toBe(1);
  });

  it("coalesces_consecutive_backward_kills_by_prepending", () => {
    const ring = new KillRing();
    ring.push("bar", { prepend: true });
    ring.push("foo", { prepend: true, accumulate: true });
    expect(ring.peek()).toBe("foobar");
  });

  it("yank_pop_rotates_older_entries_to_the_front", () => {
    const ring = new KillRing();
    ring.push("one", { prepend: false });
    ring.push("two", { prepend: false });
    expect(ring.peek()).toBe("two");
    ring.rotate();
    expect(ring.peek()).toBe("one");
    ring.rotate();
    expect(ring.peek()).toBe("two");
  });

  it("ignores_empty_kills_and_rotate_on_a_short_ring", () => {
    const ring = new KillRing();
    ring.push("", { prepend: false });
    expect(ring.length).toBe(0);
    expect(ring.peek()).toBeUndefined();
    ring.rotate(); // no-op on 0/1 entries
    ring.push("x", { prepend: false });
    ring.rotate();
    expect(ring.peek()).toBe("x");
  });
});
