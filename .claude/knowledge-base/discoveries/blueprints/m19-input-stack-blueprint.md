---
question: How do we build an input stack (raw stdin, key parsing, bracketed paste, keybindings, useInput-compat, PTY e2e) for the custom react-reconciler renderer so M15's ChatComposer runs unchanged?
milestone_id: M19
created_at: 2026-07-08
verdict: SHIPPABLE_WITH_CAVEATS
---

# M19 Blueprint — Input Stack for the react-reconciler Terminal Renderer

**Scope:** raw stdin → parse → `Key` events → `useInput`-compat hook → keybindings → bracketed paste → kitty awareness → PTY e2e. M17/M18 gave the renderer OUTPUT; M19 gives it INPUT.

## Foundational facts (verified)

- `src/renderer/terminal.ts:9-20` — `Terminal` is **output-only**; header says input/kitty "arrive with M19". Zero stdin in `src/renderer/`.
- `src/chat-composer.tsx:44-57` already declares `interface ComposerKey` (12 fields) and casts Ink's key via `key as unknown as ComposerKey` (`:349`). **This interface IS the compat contract.**
- Ink 7.1.0. `@xterm/headless 5.5.0` (dev, `disableStdin:true` → output oracle only). No `node-pty`.

## 1. The `Key` compat surface (12 fields — composer runs unchanged iff correct)

| ComposerKey field | Source seq (Ink parse-keypress.js) | Composer usage |
|---|---|---|
| return | `\r` (0x0D), NOT `\n` | `:314/:331` submit gate |
| shift | uppercase / CSI modifier / kitty | `:66` isShiftReturn |
| leftArrow/rightArrow | `\x1b[D`/`\x1b[C` (+SS3 `\x1bOD/OC`) | `:93/:96` move |
| upArrow/downArrow | `\x1b[A`/`\x1b[B` | `:304/:310` menu |
| tab | `\t` / `\x1b[Z` | `:314` complete |
| escape | `\x1b` / `\x1b\x1b` | `:318` dismiss |
| backspace | `\x7f` or `\b` | `:99` delete-backward |
| delete | `\x1b[3~` | `:99` (conflated) |
| ctrl | `s.length===1 && s<=\x1a` | `:110` insertion guard |
| meta | ESC-prefixed | `:110` insertion guard |

**Two contracts NOT to break:** (1) Ctrl+J newline = `\n` (0x0A) arrives as `input==="\n"` with ALL key flags false (`:78-79`). (2) Printable insertion gate `:110`: `input.length>0 && !ctrl && !meta && input!=="\n"` — printables + paste bursts flow as raw `input`. Uppercase auto-shift (`use-input.js:100-102`) — replicate for fidelity.

## 2. Pipeline architecture (Ink 7 is the reference)

```
stdin (raw, utf8) → 'readable'→read() loop [App.js:175-199]
  → createInputParser().push(chunk) → InputEvent[]  [input-parser.js:166] (string=key | {paste})
  → emit('input', seq) / emit('paste', content)     [App.js:182-192]
  → useInput handleData: parseKeypress(seq)→Key      [use-input.js:39-64]
  → handler(input, key)                              [use-input.js:111-113]
```

**Two-stage split (the key insight):** Stage A `createInputParser()` (byte framer, stateful `pending` buffer, slices CSI/SS3/ESC-alt/paste/backspace-runs; flush-timer emits lone ESC after debounce, `App.js:164-174`). Stage B `parseKeypress(seq)` (pure: framed event → `{name,ctrl,meta,shift,sequence,...}`, `parse-keypress.js:366`). pi's `stdin-buffer.ts` (10ms timeout) is the same shape.

**New seam (ADR-1):** add a separate `InputSource` interface (NOT `Terminal.onData`) — `Terminal` is the output DIP boundary; input has an orthogonal lifecycle (raw-mode ref-count, paste channel, kitty handshake). `InputSource`: `start(onKey,onPaste)`, `stop()`, `setRawMode(bool)` (ref-counted like `App.js:208-256`). The `VirtualTerminal` output oracle stays input-free; a separate fake/pty implements input.

