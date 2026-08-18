import { Text } from "ink";
import { describe, expect, it } from "vitest";

import { renderFrame } from "./helpers.js";

// B-020 — what `renderFrame` actually guarantees, after the fix that did not survive.
//
// HISTORY, because the alternative is a file whose narrative contradicts its own code. This suite
// was written for a fake-timer version of `renderFrame` and asserted that the frame is produced
// under FROZEN time. That mechanism was measured to BREAK stdin delivery in other tests and was
// reverted (`5c1b809`), so the assertions were left describing a mechanism that no longer exists:
// one rendered `<Text>static</Text>` and called it a spinner test, and its sibling asserted
// `vi.isFakeTimers() === false` against a helper that never installs them. Both were unfalsifiable.
// Found by review (F-tests-2), and rewritten rather than deleted — the helper still has properties
// worth pinning, they are just narrower than the ones that were claimed.
//
// WHAT IS TRUE AT HEAD. `renderFrame` renders, awaits one macrotask, reads `lastFrame()` and
// unmounts. It is deterministic for STATIC content and it does NOT freeze time, so an animated
// frame read through it remains load-sensitive. That residual sensitivity is B-020's open half:
// the two fixes that DID ship were a measured `testTimeout` and the removal of one clock-reading
// assertion, neither of which touches this helper.

describe("renderFrame (B-020)", () => {
  it("test_static_content_renders_deterministically", async () => {
    const first = await renderFrame(<Text>static</Text>);
    const second = await renderFrame(<Text>static</Text>);

    expect(first).toContain("static");
    expect(second).toBe(first);
  });

  it("test_the_instance_is_unmounted_before_the_frame_is_returned", async () => {
    // The helper unmounts before returning, which is what stops 35 callers from leaking an ink
    // instance each. Asserted through the observable consequence: a second render of DIFFERENT
    // content is unaffected by the first, so no previous tree is still painting.
    await renderFrame(<Text>first-tree</Text>);
    const frame = await renderFrame(<Text>second-tree</Text>);

    expect(frame).toContain("second-tree");
    expect(frame).not.toContain("first-tree");
  });

  it("test_the_frame_is_the_rendered_output_not_an_empty_string", async () => {
    // `lastFrame() ?? ""` means a helper that awaited too early would silently return "" and every
    // `not.toContain` assertion in 35 files would pass vacuously — the defect class review found
    // throughout B-025 v1. This is the floor that stops it.
    const frame = await renderFrame(<Text>content-present</Text>);

    expect(frame).not.toBe("");
    expect(frame.trim().length).toBeGreaterThan(0);
  });
});
