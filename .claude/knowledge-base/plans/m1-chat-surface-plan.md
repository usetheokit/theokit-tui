---
slug: m1-chat-surface
milestone_id: M1
created_at: 2026-07-06
goal: Ship the M1 chat surface (ChatThread with Static history, ChatComposer multi-line input, system role, streaming render) with all gates green in CI and a committed thread benchmark baseline.
---

# Plan: M1 Chat surface core — ChatThread + ChatComposer + streaming render

> **Version 1.2** (v1.1 absorbed edge cases; v1.2 matrix task-mapping + concurrency escape normalization; /plan-confidence SHIPPABLE 93.2) (absorbs MUST FIX EC-1 + SHOULD TEST EC-2/EC-3 from
> `reviews/m1-chat-surface-plan-edge-cases-2026-07-06.md`) — Implements `ROADMAP.md § M1` on top of the released v0.1.0 walking skeleton:
> extends `ChatMessage` with the `system` role, ships `ChatThread` (windowed `<Static>` history +
> memoized live tail, token-streaming friendly) and `ChatComposer` (grapheme-aware multi-line
> input via a pure reducer + `useInput`), adds streaming render tests + real-stdin input tests,
> an interactive example, and a mode-matrix thread benchmark with a committed baseline. Zero new
> runtime dependencies. All design decisions locked by the m1-chat-surface blueprint
> (SHIPPABLE 99.7).

## Goal

Enable TypeScript agent-CLI developers to render a streaming chat thread with history in
`<Static>` and compose multi-line input from the built `@theokit/tui` package so that the M1
chat surface is proven end-to-end, measured by the CI gate chain (format → lint → typecheck →
test → coverage → build → bench smoke) exiting 0 on `develop`.

## Context

v0.1.0 (M0) shipped `ChatMessage` (user/assistant), the theme stub, the five-gate toolchain and
the benchmark harness with a committed baseline. `ROADMAP.md § M1` now requires the chat surface
core: three roles, `ChatThread` with `<Static>` history, `ChatComposer` multi-line input, and
token-by-token streaming render — with snapshot tests per role + a streaming sequence, readable
in NO_COLOR. The DISCOVER cycle produced a SHIPPABLE blueprint (99.7) locking six ADRs from the
react-ink/gemini-cli/ink evidence: windowed Static history, identity-memo streaming contract,
grapheme-aware buffer, Enter/Ctrl+J keymap (Shift+Enter honored when the terminal encodes it),
real-stdin test strategy with ink's authoritative byte sequences, and a mode-matrix bench.
Roadmap risks: viewport/height correctness (resolved: `<Static>` IS Ink's scroll mechanism —
Blueprint §"Q1"); streaming re-render perf/flicker (resolved: memo rows + windowing —
Blueprint §"Q2").

## Baseline Context (deep review of current state)

### Files that will be touched

| File | LoC today | Last commit (sha + date) | Why it exists today | Invariants to preserve |
|---|---|---|---|---|
| `src/chat-message.tsx` | 36 | `ba938f0` (2026-07-06) | M0 primitive — role glyph + themed colors | Public `ChatMessage({role, children})` keeps working for user/assistant; guard stays FIRST statement (EC-1 M0; react-hooks lint) |
| `src/theme.tsx` | 92 | `04fb7e6` (2026-07-06) | Semantic tokens + provider + hook | `useTheoTheme()` never undefined; leaf-level merge; deep-frozen defaultTheme; memoized context value |
| `src/index.ts` | 7 | `d1a3c0b` (2026-07-06) | Composition root (only public surface) | Existing exports unchanged; `VERSION === package.json.version` |
| `src/chat-message.test.tsx` | 138 | `04fb7e6` (2026-07-06) | M0 tests incl. EC-1 typed-error + NO_COLOR subprocess | Invalid-role message assertion updates to the 3-role union (documented change) |
| `src/theme.test.tsx` | 96 | `04fb7e6` (2026-07-06) | Theme tests (5) | All keep passing; system tokens extend defaults |
| `src/chat-thread.tsx` (NEW) | 0 | — | ChatThread component | — |
| `src/chat-thread.test.tsx` (NEW) | 0 | — | co-located tests | — |
| `src/text-buffer.ts` (NEW) | 0 | — | pure grapheme-aware reducer | — |
| `src/text-buffer.test.ts` (NEW) | 0 | — | co-located reducer tests | — |
| `src/chat-composer.tsx` (NEW) | 0 | — | ChatComposer component | — |
| `src/chat-composer.test.tsx` (NEW) | 0 | — | co-located tests (real stdin) | — |
| `tests/export-surface.test.ts` | 29 | `04fb7e6` (2026-07-06) | public-entry surface contract | grows with new exports |
| `tests/public-api.integration.test.tsx` | 33 | `2d04734` (2026-07-06) | integration via composition root | grows: thread+composer scene |
| `benchmarks/chat-thread.bench.tsx` (NEW) | 0 | — | mode-matrix thread benchmark | — |
| `docs/benchmarks/m1-chat-thread-baseline.json` (NEW) | 0 | — | committed M1 baseline | M0 baseline file untouched |
| `tests/bench-baseline.test.ts` | 83 | `04fb7e6` (2026-07-06) | baseline schema oracle | extends to validate the M1 file too |
| `examples/chat.tsx` (NEW) | 0 | — | interactive TTFATT demo (thread+composer+streaming) | `examples/basic.tsx` untouched |
| `package.json` | 67 | `d1a3c0b` (2026-07-06) | manifest + scripts | contract test protects shape; adds `example:chat` script |
| `tests/package-manifest.test.ts` | 66 | `04fb7e6` (2026-07-06) | manifest contract | gate-scripts assertion grows with `example:chat` — no, script list stays as-is (bench/example not per-variant); no change needed unless script keys asserted change |
| `CHANGELOG.md` | — | `d1a3c0b` (2026-07-06) | Unreleased empty post-release | every task appends |

### Current callers / dependents

- **Symbol:** `ChatMessage` in `src/chat-message.tsx`
  - Callers (production): `examples/basic.tsx:3`, `benchmarks/chat-message.bench.tsx` (via
    `src/index.js`), future `src/chat-thread.tsx`
  - Callers (tests): `src/chat-message.test.tsx`, `tests/public-api.integration.test.tsx`,
    `tests/fixtures/no-color-probe.tsx`, `tests/export-surface.test.ts`
  - External: published API of v0.1.0 — role union EXTENSION is additive (allowed);
    the invalid-role ERROR MESSAGE text changes (documented in CHANGELOG § Changed)
- **Symbol:** `defaultTheme`/`TheoTheme`/`TheoThemeOverride` in `src/theme.tsx`
  - Callers (production): `src/chat-message.tsx:25`; tests as above
  - Change: additive `role.system` group — existing overrides remain valid