## 3. Bracketed paste

Enable `\x1b[?2004h` / disable `\x1b[?2004l` (`App.js:263/272`). Terminal wraps `\x1b[200~`…`\x1b[201~`; framer strips markers, delivers content atomically (may contain `\r\t\n`). **>10-line rule is EDITOR policy, not stdin:** pi `editor.ts:1183-1200` — if `pastedLines>10 || chars>1000`, store full text in a `pastes` Map + insert placeholder `[paste #1 +123 lines]`; else inline. Keep InputSource dumb (atomic paste string); put threshold in composer. **Ship `usePaste`-compat** (separate channel, Ink `use-paste.js` / `App.js:186-192`) so the marker rule is reachable; without it, paste falls through the `input` channel (composer still works, loses markers). Today M15 has NO paste handling — bursts ride the insertion gate.

## 4. Keybindings registry

pi `keybindings.ts:1-244`: semantic map `action → {defaultKeys}`, emacs defaults: ctrl+a/home→line-start, ctrl+e/end→line-end, ctrl+w→del-word-back, ctrl+u→del-to-start, ctrl+k→del-to-end, alt+b/alt+left→word-back, alt+f/alt+right→word-fwd, ctrl+y→yank. **Shape for M19:** `Keymap = Map<Chord, Action>` (remappable, chord like "ctrl+w"/"alt+f"/"up"). ChatComposer `handleBufferKey` (`:330`) rewires from hard-coded `if(key.leftArrow)` to `keymap.get(chord)→action→TextBufferAction`. **Gap:** word-nav/ctrl+w/u/k/undo have NO reducer actions yet — those are **M21** (ROADMAP:498). M19 ships the registry + emacs default table + the actions the M15 buffer already supports (`text-buffer.ts:12-24`). Keep the keymap a plain injectable map (YAGNI — no conflict-validation class).

## 5. useInput-compat WITHOUT Ink context

Ink's useInput needs `useStdinContext()` (`use-input.js:4,29`) — our renderer has no Ink App. Provide our own `InputContext` (InputSource + EventEmitter) at the renderer root. `useInput(handler,{isActive})`: (1) useEffect on isActive → `inputSource.setRawMode(true)`, cleanup false (ref-counted, `App.js:219-249` + `queueMicrotask` deferred-disable — port faithfully or raw mode thrashes on swaps); (2) useEffect → `emitter.on('key', handleData)`, cleanup removeListener; (3) handleData: parseKeypress→project 12-field Key→handler. Use `useEffectEvent` (React 19) for fresh closure without re-subscribe. isActive:false → no raw-mode/subscription (composer gates on isFocused `:354`).

## 6. PTY e2e (closes M15 EC-5)

**Trap:** @xterm/headless is an OUTPUT emulator (`virtual-terminal.ts:26` disableStdin:true) — it CANNOT drive raw-mode input, only verify the screen after. Two-tier (matches DoD "deterministic fake-stdin + PTY e2e"):
1. **Fast tier:** in-process `PassThrough` with `isTTY:true` + noop setRawMode; write byte fixtures (`\x1b[D`, paste, `\x03`); assert (input,key)+buffer. Ports the M15 fake-stdin suite onto the new hook.
2. **PTY tier (real path):** **node-pty** (dev dep) spawns a harness in a real pty → `stdin.isTTY===true`, real setRawMode; `pty.write(bytes)`; `pty.onData`→@xterm/headless→assert screenLines. Include EC-5 flow (onSubmit throws → no crash + draft survives). Reference: `references/agent-tui/` PTY harness.

Determinism levers: flush barrier (`virtual-terminal.ts:60-66`); ESC-flush debounce await (`App.js:164-174`); disable kitty handshake in tests (avoid 200ms timeout).

## 7. Kitty protocol — awareness + handshake ONLY (ADR-5)

