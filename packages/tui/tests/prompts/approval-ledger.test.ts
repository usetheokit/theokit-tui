import { describe, expect, it } from "vitest";

import type { UIMessageLike } from "../../src/agent/messages-to-events.js";
import { findPendingApproval } from "../../src/agent/messages-to-events.js";
import {
  createApprovalLedger,
  findNextApproval,
  ingest,
  pendingCount,
  prune,
  settle,
} from "../../src/prompts/approval-ledger.js";

/**
 * usetheokit/theokit-tui#68 — the ledger, and the policy it declares.
 *
 * The defect this closes is not a crash: it is that "which approval comes next" had two answers in
 * one process, and neither was written down. So the divergence itself is pinned below, not just the
 * ledger's own behaviour.
 */

const approvalPart = (id: string, toolName: string) => ({
  type: `tool-${toolName}`,
  state: "approval-requested",
  toolCallId: id,
  toolName,
  input: { path: "src" },
});

const message = (...ids: [string, string][]): UIMessageLike => ({
  id: `m-${ids.map(([id]) => id).join("-")}`,
  role: "assistant",
  parts: ids.map(([id, tool]) => approvalPart(id, tool)),
});

const thread = (...messages: UIMessageLike[]): UIMessageLike[] => messages;

describe("approval ledger — ingest", () => {
  it("test_collects_every_approval_in_insertion_order", () => {
    const led = ingest(
      createApprovalLedger(),
      thread(message(["a", "read_file"]), message(["b", "run_shell"])),
    );
    expect(led.entries.map((e) => e.approvalId)).toEqual(["a", "b"]);
    expect(led.watermark).toBe(2);
  });

  it("test_only_reads_messages_past_the_watermark", () => {
    const first = ingest(createApprovalLedger(), thread(message(["a", "read_file"])));
    const grown = thread(message(["a", "read_file"]), message(["b", "run_shell"]));
    const second = ingest(first, grown);
    // The point of the watermark: `a`'s entry is the SAME object, not a re-read.
    expect(second.entries[0]).toBe(first.entries[0]);
    expect(second.entries.map((e) => e.approvalId)).toEqual(["a", "b"]);
  });

  it("test_ingesting_the_same_thread_twice_does_not_duplicate", () => {
    // A re-render hands in the same thread again. A queue that grew each time would re-ask forever.
    const t = thread(message(["a", "read_file"]));
    const once = ingest(createApprovalLedger(), t);
    const twice = ingest(once, t);
    expect(twice.entries).toHaveLength(1);
    expect(twice).toBe(once);
  });

  it("test_the_same_id_arriving_in_a_LATER_message_is_not_added_twice", () => {
    // The case the id check alone can catch: the second message is PAST the watermark, so the
    // incremental read does reach it. Without the check the ledger holds `a` twice and asks about
    // it again after it is settled.
    //
    // Written after mutation testing showed that removing the id check left all sixteen tests
    // green — the watermark was masking it, and neither defence was isolated by anything.
    const led = ingest(
      createApprovalLedger(),
      thread(message(["a", "read_file"]), message(["a", "read_file"])),
    );
    expect(led.entries.map((e) => e.approvalId)).toEqual(["a"]);
  });

  it("test_a_message_with_no_approval_is_ignored", () => {
    const plain: UIMessageLike = {
      id: "m1",
      role: "assistant",
      parts: [{ type: "text", text: "just talking" }],
    };
    const led = ingest(createApprovalLedger(), thread(plain));
    expect(led.entries).toHaveLength(0);
    expect(led.watermark).toBe(1);
  });

  it("test_does_not_mutate_the_ledger_it_is_given", () => {
    // React state that mutates in place does not re-render.
    const before = createApprovalLedger();
    ingest(before, thread(message(["a", "read_file"])));
    expect(before.entries).toHaveLength(0);
    expect(before.watermark).toBe(0);
  });
});

