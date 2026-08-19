import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

// B-031 — measured against production ink, and the harness is the point.
//
// `ink-testing-library` reports the OPPOSITE of production for every property here: `renderFrame`
// discards the throw, which is how B-025 came to be built on the premise that a fired guard leaves
// "a blank region with nothing recorded anywhere". Production is loud, and loud in three wrong
// ways — it unmounts the whole tree, prints a developer stack to the end user, and exits 0.
//
// The exit code cannot be observed in-process at all: it is a property of process teardown. So
// these drive a REAL `render()` in a child process and assert on what that process leaves behind.
//
// Named `.integration.` and not `.subprocess.`: `integration` and `e2e` are the only qualifiers this
// repo registers (ADR 0003), and its own structure test caught the invented third one.

const FIXTURE = fileURLToPath(
  new URL("../../tests/fixtures/boundary-app.tsx", import.meta.url),
);

interface Run {
  readonly stdout: string;
  readonly exitCode: number;
}

/**
 * Every assertion below must first establish that the child RENDERED. Without this, a child that
 * failed to start produces `""` — which contains no absolute path, no `file:line` and no reconciler
 * frame, so two of these tests would pass on an empty string while measuring nothing. That vacuous
 * pass is the defect class this repository keeps finding (B-022's `toContain("")`), and it appeared
 * here on the first run.
 */
function expectRendered(run: Run): void {
  expect(run.stdout.trim().length).toBeGreaterThan(0);
}

function renderInChildProcess(
  opts: { wrapped: boolean; throws?: boolean; presetExit?: number } = {
    wrapped: true,
  },
): Run {
  try {
    const stdout = execFileSync("npx", ["tsx", FIXTURE], {
      encoding: "utf8",
      timeout: 30_000,
      env: {
        ...process.env,
        WRAPPED: opts.wrapped ? "1" : "0",
        THROW: opts.throws === false ? "0" : "1",
        ...(opts.presetExit === undefined
          ? {}
          : { PRESET_EXIT: String(opts.presetExit) }),
        FORCE_COLOR: "0",
      },
      stdio: "pipe",
    });
    return { stdout, exitCode: 0 };
  } catch (error) {
    const e = error as { status?: number; stdout?: string; signal?: string };
    // A timeout arrives as a signal, not a status. It must FAIL rather than read as a crash the
    // test was hoping for — otherwise a hung child looks like a passing assertion.
    if (e.signal) throw new Error(`fixture did not exit: signal ${e.signal}`);
    return { stdout: e.stdout ?? "", exitCode: e.status ?? 1 };
  }
}

describe("ComponentBoundary (B-031)", () => {
  // THE BASELINE. Every test below asserts what the boundary CHANGES, and review found that none of
  // them asserted what it changes it FROM: all four ran wrapped, so `renderInChildProcess(false)`
  // was dead code and the three defects were documented rather than tested. If ink began containing
  // errors on its own, or the throw stopped reaching React, the wrapped assertions would keep
  // passing while this component did nothing (F-tests-2).
  it("test_without_the_boundary_the_app_dies_shows_a_stack_and_reports_success", () => {
    // Act
    const bare = renderInChildProcess({ wrapped: false });

    // Assert — the three measured defects, pinned so the fix has something to be a fix OF.
    expectRendered(bare);
    expect(bare.stdout).not.toContain("ABOVE-SURVIVED");
    expect(bare.stdout).not.toContain("BELOW-SURVIVED");
    expect(bare.stdout).toMatch(/boundary-app\.tsx:\d+/);
    expect(bare.exitCode).toBe(0);
  });

  it("test_a_failing_component_does_not_take_its_siblings_with_it", () => {
    // Arrange / Act
    const wrapped = renderInChildProcess({ wrapped: true });

    // Assert — both siblings render, and the failure is visibly contained rather than absent. The
    // positive anchor matters: without it a mutant that never caught anything still passes
    // (F-tests-4).
    expect(wrapped.stdout).toContain("ABOVE-SURVIVED");
    expect(wrapped.stdout).toContain("BELOW-SURVIVED");
    expect(wrapped.stdout).toContain("[SelectList unavailable]");
  });

  it("test_the_fallback_names_the_component_that_failed", () => {
    // The only thing the end user sees, and it was asserted NOWHERE: emptying the fallback, or
    // dropping the `component` prop from it, survived every test in the first version — the suite
    // would not have noticed the boundary rendering a blank region, which is the exact B-025
    // premise this slice exists to correct (F-tests-5).
    const wrapped = renderInChildProcess({ wrapped: true });

    expect(wrapped.stdout).toContain("[SelectList unavailable]");
  });

  it("test_the_end_user_is_not_shown_a_source_excerpt_or_a_path", () => {
    // Arrange / Act
    const wrapped = renderInChildProcess({ wrapped: true });

    // Assert — ink prints the path RELATIVE (`src/status/fixtures/boundary-app.tsx:22`), which the
    // first version of this test missed: it asserted the absence of a LEADING-SLASH form that never
    // appears, so it passed identically on broken and fixed code (F-tests-3). Measured on the bare
    // baseline: 0 occurrences with the slash, 2 without.
    expectRendered(wrapped);
    expect(wrapped.stdout).toContain("[SelectList unavailable]");
    expect(wrapped.stdout).not.toMatch(/boundary-app\.tsx:\d+/);
    expect(wrapped.stdout).not.toContain("react-reconciler");
  });

  it("test_a_crash_does_not_report_success_to_the_shell", () => {
    // Arrange / Act
    const wrapped = renderInChildProcess({ wrapped: true });

    // Assert — the defect that hides all the others: a CLI that died reporting SUCCESS, so any
    // script, CI job or supervisor treats the crash as a clean run.
    expectRendered(wrapped);
    expect(wrapped.exitCode).not.toBe(0);
  });

  it("test_a_narrower_exit_code_the_consumer_already_set_is_not_overwritten", () => {
    // Review's scenario, measured: a CLI that exits 2 for a usage error, then hits a contained guard
    // failure, used to exit 1 — the boundary destroying the more specific truth with a generic one.
    // The plan's mitigation ("the consumer can set it back") only covered writes AFTER the catch,
    // which a consumer cannot schedule (F-arch-1).
    const preset = renderInChildProcess({ wrapped: true, presetExit: 2 });

    expectRendered(preset);
    expect(preset.exitCode).toBe(2);
  });

  it("test_a_healthy_subtree_renders_unchanged_and_leaves_the_exit_code_alone", () => {
    // This test used to render the THROWING fixture and assert only that a sibling appeared — a
    // strict subset of the test above, promising a healthy subtree and an untouched exit code while
    // asserting neither. A mutant rendering the fallback ALWAYS — every healthy component in the
    // package replaced by `[X unavailable]` — survived it (F-tests-1, F-arch-3).
    const healthy = renderInChildProcess({ wrapped: true, throws: false });

    expect(healthy.stdout).toContain("ABOVE-SURVIVED");
    expect(healthy.stdout).toContain("MIDDLE-RENDERED");
    expect(healthy.stdout).toContain("BELOW-SURVIVED");
    expect(healthy.stdout).not.toContain("unavailable");
    expect(healthy.exitCode).toBe(0);
  });
});
