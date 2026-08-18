import { render } from "ink";
import React from "react";
import { describe, expect, it } from "vitest";

import { UsagePanel } from "../metrics/usage-panel.js";

import type { GuardSink } from "./guard-sink.js";

// B-025 v2 T2.4 and T3.1 — the two things v1 could not know, because it never drove a real render.
//
// Every measurement behind v1 was taken through `renderFrame` (`tests/fixtures/helpers.tsx`),
// which wraps `ink-testing-library`. That harness resolves with an empty frame on a render-time
// throw, and v1 promoted that artifact to a claim about production. Measured here with ink's own
// `render`: ink ships an `ErrorBoundary` (`ink/build/components/ErrorBoundary.js`, wired at
// `App.js:550`), it fires, prints an `ERROR` panel with a stack, unmounts the whole tree, and the
// process exits 0 (all filed as B-031).
//
// So these tests exist to assert the two properties a harness cannot see:
//
//   T2.4 — how many records ONE logical guard failure produces, given React re-invokes a
//          component whose render threw. If that number is not 1, "no deduplication, so the
//          operator can count fires" is false and the docblock must say so.
//   T3.1 — that a bad prop on a real component reaches the sink AT ALL. /review proved this was
//          asserted by nothing: replacing both `reportGuardFailure(...)` calls in `usage-panel.tsx`
//          with a plain `throw` left all 16 usage-panel tests green.

/** Collect records without touching the operator's terminal. */
function collectingSink(): { sink: GuardSink; records: string[] } {
  const records: string[] = [];
  return {
    sink: {
      write: (s: string): boolean => {
        records.push(s);
        return true;
      },
    },
    records,
  };
}

/**
 * Render `element` with the REAL ink renderer and tear it down.
 *
 * `reportGuardFailure` runs SYNCHRONOUSLY inside the render body, so the record exists the moment
 * `render()` returns — there is nothing to await for the assertions below.
 *
 * `waitUntilExit()` is deliberately NOT used: it resolves in a real terminal (measured) but hangs
 * under vitest, where stdout is not a TTY. Discovering that is itself part of why this file exists
 * — the harness and the product differ, which is the mistake v1 made in the other direction.
 *
 * stdout is swapped for the duration because a throwing tree makes ink print its ERROR panel
 * there, and a passing test should not paint a stack over the reporter's output. The panel is
 * B-031's subject, not this file's.
 */
function renderForReal(element: React.ReactElement): void {
  const realWrite = process.stdout.write;
  process.stdout.write = ((): boolean => true) as typeof process.stdout.write;
  try {
    const app = render(element);
    app.unmount();
  } catch {
    // ink may rethrow synchronously depending on where the boundary catches. Either way the
    // record was already written; that is what the assertions check.
  } finally {
    process.stdout.write = realWrite;
  }
}

const goodTurn = { inputTokens: 12_000, outputTokens: 3_000, totalTokens: 15_000 };

describe("the sink under a real ink render (B-025 v2 T2.4, T3.1)", () => {
  it("test_a_bad_prop_on_UsagePanel_reaches_the_sink_through_a_real_render", () => {
    const { sink, records } = collectingSink();
    // The panel's guards call `reportGuardFailure` with the DEFAULT sink, so the only way to
    // observe them from a render is to redirect the default. That is itself the finding behind
    // /review F-dom-4 and plan Q2: a consumer has no per-call lever either.
    const realStderrWrite = process.stderr.write;
    process.stderr.write = ((s: unknown): boolean => sink.write(String(s))) as typeof process.stderr.write;
    try {
      renderForReal(
        React.createElement(UsagePanel, { usage: { ...goodTurn, cost: Number.NaN } }),
      );
    } finally {
      process.stderr.write = realStderrWrite;
    }

    expect(records.join("")).toContain("UsagePanel: usage.cost");
  });

  it("test_record_count_under_real_render", () => {
    const { sink, records } = collectingSink();
    const realStderrWrite = process.stderr.write;
    process.stderr.write = ((s: unknown): boolean => sink.write(String(s))) as typeof process.stderr.write;
    try {
      renderForReal(
        React.createElement(UsagePanel, { usage: { ...goodTurn, cost: Number.NaN } }),
      );
    } finally {
      process.stderr.write = realStderrWrite;
    }

    // MEASURED, not chosen. The number below was read from a first run and then pinned; if a React
    // or ink upgrade changes it, this test is the thing that says so, and `guard-sink.ts` states
    // the same number.
    expect(records.length).toBe(RECORDS_PER_FIRE);
  });
});

/**
 * Records produced by ONE logical guard failure. MEASURED, not chosen.
 *
 * 2026-08-18: **2**, and stable across `NODE_ENV=test` and `NODE_ENV=production` — so it is React
 * 19's error-recovery re-invocation of a component whose render threw, not StrictMode's double
 * render. `/review` (frontend F-dom-1) measured the same doubling independently.
 *
 * This number is why `guard-sink.ts` no longer says the absence of deduplication lets an operator
 * count fires: two records for one fire means the count is a renderer implementation detail, not a
 * measurement. What survives is the reason not to deduplicate — a guard firing every render is a
 * repeating problem and collapsing it to one line hides it.
 *
 * Pinned rather than asserted loosely (`>= 1`) so that a React or ink upgrade changing it is
 * reported by this test instead of silently changing what the docblock claims.
 */
const RECORDS_PER_FIRE = 2;
