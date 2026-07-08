// M21 undo-stack (plan m21-premium-capabilities T3.1, Feature B / ADR B1/B2): a
// generic clone-on-push undo stack — a faithful port of pi's undo-stack.ts.
// Stores deep clones of state snapshots so a later mutation of the live state
// never corrupts a snapshot; popped snapshots are already detached. Redo is
// intentionally absent (pi ships one-way undo — YAGNI). Held by the composer.

export class UndoStack<S> {
  private stack: S[] = [];

  /** Push a deep clone of `state`. */
  push(state: S): void {
    this.stack.push(structuredClone(state));
  }

  /** Pop the most recent snapshot (already detached), or undefined if empty. */
  pop(): S | undefined {
    return this.stack.pop();
  }

  /** Drop every snapshot. */
  clear(): void {
    this.stack.length = 0;
  }

  get length(): number {
    return this.stack.length;
  }
}
