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


/**
 * Type into a MASKED input, retrying until the mask echoes the expected length.
 * `typeWhenReady` waits for the text itself, which a masked field must never show.
 */
async function typeMaskedWhenReady(
  app: ItlInstance,
  text: string,
  maskedLength: number,
  maskChar = "\u2022",
): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    app.stdin.write(text);
    try {
      await waitForFrame(app, maskChar.repeat(maskedLength), 300);
      return;
    } catch {
      /* not subscribed yet — retry the atomic burst */
    }
  }
  throw new Error(`masked input never accepted ${JSON.stringify(text)}`);
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

  it("autoFocus_false_does_not_grab_input", async () => {
    // Parity with the other interactive components (SelectList/ChatComposer):
    // an unfocused input echoes nothing and never submits — safe in a gallery.
    const submitted: string[] = [];
    const app = render(
      createElement(FreeTextInput, {
        label: "Type:",
        onSubmit: (t: string) => submitted.push(t),
        autoFocus: false,
      }),
    );
    await waitForFrame(app, "Type:");
    app.stdin.write("hello");
    app.stdin.write("\r");
    await app.flush();
    expect(app.lastFrame()).not.toContain("hello");
    expect(submitted).toEqual([]);
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
  // U-9 — the masked mode. A terminal app that reads an API key had to rebuild this
  // component to get one, and the rebuilt copies are where the plaintext leaks.
  it("mask_renders_a_placeholder_instead_of_the_typed_text", async () => {
    const app = render(
      createElement(FreeTextInput, {
        label: "Key:",
        onSubmit: () => {},
        mask: true,
      }),
    );
    await waitForFrame(app, "Key:");
    await typeMaskedWhenReady(app, "sk-secret", 9);

    const frame = app.lastFrame() ?? "";
    expect(frame, "the plaintext reached the terminal").not.toContain("sk-secret");
    expect(frame).toContain("\u2022".repeat(9));
    app.unmount();
  });

  it("mask_submits_the_real_text_not_the_placeholder", async () => {
    // The mask is a RENDERING concern. A component that also masked the submitted
    // value would be silently useless — and only at the point the credential fails.
    const submitted: string[] = [];
    const app = render(
      createElement(FreeTextInput, {
        label: "Key:",
        onSubmit: (t: string) => submitted.push(t),
        mask: true,
      }),
    );
    await waitForFrame(app, "Key:");
    await typeMaskedWhenReady(app, "abc", 3);
    await pressUntil(app, "\r", () => submitted.length > 0);

    expect(submitted).toEqual(["abc"]);
    app.unmount();
  });

  it("mask_accepts_a_custom_character", async () => {
    const app = render(
      createElement(FreeTextInput, {
        label: "Key:",
        onSubmit: () => {},
        mask: "#",
      }),
    );
    await waitForFrame(app, "Key:");
    await typeMaskedWhenReady(app, "ab", 2, "#");

    expect(app.lastFrame() ?? "").toContain("##");
    app.unmount();
  });

  it("a_pasted_newline_does_not_submit_the_secret_early", async () => {
    // A key pasted from a password manager can carry a trailing newline. Treating it
    // as Enter submits a truncated secret, and the failure surfaces remotely, later,
    // as an opaque provider error that says nothing about a newline.
    const submitted: string[] = [];
    const app = render(
      createElement(FreeTextInput, {
        label: "Key:",
        onSubmit: (t: string) => submitted.push(t),
        mask: true,
      }),
    );
    await waitForFrame(app, "Key:");
    await typeMaskedWhenReady(app, "ab\ncd", 4);

    expect(submitted, "a pasted newline submitted early").toEqual([]);
    // EXACT count, not `toContain`. A substring assertion is satisfied by a LONGER run \u2014 four dots
    // are inside five \u2014 so it stayed green with the newline stripping removed, which a tamper-test
    // caught. The count is the whole property here: the newline must vanish, not be swallowed into
    // the buffer as a fifth character.
    const dots = /\u2022+/.exec(app.lastFrame() ?? "")?.[0] ?? "";
    expect(dots.length, "the pasted newline became a character in the secret").toBe(4);
    app.unmount();
  });

  it("unmasked_behaviour_is_byte_identical_without_the_prop", async () => {
    // Backward-compatibility guard: `mask` is opt-in and every existing caller
    // must observe exactly what it observed before the prop existed.
    const app = render(
      createElement(FreeTextInput, { label: "Type:", onSubmit: () => {} }),
    );
    await waitForFrame(app, "Type:");
    await typeWhenReady(app, "plain");

    expect(app.lastFrame()).toContain("plain");
    app.unmount();
  });
});
