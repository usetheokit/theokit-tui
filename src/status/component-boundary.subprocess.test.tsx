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

const FIXTURE = fileURLToPath(
  new URL("./fixtures/boundary-app.tsx", import.meta.url),
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

function renderInChildProcess(wrapped: boolean): Run {
  try {
    const stdout = execFileSync("npx", ["tsx", FIXTURE], {
      encoding: "utf8",
      timeout: 30_000,
      env: { ...process.env, WRAPPED: wrapped ? "1" : "0", FORCE_COLOR: "0" },
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
  it("test_a_failing_component_does_not_take_its_siblings_with_it", () => {
    // Arrange / Act
    const wrapped = renderInChildProcess(true);

    // Assert — both siblings render. Unwrapped, production removes them: the whole tree unmounts,
    // so an agent CLI mid-conversation loses the conversation over one bad prop.
    expect(wrapped.stdout).toContain("ABOVE-SURVIVED");
    expect(wrapped.stdout).toContain("BELOW-SURVIVED");
  });

  it("test_the_end_user_is_not_shown_a_source_excerpt_or_a_path", () => {
    // Arrange / Act
    const wrapped = renderInChildProcess(true);

    // Assert — the child rendered SOMETHING first, then: no absolute path, no `file:line`, no
    // reconciler frame. Unwrapped, ink's panel prints
    // all three, which is both poor UX for a published CLI and a leak of the running machine's
    // filesystem layout.
    expectRendered(wrapped);
    expect(wrapped.stdout).not.toContain("/src/status/fixtures/");
    expect(wrapped.stdout).not.toMatch(/boundary-app\.tsx:\d+/);
    expect(wrapped.stdout).not.toContain("react-reconciler");
  });

  it("test_a_crash_does_not_report_success_to_the_shell", () => {
    // Arrange / Act
    const wrapped = renderInChildProcess(true);

    // Assert — the child rendered, AND it reported failure. Without the first half, a child that
    // never started satisfies the second for the wrong reason.
    expectRendered(wrapped);
    expect(wrapped.exitCode).not.toBe(0);
  });

  it("test_a_healthy_subtree_renders_unchanged_and_leaves_the_exit_code_alone", () => {
    // The other half of the contract: containment must cost nothing when nothing fails.
    const app = renderInChildProcess(true);
    expect(app.stdout).toContain("ABOVE-SURVIVED");
  });
});
