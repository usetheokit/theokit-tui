import { render } from "ink-testing-library";
import { createElement, type ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { createFakeStdin } from "../../../tests/renderer/fake-stdin.js";
import { createInputSource, type InputSource } from "../../../src/renderer/input/input-source.js";
import type { Key } from "../../../src/renderer/input/key.js";
import { InputContext, useInput, usePaste } from "../../../src/renderer/input/use-input.js";

// M19 T2.1: the useInput/usePaste hooks over our InputContext. Mounted through
// ink-testing-library (React context works the same); driven by our own fake
// stdin (independent of Ink's).

function Provider({ source, children }: { source: InputSource; children: ReactNode }) {
  return createElement(InputContext.Provider, { value: source }, children);
}

describe("useInput / usePaste (M19 T2.1)", () => {
  it("subscribes_and_receives_keys_then_cleans_up_on_unmount", () => {
    const stdin = createFakeStdin();
    const source = createInputSource(stdin);
    source.start();
    const keys: Key[] = [];
    function Probe() {
      useInput((_input, key) => keys.push(key));
      return null;
    }
    const app = render(createElement(Provider, { source, children: createElement(Probe) }));
    stdin.send("\x1b[D");
    expect(keys).toHaveLength(1);
    expect(keys[0]!.leftArrow).toBe(true);
    app.unmount();
    stdin.send("\x1b[C"); // after unmount → no dispatch
    expect(keys).toHaveLength(1);
  });

  it("isActive_false_does_not_subscribe_or_acquire_raw_mode", () => {
    const stdin = createFakeStdin();
    const source = createInputSource(stdin);
    source.start();
    const keys: string[] = [];
    function Probe() {
      useInput((input) => keys.push(input), { isActive: false });
      return null;
    }
    render(createElement(Provider, { source, children: createElement(Probe) }));
    stdin.send("a");
    expect(keys).toHaveLength(0); // inactive → no dispatch
    expect(stdin.rawModeCalls).toHaveLength(0); // no raw-mode acquire
  });

  it("acquires_and_releases_raw_mode_around_active_mount", () => {
    const stdin = createFakeStdin();
    const source = createInputSource(stdin);
    source.start();
    function Probe() {
      useInput(() => {});
      return null;
    }
    const app = render(createElement(Provider, { source, children: createElement(Probe) }));
    expect(stdin.rawModeCalls).toEqual([true]);
    app.unmount();
    expect(stdin.rawModeCalls).toEqual([true, false]);
  });

  it("usePaste_receives_atomic_paste_on_its_own_channel", () => {
    const stdin = createFakeStdin();
    const source = createInputSource(stdin);
    source.start();
    const pastes: string[] = [];
    const keys: string[] = [];
    function Probe() {
      useInput((input) => keys.push(input));
      usePaste((content) => pastes.push(content));
      return null;
    }
    render(createElement(Provider, { source, children: createElement(Probe) }));
    stdin.send("\x1b[200~pasted text\x1b[201~");
    expect(pastes).toEqual(["pasted text"]);
    expect(keys).toHaveLength(0); // paste not forwarded to the key channel
  });

  it("no_context_provider_is_a_safe_noop", () => {
    // Without an InputContext provider the hook must not throw.
    const stdin = createFakeStdin();
    createInputSource(stdin);
    function Probe() {
      useInput(() => {});
      usePaste(() => {});
      return null;
    }
    expect(() => render(createElement(Probe))).not.toThrow();
  });
});
