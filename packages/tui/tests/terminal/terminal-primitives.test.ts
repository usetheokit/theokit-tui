/**
 * `@theokit/tui/terminal` — the loop primitives.
 *
 * These were extracted from a consumer that had them tested only where the consumer needed them.
 * As a published surface the bar is different: each one now has to hold for callers whose usage
 * nobody has seen, so the cases below concentrate on the contracts a consumer would otherwise have
 * to discover by being burned — a failed write not poisoning its queue, a lost diagnostic being
 * reported rather than swallowed, and rotation refusing a nonsense argument instead of silently
 * deleting the log.
 */

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { DEFAULT_CAP_BYTES, DEFAULT_KEEP, rotateLog } from "../../src/terminal/log-rotation.js";
import { installStderrGuard } from "../../src/terminal/stderr-guard.js";
import { createWriteQueue } from "../../src/terminal/write-queue.js";

const sandbox = mkdtempSync(join(tmpdir(), "tui-terminal-"));
afterAll(() => rmSync(sandbox, { recursive: true, force: true }));

const dir = (name: string): string => mkdtempSync(join(sandbox, `${name}-`));

describe("createWriteQueue", () => {
  it("test_operations_sharing_a_key_run_one_after_another", async () => {
    const queue = createWriteQueue();
    const order: string[] = [];
    const slow = async (tag: string, ms: number): Promise<void> => {
      await new Promise((r) => setTimeout(r, ms));
      order.push(tag);
    };

    // The first is slower on purpose: without serialisation it would finish last.
    const a = queue.enqueue("f", () => slow("a", 20));
    const b = queue.enqueue("f", () => slow("b", 1));
    await Promise.all([a, b]);

    expect(order).toEqual(["a", "b"]);
  });

  it("test_different_keys_do_not_wait_on_each_other", async () => {
    // The other half of the contract. A queue that serialised everything would pass the case above
    // and make two independent files take turns for no reason.
    const queue = createWriteQueue();
    const order: string[] = [];
    const slow = async (tag: string, ms: number): Promise<void> => {
      await new Promise((r) => setTimeout(r, ms));
      order.push(tag);
    };

    await Promise.all([
      queue.enqueue("x", () => slow("x", 20)),
      queue.enqueue("y", () => slow("y", 1)),
    ]);

    expect(order).toEqual(["y", "x"]);
  });

  it("test_a_failed_operation_rejects_its_own_caller_and_nothing_else", async () => {
    // The contract that costs the most to rediscover: one bad write must not take the file down.
    const queue = createWriteQueue();

    const failing = queue.enqueue("f", () => Promise.reject(new Error("disk full")));
    await expect(failing).rejects.toThrow("disk full");

    await expect(queue.enqueue("f", () => Promise.resolve("still works"))).resolves.toBe(
      "still works",
    );
  });

  it("test_drain_waits_for_the_key_and_drainAll_for_every_key", async () => {
    const queue = createWriteQueue();
    let done = 0;
    const work = async (): Promise<void> => {
      // duration is the subject: this simulates work that TAKES time, which is what makes the
      // queue's serialisation observable. There is no condition to poll for — the delay IS the
      // fixture (B-033 § Scope).
      await new Promise((r) => setTimeout(r, 5));
      done += 1;
    };

    void queue.enqueue("a", work);
    void queue.enqueue("b", work);

    await queue.drain("a");
    expect(done).toBeGreaterThanOrEqual(1);

    await queue.drainAll();
    expect(done).toBe(2);
  });

  it("test_two_queues_do_not_share_state", async () => {
    // The reason this is a factory. Module-level state would make these two serialise against each
    // other, and would make a test unable to start clean.
    const first = createWriteQueue();
    const second = createWriteQueue();
    const order: string[] = [];
    const slow = async (tag: string, ms: number): Promise<void> => {
      await new Promise((r) => setTimeout(r, ms));
      order.push(tag);
    };

    await Promise.all([
      first.enqueue("k", () => slow("first", 20)),
      second.enqueue("k", () => slow("second", 1)),
    ]);

    expect(order).toEqual(["second", "first"]);
  });

  it("test_draining_an_unknown_key_resolves", async () => {
    await expect(createWriteQueue().drain("never-used")).resolves.toBeUndefined();
  });
});

