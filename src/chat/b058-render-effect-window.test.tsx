/**
 * B-058 — is there a window where the frame shows FOCUS and `useInput` is not yet subscribed?
 *
 * ink's `useInput` registers its handler inside a `useEffect` keyed on `isActive`
 * (`node_modules/ink/build/hooks/use-input.js`). So when focus lands the order is:
 *
 *     isFocused=true  ->  RENDER (frame shows the cursor)  ->  commit  ->  effects  ->  on('input')
 *
 * `ink-testing-library`'s `stdin.write` is SYNCHRONOUS — it emits 'data' to whoever is listening
 * at that instant. A write landing between the render and the effect is therefore dropped, with
 * the focus indicator visibly present in the last frame. That is exactly what run 9 recorded.
 *
 * ARM A writes the moment the cursor appears. ARM B waits for the cursor AND one macrotask.
 * If the mechanism is real, A loses keystrokes and B does not.
 */
import { describe, expect, it } from "vitest";
import { render } from "ink-testing-library";
import React from "react";
import { ChatComposer } from "./chat-composer.js";
import { TheoTUIProvider } from "../theme/theme.js";

const CURSOR = "\u001B[7m";
const hasCursor = (f: string) => f.includes(CURSOR) || f.includes("▏");
const tick = () => new Promise((r) => setTimeout(r, 0));

const ATTEMPTS = 60;

async function runArm(waitAMacrotaskAfterCursor: boolean): Promise<number> {
  let lost = 0;
  for (let i = 0; i < ATTEMPTS; i++) {
    const inst = render(
      <TheoTUIProvider>
        <ChatComposer onSubmit={() => {}} />
      </TheoTUIProvider>,
    );
    // Spin until the frame shows the cursor — the signal `mount` currently trusts.
    for (let n = 0; n < 400 && !hasCursor(inst.lastFrame() ?? ""); n++)
      await tick();
    if (waitAMacrotaskAfterCursor) await tick();

    inst.stdin.write("z");
    for (let n = 0; n < 200 && !(inst.lastFrame() ?? "").includes("z"); n++)
      await tick();
    if (!(inst.lastFrame() ?? "").includes("z")) lost++;
    inst.unmount();
  }
  return lost;
}

describe("B-058 render-vs-effect window", () => {
  it("a_write_one_macrotask_after_the_cursor_is_never_lost", async () => {
    // THE INVARIANT `mount` DEPENDS ON. Asserted strictly, because if it ever fails the helper is
    // handing every composer test a dropped first keystroke.
    //
    // It holds by ORDERING rather than by duration: React schedules passive effects on a
    // MessageChannel task, and a MessageChannel task always drains before a `setTimeout` callback
    // in Node. Under load the yield gets longer; it does not get earlier.
    const lost = await runArm(true);
    expect(lost).toBe(0);
  }, 120_000);

  it("a_write_at_the_first_cursor_frame_is_lost_because_useInput_is_not_subscribed_yet", async () => {
    // THE HAZARD ITSELF, pinned so the yield above is never removed as "belt and braces".
    // Measured 60/60 — deterministic, not flaky.
    //
    // Asserted as `> 0` rather than `=== ATTEMPTS` deliberately. If a future ink subscribes
    // synchronously, this goes to 0 and the test fails — which is the RIGHT failure: it means the
    // guard can be reconsidered, and a red test is how anyone would find that out. What it must
    // never do is pass silently while the hazard quietly changes shape.
    const lost = await runArm(false);
    expect(lost).toBeGreaterThan(0);
  }, 120_000);
});
