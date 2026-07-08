---
slug: m21-premium-capabilities
milestone_id: M21
created_at: 2026-07-08
goal: Ship the V4 renderer's premium capabilities — inline images (kitty/iTerm2 + graceful fallback), a readline-grade ChatComposer editor (kill-ring, undo, word-nav, history recall), and fuzzy matching + an @-file-path provider on the existing menu surface.
---

# Plan: m21-premium-capabilities

## Goal

Deliver the three capabilities the V4 renderer unlocks, each as a faithful port of
pi's MIT prior art onto our existing seams: (1) an **`<Image>`** component
supporting the **kitty** + **iTerm2** inline-image protocols with env-based
capability detection and a text fallback; (2) a **readline-grade editor upgrade**
on `ChatComposer` — Emacs **kill-ring** (yank/yank-pop), **undo**, **word
navigation**, and **history recall** (↑/↓) — built on the M19 keymap + M15 text
buffer; (3) **fuzzy matching** + an **`@` file-path provider** generalized onto the
M15 slash-menu surface. Hand-rolled where pi proves a dep is unwarranted; the
`ignore` npm package adopted for `.gitignore` semantics (Rule 9).

## Baseline Context

### Files that will be touched

| File | Role | Change |
|---|---|---|
| `src/renderer/terminal-image.ts` | NEW | kitty/iTerm2 encoders, magic-byte dims, cell-fit, env capability matrix, fallback text |
| `src/renderer/terminal.ts` | seam | add `capabilities` (images) to the Terminal surface |
| `src/renderer/output-engine.ts` | engine | raw-passthrough line (width-exempt) + row-span filler (ADR-A2) |
| `src/renderer/output-grid.ts` | grid | honor the raw-line marker (skip `stringWidth` re-measure) |
| `src/image.tsx` | NEW | `<Image>` component emitting the sequence + filler rows |
| `src/renderer/kill-ring.ts` | NEW | Emacs kill-ring (push/peek/rotate + coalescing) |
| `src/renderer/undo-stack.ts` | NEW | generic `UndoStack<S>` (structuredClone snapshots) |
| `src/renderer/word-navigation.ts` | NEW | `findWordBackward/Forward` (Intl.Segmenter word granularity) |
| `src/text-buffer.ts` | reducer | new pure kill/word primitives returning `{state, killed}` |
| `src/chat-composer.tsx` | composer | wire kill-ring/undo/word-nav refs + `handleHistoryKey` + `@` provider |
| `src/fuzzy.ts` | NEW | pi's subsequence scorer + `fuzzyFilter` |
| `src/slash-menu-model.ts` | menu | `deriveSlashMenu` → `deriveMenu` provider/trigger registry |
| `src/file-search.ts` | NEW | async cwd walk behind an injectable interface + `ignore` |
| `examples/images.tsx` / `examples/editor.tsx` | NEW | example wiring |
| `benchmarks/editor.bench.tsx` | NEW | OWN editor-path bench |

### Current callers / dependents

- `src/text-buffer.ts:12-28` — the M15 pure reducer (`TextBufferState {text, cursorOffset}`, `TextBufferAction` union). Extended, not rewritten.
- `src/chat-composer.tsx:260-359` — the composer: `handleMenuKey` / `handleBufferKey`, slash-menu latch, `usePaste`. History + `@` slot in beside `handleMenuKey`.
- `src/slash-menu-model.ts:48-88` — `deriveSlashMenu` (`/` line-start, `.startsWith` filter). Generalized.
- `src/renderer/input/keybindings.ts:58-70` — the M19 emacs keymap ALREADY names `move-word-back/forward`, `delete-word-back`, `delete-to-line-start/end`, `delete-forward` (M21 implements their handlers) + new `C-y`/`M-y`/`C-_`.
- `src/renderer/output-engine.ts` (M20 relative-cursor engine) + `output-grid.ts` (stringWidth cell grid) — the image raw-line convention plugs here.
- `src/renderer/input/kitty.ts:11-23` — the M19 kitty handshake (secondary capability corroboration).