describe("rotateLog", () => {
  it("test_a_file_under_the_cap_is_left_alone", () => {
    const d = dir("under");
    const log = join(d, "x.log");
    writeFileSync(log, "small");

    rotateLog(log, { capBytes: 1_000, keep: 3 });

    expect(readFileSync(log, "utf8")).toBe("small");
    expect(existsSync(`${log}.0`)).toBe(false);
  });

  it("test_a_file_at_the_cap_rolls_to_generation_zero", () => {
    const d = dir("roll");
    const log = join(d, "x.log");
    writeFileSync(log, "x".repeat(50));

    rotateLog(log, { capBytes: 10, keep: 3 });

    expect(existsSync(log)).toBe(false);
    expect(readFileSync(`${log}.0`, "utf8")).toHaveLength(50);
  });

  it("test_generations_shift_and_the_oldest_is_dropped", () => {
    const d = dir("shift");
    const log = join(d, "x.log");
    writeFileSync(`${log}.0`, "gen0");
    writeFileSync(`${log}.1`, "gen1");
    writeFileSync(log, "x".repeat(50));

    rotateLog(log, { capBytes: 10, keep: 2 });

    // keep=2 means `.0` and `.1` exist; `.1` held gen1, which is now beyond the window.
    expect(readFileSync(`${log}.0`, "utf8")).toHaveLength(50);
    expect(readFileSync(`${log}.1`, "utf8")).toBe("gen0");
    expect(existsSync(`${log}.2`)).toBe(false);
  });

  it("test_a_missing_file_is_not_an_error", () => {
    expect(() => rotateLog(join(dir("absent"), "nope.log"))).not.toThrow();
  });

  it.each([
    ["a zero cap", { capBytes: 0 }],
    ["a negative cap", { capBytes: -1 }],
    ["a non-finite cap", { capBytes: Number.NaN }],
    ["a zero keep", { keep: 0 }],
    ["a fractional keep", { keep: 1.5 }],
  ])("test_%s_is_a_typed_RangeError", (_label, opts) => {
    // Argument validation throws while filesystem failure does not, and the asymmetry is the
    // design: a bad `keep` is a programming error the caller must see, a full disk is not.
    const log = join(dir("bad"), "x.log");
    writeFileSync(log, "content");
    expect(() => rotateLog(log, opts)).toThrow(RangeError);
  });

  it("test_an_unwritable_target_does_not_throw", () => {
    // Environment failure on a best-effort path. Starting without rotating beats refusing to start.
    const log = join(dir("perm"), "x.log");
    writeFileSync(log, "x".repeat(50));
    // A directory where the rolled name already exists AS A DIRECTORY makes rename fail.
    mkdirSync(`${log}.0`);

    expect(() => rotateLog(log, { capBytes: 10, keep: 3 })).not.toThrow();
  });

  it("test_the_defaults_are_the_documented_ones", () => {
    expect(DEFAULT_CAP_BYTES).toBe(10 * 1024 * 1024);
    expect(DEFAULT_KEEP).toBe(10);
  });
});

describe("installStderrGuard", () => {
  it("test_writes_go_to_the_log_and_not_to_the_terminal", () => {
    const log = join(dir("guard"), "err.log");
    const restore = installStderrGuard(log);
    try {
      process.stderr.write("a warning mid-frame\n");
    } finally {
      restore();
    }

    expect(readFileSync(log, "utf8")).toContain("a warning mid-frame");
  });

  it("test_the_disposer_puts_the_original_stream_back", () => {
    const log = join(dir("restore"), "err.log");
    const before = process.stderr.write;

    const restore = installStderrGuard(log);
    expect(process.stderr.write).not.toBe(before);
    restore();

    expect(process.stderr.write).toBe(before);
  });

  it("test_a_lost_diagnostic_is_reported_at_teardown_rather_than_swallowed", () => {
    // The case the whole module exists for: an unwritable path must not produce a session where
    // every diagnostic is dead and nothing says so.
    //
    // The capture has to be installed BEFORE the guard. The guard keeps the stream it replaced and
    // reports through THAT at teardown — swapping afterwards intercepts nothing, which is how the
    // first version of this test failed while the code was correct.
    const d = dir("lost");
    const log = join(d, "sub", "err.log");
    mkdirSync(join(d, "sub"), { recursive: true });
    mkdirSync(log); // a directory where a file is expected: every append fails

    const reported: string[] = [];
    const real = process.stderr.write;
    process.stderr.write = ((chunk: unknown): boolean => {
      reported.push(String(chunk));
      return true;
    }) as typeof process.stderr.write;

    try {
      const restore = installStderrGuard(log, { label: "probe" });
      expect(process.stderr.write("lost one\n")).toBe(false);
      expect(process.stderr.write("lost two\n")).toBe(false);
      restore();
    } finally {
      process.stderr.write = real;
    }

    expect(reported.join("")).toContain("[probe]");
    expect(reported.join("")).toContain("2 diagnostic message(s)");
    expect(reported.join("")).toContain(log);
  });

  it("test_nothing_is_reported_when_nothing_was_lost", () => {
    // Anti-vacuity: a guard that always printed at teardown would pass the case above and be noise.
    const log = join(dir("quiet"), "err.log");
    const reported: string[] = [];
    const real = process.stderr.write;
    process.stderr.write = ((chunk: unknown): boolean => {
      reported.push(String(chunk));
      return true;
    }) as typeof process.stderr.write;

    try {
      const restore = installStderrGuard(log);
      expect(process.stderr.write("fine\n")).toBe(true);
      restore();
    } finally {
      process.stderr.write = real;
    }

    expect(reported).toEqual([]);
  });
});
