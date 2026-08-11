/**
 * Per-key serialisation of async writes.
 *
 * Two writes to the same file, started concurrently, interleave. The queue makes operations sharing
 * a key run one after another while different keys stay parallel — the property a session log and a
 * transcript need from each other.
 *
 * ## Why a factory and not module-level state
 *
 * The consumer this was extracted from kept its queue in a module-level `Map`. That is fine in an
 * application, which has one of everything, and wrong in a library: two independent consumers in one
 * process would share a queue and serialise against each other for no reason, and a test could not
 * start clean without reaching into another module's internals.
 *
 * `@theokit/tui` exports functions rather than classes, so the instance is a closure rather than an
 * object with methods. That is the same fix — no shared mutable global, one owner per queue — in the
 * idiom the rest of this package already uses.
 *
 * @public
 */

/** A queue whose operations serialise per key. Create one per owner. */
export interface WriteQueue {
  /**
   * Run `op` after every operation already queued under `key`.
   *
   * @returns what `op` returns, so the caller can await the write it asked for. A rejection
   *   propagates to that caller and does NOT poison the key — the next operation still runs.
   */
  enqueue<T>(key: string, op: () => Promise<T>): Promise<T>;
  /** Resolve once everything queued under `key` has settled. */
  drain(key: string): Promise<void>;
  /** Resolve once every key has settled. */
  drainAll(): Promise<void>;
}

/** @public */
export function createWriteQueue(): WriteQueue {
  const tails = new Map<string, Promise<unknown>>();

  return {
    enqueue<T>(key: string, op: () => Promise<T>): Promise<T> {
      const previous = tails.get(key) ?? Promise.resolve();
      const result = previous.then(op);
      // The TAIL swallows rejections; the returned promise does not. Without this a single failed
      // write would reject every operation queued behind it — one bad write taking down the file.
      tails.set(
        key,
        result.catch(() => undefined),
      );
      return result;
    },

    async drain(key: string): Promise<void> {
      await (tails.get(key) ?? Promise.resolve());
    },

    async drainAll(): Promise<void> {
      // Snapshot the keys: draining is async, and an `enqueue` during it would otherwise mutate the
      // map being iterated.
      await Promise.all([...tails.keys()].map((key) => this.drain(key)));
    },
  };
}