- **Symbol:** `VERSION`, provider/hook — untouched by M1

### Domain glossary

- **thread message** — `{ id, role, content }` value object; identity (`===`) signals change.
- **live tail** — the last `windowSize + windowOverscan` messages that re-render (streaming zone).
- **static prefix** — older messages rendered ONCE through Ink `<Static>` into terminal scrollback.
- **streaming append-in-place** — caller replaces the LAST message object with a longer `content`.
- **grapheme** — user-perceived character (`Intl.Segmenter`); cursor ops never split emoji.
- **submit vs newline** — Enter submits; Ctrl+J (the literal `\n` byte) inserts newline everywhere;
  Shift+Enter inserts newline only when the terminal encodes shift (kitty protocol).

### Architecture boundaries affected

Per `rules/architecture.md § 1-3`: `src/text-buffer.ts` is pure domain logic (no ink/react
imports — unit-testable without TTY); `src/chat-thread.tsx` and `src/chat-composer.tsx` are
interface-layer components consuming theme tokens ONLY via `useTheoTheme()` (DIP, same seam as
M0); `src/index.ts` remains the only public surface. No adapter/external-I/O layer.

## Prior Art & Related Work

- **Internal blueprint:** `knowledge-base/discoveries/blueprints/m1-chat-surface-blueprint.md` —
  ADRs D1–D6 consumed verbatim (§ ADRs below restates them condensed); Corners 1–4 carry the
  `file:line` evidence.
- **Patterns skills:** (none exist).
- **Reference projects** (read-only clones; key anchors):
  - `knowledge-base/references/assistant-ui/packages/react-ink/src/primitives/thread/ThreadMessages.tsx:130-166` — windowing mechanics (tailStart, Static prefix, memo tail).
  - `knowledge-base/references/assistant-ui/packages/react-ink/src/primitives/composer/useTextBuffer.ts:3-26` — flat buffer + grapheme segmenter.
  - `knowledge-base/references/assistant-ui/packages/react-ink/src/primitives/composer/ComposerInput.tsx:89-236` — keymap + inverse cursor.
  - `knowledge-base/references/ink/src/components/Static.tsx:21-58` — Static contract (watermark, append-only).
  - `knowledge-base/references/ink/test/hooks-use-input.tsx` — authoritative stdin byte sequences.
  - `knowledge-base/references/gemini-cli/packages/cli/src/ui/components/MainContent.tsx:310-320` — production Static split + dynamic pending zone.
- **External literature:** none beyond the above (all evidence local).

## Objective

- [ ] `ChatMessage` accepts `role="system"` with distinct glyph/color tokens; typed-error guard names the 3-role union
- [ ] `ChatThread` renders windowed `<Static>` history + memoized live tail; streaming replace-last re-renders ONLY the changed row
- [ ] `ChatComposer` accepts multi-line input (Enter submits; Ctrl+J newline; grapheme-safe cursor ops) with inverse-video cursor and placeholder
- [ ] Streaming sequence test proves append-in-place progression; real-stdin tests drive the composer with ink's byte sequences
- [ ] `benchmarks/chat-thread.bench.tsx` compares plain vs windowed at 500 msgs + 300 tokens; baseline JSON committed with mean ± std dev
- [ ] Interactive example (`examples/chat.tsx`) composes thread + composer + fake streaming; non-TTY run degrades gracefully
- [ ] All gates green locally and in CI (node 20 + 22); coverage ≥ 90% on `src/**` (critical paths 100%)

## Dependencies

> Contract for `/deps-audit`. Blueprint Corner 2 verdict: **ZERO new runtime dependencies**
> (grapheme handling via built-in `Intl.Segmenter`; ink provides Static/useInput/useFocus).

### Existing — use as-is

| Package | Version | Ecosystem | Why |
|---|---|---|---|
| `ink` | `^5.2.0` | npm | `Static`, `useInput`, `useFocus`, `Box/Text` — all M1 primitives (Blueprint §"Coverage Corner 2 — Dependencies") |
| `react` | `^18.0.0 \|\| ^19.0.0` (peer) | npm | memo/useReducer/useMemo |
| (devDeps unchanged) | — | npm | vitest/ink-testing-library/tsup/eslint/prettier/tsx as released in v0.1.0 |

### New — to be introduced

| Package | Version | Ecosystem | Rule 9 rationale (libs evaluated) | Why this one |
|---|---|---|---|---|
| (none) | — | — | Evaluated: `string-width` (rejected — Ink wraps text itself at M1), `clipboardy` (rejected — paste is out of M1 scope), `chalk` direct (rejected — ink `<Text inverse>` covers the cursor) | Blueprint Corner 2: analogs' thread/composer code needs no external runtime dep |

### Removed

| Package | Last version | Why removed |
|---|---|---|
| (none) | | |

## ADRs

> D1–D6 originate in the blueprint (Blueprint §"ADRs" carries the full evidence); restated here
> condensed and self-contained. D7+ are plan-local.

### D1 — ChatThread: messages-prop API with windowed `<Static>` history (immutable prefix contract)

**Decision:** `ChatThread({ messages, windowSize = 8, windowOverscan = 4 })` with
`messages: ChatThreadMessage[]` (`{ id: string; role: ChatRole; content: string }`). Prefix
(`length − windowSize − overscan`, clamped ≥ 0) renders through `<Static>` keyed by `id`; tail
renders live via a memoized row. Documented contract: messages that leave the live window are
FROZEN (append-only history).

**Rationale:** Mirrors the react-ink windowing mechanics with an explicit-props API (M7 owns
runtime state); gemini-cli proves Static history in production; Ink has no viewport — Static IS
scroll.

**Alternatives considered:** No windowing by default (rejected: the M1 DoD names `<Static>` for
history); semantic last-user-prompt boundary (rejected: role-policy in a primitive — YAGNI);
index keys (rejected: caller data needs stable ids; react-ink can key by index only because its
store is append-only).

**Consequences:** Callers own message identity; benchmark data tunes the defaults.

### D2 — Streaming contract: rows memoized by message object identity

**Decision:** Row component wrapped in `memo` with comparator `prev.message === next.message`.
Streaming = caller replaces the LAST message object with a longer `content`; only that row
re-renders. No throttling at M1.

**Rationale:** Identity comparison gives the react-ink memo bound without a store; bench
evidence shows memo+windowing cut mean/peak frame times vs legacy; 16ms token cadence needs no
throttle.

**Alternatives considered:** Per-row store subscriptions (rejected: M7); deep-equality memo
(rejected: O(content) per row per frame; identity IS the React data contract).

**Consequences:** In-place mutation (same reference) does not repaint — documented and tested.

### D3 — ChatComposer: uncontrolled grapheme-aware buffer; Enter submits, Ctrl+J newline

