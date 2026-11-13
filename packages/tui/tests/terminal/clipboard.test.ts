import type { SpawnSyncReturns } from "node:child_process";
import { describe, expect, it } from "vitest";
import {
  ClipboardWriteError,
  copyToClipboard,
  DEFAULT_CLIPBOARD_COMMANDS,
  NoClipboardError,
} from "../../src/terminal/index.js";

const ok = (): SpawnSyncReturns<string> => ({ status: 0 }) as unknown as SpawnSyncReturns<string>;
const enoent = (): SpawnSyncReturns<string> =>
  ({
    status: null,
    error: Object.assign(new Error("spawn ENOENT"), { code: "ENOENT" }),
  }) as unknown as SpawnSyncReturns<string>;

const two = [
  { bin: "a", args: [] },
  { bin: "b", args: ["-x"] },
];

describe("copyToClipboard", () => {
  it("skips ENOENT and passes the text to the next binary", () => {
    const calls: unknown[][] = [];
    const runner = (bin: string, args: readonly string[], input: string, t: number) => {
      calls.push([bin, args, input, t]);
      return bin === "a" ? enoent() : ok();
    };
    expect(copyToClipboard("hi", { candidates: two, runner })).toEqual({ via: "b" });
    expect(calls[1]).toEqual(["b", ["-x"], "hi", 5000]);
  });

  it("passes the default and the custom timeout", () => {
    const seen: number[] = [];
    const runner = (_b: string, _a: readonly string[], _i: string, t: number) => {
      seen.push(t);
      return ok();
    };
    copyToClipboard("x", { candidates: two, runner });
    copyToClipboard("x", { candidates: two, runner, timeoutMs: 123 });
    expect(seen).toEqual([5000, 123]);
  });

  it("throws NoClipboardError listing every bin", () => {
    try {
      copyToClipboard("x", { candidates: two, runner: enoent });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(NoClipboardError);
      expect((e as NoClipboardError).tried).toEqual(["a", "b"]);
      expect((e as Error).message).toContain("a, b");
    }
  });

  it("throws ClipboardWriteError on non-zero exit without trying the next", () => {
    let n = 0;
    const runner = () => {
      n++;
      return { status: 1, stderr: "boom\n" } as unknown as SpawnSyncReturns<string>;
    };
    try {
      copyToClipboard("x", { candidates: two, runner });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ClipboardWriteError);
      expect((e as ClipboardWriteError).bin).toBe("a");
      expect((e as ClipboardWriteError).detail).toContain("boom");
    }
    expect(n).toBe(1);
  });

  it("reports timeouts, other spawn errors and empty stderr", () => {
    const mk = (r: Partial<SpawnSyncReturns<string>>) => () =>
      r as unknown as SpawnSyncReturns<string>;
    const detail = (r: Partial<SpawnSyncReturns<string>>) => {
      try {
        copyToClipboard("x", { candidates: two, runner: mk(r), timeoutMs: 7 });
      } catch (e) {
        return (e as ClipboardWriteError).detail;
      }
      return "";
    };
    expect(
      detail({ status: null, error: Object.assign(new Error("t"), { code: "ETIMEDOUT" }) }),
    ).toBe("timed out after 7 ms");
    expect(detail({ status: null, error: new Error("denied") })).toBe("denied");
    expect(detail({ status: 3 })).toBe("exited with status 3");
  });

  it("falls back to OSC 52 on a TTY sink", () => {
    const out: string[] = [];
    const osc52 = { isTTY: true, write: (d: string) => void out.push(d) };
    expect(copyToClipboard("héllo", { candidates: two, runner: enoent, osc52 })).toEqual({
      via: "osc52",
    });
    expect(out).toEqual([`\x1b]52;c;${Buffer.from("héllo").toString("base64")}\x07`]);
  });

  it("treats a non-TTY sink as unavailable", () => {
    const out: string[] = [];
    const osc52 = { isTTY: false, write: (d: string) => void out.push(d) };
    expect(() => copyToClipboard("x", { candidates: two, runner: enoent, osc52 })).toThrow(
      /not a TTY/,
    );
    expect(out).toEqual([]);
  });

  it("uses the real spawn path and the default list", () => {
    expect(DEFAULT_CLIPBOARD_COMMANDS.map((c) => c.bin)).toEqual([
      "wl-copy",
      "xclip",
      "xsel",
      "pbcopy",
      "clip.exe",
    ]);
    expect(() =>
      copyToClipboard("x", { candidates: [{ bin: "theokit-no-such-bin-193", args: [] }] }),
    ).toThrow(NoClipboardError);
    expect(() => copyToClipboard("x", { candidates: [] })).toThrow(/no binaries/);
  });
});
