import { describe, expect, it } from "vitest";

import { createFakeStdin } from "../../../tests/renderer/fake-stdin.js";
import { createInputSource } from "./input-source.js";
import type { Key } from "./key.js";

// M19 T2.1 (plan m19-input-stack, ADR D1): the InputSource — raw stdin lifecycle,
// ref-counted setRawMode, key + paste channels (multi-subscriber). Driven by the
// fake stdin.

describe("createInputSource (M19 T2.1)", () => {
  it("dispatches_key_from_bytes", () => {
    const stdin = createFakeStdin();
    const source = createInputSource(stdin);
    const keys: { input: string; key: Key }[] = [];
    source.onKey((input, key) => keys.push({ input, key }));
    source.start();
    stdin.send("\x1b[D");
    expect(keys).toHaveLength(1);
    expect(keys[0]!.key.leftArrow).toBe(true);
    source.stop();
  });

  it("dispatches_paste_on_separate_channel_not_to_onKey", () => {
    const stdin = createFakeStdin();
    const source = createInputSource(stdin);
    const keys: string[] = [];
    const pastes: string[] = [];
    source.onKey((input) => keys.push(input));
    source.onPaste((content) => pastes.push(content));
    source.start();
    stdin.send("\x1b[200~hello world\x1b[201~");
    expect(pastes).toEqual(["hello world"]);
    expect(keys).toHaveLength(0); // paste NOT forwarded to the key channel
    source.stop();
  });

  it("paste_falls_through_to_key_channel_when_no_paste_listener", () => {
    const stdin = createFakeStdin();
    const source = createInputSource(stdin);
    const inputs: string[] = [];
    source.onKey((input) => inputs.push(input)); // no paste listener
    source.start();
    stdin.send("\x1b[200~abc\x1b[201~");
    expect(inputs).toEqual(["abc"]); // paste content flows as input
    source.stop();
  });

  it("supports_multiple_key_subscribers_and_unsubscribe", () => {
    const stdin = createFakeStdin();
    const source = createInputSource(stdin);
    const a: string[] = [];
    const b: string[] = [];
    source.onKey((input) => a.push(input));
    const offB = source.onKey((input) => b.push(input));
    source.start();
    stdin.send("x");
    offB(); // unsubscribe b
    stdin.send("y");
    expect(a).toEqual(["x", "y"]);
    expect(b).toEqual(["x"]); // b stopped after unsubscribe
    source.stop();
  });

  it("refcounts_raw_mode", () => {
    const stdin = createFakeStdin();
    const source = createInputSource(stdin);
    source.setRawMode(true);
    source.setRawMode(true); // two acquires
    expect(stdin.rawModeCalls).toEqual([true]); // raw enabled once
    source.setRawMode(false); // one release — still held
    expect(stdin.rawModeCalls).toEqual([true]);
    source.setRawMode(false); // last release — now off
    expect(stdin.rawModeCalls).toEqual([true, false]);
  });

  it("stop_removes_the_listener_and_releases_raw_mode", () => {
    const stdin = createFakeStdin();
    const source = createInputSource(stdin);
    const keys: string[] = [];
    source.onKey((input) => keys.push(input));
    source.start();
    source.setRawMode(true);
    source.stop();
    expect(stdin.rawModeCalls).toEqual([true, false]); // raw released on stop
    stdin.send("a"); // after stop → no dispatch
    expect(keys).toHaveLength(0);
  });

  it("start_is_idempotent", () => {
    const stdin = createFakeStdin();
    const source = createInputSource(stdin);
    const keys: string[] = [];
    source.onKey((input) => keys.push(input));
    source.start();
    source.start(); // second start must not double-subscribe stdin
    stdin.send("a");
    expect(keys).toEqual(["a"]); // exactly one dispatch, not two
    source.stop();
  });

  it("emits_kitty_handshake_on_start_and_disable_on_stop", () => {
    const stdin = createFakeStdin();
    const writes: string[] = [];
    const source = createInputSource(stdin, (data) => writes.push(data));
    source.start();
    expect(writes).toEqual(["\x1b[>1u\x1b[?u\x1b[c"]); // enable: push flag + query + DA
    source.stop();
    expect(writes).toEqual(["\x1b[>1u\x1b[?u\x1b[c", "\x1b[<u"]); // disable pop
  });

  it("intercepts_kitty_reply_as_awareness_not_a_key", () => {
    const stdin = createFakeStdin();
    const source = createInputSource(stdin);
    const keys: string[] = [];
    source.onKey((input) => keys.push(input));
    source.start();
    expect(source.isKittyActive()).toBe(false);
    stdin.send("\x1b[?1u"); // kitty handshake reply
    expect(source.isKittyActive()).toBe(true);
    expect(keys).toHaveLength(0); // the reply is NOT dispatched as a key
    source.stop();
  });

  it("holds_partial_sequence_across_two_data_events", () => {
    const stdin = createFakeStdin();
    const source = createInputSource(stdin);
    const keys: Key[] = [];
    source.onKey((_input, key) => keys.push(key));
    source.start();
    stdin.send("\x1b["); // partial CSI
    expect(keys).toHaveLength(0);
    stdin.send("D"); // completes → left arrow
    expect(keys).toHaveLength(1);
    expect(keys[0]!.leftArrow).toBe(true);
    source.stop();
  });
});
