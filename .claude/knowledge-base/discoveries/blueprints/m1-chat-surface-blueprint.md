# Blueprint: M1 Chat surface core — ChatThread + ChatComposer + streaming render

> **Version 1.0** — Synthesizes the deep research over `assistant-ui/packages/react-ink`
> (ThreadMessages windowing + useTextBuffer composer), `gemini-cli` (production `<Static>`
> split + InputPrompt), `ink` (Static/use-input contracts + authoritative test byte
> sequences) and `ink-ui` (single-line contrast) into the locked M1 decisions: ChatThread
> composition, streaming-render contract, ChatComposer API/buffer, system-role extension,
> test strategy and bench extension. All 7 research questions answered; 0 blocked.

**Slug:** `m1-chat-surface`
**Source plan:** `.claude/knowledge-base/discoveries/plans/m1-chat-surface-plan.md`
**Owner:** paulohenriquevn + Claude (assisted)
**Generated:** 2026-07-06 via `/discover-execute`
**Confidence verdict:** SHIPPABLE (99.7/100 — 2026-07-06, zero caps)

## Context

Inherited from the discovery plan: `ROADMAP.md § M1` — ChatMessage user/assistant/system,
ChatThread (`<Static>` history), ChatComposer (multi-line via `useInput`), streaming
append-in-place, snapshot tests per role + streaming sequence, NO_COLOR-readable. Risks:
viewport/height correctness; streaming re-render perf/flicker.

## Objective

Enable `/to-plan` to write the M1 plan with zero unresolved design questions.

---

## Coverage Corner 1 — Integration Tests

*(Answers Q4, Q5.)*

### assistant-ui/react-ink (vitest — action-level input tests + mocked Static)

- ComposerInput tests drive the captured `useInput` handler DIRECTLY with `(input, key)`
  pairs and assert buffer actions + resulting text —
  `.claude/knowledge-base/references/assistant-ui/packages/react-ink/src/tests/ComposerInput.test.tsx:105-127`
  (`inputHandler?.("", { leftArrow: true }); … setText called with "heXllo"`).
- ThreadMessages tests MOCK ink's `Static` to count items and capture rendered indices via
  `vi.hoisted` mutable state —
  `.claude/knowledge-base/references/assistant-ui/packages/react-ink/src/primitives/thread/ThreadMessages.test.tsx:6-28, 125-140`
  (20 messages, windowSize → `capturedIndices` `[13..19]`).

### ink (authoritative stdin byte sequences + Static test contract)

- Key encodings (for real `stdin.write` tests) —
  `.claude/knowledge-base/references/ink/test/hooks-use-input.tsx`: Enter `"\r"`,
  Escape `""` (:88), Ctrl+F `""` (:102), Meta+m `"m"` (:109),
  Meta+Backspace `""` (:116), Tab `"\t"` (:137), Shift+Tab `"[Z"` (:144),
  Backspace `""` (:151), Delete `"[3~"` (:158); arrows `"[A"`/`"[B"`.
- Static output in tests: `renderToString` returns static+dynamic combined
  (`'A\nB\nC\n\n\nX'`) — `.claude/knowledge-base/references/ink/test/components.tsx:478-492`;
  interactive mode re-emits `fullStaticOutput + dynamicOutput` per write, so
  `lastFrame()`/last write CONTAINS the accumulated static lines —
  `.claude/knowledge-base/references/ink/test/components.tsx:494-512`.