Handshake: enable `\x1b[>1u\x1b[?u\x1b[c` (push flag 1=disambiguate + query + DA sentinel — pi's DA-sentinel `terminal.ts:15-17` avoids Ink's 200ms timeout → better test determinism); response `\x1b[?<flags>u` (flags≠0 = active); disable `\x1b[<u` on teardown. Flags bitmask (`kitty-keyboard.js:2-9`): 1 disambiguate, 2 event-types, 4 alt-keys, 8 all-as-esc, 16 assoc-text. **Composer needs NONE of kitty's disambiguation** (legacy encodings serve all 12 fields; Shift+Return is kitty-only nice-to-have). DoD says "awareness/handshake where available". Ship handshake + detection + `kittyActive` flag + teardown pop; DEFER full CSI-u decode to M21. Disable in tests.

## 8. Dependencies (Rule-9)

| Dep | Add? | Why |
|---|---|---|
| `node-pty` | **dev dep** | Only way to get real `isTTY` + `setRawMode` in a test; DoD "REAL raw-mode path" unreachable otherwise. @xterm can't be the source. MIT, industry-standard. Gate PTY tier so unit CI stays pure-JS (native build). |
| `@xterm/headless` | reuse (dev) | Screen oracle downstream of `pty.onData`. |
| keypress npm lib | **NO** | Port Ink's `parse-keypress.js` + `input-parser.js` into `src/renderer/input/` as MIT-attributed source (needed for M20 Ink-drop; reuse proven code, no new runtime dep). |
| `ink` | keep until M20 | Still the prod renderer until cutover; new stack runs parallel via the compat hook. |

## 9. Risks + open questions

1. **Raw-mode determinism in tests** — ESC-flush debounce + kitty 200ms timeout are the nondeterminism sources. Inject a clock; disable kitty in fast tier; use DA-sentinel.
2. **useInput ref-count/deferred-disable** subtlety — port Ink's dance faithfully or raw mode drops on swaps.
3. **Paste atomicity vs grapheme segmentation** (M19 risk #2) — framer `pending` holds partial UTF-8; marker logic runs on reassembled string over `Intl.Segmenter` (`text-buffer.ts:28`). Keep framing (InputSource) + marker (composer) separate layers.
4. **Kitty availability variance** (M19 risk #1) — awareness-only sidesteps; legacy fallback always works.

Open: ship usePaste-compat (yes — needed for DoD marker); port parser now (yes — decouple from Ink early); kitty flag 1 vs 7 (1 for M19); scope resize/SIGWINCH into M19? (`terminal.ts:6` defers to M18/M19 — input-adjacent, flag as sibling).

## ADRs

- **D1** — new `InputSource` seam, not `Terminal.onData` (SRP; output oracle stays input-free). Alt: onData on Terminal (rejected — conflates DIP boundaries).
- **D2** — two-stage parser (framer + semantics), ported from Ink MIT. Alt: monolithic (pi shape).
- **D3** — ship `usePaste`-compat on a separate channel. Alt: paste-through-input only (loses >10-line markers).
- **D4** — port Ink's parse-keypress/input-parser into our source. Alt: import ink internals (blocks M20 cutover) / new npm dep (reinvent).
- **D5** — kitty handshake + awareness only; defer full decode to M21. Alt: full kitty (YAGNI) / none (misses DoD awareness).
- **D6** — PTY e2e via node-pty (dev); @xterm/headless is the oracle not the driver. Alt: @xterm input injection (impossible) / fake-stdin only (doesn't close EC-5).

**Bottom line:** M19 = own `InputSource` (raw stdin + ported two-stage parser) + `useInput`/`usePaste`-compat hooks (own context) + a remappable emacs keymap + kitty handshake-awareness, proven by a deterministic fake-stdin tier AND a node-pty real-raw-mode e2e that closes M15 EC-5. Compat surface = the 12-field ComposerKey so M15's composer runs unchanged. Ink parser ported (not imported) to enable the M20 Ink-drop.