describe("approval ledger — settle", () => {
  it("test_a_settled_approval_leaves_the_queue_but_stays_in_the_ledger", () => {
    // "Asked and answered" and "never asked" are different states; only one stays out of the queue
    // when the same thread is ingested again.
    const led = settle(
      ingest(createApprovalLedger(), thread(message(["a", "read_file"], ["b", "run_shell"]))),
      "a",
    );
    expect(led.entries).toHaveLength(2);
    expect(findNextApproval(led)?.approvalId).toBe("b");
    expect(pendingCount(led)).toBe(1);
  });

  it("test_settling_an_unknown_id_is_a_no_op", () => {
    // A stale prompt settles an id this ledger never saw. Not worth throwing over.
    const led = ingest(createApprovalLedger(), thread(message(["a", "read_file"])));
    expect(settle(led, "nope")).toBe(led);
  });

  it("test_settling_twice_is_a_no_op", () => {
    // A double-click.
    const once = settle(ingest(createApprovalLedger(), thread(message(["a", "read_file"]))), "a");
    expect(settle(once, "a")).toBe(once);
  });

  it("test_re_ingesting_does_not_resurrect_a_settled_approval", () => {
    // The whole reason a settled entry is kept rather than removed.
    const t = thread(message(["a", "read_file"]));
    const settled = settle(ingest(createApprovalLedger(), t), "a");
    expect(findNextApproval(ingest(settled, t))).toBeUndefined();
  });
});

describe("approval ledger — prune", () => {
  it("test_drops_approvals_from_messages_a_backtrack_removed", () => {
    // Without this the ledger offers an approval for a tool call the user already undid, and the
    // id it settles refers to nothing.
    const led = ingest(
      createApprovalLedger(),
      thread(message(["a", "read_file"]), message(["b", "run_shell"])),
    );
    const pruned = prune(led, 1);
    expect(pruned.entries.map((e) => e.approvalId)).toEqual(["a"]);
    expect(pruned.watermark).toBe(1);
  });

  it("test_pruning_a_thread_that_did_not_shrink_changes_nothing", () => {
    const led = ingest(createApprovalLedger(), thread(message(["a", "read_file"])));
    expect(prune(led, 1)).toBe(led);
  });

  it("test_ingest_after_a_shrink_re_reads_from_the_start", () => {
    // The watermark is ahead of the thread, so incremental reading would skip everything.
    const led = ingest(
      createApprovalLedger(),
      thread(message(["a", "read_file"]), message(["b", "run_shell"])),
    );
    const backtracked = ingest(prune(led, 0), thread(message(["c", "write_file"])));
    expect(backtracked.entries.map((e) => e.approvalId)).toEqual(["c"]);
  });
});

describe("approval ledger — the declared queue policy", () => {
  it("test_findNextApproval_returns_the_OLDEST_unsettled", () => {
    const led = ingest(
      createApprovalLedger(),
      thread(message(["a", "read_file"]), message(["b", "run_shell"])),
    );
    expect(findNextApproval(led)?.approvalId).toBe("a");
  });

  it("test_it_deliberately_disagrees_with_findPendingApproval", () => {
    // THE point of the issue: both answers exist in one process, and this pins which is which so
    // the disagreement is a decision rather than a surprise.
    const t = thread(message(["a", "read_file"]), message(["b", "run_shell"]));
    expect(findPendingApproval(t)?.approvalId).toBe("b"); // newest first
    expect(findNextApproval(ingest(createApprovalLedger(), t))?.approvalId).toBe("a"); // oldest unsettled
  });

  it("test_the_returned_approval_carries_no_ledger_bookkeeping", () => {
    // It is a `PendingApproval` — the same shape the views take. Leaking `settled` would invite a
    // fourth declaration of the concept, which is what this issue is about.
    const led = ingest(createApprovalLedger(), thread(message(["a", "read_file"])));
    expect(findNextApproval(led)).toEqual({
      approvalId: "a",
      toolName: "read_file",
      input: { path: "src" },
    });
  });

  it("test_an_empty_or_fully_settled_ledger_has_nothing_next", () => {
    expect(findNextApproval(createApprovalLedger())).toBeUndefined();
    const settled = settle(ingest(createApprovalLedger(), thread(message(["a", "x"]))), "a");
    expect(findNextApproval(settled)).toBeUndefined();
    expect(pendingCount(settled)).toBe(0);
  });
});