**Decision:** `ChatComposer({ onSubmit, placeholder?, multiLine = true, autoFocus = true })`;
internal reducer buffer `{ text, cursorOffset }` with grapheme-aware ops (insert,
delete-backward, delete-forward, move-left, move-right, move-home, move-end, newline, clear)
via `Intl.Segmenter`. Keymap: printable → insert; Enter → submit (whitespace-only → no-op);
Ctrl+J → newline (reliable everywhere — it IS `\n`); `key.shift && key.return` → newline when
the terminal encodes it; arrows/home/end move; backspace/delete delete. Cursor = `<Text inverse>`
on the grapheme at cursor (space at EOL/newline). Buffer clears on submit.

**Rationale:** Buffer shape + segmenter proven in react-ink `useTextBuffer`; keymap mirrors
`ComposerInput` with the honest Shift+Enter caveat (ink's `key` cannot distinguish it in legacy
terminals); Enter-sends is the chat convention (ink-ui evidence).

**Alternatives considered:** Controlled-only value/onChange (rejected at M1: every caller
re-implements cursor state — controlled mode is additive later); gemini backslash-continuation
(deferred M2+); word-nav/kill ops (deferred — additive actions); `usePaste` (deferred M2+ —
separate event channel).

**Consequences:** Reducer is exported and test-first; TTY-free unit tests cover every op.

### D4 — `system` role via theme tokens (additive extension)

**Decision:** Role union becomes `"user" | "assistant" | "system"` (exported as `ChatRole`);
`defaultTheme.role.system = { glyph: "· ", prefix: "gray", text: undefined }`;
`TheoThemeOverride.role.system` accepted; the guard message names the 3-role union.

**Rationale:** M1 DoD names three roles; additive to v0.1.0 API; glyph keeps roles
distinguishable in NO_COLOR (M0 review positive finding).

**Alternatives considered:** Separate `SystemMessage` (rejected: M0 D4 chose one role-switched
primitive); color-only distinction (rejected: breaks color-independent readability).

**Consequences:** M0's invalid-role test message updates (CHANGELOG § Changed documents it).

### D5 — Test strategy: pure-reducer units + real-stdin integration + rerender streaming sequences

**Decision:** (1) `text-buffer` reducer: TTY-free unit tests per op incl. grapheme edges
(emoji); (2) composer: real `stdin.write` tests with ink's byte sequences (`"\r"` Enter,
`"[D"` left-arrow, `""`/`""` backspace, `"\n"` Ctrl+J) + one-tick settling;
(3) streaming: `rerender()` sequences asserting `lastFrame()` progression + a repaint-scope
unit test (memo spy counting row renders); (4) Static: assert `lastFrame()` contains history +
tail (Static output accumulates in frames); windowing boundary asserted by counting rendered
rows.

**Rationale:** Byte sequences are authoritative from ink's own test suite; Static-in-frames
behavior verified in ink's tests; mirrors the analogs' idioms with our M0 determinism kit.

**Alternatives considered:** Mocking Static (reserved for boundary unit test if frame-count
proves flaky); snapshot-only (rejected: interactive semantics need semantic asserts).

**Consequences:** M0 kit (renderFrame, env pins, NO_COLOR subprocess probe) reused; the probe
gains a thread+system-role scene.

### D6 — Bench: chat-thread mode matrix; NEW baseline file; M0 baseline untouched

**Decision:** `benchmarks/chat-thread.bench.tsx` — 500 messages + 300 streamed tokens
(replace-last + append pattern), modes `plain` (windowSize ≥ length) vs `windowed` (8+4);
protocol/env identical to M0 (1 warmup + 5 runs, mean ± std dev, pinned FORCE_COLOR); output
`docs/benchmarks/m1-chat-thread-baseline.json` (M0 schema + `mode` field per entry + per-mode
aggregate). `--smoke` = 1 run per mode, no file write.

**Rationale:** Extends the proven harness; plain-vs-windowed is the decision-relevant
comparison (rows are memoized by design — a no-memo mode tests nothing we ship);
`rules/analysis-golden-rule.md § 3` statistical rigor; separate file preserves the M0
regression anchor.

**Alternatives considered:** Overwrite M0 baseline (rejected: destroys regression anchor);
3-mode legacy comparison (rejected: legacy mode is not shippable code).

**Consequences:** Windowing benefit is measured, not assumed; defaults revisited with data.

### D7 — ChatThread validates message ids at the boundary (fail-fast on duplicates)

**Decision:** `ChatThread` throws `TypeError` naming the duplicate `id` when `messages`
contains duplicate ids (single `Set` pass per render, before any hook side effects beyond the
scan).

**Rationale:** Duplicate keys inside `<Static>`/React silently corrupt the append-only
watermark and row identity — a silent-corruption class bug (`rules/error-handling.md § 1-2`:
validate at the boundary, fail fast with typed errors). O(n) over ids per render is negligible
against Ink's render cost (evidence: M0 bench 11.2ms/frame floor).

**Alternatives considered:** Dev-only check (rejected: the lib has no dev/prod build split at
M1); silent last-wins dedup (rejected: hides caller bugs — fail-fast rule).

**Consequences:** One more negative-case test; documented in JSDoc.

### D8 — Interactive example degrades to a scripted demo when stdin is not a TTY

**Decision:** `examples/chat.tsx` renders thread + composer with a fake streaming assistant
reply; when `process.stdin.isTTY` is falsy it skips the composer (renders thread + streaming
only) so `pnpm example:chat | cat` stays a valid non-TTY smoke.

**Rationale:** ink's `useInput` requires raw-mode stdin; piped runs must not crash (roadmap
non-TTY constraint; M0 example smoke precedent).

**Alternatives considered:** TTY-only example (rejected: loses the CI-viable smoke); mocking
stdin in the example (rejected: examples are honest consumer code).

**Consequences:** The example doubles as the wiring caller for thread+composer+streaming.

## Drawbacks & Risks

| Drawback / Risk | Severity | Mitigation | Owner |
|---|---|---|---|
| `<Static>` frozen-prefix contract can surprise callers who edit old messages | Medium | JSDoc contract + a test pinning "edits to static prefix do not repaint"; documented in CHANGELOG entry | implement |
| Shift+Enter newline silently unavailable in legacy terminals (only kitty encodes it) | Medium | Ctrl+J documented as the guaranteed newline; JSDoc caveat (blueprint Rec 8); behavior test asserts Ctrl+J path | implement |
| Real-stdin tests may flake if settling is insufficient after `stdin.write` | Medium | One-tick `renderFrame` discipline + explicit awaited ticks between writes (ink suite uses staggered timers); two consecutive full-suite runs before commit | implement |
| ChatThread windowing interacts with ink-testing-library frame accumulation (Static output accumulates) — assertions must target `lastFrame()` content, not frame counts | Low | D5 strategy asserts content presence + row-count via memo spy, not raw frame counts | implement |
| 500-msg benchmark wall-clock in CI smoke | Low | `--smoke` = 1 run per mode; measured full runs only local (M0 precedent) | implement |
| Example with fake streaming timer could leave a dangling interval on exit | Low | clear interval on completion + `useApp().exit()` when scripted demo ends | implement |

