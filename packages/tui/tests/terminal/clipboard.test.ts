import type { SpawnSyncReturns } from "node:child_process";

import { describe, expect, it } from "vitest";

import {
  ClipboardWriteError,
  type ClipboardCommand,
  copyToClipboard,
  DEFAULT_CLIPBOARD_COMMANDS,
  NoClipboardError,
} from "../../src/terminal/index.js";

const A: ClipboardCommand = { bin: "aaa", args: ["-x"] };
const B: ClipboardCommand = { bin: "bbb", args: [] };

const enoent = (): SpawnSyncReturns<string> =>
  ({
    error: Object.assign(new Error("spawn ENOENT"), { code: "ENOENT" }),
    status: null,
  }) as unknown as SpawnSyncReturns<string>;
const ok = (): SpawnSyncReturns<string> =>
  ({ status: 0, stderr: "" }) as unknown as SpawnSyncReturns<string>;

describe("copyToClipboard", () => {
  it("skips a missing binary and passes the text to the next", () => {
    const calls: Array<{ bin: string; input: string }> = [];
    const res = copyToClipboard("hello", {
      candidates: [A, B],
      runner: (bin, _a, input) => {
        calls.push({ bin, input });
        return bin === "aaa" ? enoent() : ok();
      },
    });
    expect(res).toEqual({ via: "bbb" });
    expect(calls[1]).toEqual({ bin: "bbb", input: "hello" });
  });

  it("passes 5000 ms by default and the option when set", () => {
    const seen: number[] = [];
    const runner = (_b: string, _a: readonly string[], _i: string, t: number) => {
      seen.push(t);
      return ok();
    };
    copyToClipboard("x", { candidates: [A], runner });
    copyToClipboard("x", { candidates: [A], runner, timeoutMs: 123 });
    expect(seen).toEqual([5000, 123]);
  });

  it("throws NoClipboardError listing every binary tried", () => {
    try {
      copyToClipboard("x", { candidates: [A, B], runner: enoent });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(NoClipboardError);
      expect((e as NoClipboardError).tried).toEqual(["aaa", "bbb"]);
      expect((e as Error).message).toContain("aaa");
      expect((e as Error).message).toContain("bbb");
    }
  });

  it("throws ClipboardWriteError on exit 1 and does not try the next", () => {
    const bins: string[] = [];
    try {
      copyToClipboard("x", {
        candidates: [A, B],
        runner: (bin) => {
          bins.push(bin);
          return { status: 1, stderr: "boom" } as unknown as SpawnSyncReturns<string>;
        },
      });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ClipboardWriteError);
      expect((e as ClipboardWriteError).bin).toBe("aaa");
      expect((e as ClipboardWriteError).detail).toContain("boom");
    }
    expect(bins).toEqual(["aaa"]);
  });

  it("reports a non-ENOENT spawn error (timeout) and a bare non-zero exit", () => {
    const timeout = () =>
      ({
        error: Object.assign(new Error("spawnSync aaa ETIMEDOUT"), { code: "ETIMEDOUT" }),
        status: null,
      }) as unknown as SpawnSyncReturns<string>;
    expect(() => copyToClipboard("x", { candidates: [A], runner: timeout })).toThrow(/ETIMEDOUT/);
    expect(() =>
      copyToClipboard("x", {
        candidates: [A],
        runner: () => ({ status: 2 }) as unknown as SpawnSyncReturns<string>,
      }),
    ).toThrow(/status 2/);
  });

  it("falls back to OSC 52 on a TTY sink", () => {
    const writes: string[] = [];
    const res = copyToClipboard("héllo", {
      candidates: [A],
      runner: enoent,
      osc52: { isTTY: true, write: (d) => void writes.push(d) },
    });
    expect(res).toEqual({ via: "osc52" });
    expect(writes).toEqual([`\x1b]52;c;${Buffer.from("héllo").toString("base64")}\x07`]);
  });

  it("treats a non-TTY OSC 52 sink as unavailable", () => {
    const writes: string[] = [];
    expect(() =>
      copyToClipboard("x", {
        candidates: [A],
        runner: enoent,
        osc52: { isTTY: false, write: (d) => void writes.push(d) },
      }),
    ).toThrow(NoClipboardError);
    expect(writes).toEqual([]);
  });

  it("uses the real spawn path and the default candidate list", () => {
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
    expect(copyToClipboard("x", { candidates: [{ bin: "cat", args: [] }] })).toEqual({
      via: "cat",
    });
  });
});
