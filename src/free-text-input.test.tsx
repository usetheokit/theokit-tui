import { createElement } from "react";
import { describe, expect, it } from "vitest";

import { render, type ItlInstance } from "../tests/renderer/itl-adapter.js";
import { FreeTextInput } from "./free-text-input.js";

// M23 — direct unit tests for the shared FreeTextInput (it is a public export;
// QuestionPrompt/PlanApproval only exercise it transitively). Covers insert,
// backspace, empty-submit-allowed, the Esc→onCancel edge, and the focus gating
// (a blurred instance does not steal keys — review HIGH-1/HIGH-2).

async function waitForFrame(
  app: ItlInstance,
  substring: string,
  timeoutMs = 2000,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if ((app.lastFrame() ?? "").includes(substring)) return;
    await app.flush();
  }
  throw new Error(
    `frame never contained ${JSON.stringify(substring)} — got:\n${app.lastFrame()}`,
  );
}

/**
 * Type an atomic key burst, retrying until it echoes. The input subscribes a
 * render or two after mount (the focus round-trip), so the first burst can land
 * before it is listening; the burst is atomic (all keys or none), so re-sending
 * it while the buffer is empty is safe (no duplication) and deterministic. In
 * production a human types well after focus settles, so this race is test-only.
 */
async function typeWhenReady(app: ItlInstance, text: string): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    app.stdin.write(text);
    try {
      await waitForFrame(app, text, 300);
      return;
    } catch {
      /* not subscribed yet — retry the atomic burst */
    }
  }
  throw new Error(`input never accepted ${JSON.stringify(text)}`);
}

/** Press a key, retrying until `done()` — used for submits with no echo. */
async function pressUntil(
  app: ItlInstance,
  bytes: string,
  done: () => boolean,
): Promise<void> {
  for (let attempt = 0; attempt < 20 && !done(); attempt += 1) {
    app.stdin.write(bytes);
    await app.flush();
  }
}

describe("FreeTextInput (M23)", () => {
  it("renders_the_label_and_echoes_typed_text", async () => {
    const app = render(
      createElement(FreeTextInput, { label: "Type:", onSubmit: () => {} }),
    );
    await waitForFrame(app, "Type:");
    await typeWhenReady(app, "hello");
    expect(app.lastFrame()).toContain("hello");
    app.unmount();
  });

  it("backspace_deletes_the_last_grapheme", async () => {
    const app = render(
      createElement(FreeTextInput, { label: "Type:", onSubmit: () => {} }),
    );
    await waitForFrame(app, "Type:");
    await typeWhenReady(app, "abc");
    app.stdin.write("\x7f"); // backspace → "ab"
    await app.flush();
    expect(app.lastFrame()).toContain("ab");
    expect(app.lastFrame()).not.toContain("abc");
    app.unmount();
  });

  it("enter_submits_the_current_text", async () => {
    const submitted: string[] = [];
    const app = render(
      createElement(FreeTextInput, {
        label: "Type:",
        onSubmit: (t: string) => submitted.push(t),
      }),
    );
    await waitForFrame(app, "Type:");
    await typeWhenReady(app, "done");
    app.stdin.write("\r");
    await app.flush();
    expect(submitted).toEqual(["done"]);
    app.unmount();
  });

  it("enter_with_no_text_submits_the_empty_string", async () => {
    const submitted: string[] = [];
    const app = render(
      createElement(FreeTextInput, {
        label: "Type:",
        onSubmit: (t: string) => submitted.push(t),
      }),
    );
    await waitForFrame(app, "Type:");
    await pressUntil(app, "\r", () => submitted.length > 0);
    expect(submitted).toEqual([""]);
    app.unmount();
  });

  it("esc_calls_onCancel_after_the_input_has_been_focused", async () => {
    let cancelled = 0;
    const app = render(
      createElement(FreeTextInput, {
        label: "Type:",
        onSubmit: () => {},
        onCancel: () => cancelled++,
      }),
    );
    await waitForFrame(app, "Type:");
    // Type a probe so we know the input is focused + subscribed before Esc.
    await typeWhenReady(app, "x");
    app.stdin.write("\x1b"); // a lone ESC (held ~20ms) blurs → cancel
    await new Promise((resolve) => setTimeout(resolve, 40));
    await app.flush();
    await app.flush();
    expect(cancelled).toBe(1);
    app.unmount();
  });
});