## Unresolved Questions

(none — every decision is resolved at plan time: blueprint ADRs D1–D6 + plan ADRs D7–D8; the
only environment-sensitive behavior, Shift+Enter, ships with the documented Ctrl+J guarantee.)

## Critical paths

For `/code-quality` D4 when enabled: `src/text-buffer.ts` (cursor/grapheme branching),
`src/chat-thread.tsx` (window split + duplicate-id guard), `src/chat-composer.tsx` (keymap
dispatch).

## Dependency Graph

```
Phase 1 (system role) ──▶ Phase 2 (ChatThread) ──▶ Phase 3 (ChatComposer) ──▶ Phase 4 (bench + example)
                                                                                     │
                                                                                     ▼
                                                                       Final Phase (integration validation)
```

Sequential: thread rows render ChatMessage (needs system role); the example composes
thread+composer; bench renders the thread. Composer's reducer (T3.1) is independent of Phase 2
but kept in sequence for one-vertical-slice discipline.

---

## Phase 1: System role

**Objective:** `ChatMessage` accepts `system`; tokens + guard + tests updated.

### T1.1 — Extend role union + system tokens + guard message

#### Objective
`ChatRole = "user" | "assistant" | "system"` exported; `defaultTheme.role.system` tokens;
guard message names the 3-role union; existing tests updated.

#### Why this step (action + reasoning)

1. **What:** RED tests for the system-role render + updated guard message + theme tokens; then
   the minimal union/token change.
2. **Why now:** Phase 2's thread rows must render all three roles; the change is additive to
   the public API and every later phase depends on it (D4).

#### Evidence
- Blueprint §"D4" (glyph `"· "`, gray prefix); M0 review positive finding (glyph keeps
  NO_COLOR readability); `knowledge-base/references/gemini-cli/packages/cli/src/ui/components/messages/UserMessage.tsx:26` (glyph idiom precedent).

#### Files to edit
```
src/theme.tsx              — role.system tokens in TheoTheme/defaultTheme/TheoThemeOverride
src/theme.test.tsx         — RED: system tokens present + overridable
src/chat-message.tsx       — role union + exported ChatRole + guard message update
src/chat-message.test.tsx  — RED: system render + updated invalid-role message ("model" now invalid)
src/index.ts               — export type ChatRole
tests/export-surface.test.ts — extend: defaultTheme.role.system.glyph asserted
CHANGELOG.md               — Added (system role) + Changed (guard message text)
```

#### Deep file dependency analysis
- `src/theme.tsx`: `TheoTheme.role` gains `system: RoleTokens`; merge function gains the leaf
  spread for system (same shape as user/assistant — Baseline row). Downstream:
  `chat-message.tsx` reads `theme.role[role]`; `noUncheckedIndexedAccess` stays total because
  the union and the record keys stay in sync.
- `src/chat-message.tsx`: guard condition adds `role !== "system"`; message text updates.
  Downstream: M0 test asserting the old message updates HERE (documented).
- `src/index.ts`: `export type { ChatRole }`.

#### Deep Dives
- Tokens: `system: { glyph: "· ", prefix: "gray", text: undefined }` — dim-gray affordance,
  distinguishable in NO_COLOR by the `·` glyph.
- Edge cases: system role under NO_COLOR (covered by the probe extension in T4.2);
  override of only `role.system.glyph` preserves sibling leaves (existing leaf-merge tests
  extended by one case).

#### Tasks
1. RED tests (theme + chat-message) — fail on missing tokens/union
2. GREEN minimal (union + tokens + guard text)
3. Extend export-surface test; CHANGELOG entries

#### TDD
```
RED:     renders_system_message_with_glyph_prefix() — const frame = await renderFrame(<ChatMessage role="system">note</ChatMessage>); expect(frame).toContain("·"); expect(frame).toContain("note")
RED:     system_frame_matches_snapshot_under_forced_color() — expect(frame).toMatchSnapshot("chat-message-system") inside <Box width={40}>
RED:     default_theme_exposes_system_tokens() — expect(defaultTheme.role.system.glyph).toBe("· "); expect(defaultTheme.role.system.prefix).toBe("gray")
RED:     system_tokens_overridable_via_provider() — provider theme={{ role: { system: { glyph: "§ " } } }}; expect(frame).toContain("§")
RED:     invalid_role_message_names_three_role_union() — expect(() => ChatMessage({ role: "model" as never, children: "x" })).toThrow('ChatMessage: invalid role "model" — expected "user" | "assistant" | "system"')
GREEN:   Extend union + tokens + guard until all pass (existing 2-role tests stay green)
REFACTOR: None expected
VERIFY:  pnpm vitest run src/theme.test.tsx src/chat-message.test.tsx
```

#### Concurrency tests

(none — single-threaded)

#### Acceptance Criteria
- [ ] `pnpm vitest run src/theme.test.tsx src/chat-message.test.tsx` exits 0 (all roles)
- [ ] `pnpm typecheck` exits 0 — `ChatRole` exported, record/union in sync
- [ ] Pass: quality — `pnpm lint` exits 0; `wc -l src/theme.tsx` <= 500
- [ ] CHANGELOG updated — `grep -q "system" CHANGELOG.md` exits 0

#### DoD (Definition of Done)
- [ ] `pnpm gates` exits 0
- [ ] CHANGELOG updated (Added + Changed)

---

## Phase 2: ChatThread

**Objective:** Windowed Static history + memoized live tail with the streaming contract proven.

### T2.1 — ChatThread component (window split + memo rows + duplicate-id guard)

#### Objective
`src/chat-thread.tsx`: `ChatThreadMessage`/`ChatThreadProps` types + `ChatThread` with
Static prefix, memo tail, D7 guard; exported from the entry.

#### Why this step (action + reasoning)

1. **What:** RED tests (render both zones, window boundary row-count, duplicate-id typed error,
   empty list) then the minimal component per D1/D7.
2. **Why now:** The thread is the milestone's centerpiece; composer and bench build on it.

#### Evidence
- Windowing mechanics: `knowledge-base/references/assistant-ui/packages/react-ink/src/primitives/thread/ThreadMessages.tsx:130-166`.
- Static contract: `knowledge-base/references/ink/src/components/Static.tsx:21-58`.
- Memo comparator precedent: `knowledge-base/references/assistant-ui/packages/react-ink/src/primitives/internal/MemoMessage.tsx:31-35` (ours simplifies to message identity — Blueprint §"D2").