- Gotchas: Static unmount must not replay stale items (#904) —
  `.claude/knowledge-base/references/ink/test/components.tsx:514-556`.

### gemini-cli (act/waitFor settling; sampled — file is 5430 lines)

- `await act(async () => { stdin.write('[B'); }); await waitFor(...)` —
  `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/components/InputPrompt.test.tsx:503-523, 581-618`
  (sampled per plan EC-3: harness + 2 key-handling tests).

### Synthesis for M1

Two-layer test strategy: (1) REAL-stdin tests via ink-testing-library `stdin.write` with the
ink-suite byte sequences + one-tick settling (our `renderFrame` discipline); (2) streaming
asserted via `rerender()` sequences + `frames`/`lastFrame` content. Static content is asserted
through `lastFrame()` (it contains accumulated static output — no mocking needed for
happy-path; mocking Static à la react-ink reserved for index-window unit tests).

---

## Coverage Corner 2 — Dependencies

*(Answers Q6.)*

| Import (thread/composer code) | Package | Where declared | M1 need? |
|---|---|---|---|
| `Intl.Segmenter` (grapheme cursor) | built-in | — (`useTextBuffer.ts:31-34`) | ✅ built-in |
| `Box, Text, Static, useFocus, useInput` | ink | peer/dep already | ✅ present |
| `chalk` (gemini InputPrompt only) | chalk 4.1.2 | `.claude/knowledge-base/references/gemini-cli/packages/cli/package.json:40` | ❌ not needed (ink Text handles color/inverse) |
| `string-width` (gemini wrapping) | 8.1.0 | `...gemini-cli/packages/cli/package.json:64` | ❌ not needed at M1 (Ink wraps) |
| `clipboardy` (gemini paste) | 5.2.0 | `...gemini-cli/packages/cli/package.json:42` | ❌ out of scope |
| `slice-ansi` | — | not used by any analog thread/composer | ❌ absent |

**Verdict: ZERO new runtime dependencies for M1.** react-ink's composer+thread use only
react/ink/built-ins (`.claude/knowledge-base/references/assistant-ui/packages/react-ink/src/primitives/composer/ComposerInput.tsx:1-10`,
`useTextBuffer.ts:1-2`, `thread/ThreadMessages.tsx:1-11`).

---

## Coverage Corner 3 — Tools

*(Answers Q7 — bench extension.)*

- Windowed mode implementation (the thing to benchmark):
  `tailStart = max(0, len - windowSize - overscan)`; prefix indices → `<Static>`; tail wrapped
  in `MemoMessage` keyed by index —
  `.claude/knowledge-base/references/assistant-ui/packages/react-ink/src/primitives/thread/ThreadMessages.tsx:130-166`.
- Memo wrapper: `memo(Impl, (prev,next) => prev.index === next.index && Object.is(prev.render, next.render))` —
  `.claude/knowledge-base/references/assistant-ui/packages/react-ink/src/primitives/internal/MemoMessage.tsx:31-35`.
- Streaming mutation pattern for the workload (grow last assistant msg + append placeholder)
  — `.claude/knowledge-base/references/assistant-ui/packages/react-ink/benchmarks/long-thread.bench.tsx:244-259`;
  3-mode trial driver + attribution deltas `:288-342`.
- **M1 bench design:** extend OUR harness with `benchmarks/chat-thread.bench.tsx` — mode
  matrix {plain, windowed} × 500 messages × 300 streamed tokens, same metrics
  (frames, mean/peak ms-per-frame, ±std dev, pinned color env) and a NEW baseline JSON
  `docs/benchmarks/m1-chat-thread-baseline.json` (same schema + `mode` field per entry).
  The M0 chat-message baseline stays untouched (regression comparability).

---

## Coverage Corner 4 — Techniques

*(Answers Q1, Q2, Q3.)*

### Q1 — ChatThread composition

- react-ink: optional windowing; prefix→`<Static>`, tail→live `MemoMessage[]`; overscan
  default 4 — `ThreadMessages.tsx:35-49, 130-166` (quotes in Corner 3).
- gemini-cli: Static holds header + history up to & incl. the LAST USER PROMPT; assistant
  output after it + pending items stay dynamic below —
  `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/components/MainContent.tsx:73-152, 310-320`;
  height guard `staticAreaMaxItemHeight = max(terminalHeight*4, 100)` —
  `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/AppContainer.tsx:609`.
- ink Static contract: renders NEW items once (index watermark `useState(0)` +
  `items.slice(index)` + `useLayoutEffect` advance), `position:'absolute'`, output lands in
  terminal scrollback — `.claude/knowledge-base/references/ink/src/components/Static.tsx:21-58`.
- **"Scroll/viewport" in Ink = terminal scrollback.** No imperative viewport exists; Static
  IS the scroll mechanism (plan ADR D2 confirmed — bubbles not needed).

### Q2 — Streaming render without flicker

- Per-message subscription (only the growing row recomputes) + memo boundary + windowing
  bound the reconciliation scope; the growing message NEVER enters Static —
  `long-thread.bench.tsx:99-109` (per-row length subscriber), `:112-128` (legacy — whole array
  reconciles), `MemoMessage.tsx:31-35`, `MainContent.tsx:320` (pendingItems outside Static).
- No throttle/re-key needed at 16ms token cadence — Ink flushes between ticks
  (`long-thread.bench.tsx:152-155`).

### Q3 — ChatComposer input

- Buffer: flat `{ text, cursorOffset, preferredColumn }` + reducer actions (insert/delete/
  move/kill/word ops), grapheme-aware via `Intl.Segmenter` —
  `.claude/knowledge-base/references/assistant-ui/packages/react-ink/src/primitives/composer/useTextBuffer.ts:3-26, 31-34, 137-309`.
- Key mapping (ComposerInput): Ctrl+J always newline (multiLine); Return → newline when
  `multiLine && (!submitOnEnter || key.shift)` else submit; emacs bindings; arrows; cursor
  rendered as `<Text inverse>{graphemeAtCursor}</Text>` (space when at newline/EOL) —
  `.claude/knowledge-base/references/assistant-ui/packages/react-ink/src/primitives/composer/ComposerInput.tsx:89-236`.
- gemini-cli: dedicated NEWLINE key + SUBMIT with backslash-continuation (`\` before cursor →
  newline instead of submit) + 40ms paste-protection —
  `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/components/InputPrompt.tsx:1074-1077, 1258-1283`.
- ink `useInput` `key` fields: return/escape/ctrl/shift/tab/meta/arrows/backspace/delete
  (+kitty-only extras). **Shift+Enter is NOT a distinct key** — both set `key.return`;
  `key.shift` only arrives when the terminal actually encodes it (kitty protocol) —
  `.claude/knowledge-base/references/ink/src/hooks/use-input.ts:9-124`. Paste arrives via the
  separate `usePaste` channel (bracketed paste) —
  `.claude/knowledge-base/references/ink/src/hooks/use-paste.ts:14-80`.
- ink-ui contrast (single-line): `key.return` always submits; 4-action reducer; chalk-inverse
  cursor — `.claude/knowledge-base/references/ink-ui/source/components/text-input/use-text-input.ts:34-115`.

## Cross-cutting Comparison

| Dimension | react-ink | gemini-cli | ink | ink-ui |
|---|---|---|---|---|
| History freeze | windowed prefix → Static (`ThreadMessages.tsx:157-166`) | Static up to last user prompt (`MainContent.tsx:144-152`) | Static = append-only scrollback (`Static.tsx:28-38`) | n/a |
| Streaming zone | live tail w/ memo rows | pendingItems below Static (`MainContent.tsx:320`) | dynamic output region | n/a |
| Input buffer | flat string+offset, Intl.Segmenter (`useTextBuffer.ts`) | lines[]+[row,col]+visual map (`text-buffer.ts:3913-4010`) | — | flat, 4 actions |
| Submit vs newline | Enter submits; Shift+Enter/Ctrl+J newline (`ComposerInput.tsx:147-158`) | SUBMIT key + `\`-continuation (`InputPrompt.tsx:1275-1279`) | key.return only (`use-input.ts`) | Enter always submits |
| Input tests | direct handler invocation | stdin.write + act/waitFor | stdin byte suite | stdin.write + delay |

## ADRs

### D1 — ChatThread: messages-prop API with windowed `<Static>` history (immutable prefix contract)

**Decision:** `ChatThread({ messages, windowSize = 8, windowOverscan = 4, renderMessage? })`
where `messages: ChatThreadMessage[]` (`{ id, role, content }`). Prefix
(`len - windowSize - overscan`) renders through `<Static>` keyed by message id; tail renders
live, each row wrapped in a memoized row component. Documented contract: **messages that
leave the live window are frozen** (append-only history — edits to them will not repaint).

**Rationale:** Mirrors `ThreadMessages.tsx:130-166` mechanics with an explicit-props API (no
runtime store at M1 — plan ADR D3); gemini-cli proves Static-history in production; Ink has
no viewport — Static IS scroll (`Static.tsx:21-27`).

**Alternatives considered:** No windowing by default like react-ink (rejected: roadmap DoD
names `<Static>` for history — a default that never uses Static fails the DoD); semantic
boundary at last-user-prompt like gemini-cli (rejected: requires role semantics in the
component — caller-specific policy, YAGNI at M1); id-less index keys (rejected: react keys on
reorder-able data need stable ids; react-ink keys by index only because its store guarantees
append-only).

**Consequences:** Callers own message identity (`id`); M7's adapter will emit stable ids.
Window defaults tuned by the M1 benchmark data.

### D2 — Streaming contract: memoized rows by message identity; growing message stays in the live tail

**Decision:** Row memo comparator: `prev.message === next.message` (object identity) — the
caller streams by replacing the LAST message object (`[...msgs.slice(0,-1), {...last,
content: last.content + token}]`); only that row re-renders. No throttle at M1.

**Rationale:** Simpler than react-ink's render-fn memo (`MemoMessage.tsx:31-35`) because our
API passes message objects, not store accessors; identity comparison gives the same bound
(only-changed-row reconciles). Bench evidence: memo/windowed modes cut mean+peak frame times
vs legacy (`long-thread.bench.tsx:288-342`); 16ms cadence needs no throttle (`:152-155`).

**Alternatives considered:** Per-row store subscription à la react-ink (rejected: M7 owns
state); deep-equality memo (rejected: O(content) per row per frame — identity is the
contract).

**Consequences:** Mutating a message in place (same reference) will NOT repaint — documented
+ tested. This is the standard React data contract.

### D3 — ChatComposer: uncontrolled grapheme-aware buffer; Enter submits, Ctrl+J newline (Shift+Enter honored when the terminal encodes it)

**Decision:** `ChatComposer({ onSubmit, placeholder?, multiLine = true, autoFocus = true })`
with an internal reducer buffer `{ text, cursorOffset }` (Intl.Segmenter graphemes; insert/
delete-backward/delete-forward/move-left/right/home/end + newline insert). Keymap: printable →
insert; Enter → submit (trimmed-empty guard: no-op); **Ctrl+J → newline** (reliable in every
terminal — it IS the `\n` byte); `key.shift && key.return` → newline when the terminal
encodes it (kitty); arrows/home/end move; backspace/delete delete. Cursor = `<Text inverse>`
on the grapheme at cursor (space at EOL/newline). Multi-line renders as wrapped lines; on
submit the buffer clears.

**Rationale:** Buffer shape + grapheme discipline proven in `useTextBuffer.ts:3-26,31-34`;
keymap mirrors `ComposerInput.tsx:89-158` with the honest Shift+Enter caveat from
`use-input.ts` (no distinct encoding in legacy terminals). ink-ui shows Enter-always-submit
is the single-line convention — we keep it as the multi-line default too (chat UX: Enter
sends), with Ctrl+J as the guaranteed newline path.

**Alternatives considered:** Controlled-only `value/onChange` (rejected at M1: forces every
caller to re-implement cursor state; add controlled mode when a consumer needs it — YAGNI);
gemini's backslash-continuation (deferred: nice-to-have, M2+); full emacs kill/word ops
(deferred: additive later; M1 ships core ops only); `usePaste` integration (deferred to M2+ —
separate channel per `use-paste.ts:17-18`).

**Consequences:** Word-nav/kill ops and paste land later as additive actions; the reducer is
exported test-first so ops are unit-testable without a TTY.

### D4 — ChatMessage gains `system` role via theme tokens (breaking-safe extension)

**Decision:** Extend the role union to `"user" | "assistant" | "system"`; add
`defaultTheme.role.system` tokens (glyph `"· "`, prefix color `"gray"`, text undefined);
`TheoThemeOverride.role.system` accepted; the EC-1 guard message updates to name the 3-role
union.

**Rationale:** Roadmap M1 DoD names three roles. Purely additive to the M0 API (existing
consumers unaffected); token-driven per ADR D5 (M0) so NO_COLOR keeps role
distinguishability via glyphs (M0 review positive finding).

**Alternatives considered:** Separate `SystemMessage` component (rejected: M0 ADR D4 chose a
single role-switched primitive); color-only distinction (rejected: breaks the color-independent
a11y property).

**Consequences:** M0's invalid-role test asserting the 2-role message updates (documented
test change, not silent).

### D5 — Test strategy: real-stdin integration for composer; rerender-sequence for streaming; lastFrame for Static

**Decision:** (1) Composer: reducer unit tests (pure, no TTY) + real `stdin.write` tests
using the ink-suite byte sequences (`"\r"`, `"[D"`, `""`, `"\n"` for Ctrl+J) with
one-tick settling; (2) streaming: drive `rerender()` with growing content; assert
`lastFrame()` progression + a row-repaint-scope unit test via memo spy; (3) ChatThread/Static:
assert `lastFrame()` contains history + live tail (Static output accumulates in frames per
`ink/test/components.tsx:494-512`); windowing boundary unit-tested by counting rendered rows
(react-ink mock-Static idiom when needed).

**Rationale:** Byte sequences are authoritative from ink's own suite (Q4); Static-in-frames
behavior verified (Q5); action-level tests mirror `ComposerInput.test.tsx:105-127`.

**Alternatives considered:** Mock-everything à la gemini (rejected: our components have no
service deps — real stdin is cheaper and more honest); snapshot-only (rejected: interactive
behavior needs semantic asserts).

**Consequences:** M0 determinism kit (renderFrame, FORCE_COLOR pins, NO_COLOR subprocess
probe) is reused as-is; the NO_COLOR probe gains a thread+composer scene.

### D6 — Bench extension: chat-thread bench with mode matrix; new baseline JSON; M0 baseline untouched

**Decision:** `benchmarks/chat-thread.bench.tsx`: 500 messages, 300 streamed tokens, modes
{plain-column, windowed(8+4)}; same sampling/protocol/env-pin as M0; results →
`docs/benchmarks/m1-chat-thread-baseline.json` (schema + `mode` per entry). Streaming
mutation follows the analog pattern (grow last + append — `long-thread.bench.tsx:244-259`).

**Rationale:** Extends the proven harness; mode attribution mirrors the analog's
legacy/memo/windowed comparison; separate file preserves M0 regression comparability.

**Alternatives considered:** Overwrite the M0 baseline (rejected: destroys the regression
anchor); add legacy/no-memo mode (rejected: our rows are memoized by design — plain vs
windowed is the decision-relevant comparison).

**Consequences:** Real windowing-vs-plain data lands in the repo; M6+ tuning has evidence.

## Recommendations for the project

| # | Recommendation | Linked to | Priority |
|---|---|---|---|
| 1 | `ChatThread` with windowed Static history + memo rows keyed by id | Q1/Q2, D1/D2 | HIGH |
| 2 | `ChatComposer` with grapheme reducer buffer + Enter/Ctrl+J keymap + inverse cursor | Q3, D3 | HIGH |
| 3 | `system` role tokens + guard update | D4 | HIGH |
| 4 | Reducer exported and unit-tested first (TDD anchor), stdin tests with ink byte sequences | Q4, D5 | HIGH |
| 5 | Streaming rerender-sequence tests + repaint-scope proof | Q2/Q4, D5 | HIGH |
| 6 | chat-thread bench + m1 baseline JSON (mode matrix) | Q7, D6 | HIGH |
| 7 | ZERO new runtime deps (Intl.Segmenter built-in) | Q6 | HIGH |
| 8 | Document Shift+Enter terminal caveat in composer JSDoc | Q3, D3 | MEDIUM |

## Blocked questions (if any)

(none — all 7 answered)

## Halt-loop progress (audit trail)

- Iterations used: 1 (inline — 4 parallel research agents + synthesis; ralph-loop not spawned:
  session Stop hook active, per `rules/loop-engine-convention.md § Anti-patterns`)
- Questions answered: 7/7 · blocked: 0
- Citations verified: full path-existence sweep (Step 7) after synthesis
- EC-3 sampling honored: InputPrompt.test.tsx (5430 lines) sampled — harness + 2 key tests

## Related

- Discovery plan: `.claude/knowledge-base/discoveries/plans/m1-chat-surface-plan.md`
- Edge-case review: `.claude/knowledge-base/reviews/m1-chat-surface-edge-cases-2026-07-06.md`
- Project rules linked: `.claude/rules/architecture.md`, `.claude/rules/testing.md`,
  `.claude/rules/analysis-golden-rule.md`, `.claude/rules/public-copy.md`
