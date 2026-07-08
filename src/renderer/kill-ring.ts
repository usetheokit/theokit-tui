// M21 kill-ring (plan m21-premium-capabilities T3.1, Feature B / ADR B2): the
// Emacs kill/yank cut buffer — a faithful port of pi's kill-ring.ts. Consecutive
// kills coalesce into one entry (prepend for backward deletion, append for
// forward); yank pastes the head, yank-pop rotates the ring. This is STATEFUL
// (held by the composer via a ref), NOT part of the pure text-buffer reducer.

export class KillRing {
  private ring: string[] = [];

  /**
   * Add killed text. When `accumulate` and the ring is non-empty, merge into the
   * most recent entry — `prepend` for a backward kill (C-w / C-u), append for a
   * forward kill (C-k / C-d) — so three consecutive kills form one yank.
   */
  push(text: string, opts: { prepend: boolean; accumulate?: boolean }): void {
    if (!text) {
      return;
    }
    if (opts.accumulate && this.ring.length > 0) {
      const last = this.ring.pop()!;
      this.ring.push(opts.prepend ? text + last : last + text);
    } else {
      this.ring.push(text);
    }
  }

  /** The most recent entry (yank), without mutating the ring. */
  peek(): string | undefined {
    return this.ring.length > 0 ? this.ring[this.ring.length - 1] : undefined;
  }

  /** Move the last entry to the front — yank-pop cycling. */
  rotate(): void {
    if (this.ring.length > 1) {
      const last = this.ring.pop()!;
      this.ring.unshift(last);
    }
  }

  get length(): number {
    return this.ring.length;
  }
}