### Domain glossary

- **kitty graphics protocol** — `\x1b_G<params>;<base64>\x1b\\` APC, 4096-byte chunks, `q=2` quiet, `C=1` no cursor move.
- **iTerm2 inline image** — `\x1b]1337;File=<params>:<base64>\x07` OSC, `inline=1`.
- **raw-passthrough line** — a grid line carrying a literal escape sequence, width-exempt (not re-measured), with a declared row-span of blank filler.
- **kill-ring** — Emacs cut buffer; consecutive kills coalesce; yank pastes the head, yank-pop rotates.
- **coalescing (undo)** — snapshot before a word boundary / structural op, not per keystroke.
- **trigger registry** — a provider set (`/`, `@`) each with a scope (line-start vs token) feeding one menu.

### Architecture boundaries affected

- `src/renderer/` gains pure modules (terminal-image, kill-ring, undo-stack, word-navigation) — no Ink imports. `src/file-search.ts` is the ONLY I/O module; DIP'd behind an interface so tests inject a fake fs.
- The output-engine raw-line change is internal; `createRenderer` API unchanged. The reducer stays pure (stateful ring/undo/history live in the composer).

## Prior Art

- **Blueprint:** `.claude/knowledge-base/discoveries/blueprints/m21-premium-capabilities-blueprint.md` (this cycle) — pi as primary source for all three features + the ADRs and edge cases below.
- **pi (MIT):** `terminal-image.ts`, `components/image.ts`, `kill-ring.ts`, `undo-stack.ts`, `word-navigation.ts`, `fuzzy.ts`, `components/editor.ts` (history/coalescing).
- **codex (Apache-2.0):** `image_protocol.rs` (capability matrix + mux-safety), `popup_state.rs`/`chat_composer.rs` (single-menu trigger-priority), `file-search` (`ignore`/WalkBuilder).
- **gemini-cli (Apache-2.0):** `useAtCompletion.ts` (`fzf`, async/cache/debounce), `ignorePatterns.ts` (the hand-rolled-gitignore burden `ignore` avoids).
- **Our M15/M19/M20:** `text-buffer.ts`, `chat-composer.tsx`, `slash-menu-model.ts`, `keybindings.ts`, `output-engine.ts`, `output-grid.ts`.

## ADRs

### A1 — Ship kitty + iTerm2, defer Sixel
**Alt:** Sixel now (codex embeds a full sixel encoder — heavyweight palette quantization; YAGNI until a Sixel-only user); half-block ANSI fallback (deferred future tier). Chosen: the DoD's exact two protocols + text fallback for the rest.

### A2 — Raw-passthrough width-exempt line + row-span filler in output-engine
**Alt:** side-channel writing images outside the diff loop (breaks CSI-2026 atomicity + scroll-invariance); absolute cursor addressing per image (M20 review established it breaks under scroll). Chosen: pi's filler-line convention — diff-loop-native, scroll-safe.

### A3 — `<Image>` takes `base64Data + mimeType`; magic-byte dims (no decode)
**Alt:** accept a file path and read bytes (I/O in a component — rejected; the app supplies bytes, same posture as ChatComposer never doing I/O). Ship pi's 9×18 default cell size; terminal cell-size query deferred.

### B1 — Undo coalescing is fish-style (word-boundary), paste = one snapshot, redo deferred
**Alt:** per-keystroke undo (annoying granularity); ship redo now (pi ships one-way; readline default; YAGNI).

### B2 — Kill-ring/undo/history live in the composer, NOT the pure reducer
**Alt:** put mutable ring/undo state in the reducer (violates the pure-reducer invariant `text-buffer.ts:1-2` and SRP). Chosen: reducer gains only pure primitives (kill returns `{state, killed}`); the composer holds the stateful ring/undo/history in refs.

### B3 — History is session-only by default; expose `onHistoryChange` for app-owned persistence
**Alt:** persist to disk in the component (I/O in a component — rejected). Plain scroll, dedup consecutive, cap 100, gate on menu-closed + first-line.

