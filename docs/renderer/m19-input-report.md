# M19 Input Stack — Compat + EC-5 Closure Report

**Milestone:** M19 (renderer input stack) · **Plan:** `m19-input-stack` · **ADRs:** D1–D6
**Date:** 2026-07-08

The renderer got its INPUT half: raw stdin → a two-stage parser (ported from Ink MIT) → the 12-field `Key` → `useInput`/`usePaste`-compat hooks → a remappable emacs keymap → kitty handshake-awareness. Proven by a deterministic fake-stdin tier AND a `node-pty` real-raw-mode e2e.

## The compat contract — the 12-field Key

Our `projectKey(sequence)` emits exactly the `ComposerKey` surface (`chat-composer.tsx:44-57`): `upArrow/downArrow/leftArrow/rightArrow/return/escape/ctrl/shift/tab/backspace/delete/meta` + the printable `input`. The two load-bearing composer contracts are preserved:

- **Ctrl+J = newline** — `\n` → `input === "\n"` with all key flags false (the composer inserts a newline in multiline mode).
- **Printable insertion gate** — printables + paste bursts flow as raw `input` with no ctrl/meta.

## Composer runs unchanged (compat proof)

`composer-compat.test.tsx` drives the composer's own `textBufferReducer` through OUR `useInput` + `projectKey` + fake stdin:

- typing "hello" → `{ text: "hello", cursorOffset: 5 }`
- left, left, backspace → `"helo"`, cursor 2
- Ctrl+J → `"a\nb"` (newline, not submit)

Because `projectKey` matches Ink's projection (asserted per-sequence in `key.test.ts`), the transitions are Ink-identical — M15's composer runs unchanged on the new stack. (The Ink-dependency swap in the shipped composer is M20's cutover.)

## M15 EC-5 — permanently closed on the REAL raw-mode path

M15's EC-5 ("the composer never swallows a caller error; the exception propagates synchronously and the draft survives") was previously proven only against **fake** stdin. M19 closes it on the **real** path.

- **Fake-stdin tier** (`composer-compat.test.tsx`): a submit handler that throws → the error propagates through the stdin emit chain (`expect(() => stdin.send("\r")).toThrow`), and the draft is intact.
- **PTY tier** (`pty-e2e.integration.test.ts`, `node-pty`): the harness runs in a REAL pseudo-terminal — `process.stdin.isTTY === true`, real `setRawMode`. The e2e writes bytes down the pty; the harness folds arrows/backspace into the buffer (`BUF:ac`) and, on submit, surfaces `SUBMIT_ERROR:submit exploded` + `DRAFT:hi` — the error is not swallowed and the draft survives on the real raw-mode path. **This is the literal "REAL raw-mode path" the DoD requires.**

Per EC-7, the PTY tier **SKIPs gracefully** (logged reason, never a false green) when node-pty's native module cannot build; the fake-stdin tier still gates. In this environment node-pty was built (node-gyp) and both e2e tests pass.

## Kitty keyboard protocol — handshake + awareness (D5)

`kitty.ts`: `KITTY_ENABLE` (`\x1b[>1u\x1b[?u\x1b[c` — push disambiguate flag + query + DA sentinel) / `KITTY_DISABLE` (`\x1b[<u`) / `detectKittyActive(reply)`. The InputSource intercepts a `\x1b[?<flags>u` reply as awareness state (`isKittyActive()`), never dispatching it as a key. Full CSI-u key decoding is deferred to M21 — the composer needs none of kitty's disambiguation (legacy encodings serve all 12 fields).

## Ported, not imported

`src/renderer/input/` has ZERO `ink/build` imports — the parser is ported from Ink's MIT source, unblocking the M20 Ink-drop.

## Coverage

Every input module at 100% lines: `parse-keypress`, `input-parser`, `key`, `input-source`, `use-input`, `keybindings`, `kitty`.