#### Files to edit
```
src/chat-thread.test.tsx — (NEW) RED suite
src/chat-thread.tsx      — (NEW) component + types
src/index.ts             — export ChatThread + types
tests/export-surface.test.ts — extend
CHANGELOG.md             — Added entry
```

#### Deep file dependency analysis
- `src/chat-thread.tsx`: imports `Static, Box` from ink, `ChatMessage`+`ChatRole` from
  `./chat-message.js` (interface layer composing the M0 primitive), `memo/useMemo` from react.
  No theme import (rows delegate to ChatMessage — DIP preserved).
- `src/index.ts`: gains `ChatThread`, `ChatThreadMessage`, `ChatThreadProps`.

#### Deep Dives
- Signature:

```pseudocode
interface ChatThreadMessage { id: string; role: ChatRole; content: string }
interface ChatThreadProps { messages: ChatThreadMessage[]; windowSize?: number; windowOverscan?: number }
ChatThread({ messages, windowSize = 8, windowOverscan = 4 }):
  assertUniqueIds(messages)                       -- D7: TypeError naming the duplicate id
  tailStart = max(0, messages.length - max(0,windowSize) - max(0,windowOverscan))
  prefix = messages.slice(0, tailStart)           -- <Static items={prefix}> keyed by m.id
  tail   = messages.slice(tailStart)              -- <MemoRow key={m.id} message={m}>
  render <>{Static when prefix.length>0}{<Box flexDirection="column">tail rows</Box>}</>

MemoRow = memo(({message}) => <ChatMessage role={message.role}>{message.content}</ChatMessage>,
               (prev, next) => prev.message === next.message)
```