### C1 — Hand-roll pi's fuzzy scorer; `fzf@0.5.2` documented fallback
**Alt:** adopt `fzf`/`fuzzysort` now (async/index machinery over-engineered for our tiny candidate sets — YAGNI + a new dep). Chosen: pi's ~90-line scorer; escape hatch documented if the `@`-set lags.

### C2 — `@` uses token scope (mid-token trigger); `/` keeps line-start
**Alt:** `@`-at-line-start-only (users mention files mid-sentence; codex confirms token scope is the norm).

### C3 — `/`-command matching stays PREFIX (M15 contract); `@` defaults FUZZY (per-provider flag)
**Alt:** make `/` fuzzy too — rejected without an explicit decision (regresses the M15 codex-parity contract `slash-menu-model.ts:5-6`).

### C4 — Adopt `ignore` npm for `.gitignore`, encapsulate behind the file-search interface (DIP)
**Alt:** hand-roll gitignore patterns (gemini did — maintenance burden; Rule 9). Hand-roll only the fs walk.

## Dependencies

| Ecosystem | Package | Version | For | Rule 9 |
|---|---|---|---|---|
| npm (prod) | `ignore` | ^5 (MIT) | `.gitignore` parsing for the `@`-provider | adopt — git-ignore semantics are subtle |

(All else stdlib: `Intl.Segmenter`, `structuredClone`, `node:fs/promises`, `Buffer`. `/deps-audit` MUST confirm `ignore` has no critical/high CVE before IMPLEMENT.)

## Critical paths

- `src/renderer/output-engine.ts` — the raw-line + filler change (highest risk; a miscount corrupts every subsequent frame).
- `src/renderer/terminal-image.ts` — the encoders + capability matrix (protocol correctness).
- `src/text-buffer.ts` + `src/renderer/kill-ring.ts` — the editor primitives + ring coalescing.
- `src/file-search.ts` — the only I/O module (async, abortable).

## Phase 1: Image encoders + capability matrix (pure core)

### T1.1 — `terminal-image.ts`: encoders, dims, capability matrix, fallback
#### Objective
Port pi's pure image module: kitty + iTerm2 encoders (with chunking), magic-byte dimension extraction, cell-fit sizing, the env-based capability matrix, and the text fallback — all unit-tested by env injection, no TTY, no renderer wiring.

#### Why this step
1. **What:** RED — encode/detect/fallback behaviors as pure-function tests (env-injected). GREEN — the ported module.
2. **Why now:** de-risks nothing in the renderer yet; establishes the correct protocol bytes + conservative capability defaults before wiring.

#### Evidence
Blueprint Feature A; pi `terminal-image.ts:65-125,165-250,291-430,482-488`; codex `image_protocol.rs:112-195`.

#### TDD
```
RED: kitty_single_and_chunked_encode_match_the_protocol() — encodeKitty(base64,{columns,rows,moveCursor:false}) → \x1b_G...a=T,f=100,q=2,C=1...\x1b\\; payload >4096 chunks with m=1/m=0
RED: iterm2_encode_wraps_osc_1337_with_inline_and_base64_name()
RED: magic_bytes_extract_png_jpeg_gif_webp_dimensions() — known fixtures; malformed → null
RED: capability_matrix_maps_env_to_protocol() — KITTY_WINDOW_ID→kitty; ITERM_SESSION_ID→iterm2; TMUX→null; unknown→null
RED: fallback_text_renders_for_unsupported() — imageFallback(mime,dims,name) → "[Image: name [image/png] 800x600]"
VERIFY: pnpm vitest run src/renderer/terminal-image.test.ts
```
#### Concurrency tests (none — single-threaded)
#### Acceptance Criteria
- [ ] `pnpm vitest run src/renderer/terminal-image.test.ts` exits 0; terminal-image at 100% lines
- [ ] RED exit recorded; tmux/screen/zellij forced `null`; unknown terminal → `null` (graceful absence)
#### DoD
- [ ] `pnpm gates` exits 0

## Phase 2: Image component + output-engine raw-line convention

