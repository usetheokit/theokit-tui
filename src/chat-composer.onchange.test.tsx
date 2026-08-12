import { render } from "ink-testing-library";
import { describe, expect, it, vi } from "vitest";

import { ChatComposer } from "./chat-composer.js";
import { TheoTUIProvider } from "./theme.js";

const tick = () => new Promise((r) => setTimeout(r, 0));

// Poll-until-condition instead of a fixed sleep (review F-tests-8 — a fixed
// 50 ms settle is a flake surface under CI load; testing.md § 6).
/**
 * B-125 — write `input` until it lands, rather than assuming two ticks were enough to subscribe.
 *
 * `useInput` attaches AFTER the mount frame, so a write issued before that is silently dropped —
 * and "two ticks" is a guess about scheduling, not a fact about the component. Under a loaded suite
 * the guess is wrong about one run in twenty, and the symptom is this file's `waitFor` timing out
 * two seconds later, far from the cause.
 *
 * Re-writing is the right compensation because a dropped keystroke is exactly what happened: the
 * component never saw it, so sending it again is not a retry of a failed assertion but a resend of
 * a lost event.
 */
const typeUntil = async (
  inst: { stdin: { write: (s: string) => void } },
  input: string,
  landed: () => boolean,
  timeoutMs = 2000,
) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    inst.stdin.write(input);
    for (let i = 0; i < 10; i += 1) {
      await tick();
      if (landed()) return;
    }
  }
};

const waitFor = async (predicate: () => boolean, timeoutMs = 2000) => {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) return;
    await tick();
  }
};

/**
 * M54 (agent-builder backtrack) — `onChange` reports buffer text so the host can enforce a
 * composer-empty precondition (Codex `is_normal_backtrack_mode`); `initialValue` seeds the
 * draft being restored.
 */
describe("ChatComposer onChange", () => {
  it("fires_with_current_text_as_the_buffer_changes", async () => {
    const onChange = vi.fn();
    const inst = render(
      <TheoTUIProvider>
        <ChatComposer onSubmit={() => {}} onChange={onChange} />
      </TheoTUIProvider>,
    );
    await tick();
    await tick();
    inst.stdin.write("hi");
    // The last onChange reflects the typed text.
    await waitFor(() => onChange.mock.calls.at(-1)?.[0] === "hi");
    const calls = onChange.mock.calls.map((c) => c[0]);
    expect(calls.at(-1)).toBe("hi");
    inst.unmount();
  });

  // Review M3 (F-tests-4 / F-wire-6): the prop-to-reducer wiring and the
  // documented "fires after mount with the initial text" contract — the exact
  // composer-empty-precondition handshake the backtrack feature needs.
  it("initialValue_renders_seeded_text_and_onChange_fires_it_after_mount", async () => {
    const onChange = vi.fn();
    const inst = render(
      <TheoTUIProvider>
        <ChatComposer
          onSubmit={() => {}}
          onChange={onChange}
          initialValue="draft"
        />
      </TheoTUIProvider>,
    );
    await waitFor(() => onChange.mock.calls.length > 0);
    // (a) the seeded draft appears in the frame…
    expect(inst.lastFrame()).toContain("draft");
    // (b) …and onChange fired after mount with the initial text.
    expect(onChange.mock.calls[0]?.[0]).toBe("draft");
    // The seeded draft stays editable — typing appends at the seeded cursor.
    // Two ticks: the useInput subscription attaches after the mount frame
    // (same idiom as the sibling test above).
    await typeUntil(
      inst,
      "!",
      () => onChange.mock.calls.at(-1)?.[0] === "draft!",
    );
    expect(onChange.mock.calls.at(-1)?.[0]).toBe("draft!");
    inst.unmount();
  });
});

describe("issue #59 item 3 — an unstable onChange identity does not re-fire", () => {
  it("a re-render with a new INLINE callback and unchanged text does not call again", async () => {
    // F-arch-7 / F-tui-10: the effect depended on `[buffer.text, onChange]`, so an
    // `onChange={(t) => something(t)}` — the form every consumer writes — re-fired on
    // each host render with the text UNCHANGED. The documented contract is "after mount
    // with the initial text, and on every edit"; firing on an identity change is
    // neither of those.
    const spy = vi.fn();
    // The spy is stable, but the function PASSED IN is new on every render — the real case.
    const tree = () => (
      <TheoTUIProvider>
        <ChatComposer onSubmit={() => {}} onChange={(t) => spy(t)} />
      </TheoTUIProvider>
    );
    const inst = render(tree());
    await waitFor(() => spy.mock.calls.length > 0);
    await tick();
    const antes = spy.mock.calls.length;

    inst.rerender(tree());
    await tick();
    await tick();

    expect(spy.mock.calls.length).toBe(antes);
    inst.unmount();
  });
});
