import { render } from "ink-testing-library";
import { createElement, type ReactNode } from "react";
import { describe, expect, it } from "vitest";

import {
  initialTextBuffer,
  textBufferReducer,
  type TextBufferAction,
  type TextBufferState,
} from "../../text-buffer.js";
import { createFakeStdin } from "../../../tests/renderer/fake-stdin.js";
import { createInputSource, type InputSource } from "./input-source.js";
import type { Key } from "./key.js";
import { InputContext, useInput } from "./use-input.js";

// M19 T3.1: the composer-compat proof. The ChatComposer maps (input, key) →
// TextBufferAction and folds it through `textBufferReducer`; here we drive the
// SAME reducer through OUR useInput + projectKey + fake stdin and assert the
// buffer transitions — proving M15's composer runs unchanged on the new input
// stack (our projectKey matches Ink's, so the transitions are Ink-identical).
// State is held in a ref updated synchronously in the handler (the reducer
// transition — not React's async re-render — is what compat is about), incl. the
// M15 EC-5 error-propagation flow.

/** The composer's key→action mapping (chat-composer.tsx:93-110 essence). */
function keyToAction(input: string, key: Key): TextBufferAction | undefined {
  if (key.leftArrow) return { type: "move-left" };
  if (key.rightArrow) return { type: "move-right" };
  if (key.backspace || key.delete) return { type: "delete-backward" };
  if (input === "\n") return { type: "newline" };
  if (input.length > 0 && !key.ctrl && !key.meta)
    return { type: "insert", text: input };
  return undefined;
}

function Provider({
  source,
  children,
}: {
  source: InputSource;
  children: ReactNode;
}) {
  return createElement(InputContext.Provider, { value: source }, children);
}

function mountProbe(
  source: InputSource,
  ref: { current: TextBufferState },
  onSubmitThrow = false,
): void {
  function Probe() {
    useInput((input, key) => {
      if (key.return) {
        if (onSubmitThrow) {
          throw new Error("submit handler exploded");
        }
        return;
      }
      const action = keyToAction(input, key);
      if (action) {
        ref.current = textBufferReducer(ref.current, action);
      }
    });
    return null;
  }
  render(createElement(Provider, { source, children: createElement(Probe) }));
}

describe("composer compat on the M19 input stack (T3.1)", () => {
  it("typing_arrows_and_backspace_drive_the_buffer_identically", () => {
    const stdin = createFakeStdin();
    const source = createInputSource(stdin);
    source.start();
    const ref = { current: initialTextBuffer };
    mountProbe(source, ref);
    for (const ch of "hello") {
      stdin.send(ch);
    }
    expect(ref.current).toEqual({ text: "hello", cursorOffset: 5 });
    stdin.send("\x1b[D"); // left
    stdin.send("\x1b[D"); // left → cursor at 3
    stdin.send("\x7f"); // backspace → deletes "l" at index 2
    expect(ref.current.text).toBe("helo");
    expect(ref.current.cursorOffset).toBe(2);
  });

  it("ctrl_j_inserts_a_newline", () => {
    const stdin = createFakeStdin();
    const source = createInputSource(stdin);
    source.start();
    const ref = { current: initialTextBuffer };
    mountProbe(source, ref);
    stdin.send("a");
    stdin.send("\n"); // Ctrl+J → newline (not submit)
    stdin.send("b");
    expect(ref.current.text).toBe("a\nb");
  });

  it("ec5_submit_handler_throw_propagates_and_draft_survives", () => {
    // M15 EC-5: the composer never swallows a caller error — the exception
    // propagates synchronously through the stdin emit chain, and the draft
    // (buffer state) is preserved.
    const stdin = createFakeStdin();
    const source = createInputSource(stdin);
    source.start();
    const ref = { current: initialTextBuffer };
    mountProbe(source, ref, true);
    for (const ch of "draft") {
      stdin.send(ch);
    }
    expect(ref.current.text).toBe("draft");
    // The submit key's handler throws — the error must PROPAGATE, not be swallowed.
    expect(() => stdin.send("\r")).toThrow("submit handler exploded");
    // ...and the draft survives (state untouched by the failed submit).
    expect(ref.current.text).toBe("draft");
  });
});