### T2.1 — raw-passthrough line + `<Image>` component
#### Objective
Add the width-exempt raw-line + row-span filler to the output engine/grid, and ship `<Image>` emitting the escape sequence + filler rows so an image reserves the correct vertical space without desyncing subsequent differential diffs (scroll-safe).

#### Why this step
1. **What:** RED — a VirtualTerminal oracle: an `<Image>` emits its protocol bytes, occupies the declared rows, and a later differential update below it lands correctly (no corruption). GREEN — the raw-line marker + filler + component.
2. **Why now:** the highest-risk architectural change; done early under full test.

#### Evidence
Blueprint ADR-A2; pi `components/image.ts:90-111`; our `output-engine.ts:13-30`, `output-grid.ts:7,37-41`.

#### TDD
```
RED: raw_line_is_not_remeasured_and_reserves_rows() — a raw grid line (escape seq) has grid width 0 but N-row span; the grid places N-1 filler blanks
RED: image_component_emits_kitty_bytes_on_a_kitty_terminal() — <Image base64 mimeType> through createRenderer on a VirtualTerminal with kitty caps → \x1b_G on the wire
RED: image_falls_back_to_text_on_unsupported_terminal()
RED: differential_update_below_an_image_lands_correctly() — render image + a live line; change the live line → the patch targets the right row (no image corruption); scroll-safe
VERIFY: pnpm vitest run tests/renderer/image.test.tsx src/renderer/output-engine.test.ts
```
#### Failure scenarios (external I/O — terminal writes)
- Image taller than viewport → filler respects overflow (documented budget + test).
- iTerm2 cursor-move accounting (`\x1b[${rows-1}A`) keeps the frame consistent (assert).
#### Acceptance Criteria
- [ ] `pnpm vitest run tests/renderer/image.test.tsx` exits 0; a differential update below an image is uncorrupted (regression-grade, mirrors M20 B1 discipline)
- [ ] `<Image>` exported from `src/index.ts`; RED exit recorded
#### DoD
- [ ] `pnpm gates` exits 0

## Phase 3: Editor upgrade (kill-ring + undo + word-nav + history)

### T3.1 — readline-grade editor on ChatComposer
#### Objective
Port kill-ring/undo/word-navigation as pure modules, extend the text-buffer reducer with pure kill/word primitives (`{state, killed}`), and wire the stateful ring/undo/history into the composer (refs) + the M19 keymap actions + `handleHistoryKey`.

#### Why this step
1. **What:** RED — kill/yank/yank-pop/undo/word-nav/history behaviors (pure-module unit tests + composer-compat tests driving the real reducer). GREEN — the ported modules + reducer primitives + composer wiring.
2. **Why now:** extends the reducer/keymap with no renderer change; independent of images.

#### Evidence
Blueprint Feature B; pi `kill-ring.ts:8-46`, `undo-stack.ts:1-28`, `word-navigation.ts:1-118`, `editor.ts:298-443,1084-1097,1515-1551`; our `text-buffer.ts:12-28`, `keybindings.ts:58-70`, `chat-composer.tsx:334-359`.

#### TDD
```
RED: kill_ring_coalesces_consecutive_kills_and_yank_pop_rotates()
RED: undo_coalesces_by_word_boundary_and_paste_is_atomic()
RED: word_nav_moves_and_deletes_over_graphemes() — Intl.Segmenter word granularity; emoji-safe
RED: reducer_kill_primitives_return_state_and_killed_slice() — pure; C-k on empty line kills the newline
RED: composer_history_recall_up_down_is_gated_by_menu_and_first_line() — ↑ recalls only when menu closed + first line; dedup; cap 100; draft restored on ↓ past newest
RED: ctrl_y_yanks_and_alt_y_yank_pops_through_the_keymap()
VERIFY: pnpm vitest run src/renderer/kill-ring.test.ts src/renderer/undo-stack.test.ts src/renderer/word-navigation.test.ts src/text-buffer.test.ts src/chat-composer.test.tsx
```
#### Acceptance Criteria
- [ ] All new pure modules at 100% lines; kill-ring/undo/word-nav green
- [ ] History recall gated correctly (menu-closed + first-line); PTY e2e drives ↑/↓/C-y/C-k/M-y on a real pty
- [ ] `benchmarks/editor.bench.tsx` committed (reducer+ring per keystroke, load<4); RED exit recorded
#### DoD
- [ ] `pnpm gates` exits 0

