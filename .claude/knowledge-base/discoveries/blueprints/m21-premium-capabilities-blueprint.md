# BLUEPRINT — M21: Renderer V4 Premium Capabilities (Inline Images · Editor Upgrade · Fuzzy + @-Provider)

**Slug:** `m21-premium-capabilities` · **Milestone:** M21 (deps M20) · **Date:** 2026-07-08 · **Type:** DISCOVER blueprint (prior-art + design recommendations; no production code)

## Executive summary

All three features have a single dominant MIT prior-art source in `references/pi/packages/tui/`. pi hand-rolls all three with zero image/fuzzy npm deps. Its implementations are small pure unit-testable modules that map ~1:1 onto our existing seams:

- **Images** → pi `terminal-image.ts` (encoders + capability matrix) + `components/image.ts` (grid integration). Hard decision: a zero-display-width escape sequence coexisting with our `string-width` cell grid — pi solves it with a "sequence-as-line + N blank filler rows" convention the line-diff `output-engine` can adopt.
- **Editor** → pi `kill-ring.ts`, `undo-stack.ts`, `word-navigation.ts` + history in `components/editor.ts`. Extend `text-buffer.ts` + the already-named-but-unimplemented `defaultKeymap` actions (`keybindings.ts:58-70`).
- **Fuzzy + @** → pi `fuzzy.ts` (subsequence scorer) + a Node `fs` cwd walk (respect `.gitignore`); plug into `slash-menu-model.ts` by generalizing the trigger from `/`-only to a trigger registry.

**Rule 9 verdict:** images + editor → hand-roll (following pi; the "libraries" are protocol string builders + small pure reducers). Fuzzy → judgment call (ADR-C1: pi/codex hand-roll; gemini uses `fzf@0.5.2`; opencode `fuzzysort@3.1.0`) → recommend hand-roll pi's scorer. `@`-file-walk → adopt the `ignore` npm package for `.gitignore` (Rule 9), hand-roll the walk on `fs`.

## Coverage Corner 1 — Integration seams

| Feature | Extends (file:line) | Nature |
|---|---|---|
| Image encoders | new `src/renderer/terminal-image.ts` | pure; DIP-consistent with `Terminal` |
| Image component | new `src/image.tsx`; `output-engine.ts:22-30,140` | raw-passthrough line convention |
| Image capability | `terminal.ts:9-20` (add `capabilities`), `input/kitty.ts:20-23` | env-matrix + optional runtime query |
| Kill-ring/undo/word-nav | `text-buffer.ts:12-24`, `keybindings.ts:58-70` | new reducer actions + ring/undo state outside the pure reducer |
| History recall | `chat-composer.tsx:334-349` | ↑/↓ interception, mirrors `handleMenuKey` |
| Fuzzy | `slash-menu-model.ts:65` (`.startsWith` → fuzzy) | swap prefix for scorer |
| @-provider | `slash-menu-model.ts:48-88`, `chat-composer.tsx:260-332` | generalize trigger `/` ∪ `@` |

## Coverage Corner 2 — Dependencies

- `Intl.Segmenter` (stdlib, already used `text-buffer.ts:28`) — grapheme + word (`granularity:"word"`).
- `structuredClone` (stdlib) — undo snapshots (pi `undo-stack.ts:12`).
- `node:fs/promises` (stdlib) — `@` walk (hand-roll).
- `ignore` (npm, MIT, 5.x) — `.gitignore` parsing (adopt; Rule 9).
- `Buffer` + magic-byte parse (stdlib) — image intrinsic dims (hand-roll pi `terminal-image.ts:291-430`).
- fuzzy matcher — hand-roll pi `fuzzy.ts` (ADR-C1); `fzf@0.5.2` documented fallback.

`/deps-audit` to confirm `ignore` at PLAN time. No CVE surface from the stdlib path.

## Coverage Corner 3 — Tools / test harness

