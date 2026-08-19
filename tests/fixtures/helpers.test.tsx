import { describe, expect, it } from "vitest";

import { CodeBlock, ensureHighlighter } from "../../src/markdown/code-block.js";

import { renderFrame } from "./helpers.js";
import { stripAnsi } from "../../src/format/ansi.js";

// B-020 — what `renderFrame` actually guarantees, asserted by properties a mutation can reach.
//
// TWO ROUNDS OF THIS FILE WERE THEATRE, and recording that is the point. It was first written for a
// fake-timer `renderFrame` and asserted "the frame is produced under FROZEN time"; that mechanism
// was reverted (`5c1b809`) and the assertions were left describing something that no longer
// existed. The rewrite meant to fix THAT shipped three tests of which two were also unfalsifiable —
// measured independently by two reviewers, who mutated the helper and found:
//
//     mutant                                 tests failing
//     -----------------------------------    -------------
//     none (control)                         0 of 3
//     `instance.unmount()` removed           0 of 3
//     the determinism tick removed           0 of 3
//     helper returns ""  (soundness check)   3 of 3
//
// The last row proved the harness CAN detect a broken helper, so the two zero rows were real.
// `test_the_instance_is_unmounted_before_the_frame_is_returned` could never observe its property:
// `ink-testing-library` gives each `render()` its own output buffer, so a leaked instance cannot
// appear in a later frame no matter what.
//
// SO THIS ROUND ASSERTS ONLY WHAT A MUTANT CAN REACH. The determinism tick IS observable — through
// content that arrives ASYNCHRONOUSLY, which is what `setTimeout(0)` is actually waiting for.
// Syntax highlighting is exactly that, and it is how the microtask experiment was caught during
// B-020: reading one tick too early loses the colour bytes and a snapshot goes plain.
//
// The unmount is NOT asserted. It is real and it matters, and no test here can see it — saying so
// is better than a third test named after a property it cannot fail on.

const SNIPPET = "const x = 1;";
/** ANSI SGR — the observable difference between "read after the tick" and "read too early". */
// KEPT DELIBERATELY (B-055): this asserts an SGR is PRESENT, so it is not a stripper and does not
// belong in `format/ansi.ts`. It is the only `[0-9;]*m` construct left outside that module.
const SGR_RE = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`);

describe("renderFrame (B-020)", () => {
  it("test_static_content_renders_deterministically", async () => {
    const first = await renderFrame(<CodeBlock code={SNIPPET} />);
    const second = await renderFrame(<CodeBlock code={SNIPPET} />);

    expect(first).toContain("const x = 1;");
    expect(second).toBe(first);
  });

  it("test_the_tick_lets_asynchronous_content_land", async () => {
    // The helper's ONE timing guarantee, and the only mutation-reachable one: it yields a macrotask
    // so work React queued for this render completes before the frame is read. Highlighting is
    // asynchronous, so a helper that reads earlier returns the same TEXT with no colour.
    await ensureHighlighter();
    const frame = await renderFrame(
      <CodeBlock code={SNIPPET} language="typescript" />,
    );

    // The TEXT is unchanged by highlighting — only colour bytes are added, which is the invariant
    // `code-block.test.tsx` calls D8 text invariance.
    expect(stripAnsi(frame)).toContain("const x = 1;");
    // And the colour bytes ARE there, which is what a read-too-early helper loses.
    expect(SGR_RE.test(frame)).toBe(true);
  });

  it("test_the_frame_is_the_rendered_output_not_an_empty_string", async () => {
    // `lastFrame() ?? ""` means a helper that awaited wrongly would silently return "" and every
    // `not.toContain` in 35 files would pass vacuously — the defect class review found throughout
    // B-025 v1. This is the floor that stops it.
    const frame = await renderFrame(<CodeBlock code={SNIPPET} />);

    expect(frame).not.toBe("");
    expect(frame.trim().length).toBeGreaterThan(0);
  });
});
