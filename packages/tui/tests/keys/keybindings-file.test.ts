import { describe, expect, it } from "vitest";
import { chordOf, defaultKeymap, parseKeybindings, resolveAction } from "../../src/keys/index.js";

const actions = ["toggle-verbose", "quit"] as const;

describe("parseKeybindings", () => {
  it("maps a flat document and the nested form to the same keymap", () => {
    const flat = parseKeybindings({ "ctrl+t": "toggle-verbose" }, { actions });
    const nested = parseKeybindings(
      { bindings: [{ bindings: { "ctrl+t": "toggle-verbose" } }] },
      { actions },
    );
    expect(flat.notApplied).toEqual([]);
    expect(flat.keymap.get("ctrl+t")).toBe("toggle-verbose");
    expect(nested.keymap).toEqual(flat.keymap);
  });

  it("normalizes chords and lists", () => {
    const r = parseKeybindings(
      { "  Ctrl+T ": "quit", "ctrl+Q": "quit" },
      { actions, reserved: ["CTRL+Q"] },
    );
    expect(r.keymap.get("ctrl+t")).toBe("quit");
    expect(r.keymap.has("ctrl+q")).toBe(false);
    expect(r.notApplied).toHaveLength(1);
  });

  it("null removes a chord from base without mutating it", () => {
    const base = new Map([["ctrl+x", "quit"]]);
    const r = parseKeybindings({ "ctrl+x": null }, { actions, base });
    expect(r.keymap.has("ctrl+x")).toBe(false);
    expect(base.has("ctrl+x")).toBe(true);
    expect(r.notApplied).toEqual([]);
  });

  it("reports reserved, claimed and unknown-action chords distinctly", () => {
    const r = parseKeybindings(
      { "ctrl+c": "quit", "ctrl+o": "quit", "ctrl+t": "nope", "ctrl+n": 4 },
      { actions, reserved: ["ctrl+c"], claimed: ["ctrl+o"] },
    );
    expect(r.keymap.size).toBe(0);
    expect(r.notApplied.map((n) => n.chord)).toEqual(["ctrl+c", "ctrl+o", "ctrl+t", "ctrl+n"]);
    expect(r.notApplied[0]?.reason).toContain("reserved");
    expect(r.notApplied[1]?.reason).toContain("always handled");
    expect(r.notApplied[2]?.reason).toContain("not a known action");
    expect(new Set(r.notApplied.slice(0, 3).map((n) => n.reason)).size).toBe(3);
  });

  it("rejects a chord chordOf cannot produce", () => {
    const r = parseKeybindings({ "ctrl+shift+x": "quit", enter: "quit" }, { actions });
    expect(r.keymap.size).toBe(0);
    expect(r.notApplied).toHaveLength(2);
    expect(r.notApplied[0]?.reason).toContain("ctrl+shift+x");
  });

  it("accepts named keys", () => {
    expect(parseKeybindings({ escape: "quit" }, { actions }).keymap.get("escape")).toBe("quit");
  });

  it("reports a malformed document and never throws", () => {
    for (const doc of [
      "nope",
      { bindings: 3 },
      null,
      [],
      { bindings: [3] },
      { bindings: [{ bindings: 1 }] },
    ]) {
      const r = parseKeybindings(doc, { actions });
      expect(r.keymap.size).toBe(0);
      expect(r.notApplied).toHaveLength(1);
      expect(r.notApplied[0]?.reason).toContain("malformed");
    }
  });

  it("applies good blocks beside a bad one", () => {
    const r = parseKeybindings({ bindings: [3, { bindings: { "ctrl+t": "quit" } }] }, { actions });
    expect(r.keymap.get("ctrl+t")).toBe("quit");
    expect(r.notApplied).toHaveLength(1);
  });

  it("re-exports the chord helpers", () => {
    expect(chordOf("a", { ctrl: true } as never)).toBe("ctrl+a");
    expect(resolveAction(defaultKeymap, "ctrl+a")).toBe("move-line-start");
  });
});