- Unit: pure modules via `vitest`, no TTY (mirrors `text-buffer.test.ts`).
- Capability matrix: inject `process.env` (pi `setCapabilities`/`resetCapabilitiesCache` seam).
- Integration: `@xterm/headless` VirtualTerminal asserts escape bytes + row accounting.
- PTY e2e: `node-pty` + harness (DoD "PTY e2e coverage") — real ↑/↓/C-y/C-k.
- Bench: OWN bench for the editor path (reducer+ring per keystroke).

## Coverage Corner 4 — Techniques

- Kitty APC graphics, 4096-byte chunking, `q=2`, `C=1` no-cursor-move (pi `terminal-image.ts:165-209`).
- iTerm2 OSC 1337 `File=` `inline=1` base64 name (pi `:227-250`).
- PNG/JPEG/GIF/WebP magic-byte dims (pi `:291-430`).
- Kill-ring accumulation prepend/append + `lastAction` coalescing (pi `kill-ring.ts:19-28`).
- Undo via full-state `structuredClone` + word-boundary coalescing (pi `undo-stack.ts` + `editor.ts:1084-1097`).
- Word boundaries via `Intl.Segmenter({granularity:"word"})` + ASCII-punct split (pi `word-navigation.ts`).
- Subsequence fuzzy: consecutive-run bonus, gap penalty, word-boundary bonus, exact-match bonus (pi `fuzzy.ts:12-93`).

## FEATURE A — Inline Images (`<Image>`)

Port pi's two-file structure:
1. `src/renderer/terminal-image.ts` (pure): `encodeKitty`, `encodeITerm2`, `getImageDimensions`, `calculateImageCellSize` (default cell 9×18px), `detectCapabilities` env-matrix, `imageFallback` (`[Image: name [image/png] 800x600]`).
2. `src/image.tsx`: emits a reconciler node carrying the escape sequence + declared row count → output-engine raw line (ADR-A2).

**Capability matrix (port pi `terminal-image.ts:65-125`), env-var first:** TMUX/screen/zellij → `null` (mux corrupts); KITTY_WINDOW_ID/ghostty/wezterm/warp → `kitty`; ITERM_SESSION_ID → `iterm2`; WT/vscode/alacritty/jetbrains/unknown → `null` (text fallback). Cross-checked with codex `image_protocol.rs:112-195` (same conclusions; mux-safety universal). M19 kitty keyboard reply is secondary corroboration only — env-matrix is primary (no blocking query on the hot path).

**Critical constraint (drives ADR-A2):** `output-grid.ts:7,37-41` measures every run with `stringWidth`; `output-engine.ts` line-diffs with relative cursor moves inside CSI-2026. An image escape has display width 0 but occupies real rows → desyncs the grid. pi solves it (`components/image.ts:90-111`): image = one grid line with the sequence + `rows-1` blank filler lines. Kitty (`C=1`) on the first line; iTerm2 (moves cursor) prepends `\x1b[${rows-1}A` and places the sequence on the last line.

**ADRs:** A1 — ship kitty+iTerm2, defer Sixel (heavyweight encoder, YAGNI). A2 — raw-passthrough width-exempt line + row-span in output-engine (NOT a side-channel — breaks CSI-2026 atomicity; NOT absolute addressing — M20 review established it breaks under scroll). A3 — component takes `base64Data + mimeType`, magic-byte dims (no decode/sharp), cell-fit; file-path reading deferred (keeps component pure).

**Edge cases:** unsupported→fallback text; NO_COLOR orthogonal; malformed base64→null dims→default/fallback, never throw; tmux/screen/zellij forced null; chunk boundary at 4096; image taller than viewport (filler vs clip); kitty image-id collisions (random id + cleanup on unmount).

## FEATURE B — ChatComposer Editor Upgrade (readline-grade)

pi is the only readline-grade source (bubbles has word-delete only; codex/gemini/opencode/others none). Keymap already declares the actions (`keybindings.ts:58-70`). **State placement (SRP):** kill-ring/undo/history are stateful across keystrokes → held by the composer (refs), NOT inside the pure `textBufferReducer`; the reducer gains only pure edit primitives (kill variants return `{state, killed}`).