## Phase 4: Fuzzy + `@`-file-path provider

### T4.1 — fuzzy matcher + trigger-registry menu + `@` provider
#### Objective
Port pi's fuzzy scorer, generalize `deriveSlashMenu` → `deriveMenu` with a provider/trigger registry (codex priority model), and add an async cwd file-search (`@`) behind an injectable interface using `ignore` for `.gitignore` — keeping `/` prefix and `@` fuzzy.

#### Why this step
1. **What:** RED — fuzzy scoring/ordering, the provider registry (`/` line-start prefix vs `@` token fuzzy), `complete-mention` insertion, and the async walk (fake-fs). GREEN — `fuzzy.ts`, `deriveMenu`, `file-search.ts`, the reducer action.
2. **Why now:** builds on the stable M15 menu + the Phase-3 reducer discipline; last because it composes the prior work.

#### Evidence
Blueprint Feature C; pi `fuzzy.ts:12-137`; codex `popup_state.rs:24-32`, `chat_composer.rs:3499-3623`; gemini `useAtCompletion.ts`, `ignorePatterns.ts`; our `slash-menu-model.ts:48-88`, `chat-composer.tsx:260-332`.

#### TDD
```
RED: fuzzy_scores_consecutive_runs_and_word_boundaries_above_gaps()
RED: derive_menu_resolves_trigger_priority() — cursor in an @-token → @ provider wins; else / provider; / stays prefix, @ fuzzy
RED: at_provider_completes_a_cwd_relative_path() — complete-mention inserts the path at the @-token
RED: file_search_walks_and_respects_gitignore() — injectable fake fs; node_modules/.git skipped; abort stale walk
RED: slash_menu_contract_is_unchanged() — the M15 / menu behaves identically (regression guard)
VERIFY: pnpm vitest run src/fuzzy.test.ts src/slash-menu-model.test.ts src/file-search.test.ts src/chat-composer.test.tsx
```
#### Failure scenarios (external I/O — filesystem)
- Huge repo → debounce + cap + abort (documented); no `.gitignore` → default skip-list; non-TTY / no cwd → provider yields nothing (composer degrades to plain text).
#### Acceptance Criteria
- [ ] fuzzy + file-search at 100% lines; `/` menu contract unchanged (M15 regression guard green)
- [ ] `@` inserts a real cwd-relative path; `.gitignore` respected via `ignore`; example wires an `@` provider; RED exit recorded
#### DoD
- [ ] `pnpm gates` exits 0

## Edge cases absorbed
(A: unsupported→fallback, tmux/screen/zellij→null, malformed base64→no-throw, chunk@4096, image>viewport→T2.1 failure scenario, kitty id collision+cleanup. B: yank-pop empty ring no-op, undo empty no-op, word-nav emoji, C-k empty line kills newline, coalescing reset on cursor move, history ↑ multiline moves cursor, paste resets kill-chain. C: @ no matches→closed, huge repo→debounce/abort, no .gitignore→skip-list, path-with-spaces→quote at PLAN, @+/ priority, symlink loop→bound depth, non-TTY→nothing.)

## Coverage Matrix