- Invariants: prefix rows are appended-only (Static watermark — never re-rendered); tail rows
  re-render ONLY when their message object identity changes (D2); empty `messages` renders
  nothing (no Static mount — avoids the ink#904 class of issues).
- Edge cases: `windowSize=0` (everything except overscan tail in Static); thread shorter than
  window (no Static at all); duplicate ids (TypeError); replace-last streaming (only last row
  repaints — proven by memo spy test in T2.2).

#### Tasks
1. RED suite (7 tests below)
2. GREEN minimal component
3. Wire exports; CHANGELOG

#### TDD
```
RED:     renders_all_roles_in_order() — 3 messages (user/assistant/system); expect(frame).toContain("first"); expect(frame).toContain("·"); frame order: expect(frame.indexOf("first")).toBeLessThan(frame.indexOf("second"))
RED:     long_thread_splits_history_into_static_prefix() — 20 messages, windowSize 4, overscan 2; expect(lastFrame()).toContain("msg-0 content") (static accumulates in frames) AND live-row spy (below) counts only tail rows on rerender
RED:     short_thread_renders_without_static() — 3 messages windowSize 8; row spy count equals 3; rerender with same array → row renders stay 0 (memo)
RED:     duplicate_message_ids_throw_typed_error() — expect(() => renderIt([{id:"a"},{id:"a"}])).toThrow(TypeError); expect(...).toThrow('ChatThread: duplicate message id "a"')
RED:     empty_messages_render_empty_frame() — expect(frame.trim()).toBe("")
RED:     window_boundary_row_count_is_exact() — 20 msgs windowSize 4 overscan 2 → memo-spy render count === 6 on mount tail (prefix rendered via Static once)
RED:     negative_window_values_clamp_to_zero() — (EC-2) windowSize={-5} overscan={-1} on 6 msgs; render succeeds; expect(lastFrame()).toContain(every message content) (clamped arithmetic, no crash)
GREEN:   Implement chat-thread.tsx until all pass
REFACTOR: Extract assertUniqueIds helper if inline exceeds ~10 lines (KISS)
VERIFY:  pnpm vitest run src/chat-thread.test.tsx
```

#### Concurrency tests

(none — single-threaded)

#### Acceptance Criteria
- [ ] `pnpm vitest run src/chat-thread.test.tsx` exits 0 (7 tests)
- [ ] Pass: quality — `pnpm lint` exits 0; `wc -l src/chat-thread.tsx` <= 500; complexity <= 10 via `pnpm lint`
- [ ] CHANGELOG updated — `grep -q "ChatThread" CHANGELOG.md` exits 0

#### DoD (Definition of Done)
- [ ] `pnpm gates` exits 0

### T2.2 — Streaming contract tests + integration scene

#### Objective
Prove append-in-place streaming (frame progression + repaint scope) and extend the public-API
integration test with a thread scene.

#### Why this step (action + reasoning)

1. **What:** rerender-driven streaming sequence tests + memo-spy repaint-scope proof + an
   integration scene through `src/index.js`.
2. **Why now:** The M1 DoD names the streaming render explicitly; the proof must exist before
   the bench interprets numbers (wiring pillar b for the thread).

#### Evidence
- Streaming mutation pattern: `knowledge-base/references/assistant-ui/packages/react-ink/benchmarks/long-thread.bench.tsx:244-259`.
- Frozen-prefix expectation: `knowledge-base/references/ink/src/components/Static.tsx:28-38`.

#### Files to edit
```
src/chat-thread.test.tsx — extend: streaming describe-block
tests/public-api.integration.test.tsx — extend: thread scene via src/index.js
```

#### Deep Dives
- Streaming test drives `rerender(<ChatThread messages={next}/>)` where `next` replaces the
  last message with longer content per step; asserts `lastFrame()` shows the progressive text
  AND the memo spy shows exactly 1 row render per step.
- Frozen-prefix test: mutate a PREFIX message object (new array, same tail) after it entered
  Static → frame unchanged (documents the D1 contract).

#### Tasks
1. RED streaming block (3 tests)
2. GREEN (no production change expected — contract already implemented; failures loop back to T2.1)
3. Integration scene + CHANGELOG note (grouped with T2.1 entry)

#### TDD
```
RED:     streaming_replace_last_updates_frame_progressively() — steps ["He","Hello","Hello wor","Hello world"]; after each rerender expect(lastFrame()).toContain(step)
RED:     streaming_repaints_only_the_growing_row() — memo spy: per step expect(rowRenders).toBe(1)
RED:     static_prefix_is_frozen_after_graduation() — 20 msgs windowed; rerender with modified content on message id "msg-1" (new object) while tail unchanged; expect(lastFrame()).toContain(ORIGINAL "msg-1" content) — documents the append-only contract
RED:     public_entry_composes_thread_with_provider() — import { ChatThread } from "../src/index.js"; custom system glyph via provider; expect(frame).toContain("§")
GREEN:   No new production code expected; fix T2.1 if any fails
REFACTOR: None expected
VERIFY:  pnpm vitest run src/chat-thread.test.tsx tests/public-api.integration.test.tsx
```

#### Concurrency tests

(none — single-threaded)

#### Acceptance Criteria
- [ ] `pnpm vitest run src/chat-thread.test.tsx tests/public-api.integration.test.tsx` exits 0
- [ ] Streaming repaint-scope proof present (memo spy assertion)

#### DoD (Definition of Done)
- [ ] `pnpm gates` exits 0

---

## Phase 3: ChatComposer

**Objective:** Grapheme-aware multi-line input with real-stdin coverage.

### T3.1 — text-buffer reducer (pure domain, TDD anchor)

#### Objective
`src/text-buffer.ts`: `TextBufferState`, `TextBufferAction`, `textBufferReducer`,
`initialTextBuffer` — no ink/react imports.

#### Why this step (action + reasoning)

1. **What:** RED unit suite for every op incl. grapheme edges; then the pure reducer.
2. **Why now:** The reducer is the composer's core logic; TTY-free tests give the tightest TDD
   loop and 100% critical-path coverage before any rendering exists (D3/D5).

#### Evidence
- Buffer shape + segmenter: `knowledge-base/references/assistant-ui/packages/react-ink/src/primitives/composer/useTextBuffer.ts:3-26, 31-34, 137-309`.

#### Files to edit
```
src/text-buffer.test.ts — (NEW) RED suite
src/text-buffer.ts      — (NEW) reducer
CHANGELOG.md            — Added entry (grouped with T3.2)
```

#### Deep Dives
- State `{ text: string; cursorOffset: number }`; actions: `insert{text}`, `delete-backward`,
  `delete-forward`, `move-left`, `move-right`, `move-home`, `move-end`, `newline`, `clear`.
- Grapheme discipline: `Intl.Segmenter(undefined, { granularity: "grapheme" })`; move/delete
  step by grapheme (emoji "👍" is ONE step); home/end = line boundaries within multi-line text
  (previous/next `\n`), matching the analog's multiline semantics.
- Edge cases: cursor at 0 (delete-backward no-op), cursor at end (delete-forward no-op),
  insert at middle, newline at middle, empty text ops, emoji at cursor boundary.

#### Pseudo-code / Signatures
```pseudocode
function textBufferReducer(state, action): TextBufferState
  case insert:  text.slice(0,cur) + action.text + text.slice(cur); cur += action.text.length
  case delete-backward: prevGrapheme(cur) → splice out; cur = prevStart
  case move-left/right: cur = prev/nextGraphemeBoundary
  case move-home/end:   cur = lineStart/lineEnd (nearest "\n" boundaries)
  case newline: insert "\n"
  case clear:   { text: "", cursorOffset: 0 }

# Example
input:  {text:"héllo", cursorOffset:5} + move-left ×2
output: cursorOffset lands before "l" (grapheme steps, é = one step)
```

#### Tasks
1. RED suite (10 tests below)
2. GREEN reducer
3. CHANGELOG (grouped)

#### TDD
```
RED:     insert_at_cursor_advances_cursor() — expect(next.text).toBe("heXllo"); expect(next.cursorOffset).toBe(3)
RED:     delete_backward_removes_previous_grapheme() — expect(next.text).toBe("hllo"); expect(next.cursorOffset).toBe(1)
RED:     delete_backward_at_start_is_noop() — expect(next).toEqual(state)
RED:     delete_forward_removes_grapheme_at_cursor() — expect(next.text).toBe("hllo")
RED:     move_left_steps_one_grapheme_over_emoji() — text "a👍b" cursor 3; move-left → expect(next.cursorOffset).toBe(1)
RED:     move_right_at_end_is_noop() — expect(next.cursorOffset).toBe(state.text.length)
RED:     move_home_and_end_target_line_boundaries() — text "ab\ncd" cursor 4; move-home → expect(3); move-end → expect(5)
RED:     newline_inserts_linefeed_at_cursor() — expect(next.text).toBe("ab\ncd".slice? ) — concrete: text "abcd" cursor 2 → expect(next.text).toBe("ab\ncd"); expect(next.cursorOffset).toBe(3)
RED:     clear_resets_buffer() — expect(next).toEqual({ text: "", cursorOffset: 0 })
RED:     insert_multichar_paste_like_text() — insert "wor ld" mid-buffer; expect cursor advanced by 6
GREEN:   Implement the reducer until all pass
REFACTOR: Extract graphemeBoundary helpers (shared by move/delete)
VERIFY:  pnpm vitest run src/text-buffer.test.ts
```

#### Concurrency tests

(none — single-threaded)

#### Acceptance Criteria
- [ ] `pnpm vitest run src/text-buffer.test.ts` exits 0 (10 tests)
- [ ] `src/text-buffer.ts` imports NOTHING from ink/react — `grep -cE 'from "(ink|react)"' src/text-buffer.ts` outputs 0
- [ ] Pass: quality — `pnpm lint` exits 0; complexity <= 10

#### DoD (Definition of Done)
- [ ] `pnpm gates` exits 0

### T3.2 — ChatComposer component (useInput + cursor + submit)

#### Objective
`src/chat-composer.tsx` per D3, driven by real-stdin tests.

#### Why this step (action + reasoning)

1. **What:** RED tests via `stdin.write` byte sequences; then the component mapping keys to
   reducer actions with inverse-video cursor + placeholder + submit semantics.
2. **Why now:** Completes the M1 input surface on top of the tested reducer; the example and
   integration scene depend on it.

#### Evidence
- Keymap + cursor idiom: `knowledge-base/references/assistant-ui/packages/react-ink/src/primitives/composer/ComposerInput.tsx:89-236`.
- Byte sequences: `knowledge-base/references/ink/test/hooks-use-input.tsx` (Enter `"\r"`,
  arrows `"[C/D"`, backspace, Ctrl+J = `"\n"`).
- `useInput` key surface: `knowledge-base/references/ink/src/hooks/use-input.ts:9-124`.

#### Files to edit
```
src/chat-composer.test.tsx — (NEW) RED suite (real stdin)
src/chat-composer.tsx      — (NEW) component
src/index.ts               — export ChatComposer + props type
tests/export-surface.test.ts — extend
tests/public-api.integration.test.tsx — extend: composer scene
CHANGELOG.md               — Added entry
```

#### Deep Dives
- Props `{ onSubmit: (text: string) => void; placeholder?: string; multiLine?: boolean;
  autoFocus?: boolean }`; internal `useReducer(textBufferReducer, initialTextBuffer)`.
- useInput mapping: printable → insert; `key.return && key.shift && multiLine` → newline;
  `key.return` → submit(trim-guard, clear); `input === "\n"` (Ctrl+J) && multiLine → newline;
  arrows ←/→ move; home/end (`key.home`/`key.end` if exposed; else Ctrl+A/E deferred) —
  M1 maps `key.leftArrow/rightArrow` + backspace/delete only (home/end via reducer covered in
  unit tests; key binding additive later — YAGNI).
- Render: `<Box>` prompt glyph (`theme.role.user.glyph` — the composer writes as the user) +
  text with `<Text inverse>` cursor; placeholder dimmed when empty && !focused? (placeholder
  shows when empty; cursor shows when focused).
- Edge cases: submit with whitespace-only → no-op (no clear); unfocused composer ignores input
  (useFocus); multiLine=false → Ctrl+J ignored.

#### Tasks
1. RED suite (8 tests below)
2. GREEN component
3. Exports + integration scene + CHANGELOG

#### TDD
```
RED:     typing_updates_frame_with_typed_text() — stdin.write("hi"); await tick; expect(lastFrame()).toContain("hi")
RED:     enter_submits_trimmed_text_and_clears() — type "hello"; stdin.write("\r"); expect(onSubmit).toHaveBeenCalledWith("hello"); expect(lastFrame()).not.toContain("hello")
RED:     whitespace_only_enter_is_noop() — type "   "; stdin.write("\r"); expect(onSubmit).not.toHaveBeenCalled()
RED:     ctrl_j_inserts_newline_in_multiline() — type "ab"; stdin.write("\n"); type "cd"; submit; expect(onSubmit).toHaveBeenCalledWith("ab\ncd")
RED:     arrows_and_backspace_edit_at_cursor() — type "abc"; stdin.write("[D"); stdin.write("" or ""); submit; expect(onSubmit).toHaveBeenCalledWith("ac")
RED:     placeholder_renders_when_empty() — expect(lastFrame()).toContain("Type a message")
RED:     single_line_mode_ignores_ctrl_j() — multiLine={false}; "ab" + "\n" + "cd"; submit; expect(onSubmit).toHaveBeenCalledWith("abcd")
RED:     multichar_input_burst_inserts_atomically() — (EC-3) stdin.write("hello world") once; expect(lastFrame()).toContain("hello world")
GREEN:   Implement chat-composer.tsx until all pass
REFACTOR: Key-dispatch table if the useInput handler exceeds complexity 10
VERIFY:  pnpm vitest run src/chat-composer.test.tsx
```

#### Concurrency tests

(none — single-threaded)

#### Acceptance Criteria
- [ ] `pnpm vitest run src/chat-composer.test.tsx` exits 0 (8 tests) — run twice consecutively (stdin-settle stability)
- [ ] Pass: quality — `pnpm lint` exits 0 (react-hooks clean); complexity <= 10
- [ ] CHANGELOG updated — `grep -q "ChatComposer" CHANGELOG.md` exits 0

#### DoD (Definition of Done)
- [ ] `pnpm gates` exits 0

---

## Phase 4: Bench + example + probe extension

**Objective:** Evidence artifacts — mode-matrix baseline, interactive demo, NO_COLOR scene.

### T4.1 — chat-thread benchmark + committed M1 baseline

#### Objective
`benchmarks/chat-thread.bench.tsx` (plain vs windowed, 500 msgs + 300 tokens) writing
`docs/benchmarks/m1-chat-thread-baseline.json`; schema test extended.

#### Why this step (action + reasoning)

1. **What:** RED schema test for the M1 baseline file; then the bench (reusing the M0 sampling
   kit) and a full local run committing real numbers.
2. **Why now:** D6 — the windowing decision needs measured data; the cycle owner requires
   benchmark evidence per milestone.

#### Evidence
- Mode driver + streaming mutation: `knowledge-base/references/assistant-ui/packages/react-ink/benchmarks/long-thread.bench.tsx:244-342`.
- M0 harness (env pin + protocol): `benchmarks/chat-message.bench.tsx` (Baseline row).

#### Files to edit
```
tests/bench-baseline.test.ts — extend: M1 file schema (modes[], per-mode aggregate, isFinite, self-consistency)
benchmarks/chat-thread.bench.tsx — (NEW) workload
docs/benchmarks/m1-chat-thread-baseline.json — (NEW) generated + committed
CHANGELOG.md — Added entry
```

#### Deep Dives
- Workload per mode (EC-1 MUST FIX absorbed): mount 500 messages; 300 steps where each step
  BOTH replaces the last message (+1 char — streaming repaint) AND appends a new short message
  (append churn: tail-array rebuild + Static graduation) — the analog's exact pattern
  (`long-thread.bench.tsx:244-259`); with rows memoized by identity, replace-last alone would
  re-render one row in BOTH modes and the comparison would be decision-irrelevant. Both
  phenomena documented in `methodology`. Per-step awaited tick; EC-2 zero-frame guard reused.
- JSON: `{ benchmark: "chat-thread-render", modes: [{ mode: "plain"|"windowed", runs: [...],
  aggregate: {...} }], workload: { messages: 500, streamed_tokens: 300, window: "8+4" },
  protocol, hardware, node_version, color_env, methodology }`.
- `--smoke`: 1 run per mode, no write.

#### Tasks
1. RED schema test (M1 block) — file absent
2. Implement bench; `pnpm bench` full run; commit JSON
3. CHANGELOG

#### TDD
```
RED:     m1_thread_baseline_exists_with_mode_matrix() — parse docs/benchmarks/m1-chat-thread-baseline.json; expect(baseline.modes.length).toBe(2); for each mode expect(mode.runs.length).toBeGreaterThanOrEqual(3); expect(Number.isFinite(mode.aggregate.mean_ms_per_frame.std_dev)).toBe(true); recomputed mean within 0.01 of aggregate
GREEN:   Implement bench with EC-2 guard; run pnpm bench; commit baseline
REFACTOR: Share sampling/stats helpers with chat-message bench via benchmarks/sampling.ts if duplication exceeds rule-of-three
VERIFY:  pnpm vitest run tests/bench-baseline.test.ts && pnpm bench --smoke
```

#### Concurrency tests

(none — single-threaded) — the workload is a sequential awaited rerender loop.

#### Acceptance Criteria
- [ ] `pnpm bench` exits 0 and writes both mode aggregates with >= 3 finite runs each
- [ ] `pnpm bench --smoke` exits 0 in < 120s (CI-viable)
- [ ] `git ls-files docs/benchmarks/m1-chat-thread-baseline.json` outputs the path
- [ ] Pass: quality — `pnpm lint benchmarks` exits 0

#### DoD (Definition of Done)
- [ ] `pnpm gates` exits 0; real measured numbers committed

### T4.2 — Interactive example + NO_COLOR scene extension

#### Objective
`examples/chat.tsx` (thread + composer + fake streaming; TTY-aware) + NO_COLOR probe gains a
system-role + thread scene.

#### Why this step (action + reasoning)

1. **What:** The human-runnable wiring caller for the whole M1 surface + the degraded-render
   proof extended to the new primitives.
2. **Why now:** Wiring pillar (a) for thread/composer/streaming in one honest consumer program
   (D8); NO_COLOR coverage is an M1 DoD line.

#### Evidence
- D8 (TTY detection); M0 probe precedent (`tests/fixtures/no-color-probe.tsx`);
  `rules/cycle-implement.md § Wiring triad`.

#### Files to edit
```
examples/chat.tsx — (NEW) interactive demo (TTY) / scripted streaming demo (non-TTY)
package.json      — "example:chat": "tsx examples/chat.tsx"
tests/fixtures/no-color-probe.tsx — extend: thread with 3 roles rendered
src/chat-message.test.tsx — no_color assertion extends: "·" present without ANSI
CHANGELOG.md — Added entry
```

#### Deep Dives
- TTY mode: composer onSubmit appends user msg + starts interval appending tokens to an
  assistant reply (60ms cadence), `useApp().exit()` on Ctrl+C (ink default) — interval cleared
  when reply completes.
- Non-TTY mode: renders a fixed 3-role thread + a scripted 20-token streaming reply, then
  exits 0 (interval cleared; unmount) — `pnpm example:chat | cat` asserts in Final Phase.
- Probe: renders `<ChatThread messages={threeRoles}/>` (short thread — no Static needed for
  the degraded proof) and writes the frame.

#### Tasks
1. Extend probe + no_color test (RED: "·" not yet in probe output)
2. Write example; verify TTY-less run exits 0
3. package.json script + CHANGELOG

#### TDD
```
RED:     no_color_render_contains_text_without_ansi_escapes() — EXTENDED assertion: expect(out).toContain("·") (system glyph present, zero ANSI)
RED:     (example — infrastructure) Given examples/chat.tsx When run piped (`pnpm example:chat | cat`) Then output contains all three role glyphs and the streamed reply text and the process exits 0
GREEN:   Extend probe; write example
REFACTOR: None expected
VERIFY:  pnpm vitest run src/chat-message.test.tsx -t no_color && pnpm example:chat | cat
```

#### Concurrency tests

(none — single-threaded) — the demo interval is a single timer cleared on completion.

#### Acceptance Criteria
- [ ] `pnpm example:chat | cat` exits 0 and output contains ">", "✦", "·"
- [ ] `pnpm vitest run src/chat-message.test.tsx -t no_color` exits 0 with the extended assertion
- [ ] Pass: quality — `pnpm lint examples` exits 0

#### DoD (Definition of Done)
- [ ] `pnpm gates` exits 0
- [ ] CHANGELOG updated

---

## Coverage Matrix

| # | Gap / Requirement (source) | Task(s) | Resolution |
|---|---|---|---|
| 1 | ChatMessage user/assistant/system roles (ROADMAP M1 DoD-1) | T1.1 | Union + tokens + guard + snapshots |
| 2 | ChatThread with `<Static>` history + viewport semantics (DoD-1) | T2.1 | Windowed Static prefix + memo tail + D7 guard |
| 3 | ChatComposer multi-line via useInput (DoD-1) | T3.1, T3.2 | Pure reducer + component with real-stdin tests |
| 4 | Streaming append-in-place render (DoD-2) | T2.2 | Rerender sequence + repaint-scope proof |
| 5 | Snapshot tests per role + streaming sequence (DoD-3) | T1.1, T2.2 | System snapshot + progressive-frame asserts |
| 6 | Readable in NO_COLOR (DoD-3) | T4.2 | Probe extended to 3 roles/thread |
| 7 | Benchmark data with statistical protocol (cycle owner) | T4.1 | Mode-matrix baseline committed |
| 8 | Wiring triad for new symbols (`rules/cycle-implement.md`) | T2.2, T4.1, T4.2 | Integration scenes + example + bench callers |
| 9 | CHANGELOG discipline (Rule 6) | T1.1, T2.1, T2.2, T3.1, T3.2, T4.1, T4.2 | [Unreleased] entries appended by every task |
| 10 | Zero new runtime deps (Blueprint Corner 2) | T3.1, T3.2 | Composer uses built-in Intl.Segmenter + ink primitives only; deps-audit verified no manifest change |

**Coverage: 10/10 gaps covered (100%)**

## Global Definition of Done

- [ ] All phases completed
- [ ] All tests passing — `pnpm test` green (M0 suite + ~28 new M1 tests)
- [ ] Zero type errors — `pnpm typecheck`; zero lint warnings — `pnpm lint`; format clean — `pnpm format:check`
- [ ] Build green — `pnpm build` produces `dist/index.js` + `dist/index.d.ts`
- [ ] Coverage ≥ 90% on `src/**` — `pnpm test:coverage` exits 0 (critical paths § above: 100%)
- [ ] File-size budget — `wc -l` <= 500 for every changed source file
- [ ] CHANGELOG `[Unreleased]` updated per task (Rule 6)
- [ ] Backward compatibility — v0.1.0 public API unchanged except documented guard-message text (CHANGELOG § Changed)
- [ ] **Benchmark proof** — `docs/benchmarks/m1-chat-thread-baseline.json` committed with real numbers (2 modes × ≥ 3 runs, mean ± std dev, finite, self-consistent)
- [ ] CI green on develop (node 20 + 22, 7 steps incl. coverage + bench smoke)
- [ ] **Plan archived** — after `/review` READY_TO_MERGE AND the release PR merges, move to `knowledge-base/plans/completed/` (never before)

## Failure scenarios (when I/O external)

(none — no external I/O touched)

## Final Phase: Integration Validation (MANDATORY)

**Objective:** Prove the M1 surface as a composed workload.

### Execution

```
pnpm gates                    # format:check → lint → typecheck → test → build
pnpm test:coverage            # >= 90% src/** (thresholds enforced)
pnpm bench                    # full run — refresh M1 baseline; commit diff if any
pnpm example:chat | cat       # non-TTY smoke of the full M1 surface
pnpm vitest run               # second consecutive full run (stdin/snapshot stability)
```

### Acceptance Criteria

- [ ] `pnpm gates` exits 0; `pnpm test:coverage` exits 0
- [ ] Two consecutive full `pnpm vitest run` executions green (stability)
- [ ] `pnpm example:chat | cat` exits 0 with all three glyphs + streamed text
- [ ] M1 baseline present, finite, self-consistent; if the full run changed it, the refresh is committed
- [ ] Failure scenarios — skipped ("(none — no external I/O touched)")

### If Validation Fails

1. All failures are plan-caused (only M1 files changed) — fix before declaring complete
2. Re-run the chain; document any environment quirk in the PR description
