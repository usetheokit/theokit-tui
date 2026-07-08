---
slug: m19-input-stack
milestone_id: M19
created_at: 2026-07-08
goal: Give the custom renderer an input stack (raw stdin, key parsing, bracketed paste, keybindings, useInput/usePaste-compat) so M15's ChatComposer runs unchanged, with a node-pty e2e closing M15 EC-5.
---

# Plan: m19-input-stack

## Goal

Add the INPUT half to the M17/M18 renderer: raw stdin → a two-stage parser
(byte framer + keypress semantics, ported from Ink MIT) → the 12-field
`ComposerKey` → `useInput`/`usePaste`-compat hooks over our own React context →
a remappable emacs keybindings registry → kitty-protocol handshake-awareness.
Proven by a deterministic fake-stdin tier AND a `node-pty` real-raw-mode e2e that
permanently closes the M15 EC-5 gap. The compat surface is exact so M15's
`ChatComposer` runs unchanged on the new stack (the shipped Ink-dependency swap
is M20's cutover; M19 delivers + proves the compat hook).

## Baseline Context

### Files that will be touched

| File | Role | Change |
|---|---|---|
| `src/renderer/input/parse-keypress.ts` | NEW | port of Ink `parse-keypress.js` — framed seq → `{name,ctrl,meta,shift,sequence,...}` |
| `src/renderer/input/input-parser.ts` | NEW | port of Ink `input-parser.js` — byte framer (CSI/SS3/ESC-alt/paste/backspace runs, `pending`) |
| `src/renderer/input/key.ts` | NEW | the 12-field `Key` projection (matches `ComposerKey`, `chat-composer.tsx:44-57`) |
| `src/renderer/input/input-source.ts` | NEW | `InputSource` (raw stdin lifecycle, ref-counted setRawMode, key + paste channels, kitty handshake) |
| `src/renderer/input/use-input.ts` | NEW | `useInput`/`usePaste`-compat hooks + `InputContext` (no Ink context) |
| `src/renderer/input/keybindings.ts` | NEW | remappable `Map<Chord, Action>` + emacs defaults |
| `src/renderer/input/index.ts` | NEW | barrel (subpath surface) |
| `tests/renderer/fake-stdin.ts` | NEW | `PassThrough` with isTTY:true + noop setRawMode (fast tier) |
| `tests/renderer/pty-e2e.integration.test.ts` | NEW | node-pty real-raw-mode e2e (closes EC-5) |
| `package.json` | deps | `node-pty` (dev) |

### Current callers / dependents

- `src/chat-composer.tsx:349` casts Ink's key via `key as unknown as ComposerKey`; consumes exactly the 12 fields (`:44-57`). Two contracts: Ctrl+J = `\n` with all flags false (`:78-79`); printable/paste insertion gate `:110`. M19 must reproduce these.
- `src/renderer/terminal.ts` is output-only; M19 adds a sibling `InputSource` (NOT `Terminal.onData` — ADR D1).
- No component is rewired in M19 (that is M20); M19 proves compat via a test mounting the composer's input logic on our stack.

### Domain glossary

- **framer (Stage A)** — stateful byte slicer; holds `pending`; emits complete key/paste events.
- **parseKeypress (Stage B)** — pure fn: one framed seq → semantics.
- **InputSource** — raw stdin lifecycle: `start(onKey,onPaste)`, `stop()`, ref-counted `setRawMode`.
- **bracketed paste** — `\x1b[200~`…`\x1b[201~`; markers stripped, content atomic.
- **chord** — `"ctrl+w"`/`"alt+f"`/`"up"`; keymap key.
- **kitty handshake** — `\x1b[>1u\x1b[?u\x1b[c` enable+query+DA-sentinel; `\x1b[<u` teardown.

### Architecture boundaries affected

- `src/renderer/input/` is a new island under the renderer; imports NOTHING from the Ink component path. It MAY be exported at a subpath later (M20). The parser is ported (not imported from `ink/build`) so the M20 Ink-drop is unblocked (ADR D4).

## Prior Art

- **Blueprint:** `.claude/knowledge-base/discoveries/blueprints/m19-input-stack-blueprint.md` (SHIPPABLE_WITH_CAVEATS) — the 12-field surface, two-stage parser map, ADRs D1–D6.
- **Ink 7 (MIT, studied):** `node_modules/ink/build/{parse-keypress,input-parser}.js`, `hooks/use-input.js`, `hooks/use-paste.js`, `components/App.js`, `kitty-keyboard.js`, `ink.js`.
- **pi (MIT):** `references/pi/packages/tui/src/{terminal,stdin-buffer,keybindings}.ts`, `components/editor.ts:1183` (>10-line paste marker).
- **agent-tui (MIT):** PTY automation harness idiom.

## ADRs

### D1 — new `InputSource` seam, not `Terminal.onData`
Input has an orthogonal lifecycle (raw-mode ref-count, paste channel, kitty handshake) from the output DIP boundary. **Alt:** onData on Terminal (conflates SRP; pollutes the output oracle).

### D2 — two-stage parser (framer + semantics), ported from Ink MIT
**Alt:** monolithic (pi shape — less unit-testable per sequence).

### D3 — ship `usePaste`-compat on a separate channel
Needed to reach the >10-line atomic-marker DoD; matches Ink (paste never leaks to `useInput` when a paste listener exists). **Alt:** paste-through-input only (loses markers).

### D4 — port Ink's parser into our source (not import `ink/build`, not a new npm dep)
Needed for the M20 Ink-drop; reuse proven MIT code. **Alt:** import ink internals (blocks cutover) / new npm keypress dep (reinvent).

### D5 — kitty handshake + awareness ONLY for M19; full CSI-u decode deferred to M21
DoD says "awareness/handshake where available"; the composer needs none of kitty's disambiguation. **Alt:** full kitty (YAGNI) / none (misses DoD).

### D6 — PTY e2e via `node-pty` (dev dep); @xterm/headless is the oracle not the driver
Only node-pty makes `isTTY` true + real `setRawMode` — the literal "REAL raw-mode path" closing EC-5. **Alt:** @xterm input injection (impossible — `disableStdin:true`) / fake-stdin only (doesn't close EC-5).

## Dependencies

| Package | Version | Scope | Rule 9 justification |
|---|---|---|---|
| `node-pty` | `1.1.0` | **dev** | Only way to get real `isTTY` + `setRawMode` in a test; DoD "REAL raw-mode path" unreachable otherwise. MIT, industry-standard (VS Code/hyper). Native build → gate the PTY tier so unit CI stays pure-JS. |

deps-audit 2026-07-08: node-pty 1.1.0 MIT, latest, no known advisories. NO runtime deps added (parser ported, not depended on).

## Critical paths

- `src/renderer/input/parse-keypress.ts` — the semantics (mutation-test target; every sequence class).
- `src/renderer/input/input-parser.ts` — the framer (paste/pending/backspace-run correctness).
- `src/renderer/input/input-source.ts` — raw-mode ref-count + deferred-disable (thrash-free).
- `src/renderer/input/use-input.ts` — the compat projection + subscription lifecycle.

## Phase 1: The parser — bytes → the 12-field Key

### T1.1 — parse-keypress + input-parser port + Key projection

#### Objective
Port Ink's byte framer + keypress semantics into pure, unit-testable modules that turn a raw stdin byte stream into the exact 12-field `Key` the composer consumes.

#### Why this step (action + reasoning)
1. **What:** RED — per-sequence oracles (arrows/ctrl/meta/backspace/delete/tab/escape/return/Ctrl+J-newline/paste framing/backspace-run split); GREEN — port `input-parser.js` (framer) + `parse-keypress.js` (semantics) + `key.ts` (projection).
2. **Why now:** everything downstream (InputSource, hooks) needs the byte→Key transform; it is pure and the foundation.

#### Evidence
Blueprint §1 (Key surface), §2 (two-stage), ADR D2/D4; Ink `parse-keypress.js:366-493`, `input-parser.js:1-193`, `use-input.js:40-64`.

#### Files to edit
```
src/renderer/input/parse-keypress.ts / parse-keypress.test.ts (NEW)
src/renderer/input/input-parser.ts / input-parser.test.ts (NEW)
src/renderer/input/key.ts (NEW) / CHANGELOG.md
```

#### TDD
```
RED: parses_arrow_keys() — "\x1b[D"→{leftArrow:true}; "\x1b[C"→right; "\x1bOA"→up (SS3)
RED: parses_ctrl_and_meta() — "\x03"→{ctrl:true,name:"c"}; "\x1bb"→{meta:true}
RED: parses_backspace_delete_tab_escape_return() — "\x7f"→backspace; "\x1b[3~"→delete; "\t"→tab; "\x1b"→escape; "\r"→return
RED: ctrl_j_is_newline_with_all_flags_false() — "\n"→{input:"\n", return:false, ctrl:false, meta:false} (composer contract :78-79)
RED: uppercase_sets_shift() — "A"→{input:"A", shift:true}
RED: framer_splits_bracketed_paste() — "\x1b[200~abc\x1b[201~" → one paste event {paste:"abc"}, markers stripped
RED: framer_splits_held_backspace_run() — "\x7f\x7f\x7f" → 3 backspace events
RED: framer_holds_partial_sequence_in_pending() — push("\x1b[") returns no event; push("D") completes leftArrow
VERIFY: pnpm vitest run src/renderer/input/parse-keypress.test.ts src/renderer/input/input-parser.test.ts
```

#### Concurrency tests
(none — single-threaded)

#### Acceptance Criteria
- [ ] `pnpm vitest run src/renderer/input/parse-keypress.test.ts src/renderer/input/input-parser.test.ts` exits 0; both files at 100% lines
- [ ] RED exit recorded before the modules exist (progress notes)
- [ ] `key.ts` emits EXACTLY the 12 `ComposerKey` fields (asserted against `chat-composer.tsx:44-57`)
- [ ] Zero Ink imports in `src/renderer/input/` (ported, not imported — grep clean)

#### DoD (Definition of Done)
- [ ] `pnpm gates` exits 0

## Phase 2: InputSource + useInput/usePaste-compat + keybindings

### T2.1 — InputSource + hooks + keymap

#### Objective
Wrap raw stdin in an `InputSource` (ref-counted raw mode, key + paste channels), provide `useInput`/`usePaste`-compat hooks over our own `InputContext`, and a remappable emacs keybindings registry — all driven deterministically by a fake stdin.

#### Why this step (action + reasoning)
1. **What:** RED — InputSource dispatches key/paste from fed bytes; useInput subscribes/cleans up/gates on isActive; ref-counted raw mode; keymap resolves chords→actions. GREEN — InputSource + hooks + InputContext + keymap.
2. **Why now:** the parser (T1.1) exists; this makes it consumable by React components exactly like Ink's useInput.

#### Evidence
Blueprint §2 (InputSource seam), §4 (keybindings), §5 (hook without Ink ctx), ADR D1/D3; Ink `use-input.js:27-124`, `use-paste.js`, `App.js:208-256`; pi `keybindings.ts`.

#### Files to edit
```
src/renderer/input/input-source.ts / input-source.test.ts (NEW)
src/renderer/input/use-input.ts / use-input.test.tsx (NEW)
src/renderer/input/keybindings.ts / keybindings.test.ts (NEW)
src/renderer/input/index.ts (NEW) / tests/renderer/fake-stdin.ts (NEW) / CHANGELOG.md
```

#### TDD
```
RED: input_source_dispatches_key_from_bytes() — feed "\x1b[D" → onKey called with leftArrow Key
RED: input_source_dispatches_paste_on_separate_channel() — feed bracketed paste → onPaste("abc"), onKey NOT called
RED: input_source_refcounts_raw_mode() — two setRawMode(true) then one false keeps raw on; both false → off
RED: use_input_subscribes_and_cleans_up() — mount handler receives keys; unmount → no more dispatch
RED: use_input_isActive_false_no_subscription() — isActive:false → handler never called, raw mode not acquired
RED: use_paste_receives_atomic_paste() — a bracketed paste reaches the usePaste handler as one string
RED: keymap_resolves_emacs_chords() — "ctrl+w"→"delete-word-back"; "alt+f"→"move-word-forward"; remap overrides default
VERIFY: pnpm vitest run src/renderer/input/input-source.test.ts src/renderer/input/use-input.test.tsx src/renderer/input/keybindings.test.ts
```

#### Concurrency tests
(none — single-threaded; the raw-mode ref-count is synchronous)

#### Acceptance Criteria
- [ ] `pnpm vitest run src/renderer/input/input-source.test.ts src/renderer/input/use-input.test.tsx src/renderer/input/keybindings.test.ts` exits 0; input-source + use-input + keybindings at 100% lines
- [ ] RED exit recorded (progress notes)
- [ ] Raw-mode ref-count is thrash-free (a same-tick acquire/release swap does not drop raw mode — asserted)
- [ ] `usePaste` is a SEPARATE channel (a paste does not also fire `useInput`)

#### DoD (Definition of Done)
- [ ] `pnpm gates` exits 0

## Phase 3: Composer compat + kitty awareness + node-pty e2e

### T3.1 — composer-on-new-stack proof + kitty handshake + PTY e2e (closes EC-5)

#### Objective
Prove M15's `ChatComposer` input logic runs unchanged on the new stack, add the kitty handshake-awareness, and a `node-pty` real-raw-mode e2e that permanently closes M15 EC-5.

#### Why this step (action + reasoning)
1. **What:** RED — the composer's key handling produces the SAME buffer transitions on our useInput as on Ink's (fast tier); kitty handshake emits the right bytes + detects; node-pty e2e drives a real TTY and asserts the screen + EC-5 (onSubmit throws → no crash, draft survives). GREEN — kitty handshake in InputSource; the compat proof; the PTY harness.
2. **Why now:** terminal integration + evidence step; release follows review.

#### Evidence
Blueprint §3 (paste), §6 (PTY), §7 (kitty), ADR D5/D6; Ink `kitty-keyboard.js`, `ink.js:819-871`; pi `terminal.ts:15-17`; `references/agent-tui/`; M15 EC-5 (`chat-composer.tsx` env caveat + composer tests).

#### Files to edit
```
src/renderer/input/input-source.ts (kitty handshake) / src/renderer/input/kitty.ts (NEW)
src/renderer/input/composer-compat.test.tsx (NEW — composer buffer transitions on our useInput)
tests/renderer/pty-e2e.integration.test.ts (NEW) / package.json (node-pty dev) / docs/renderer/m19-input-report.md (NEW) / CHANGELOG.md
```

#### TDD
```
RED: composer_key_transitions_match_ink_on_our_useInput() — feed arrows/backspace/return through our stack; assert the TextBufferState transitions equal the Ink-driven baseline
RED: kitty_handshake_emits_enable_query_da_and_disables_on_teardown() — start writes "\x1b[>1u\x1b[?u\x1b[c"; stop writes "\x1b[<u"
RED: kitty_detects_active_from_response() — feed "\x1b[?1u" → kittyActive true; a DA-only reply → false
RED: pty_e2e_drives_real_raw_mode_and_renders() — node-pty spawns a harness; pty.write("\x1b[D"...); pty.onData→xterm→screenLines asserts the cursor/char moved (stdin.isTTY===true in the child)
RED: pty_e2e_ec5_onSubmit_throw_does_not_crash_and_draft_survives() — script a submit whose handler throws; assert process alive + draft text still on screen (closes M15 EC-5)
VERIFY: pnpm vitest run src/renderer/input/composer-compat.test.tsx tests/renderer/pty-e2e.integration.test.ts
```

#### Concurrency tests
(none — single-threaded)

#### Failure scenarios (external I/O — the PTY subprocess)
- node-pty spawn failure / not built → the PTY tier SKIPs with a logged reason (never a false green); the fast fake-stdin tier still runs and gates.
- Child process hang → the e2e has a hard timeout; on timeout the test FAILs loudly with the captured screen.
- Partial UTF-8 across stdin chunks → the framer `pending` buffer holds it (asserted in T1.1); the e2e feeds a multi-byte paste to exercise reassembly.

#### Acceptance Criteria
- [ ] `pnpm vitest run src/renderer/input/composer-compat.test.tsx` exits 0 — the composer's buffer transitions on our useInput equal the Ink-driven baseline (compat proven)
- [ ] kitty handshake emits/detects the correct bytes; `kitty.ts` at 100% lines
- [ ] `tests/renderer/pty-e2e.integration.test.ts` drives a REAL raw-mode TTY (`stdin.isTTY===true` in the child) and asserts the rendered screen; the EC-5 flow (onSubmit throw) is proven — no crash, draft survives
- [ ] `docs/renderer/m19-input-report.md` documents the compat surface + the EC-5 closure with evidence

#### DoD (Definition of Done)
- [ ] `pnpm gates` exits 0

## Edge cases absorbed
(EC-1 Ctrl+J newline all-flags-false → T1.1; EC-2 held-backspace run split → T1.1; EC-3 partial-sequence pending → T1.1; EC-4 paste atomic on separate channel → T2.1; EC-5 raw-mode thrash-free ref-count → T2.1; EC-6 kitty unavailable → legacy fallback always works → T3.1; EC-7 node-pty unbuilt → PTY tier SKIPs, fast tier gates → T3.1; EC-8 M15 EC-5 onSubmit-throw → T3.1 PTY e2e)

## Coverage Matrix

| # | Gap / Requirement (source) | Task(s) | Resolution |
|---|---|---|---|
| 1 | M19 DoD-1: stdin buffer — escape parsing, bracketed paste atomic, kitty handshake (ROADMAP § M19) | T1.1, T2.1, T3.1 | framer + InputSource paste channel + kitty.ts |
| 2 | M19 DoD-2: keybindings registry (emacs, remappable), consumed by ChatComposer (ROADMAP § M19) | T2.1, T3.1 | keymap + composer-compat proof |
| 3 | M19 DoD-3: useInput-compat so M15 composer runs unchanged (ROADMAP § M19) | T1.1, T2.1, T3.1 | 12-field Key + hooks + compat test |
| 4 | M19 DoD-4: PTY e2e drives REAL raw-mode path, closes M15 EC-5 (ROADMAP § M19) | T3.1 | node-pty e2e + EC-5 flow |
| 5 | M19 DoD-5: gates/coverage/CHANGELOG (ROADMAP § M19) | T1.1–T3.1 | per-task gates |
| 6 | M19 risk-1: kitty availability variance (blueprint risk 1) | T3.1 | awareness-only + legacy fallback |
| 7 | M19 risk-2: paste atomicity vs grapheme segmentation (blueprint risk 2) | T1.1, T3.1 | pending buffer + separate marker layer |
| 8 | Deps: node-pty CVE pass (blueprint §8) | (deps-audit gate) | node-pty 1.1.0 MIT, no advisories |

**Coverage: 8/8 (100%)**

## Drawbacks & Risks

| Drawback / Risk | Severity | Mitigation | Owner |
|---|---|---|---|
| Raw-mode determinism in tests | High | inject a clock; disable kitty in fast tier; node-pty tier has a hard timeout | implement |
| node-pty native build in CI | Medium | dev-only dep; PTY tier SKIPs gracefully when unbuilt; fast tier gates | implement |
| useInput ref-count/deferred-disable subtlety | Medium | port Ink's dance faithfully; a thrash-free assertion | implement |
| Paste atomicity vs grapheme boundaries | Medium | pending buffer holds partial UTF-8; keep framing + marker layers separate | implement |
| kitty availability variance | Low | awareness-only; legacy encodings serve all 12 fields | implement |

## Unresolved Questions
- Ship `usePaste` in M19 or defer? → **Ship** (blueprint D3 — needed for the >10-line marker DoD reachability; the composer marker policy itself is M21).
- Wire the SHIPPED ChatComposer onto our useInput now? → **No** — that Ink-dependency swap is M20's cutover. M19 proves compat via a test; the shipped composer keeps Ink's useInput until M20.
- Scope resize/SIGWINCH into M19? → **Sibling, deferred** — input-adjacent but not in the M19 DoD; revisit at M20 cutover.

## Failure scenarios (when I/O external)
See Phase 3 "Failure scenarios" (the node-pty subprocess is the only external I/O; the InputSource otherwise reads an in-process stdin stream).

## Test Plan
Per-sequence parser oracles + framer paste/pending/backspace-run + InputSource dispatch/ref-count + hook subscribe/isActive/cleanup + keymap resolve/remap + composer-compat buffer-transition equality + kitty handshake bytes + node-pty real-raw-mode e2e (incl. EC-5). Discipline per `.claude/rules/testing.md` (§4.1 negatives — unknown sequence, kitty-absent, node-pty-unbuilt; §6 determinism — injected clock, no real timers in unit tier). Two consecutive full runs green.

## Global Definition of Done
- [ ] All tasks committed gates-gated (1 task = 1 commit, FULL `pnpm gates`)
- [ ] 12-field Key compat proven; composer buffer transitions match Ink on our stack
- [ ] node-pty e2e drives real raw-mode; M15 EC-5 closed with evidence
- [ ] Zero Ink imports in `src/renderer/input/`; parser ported (unblocks M20)
- [ ] Plan archived post-release