| # | Gap / Requirement (source) | Task(s) | Resolution |
|---|---|---|---|
| 1 | DoD: `Image` component (kitty + iTerm2, graceful absence) (ROADMAP § M21) | T1.1, T2.1 | encoders + capability matrix + component + fallback |
| 2 | DoD: ChatComposer editor upgrade (undo, kill-ring, word-nav, history) (ROADMAP § M21) | T3.1 | ported pure modules + reducer primitives + composer wiring |
| 3 | DoD: fuzzy matching + file-path (`@`) provider (ROADMAP § M21) | T4.1 | pi scorer + trigger registry + async file-search |
| 4 | DoD: example + PTY e2e; OWN bench for the editor path (ROADMAP § M21) | T2.1, T3.1, T4.1 | examples + PTY e2e (editor keys) + editor.bench |
| 5 | DoD: gates/coverage/CHANGELOG house standard (ROADMAP § M21) | T1.1–T4.1 | per-task gates |
| 6 | Risk: image protocol detection matrix (ROADMAP § M21) | T1.1 | conservative env-matrix + forced-off mux + text fallback |
| 7 | Risk: editor state complexity (undo × paste × graphemes) (ROADMAP § M21) | T3.1 | pi segmenter/coalescing + stateful parts outside the pure reducer + property tests |
| 8 | Image escape vs stringWidth cell grid (blueprint ADR-A2) | T2.1 | raw-passthrough width-exempt line + filler rows |
| 9 | `/` M15 contract must not regress (blueprint ADR-C3) | T4.1 | `/` stays prefix; regression guard test |

**Coverage: 9/9 (100%)**

## Drawbacks & Risks

| Drawback / Risk | Severity | Mitigation | Owner |
|---|---|---|---|
| output-engine raw-line miscount corrupts subsequent frames | High | pi filler convention; @xterm/headless row-accounting oracle; do first (T2.1) under full test | implement |
| image capability env-heuristic misclassifies a terminal | Medium | conservative `null` default (text fallback); mux forced off (pi+codex agree) | implement |
| editor state complexity (undo × kill-ring × graphemes × paste) | High | pi precedent + property tests; stateful ring/undo outside the pure reducer (SRP) | implement |
| `@`-walk is the first component-surface I/O | Medium | DIP behind an injectable interface + `ignore` dep + async/abort/debounce | implement |
| fuzzy on `/` would regress the M15 contract | Medium | `/` stays prefix (ADR-C3); regression guard | implement |

## Failure scenarios (when I/O external)
Image writes to a Terminal (in-process, T2.1). The `@`-provider reads the filesystem (T4.1): huge repo (debounce/cap/abort), missing `.gitignore` (skip-list), non-TTY/no-cwd (yields nothing). No network/DB/queue.

## Unresolved Questions
- `/`-command fuzzy vs prefix → **stay prefix** (ADR-C3; M15 contract).
- `@`-paths with spaces → quote/escape convention decided in T4.1 (default: filter stops at whitespace; insert quoted if the path contains spaces).
- History persistence → **session-only default + `onHistoryChange` prop** (ADR-B3).
- Image cell-pixel size → **ship pi's 9×18 default**; terminal cell-size query deferred.
- Redo → **deferred** (pi one-way; YAGNI) — explicit non-goal.

## Test Plan
Pure-module units (terminal-image encoders/dims/matrix/fallback; kill-ring; undo; word-nav; fuzzy; file-search via fake-fs) + the output-engine raw-line + filler oracle (VirtualTerminal, incl. a differential-below-image regression) + composer-compat (real reducer through our useInput: kill/yank/undo/word-nav/history) + the `deriveMenu` trigger-priority + `@`-completion + the M15 `/`-contract regression guard + PTY e2e (editor keys) + the editor bench. Discipline per `.claude/rules/testing.md` (§4.1 negatives — unsupported terminal, empty ring/undo, no-match `@`, non-TTY; §6 determinism — env injection + fake fs, no real timers except the PTY e2e). Two consecutive full runs green.

## Global Definition of Done
- [ ] All tasks committed gates-gated (1 task = 1 commit or coherent gated sub-commits, FULL `pnpm gates`)
- [ ] `<Image>` renders kitty/iTerm2 + text fallback; a differential update below an image is uncorrupted
- [ ] Editor: kill-ring/undo/word-nav/history all green; PTY e2e drives the real keys; editor bench committed (load<4)
- [ ] Fuzzy + `@`-provider: `@` inserts a cwd-relative path (`.gitignore` respected); `/` menu contract unchanged
- [ ] `ignore` dep audited (no critical/high CVE); examples + CHANGELOG updated
- [ ] Plan archived post-release
