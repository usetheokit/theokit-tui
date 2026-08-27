import type { PendingApproval, UIMessageLike } from "../agent/messages-to-events.js";
import { partToPendingApproval } from "../agent/messages-to-events.js";

/**
 * usetheokit/theokit-tui#68 — the ledger of approvals in flight.
 *
 * `findPendingApproval` answers a different question than this does, and the two answers disagreed
 * in the same process: a consumer used this package's `PermissionPrompt` view with a ledger of its
 * own, so "which approval comes next" had two implementations and two orders. Both are legitimate;
 * what was missing was a place where the choice is WRITTEN DOWN.
 *
 * ## The policy, declared
 *
 * `findNextApproval` returns the OLDEST unsettled approval. A human answering a queue answers it in
 * the order the questions arrived — newest-first makes the visible prompt jump backwards every time
 * the agent asks something else, and an approval that never becomes newest is never shown at all.
 *
 * `findPendingApproval` keeps its newest-first order and its meaning: "the approval that just came
 * in", a single-prompt surface with no queue. It is not a degraded ledger and is not deprecated
 * here — the two answer different questions, and now say so.
 *
 * ## Why a ledger rather than a scan
 *
 * A scan is O(thread) per call and cannot represent "asked and answered": a settled approval is
 * indistinguishable from one that was never there, so the scan re-offers it or skips it depending on
 * what else the thread holds. The ledger settles an entry without removing it, which is what makes
 * the next answer stable while the thread keeps growing.
 */

export interface LedgerEntry extends PendingApproval {
  /** Index of the message this approval arrived in — what `prune` compares against. */
  messageIndex: number;
  /** Whether a decision has been recorded. Settled entries stay until pruned. */
  settled: boolean;
}

export interface ApprovalLedger {
  /** Insertion-ordered entries, settled ones included. */
  readonly entries: readonly LedgerEntry[];
  /**
   * How many messages have been ingested. `ingest` starts from here, so a growing thread costs
   * only its new messages rather than a full rescan.
   */
  readonly watermark: number;
}

export function createApprovalLedger(): ApprovalLedger {
  return { entries: [], watermark: 0 };
}

/**
 * Folds the messages after the watermark into the ledger.
 *
 * Returns a NEW ledger; the input is untouched. Same contract as the other models here, and the
 * reason is the same: a React state value that mutates in place does not re-render.
 *
 * Two separate defences, and they are not the same one twice:
 *
 * - the WATERMARK is performance. It skips messages already folded in, so a growing thread costs
 *   its new messages. Remove it and the result is identical, only slower — mutation-tested, and no
 *   behavioural test can tell the difference, which is exactly what an optimisation should look
 *   like.
 * - the ID CHECK is correctness. The same `approvalId` can arrive in a LATER message, past the
 *   watermark, and without the check the ledger holds it twice and re-asks after it is settled.
 */
export function ingest(ledger: ApprovalLedger, thread: readonly UIMessageLike[]): ApprovalLedger {
  // A thread SHORTER than the watermark means messages were removed (backtrack). Re-reading from
  // the start is correct there and cheap, because the thread is now short. The id check below is
  // what keeps that re-read from duplicating anything.
  const from = thread.length < ledger.watermark ? 0 : ledger.watermark;
  const seen = new Set(ledger.entries.map((entry) => entry.approvalId));
  const added: LedgerEntry[] = [];
  for (let i = from; i < thread.length; i++) {
    for (const part of thread[i]?.parts ?? []) {
      const pending = partToPendingApproval(part);
      if (pending === undefined || seen.has(pending.approvalId)) continue;
      seen.add(pending.approvalId);
      added.push({ ...pending, messageIndex: i, settled: false });
    }
  }
  if (added.length === 0 && ledger.watermark === thread.length) return ledger;
  return { entries: [...ledger.entries, ...added], watermark: thread.length };
}

/**
 * Records a decision for one approval, keeping the entry.
 *
 * Kept rather than removed because "asked and answered" and "never asked" are different states, and
 * only one of them should stay out of the queue when the same thread is ingested again.
 *
 * An unknown id is a no-op: settling twice, or settling an approval this ledger never saw, is what
 * a double-click and a stale prompt produce, and neither is worth throwing over.
 */
export function settle(ledger: ApprovalLedger, approvalId: string): ApprovalLedger {
  let changed = false;
  const entries = ledger.entries.map((entry) => {
    if (entry.approvalId !== approvalId || entry.settled) return entry;
    changed = true;
    return { ...entry, settled: true };
  });
  return changed ? { ...ledger, entries } : ledger;
}

/**
 * Drops entries whose message no longer exists — a backtrack cut the thread.
 *
 * Without this the ledger keeps offering an approval for a tool call the user has already undone,
 * and the id it settles refers to nothing.
 */
export function prune(ledger: ApprovalLedger, threadLength: number): ApprovalLedger {
  const entries = ledger.entries.filter((entry) => entry.messageIndex < threadLength);
  if (entries.length === ledger.entries.length && ledger.watermark <= threadLength) return ledger;
  return { entries, watermark: Math.min(ledger.watermark, threadLength) };
}

/** The oldest unsettled approval — the declared policy above. `undefined` when the queue is empty. */
export function findNextApproval(ledger: ApprovalLedger): PendingApproval | undefined {
  const entry = ledger.entries.find((candidate) => !candidate.settled);
  if (entry === undefined) return undefined;
  const { messageIndex: _messageIndex, settled: _settled, ...pending } = entry;
  return pending;
}

/** How many approvals are still waiting for a decision. */
export function pendingCount(ledger: ApprovalLedger): number {
  return ledger.entries.reduce((total, entry) => total + (entry.settled ? 0 : 1), 0);
}