**B.1 Kill-ring** (port pi `kill-ring.ts:8-46`): `push(text,{prepend,accumulate})`, `peek()` (yank), `rotate()` (yank-pop). Coalesce via `lastAction==="kill"` (`editor.ts:1515-1551`). Chords: `C-k`/`C-u`/`C-w` (in keymap) + new `C-y` yank (`\x19`), `M-y` yank-pop (`alt+y`).

**B.2 Undo** (port pi `undo-stack.ts:1-28`, `structuredClone` snapshots of `{text,cursorOffset}`): fish-style word-boundary coalescing (snapshot before space/punct/structural op, `editor.ts:1084-1097`); paste = one snapshot (atomic undo); chord `C-_` (`\x1f`). **Redo deferred** (pi ships one-way; YAGNI).

**B.3 Word-nav** (port pi `word-navigation.ts:1-118`): pure `findWordBackward/Forward` via `Intl.Segmenter({granularity:"word"})`, ASCII-punct-aware; wire `move-word-back/forward`, `delete-word-back`, `M-d delete-word-forward`.

**B.4 History ↑/↓** (port pi `editor.ts:298-443`): array + `historyIndex` (−1 = live draft), dedup consecutive, cap 100, plain scroll (not prefix-search), session-only (expose `onHistoryChange` prop for app-owned persistence — ADR-B3). Gate: only when menu closed AND cursor on first line (pi `editor.ts:809-822`). Add `handleHistoryKey` before `handleBufferKey` (mirror `handleMenuKey` order).

**Edge cases:** yank-pop with empty ring no-op; undo past empty no-op; word-nav over emoji (grapheme-safe segmenter); C-k on empty line kills newline; coalescing resets on cursor move; history ↑ on multiline draft moves cursor not recall; paste during kill-chain resets lastAction.

## FEATURE C — Fuzzy + `@`-File-Path Provider

**C.1 Fuzzy** — hand-roll pi `fuzzy.ts:12-93` (subsequence scorer, ~90 lines): consecutive-run bonus, gap penalty, word-boundary bonus (`[\s\-_./:]`), exact-match bonus; lower=better. `fuzzyFilter` tokenizes on `[\s/]+`, all tokens must match. **ADR-C1:** hand-roll (candidate sets tiny — slash cmds single-digit, @-files hundreds; `fzf`/`fuzzysort` async/index over-engineered — YAGNI; zero dep). Drops into `slash-menu-model.ts:65`. `fzf@0.5.2` documented fallback if @-set lags.

**C.2 @-provider** — hand-roll async cwd walk on `node:fs/promises` (pi/gemini both hand-roll) in a DIP'd `src/file-search.ts` (inject fake fs); adopt `ignore` npm for `.gitignore` (Rule 9; gemini reimplemented and carries the burden) + default skip-list (node_modules/.git); debounce ~150-200ms, TTL cache ~30s, abort stale walks; fuzzy-rank results.

**C.3 Multiplex @ and /** — generalize `deriveSlashMenu` → `deriveMenu(text, providers)` with codex's single-menu trigger-priority model (`popup_state.rs:24-32`, `chat_composer.rs:3516-3521`): provider declares `{trigger, scope: "line-start"|"token", complete, source}`. `/` keeps line-start + `complete-command`; `@` uses token scope (filter = text after last `@` to whitespace) + new `complete-mention` action. The list renderer, selection, dismissal latch, key interception are already provider-agnostic.

**ADRs:** C2 — `@` token-scope (mid-sentence mentions; codex parity), not line-start. C3 — keep `/` PREFIX (M15 codex-parity contract), default `@` FUZZY (per-provider flag). C4 — adopt `ignore`, encapsulate behind file-search interface (DIP).

**Edge cases:** `@` no matches→closed; huge repo→debounce+cap+abort; no `.gitignore`→default skip-list; path with spaces (quote/escape — decide at PLAN); `@` + `/` both present→priority (token `@` wins in @-token); symlink loops→bound depth; non-TTY→provider yields nothing.

## Proposed phase decomposition (4 phases)

1. **Image encoders + capability matrix (pure core)** — `terminal-image.ts` full port; env-injection unit tests; no wiring. DoD: encoders + matrix green; fallback asserted.
2. **Image component + output-engine raw-line convention (wiring)** — ADR-A2 raw line + row-span filler; `image.tsx`; `@xterm/headless` asserts bytes + row accounting; scroll-safe; export `Image`. DoD: renders in-grid without corrupting subsequent diffs.
3. **Editor upgrade** — port kill-ring/undo/word-nav; extend `text-buffer.ts`; wire keymap actions + `C-y`/`M-y`/`C-_`; `handleHistoryKey` + history refs; property tests over graphemes; PTY e2e; editor micro-bench. DoD: 4 sub-features green; coalescing + paste-atomicity proven.
4. **Fuzzy + @-provider** — port `fuzzy.ts`; `deriveSlashMenu`→`deriveMenu` provider registry; `file-search.ts` async walk + `ignore`; `complete-mention` action; keep `/` prefix, `@` fuzzy; example + PTY e2e. DoD: `@` inserts a cwd-relative path; `/` menu unchanged (M15 contract intact).

Ordering: images (1-2) de-risk the hardest item (ADR-A2 output-engine change) first + independent; editor (3) extends reducer/keymap, no renderer change; fuzzy+@ (4) builds on the stable M15 menu + Phase-3 reducer discipline.

## Drawbacks & Risks

1. ADR-A2 touches the differential renderer core (highest risk; a miscount corrupts subsequent frames) — pi filler convention proven, `@xterm/headless` asserts accounting, do first under full test.
2. Image capability is env-heuristic — conservative `null` default; mux forced off (pi+codex agree).
3. Editor state complexity (undo × kill-ring × graphemes × paste) — pi precedent + property tests; stateful parts outside the pure reducer (SRP).
4. Fuzzy on `/` would regress M15 codex-parity — ADR-C3 keeps `/` prefix.
5. `@`-walk is our first component-surface I/O — DIP + `ignore` + async/abort/debounce.

## Unresolved Questions (for PLAN grill)

- ADR-C3: `/`-command fuzzy or stay prefix? (Recommend prefix.)
- `@`-paths with spaces — quote/escape convention?
- History persistence: `onHistoryChange` prop, session-only default? (Recommend expose prop.)
- Image cell-pixel size: ship pi's 9×18 default, or add terminal cell-size query now? (Recommend default now, query deferred.)

## Prior Art (verified on disk)

- **pi** (MIT): `terminal-image.ts:1-489`, `components/image.ts:60-126`, `kill-ring.ts:1-46`, `undo-stack.ts:1-28`, `word-navigation.ts:1-118`, `fuzzy.ts:1-137`, `components/editor.ts:298-443,1084-1097,1515-1551`.
- **codex** (Apache-2.0): `image_protocol.rs:112-268`, `sixel.rs`, `utils/fuzzy-match/src/lib.rs`, `file-search/src/lib.rs:411-481`, `popup_state.rs:24-32` + `chat_composer.rs:3499-3623`.
- **gemini-cli** (Apache-2.0): `useAtCompletion.ts:22,315-373` (`fzf@0.5.2`), `bfsFileSearch.ts`, `ignorePatterns.ts:15-101`, `terminalCapabilityManager.ts`.
- **opencode** (MIT): `fuzzysort@3.1.0`. **bubbles** (MIT): `textinput.go:416-563` (negative evidence — pi is the only readline-grade source).
- **Our codebase:** `text-buffer.ts:12-28`, `chat-composer.tsx:260-359`, `slash-menu-model.ts:48-88`, `keybindings.ts:58-70`, `input/kitty.ts:11-23`, `output-engine.ts:13-30,140`, `output-grid.ts:7,37-41`, `terminal.ts:9-20`, `index.ts:84-90`.
