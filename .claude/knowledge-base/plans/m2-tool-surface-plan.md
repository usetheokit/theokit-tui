---
slug: m2-tool-surface
milestone_id: M2
created_at: 2026-07-06
goal: Ship the M2 tool-use surface (ToolCall/ToolCallCard with 4-status lifecycle + spinner, ToolResult with tail-truncation and shell envelope) with all gates green in CI and a committed tool-cards benchmark baseline.
---

# Plan: M2 Tool-use surface — ToolCall + ToolCallCard + ToolResult

> **Version 1.0** — Implements `ROADMAP.md § M2` on top of v0.2.0: `ToolCall` (inline status
> row), `ToolCallCard` (header + indented body), `ToolResult` (tail-truncation with
> `… +N lines hidden`, shell-envelope mode with labeled stderr + non-zero exit badge),
> `ink-spinner` as the first new runtime dependency since M0 (Rule 9 verdict: adopted by both
> analogs in production), per-status snapshots + one real animation test + transition rerenders,
> NO_COLOR scene, an examples update and a tool-cards benchmark with committed baseline. All
> design decisions locked by the m2-tool-surface blueprint (SHIPPABLE 98.7).

## Goal

Enable TypeScript agent-CLI developers to render tool-call lifecycles (running spinner →
success/failed) with truncated shell output from the built `@theokit/tui` package so that the
M2 tool surface is proven end-to-end, measured by the CI gate chain (format → lint → typecheck →
test → coverage → build → bench smoke) exiting 0 on `develop`.

## Context

v0.2.0 (M1) shipped the chat surface (ChatThread/ChatComposer/3 roles). `ROADMAP.md § M2` now
requires the tool-use surface: ToolCall/ToolCallCard with status lifecycle, ToolResult
(collapsed/expanded; shell-envelope `{stdout, stderr, exitCode}` aware), spinner while running
(ink-spinner), snapshot tests across statuses + long/truncated output. Risks: long output
overflow (resolved: maxLines tail-retention + 20k char pre-cap — Blueprint §"D4"); status
transitions racing the stream (resolved: status is a prop; transitions are plain rerenders,
row-level memo from M1 unchanged — Blueprint §"D3" boundary). The DISCOVER cycle produced a
SHIPPABLE blueprint (98.7) locking six ADRs from gemini-cli/react-ink/ink-ui/codex evidence.

## Baseline Context (deep review of current state)

### Files that will be touched

| File | LoC today | Last commit (sha) | Why it exists today | Invariants to preserve |
|---|---|---|---|---|
| `src/index.ts` | 15 | `c3b219e` | Composition root | Existing exports unchanged; `VERSION === package.json.version` |
| `src/theme.tsx` | 96 | `fa2c74e` | Semantic tokens | UNTOUCHED at M2 (status tokens already carry the card colors — Blueprint §"D1") |
| `src/tool-call.tsx` (NEW) | 0 | — | ToolCall + ToolCallCard + status types/constants | — |
| `src/tool-call.test.tsx` (NEW) | 0 | — | co-located tests | — |
| `src/tool-result.tsx` (NEW) | 0 | — | ToolResult (truncation + shell mode) | — |
| `src/tool-result.test.tsx` (NEW) | 0 | — | co-located tests | — |
| `tests/export-surface.test.ts` | 42 | `d45a321` | public-entry contract | grows with new exports |
| `tests/public-api.integration.test.tsx` | 82 | `ae00ca0` | integration via composition root | grows: tool-card scene |
| `tests/fixtures/no-color-probe.tsx` | 20 | `a314c2f` | NO_COLOR subprocess probe | gains a tool-card scene (glyphs w/o color) |
| `src/chat-message.test.tsx` | ~150 | `ae00ca0` | NO_COLOR test assertions | extends: status glyph asserts |
| `benchmarks/tool-cards.bench.tsx` (NEW) | 0 | — | M2 benchmark | — |
| `docs/benchmarks/m2-tool-cards-baseline.json` (NEW) | 0 | — | committed baseline | M0/M1 baselines untouched |
| `tests/bench-baseline.test.ts` | 158 | `ae00ca0` | baseline schema oracles | gains M2 block (M0-parity assertions incl. color_env) |
| `examples/tools.tsx` (NEW) | 0 | — | tool-cards demo (TTFATT caller) | `examples/basic.tsx`/`chat.tsx` untouched |
| `tests/example-tools.integration.test.ts` (NEW) | 0 | — | subprocess smoke (M1 F-tests-8 precedent) | — |
| `package.json` | 68 | `c3b219e` | manifest | + `ink-spinner` dependency + `example:tools` script; contract test protects shape |
| `CHANGELOG.md` | — | `c3b219e` | Unreleased empty post-0.2.0 | every task appends |

### Current callers / dependents

- **No existing production symbol is modified.** New symbols gain first callers inside this
  plan: `examples/tools.tsx`, `benchmarks/tool-cards.bench.tsx`, integration/probe tests.
- **Symbol:** `useTheoTheme` (`src/theme.tsx`) — new consumers `src/tool-call.tsx` /
  `src/tool-result.tsx` read `theme.status.*` + `theme.role.system.prefix` (existing tokens,
  additive consumption only).
- External: v0.2.0 public API — M2 is purely additive.

### Domain glossary

- **tool-call status** — `"pending" | "running" | "success" | "failed"`; visual = glyph/spinner
  + status color; arrives via props (M7 owns transitions).
- **indicator cell** — fixed 3-cell status column aligning card headers (gemini idiom).
- **tail retention** — truncation keeps the LAST lines (recent tool output wins).
- **shell envelope** — `{ stdout, stderr, exitCode }` value object rendered with labeled stderr
  and a non-zero-only exit badge.
- **first-frame determinism** — `renderFrame` captures at tick 0, before ink-spinner's first
  ~80ms interval → `running` snapshots always show `dots` frame[0].

### Architecture boundaries affected

Per `rules/architecture.md § 1-3`: both new components are interface-layer, consuming theme
tokens ONLY via `useTheoTheme()` (DIP seam unchanged); truncation math lives in a pure helper
inside `src/tool-result.tsx` (no ink import in the helper — unit-testable);
`src/index.ts` remains the only public surface. No external I/O.

## Prior Art & Related Work

- **Internal blueprint:** `knowledge-base/discoveries/blueprints/m2-tool-surface-blueprint.md` —
  ADRs D1–D6 consumed verbatim (§ ADRs restates condensed); Corners 1–4 carry the evidence.
- **Patterns skills:** (none exist).
- **Reference projects** (key anchors):
  - `knowledge-base/references/gemini-cli/packages/cli/src/ui/constants.ts:20-27` — TOOL_STATUS glyphs.
  - `knowledge-base/references/gemini-cli/packages/cli/src/ui/components/messages/ToolShared.tsx:29,145-190` — indicator width 3 + status→color.
  - `knowledge-base/references/gemini-cli/packages/cli/src/ui/components/shared/SlicingMaxSizedBox.tsx:12` — 20k char pre-cap.
  - `knowledge-base/references/codex/codex-rs/tui/src/exec_cell/render.rs:254-260` — `… +N lines` indicator idiom.
  - `knowledge-base/references/codex/codex-rs/exec/src/event_processor_with_human_output.rs:137-142` — non-zero-only `exited {code}`.
  - `knowledge-base/references/assistant-ui/packages/react-ink/src/primitives/toolCall/ToolFallback.tsx:1-125` — running spinner-in-Text idiom.
  - `knowledge-base/references/ink-ui/test/spinner.tsx:10-26` — exhaust+dedup animation test idiom.
- **External literature:** none beyond the above.

## Objective

- [ ] `ToolCall` renders indicator (3 cells) + bold name + dim summary for all 4 statuses; running shows the spinner
- [ ] `ToolCallCard` composes the ToolCall header + indented body (children)
- [ ] `ToolResult` truncates to `maxLines` with tail retention + `… +N lines hidden`; `expanded` shows all; 20k char pre-cap
- [ ] Shell mode renders labeled stderr, `exited {code}` only when non-zero, `(no output)` when empty
- [ ] Per-status snapshots + ONE real animation test (exhaust+dedup) + transition rerender tests + truncation line oracles
- [ ] NO_COLOR probe proves status glyphs are color-independent
- [ ] `benchmarks/tool-cards.bench.tsx` baseline committed (≥ 3 runs, mean ± std dev, pinned env)
- [ ] All gates green locally and in CI (node 20 + 22); coverage ≥ 90% on `src/**` (critical paths 100% lines)

## Dependencies

> Contract for `/deps-audit`. FIRST new runtime dependency since M0 (Blueprint §"D2" Rule 9 verdict).

### Existing — use as-is

| Package | Version | Ecosystem | Why |
|---|---|---|---|
| `ink` | `^5.2.0` | npm | Box/Text primitives |
| `react` | `^18.0.0 \|\| ^19.0.0` (peer) | npm | component model |
| (devDeps unchanged) | — | npm | as released in v0.2.0 |

### New — to be introduced

| Package | Version | Ecosystem | Rule 9 rationale (libs evaluated) | Why this one |
|---|---|---|---|---|
| `ink-spinner` | `^5.0.0` | npm | Evaluated: hand-rolled hook + `cli-spinners` (rejected — reproduces ~60 LoC incl. interval cleanup, and ink-ui's own version shipped a real packaging bug: runtime dep undeclared); `@inkjs/ui` Spinner (rejected — pulls the whole component suite for one spinner) | Production-adopted by BOTH analogs (react-ink `^5.0.0`, gemini-cli pinned `5.0.0`); canonical Ink solution; tiny. **`/deps-audit` registry check DONE (Q-U1 resolved):** peers `ink >=4.0.0` ✓ + `react >=18.0.0` ✓ vs our ink `^5.2.0` / react `^18\|\|^19`; MIT; single transitive `cli-spinners ^2.7.0` (MIT); OSV: 0 vulns on both packages |

### Removed

| Package | Last version | Why removed |
|---|---|---|
| (none) | | |

## ADRs

> D1–D6 originate in the blueprint (Blueprint §"ADRs" carries the evidence); restated condensed
> and self-contained. D7 is plan-local.

### D1 — Status lifecycle: 4 states, glyph/color constants, indicator width 3

**Decision:** `ToolCallStatus = "pending" | "running" | "success" | "failed"` (exported).
Visuals: pending `o` in gray (`theme.role.system.prefix`); running = ink-spinner `dots` in
`theme.status.warning`; success `✓` in `theme.status.success`; failed `x` bold in
`theme.status.error`. Module constant `STATUS_INDICATOR_WIDTH = 3`. Glyphs are module-local
constants (documented M6 theming candidates), colors come from EXISTING theme tokens.

**Rationale:** Roadmap DoD names running→success/failed; pending is real (queued calls) and
present in both analogs; glyphs mirror gemini's production set; zero theme-shape change.

**Alternatives considered:** gemini's 6-state set (rejected: confirming/canceled belong to the
M3+ approval surface — YAGNI); themable glyph tokens now (rejected: M6 owns theming).

**Consequences:** M3 may extend the union additively.

### D2 — Spinner: adopt `ink-spinner ^5.0.0`

**Decision:** New runtime dependency; running indicator =
`<Text color={warning}><Spinner type="dots"/></Text>`.

**Rationale:** Production-proven by both analogs; canonical; hand-rolling reproduces ~60 LoC
and invites the exact packaging mistake ink-ui shipped (undeclared runtime dep).

**Alternatives considered:** hand-rolled + cli-spinners (fallback only if peers conflict);
@inkjs/ui spinner (rejected: whole-suite pull).

**Consequences:** deps-audit gates the peers; documented fallback exists.

### D3 — Three composable primitives: ToolCall (row), ToolCallCard (card), ToolResult (output)

**Decision:** `ToolCall({ name, status, summary? })` = one header line;
`ToolCallCard({ name, status, summary?, children? })` = header + body indented
`paddingLeft = 3` (no borders at M2); `ToolResult` = output block (D4/D5). Status via props.

**Rationale:** Mirrors gemini's header/body split minus sticky/focus machinery (M3+);
composition over configuration (M0 D4 precedent); ISP — row consumers don't carry card props.

**Alternatives considered:** one component with `variant` (rejected: ISP); bordered body
(rejected at M2: border/height plumbing belongs with focus/viewport work — indentation is the
codex-like minimum).

**Consequences:** M3 timeline embeds `ToolCall` rows; cards stay compact.

**Edge-case addenda (EC-4, EC-8):** plain-STRING children are auto-wrapped in `<Text>` (a raw
string inside Ink's `<Box>` throws — the most natural consumer call must not crash); an
empty-string child is content-less → card collapses to the bare row. The header is ONE line by
contract: `name`/`summary` newlines are sanitized (`replace(/\r?\n/g, " ")`) before render;
other control/ANSI chars pass through unsanitized (documented in JSDoc — YAGNI at M2, EC-16).

### D4 — Truncation: `maxLines` tail-retention + `… +N lines hidden`; caller-controlled `expanded`

**Decision:** `ToolResult({ children?, shell?, maxLines = 10, expanded = false })` — content
over `maxLines` and not expanded renders the LAST `maxLines − 1` lines + one dim indicator
line `… +N lines hidden`; `expanded` renders all. Inputs are pre-capped at 20 000 chars
(pathological-input guard) with the cap surfaced in the indicator when it fires.

**Rationale:** Tail retention = gemini standard mode (recent output wins); indicator phrasing
follows codex (terminal-size-independent — no height threading at M2); 20k pre-cap mirrors
`SlicingMaxSizedBox`.

**Alternatives considered:** codex head+tail split (rejected: more layout for marginal M2
value); keybind expansion (rejected: no focus mgmt at M2); `availableTerminalHeight` plumbing
(deferred to M6).

**Consequences:** Interactive expansion arrives M3+; the prop contract stays.

**Edge-case addenda (EC-1, EC-2, EC-5, EC-6):**
- `maxLines` MUST be an integer ≥ 1 — anything else throws
  `TypeError: truncateLines: maxLines must be an integer >= 1 — got {value}` (fail-fast,
  `rules/error-handling.md § 2`; no magic clamping). `maxLines === 1` is an explicit special
  case: `{ visible: [], hidden: lines.length }` (the naive `slice(-(maxLines-1))` = `slice(-0)`
  returns ALL lines — a silent wrong render).
- **Content sources are mutually exclusive:** exactly one of `children` (plain string) |
  `lines` | `shell` may be provided; 2+ throw
  `TypeError: ToolResult: provide exactly one of children | lines | shell`; ZERO provided
  renders nothing (empty body is legal for composition).
- The 20k char pre-cap is an input guard, NOT display truncation: `expanded` does NOT bypass
  it; boundary is `> 20000` (exactly 20 000 chars passes untouched).
- CRLF input is normalized: split on `\n` then strip trailing `\r` per line (no stray `\r` in
  frames — snapshot stability).

### D5 — Shell envelope: labeled stderr, non-zero-only exit badge, `(no output)` placeholder

**Decision:** `shell={{ stdout, stderr, exitCode }}` renders: stdout lines plain; when stderr
non-empty — one dim `stderr:` label line then stderr lines in `theme.status.error`; when
`exitCode !== 0` — final line `exited {code}` bold in `status.error`; both streams empty → dim
`(no output)`. D4 truncation applies to the combined list (stdout then stderr).

**Rationale:** We receive SEPARATED fields (gemini interleaves pre-colored ANSI — different
input); color alone fails NO_COLOR, hence the one-line label (M0/M1 color-independence
precedent); exit-code convention from codex; `(no output)` beats silent-drop inside a card.

**Alternatives considered:** timestamp interleave (rejected: fields carry no ordering — would
fabricate); always-shown exit code (rejected: noise).

**Consequences:** M4+ may accept pre-interleaved ANSI arrays.

**Edge-case addenda (EC-3, EC-7, EC-12):** `exitCode?: number` is OPTIONAL — the badge renders
ONLY when `typeof exitCode === "number" && exitCode !== 0` (a mid-stream envelope
`{stdout, stderr}` from a JS caller must NOT render `exited undefined`); any non-zero number
renders verbatim (`exited 137`, `exited -1` — no signal mapping). Trailing newlines are
dropped after split (`"one\ntwo\n"` → 2 lines — no phantom blank line before the badge, no
hidden-count inflation).

### D6 — Test strategy: first-frame spinner determinism; one exhaust test; transition rerenders; line oracles

**Decision:** (1) per-status snapshots via `renderFrame` (tick-0 capture = deterministic
`dots` frame[0]); (2) ONE animation test with the ink-ui exhaust+dedup idiom
(`await delay(frames.length * interval)` real timers, dedup, assert subset of
`cli-spinners.dots.frames`); (3) transitions via `rerender` with new `status`; (4) truncation
via line presence/absence + indicator; (5) NO_COLOR probe scene with all 4 status glyphs;
(6) NO fake timers.

**Rationale:** Q4 evidence (gemini mocks animation; ink-ui owns the real test); frame[0]
stability by construction; `rules/testing.md § 6` bans time nondeterminism.

**Alternatives considered:** fake timers for spinner cycling (rejected: flake evidence);
mocking ink-spinner everywhere (rejected: nothing would prove the real integration).

**Consequences:** One test carries ~800ms wall cost — bounded, explicit timeout.

### D7 — Truncation math is a pure exported helper (`truncateLines`)

**Decision:** `truncateLines(lines: string[], maxLines: number): { visible: string[]; hidden: number }`
exported from `src/tool-result.tsx` (module-level, unit-tested without rendering; not
re-exported from the package entry).

**Rationale:** The head/tail arithmetic is the M2 critical path — pure-function testing gives
the tight TDD loop (M1 text-buffer precedent); rendering tests then assert composition only.

**Alternatives considered:** inline logic (rejected: forces every arithmetic edge through slow
render tests); separate file (rejected: single consumer — KISS).

**Consequences:** M6 height-aware truncation can evolve the helper without touching render code.

## Drawbacks & Risks

| Drawback / Risk | Severity | Mitigation | Owner |
|---|---|---|---|
| `ink-spinner` peers may not accept ink ^5/react ^18 (registry unknown until audit) | High | `/deps-audit` registry check BEFORE implement; documented fallback: ~30-line internal hook (Blueprint Corner 2) | deps-audit |
| First-frame snapshot determinism depends on renderFrame capturing before the first 80ms interval — a slower CI tick could race | Medium | The capture happens at tick 0 (0ms macrotask) — 80ms of headroom; the exhaust test provides the animation coverage; if a snapshot ever flakes, pin by mocking ONLY in snapshots (documented escape) | implement |
| Spinner interval keeps running for every mounted `running` card (N spinners = N timers) | Medium | Documented in ToolCall JSDoc (mirror gemini's showSpinner escape as an M6 candidate); bench measures the cost with 50 mixed-status cards | implement |
| Tail-only truncation hides the command's initial error context in some tools | Low | Documented trade-off (recent-output-wins, gemini precedent); `expanded` shows all; M6 revisits with height awareness | implement |
| 20k char pre-cap could clip a legitimately huge single line | Low | Cap surfaced in the indicator (`… output capped at 20000 chars`); constant exported for visibility | implement |

## Unresolved Questions

- Q-U1 — Exact `ink-spinner@5.x` peer ranges (ink/react): resolved by `/deps-audit` registry
  inspection before implement; conflict → documented fallback hook (D2).

(no others — blueprint ADRs D1–D6 + plan D7 resolve every decision.)

## Critical paths

For `/code-quality` D4 when enabled: `src/tool-result.tsx` (`truncateLines` + shell-envelope
branching), `src/tool-call.tsx` (status dispatch).

## Dependency Graph

```
Phase 1 (ToolCall + Card) ──▶ Phase 2 (ToolResult) ──▶ Phase 3 (integration + example + bench)
                                                              │
                                                              ▼
                                                    Final Phase (integration validation)
```

Sequential — one vertical slice; ToolResult composes inside ToolCallCard scenes; bench renders
both.

---

## Phase 1: ToolCall + ToolCallCard

**Objective:** Status lifecycle primitives with spinner, snapshot-covered.

### T1.1 — ToolCall row + status system (+ ink-spinner dependency)

#### Objective
`src/tool-call.tsx`: `ToolCallStatus` type, status glyph/color constants, `ToolCall` row;
`ink-spinner` installed; exported from the entry.

#### Why this step (action + reasoning)

1. **What:** RED tests (4 status renders + snapshots + spinner canary + invalid-status typed
   error) then the minimal row per D1/D2.
2. **Why now:** The status system is the milestone's core; the card, result, bench and example
   all consume it. The dependency lands here (post deps-audit Q-U1 confirmation).

#### Evidence
- Glyph/width/color maps: `knowledge-base/references/gemini-cli/packages/cli/src/ui/constants.ts:20-27`,
  `.../messages/ToolShared.tsx:29,145-190`.
- Spinner-in-Text idiom: `knowledge-base/references/assistant-ui/packages/react-ink/src/primitives/toolCall/ToolFallback.tsx:1-125`.

#### Files to edit
```
src/tool-call.test.tsx — (NEW) RED suite
src/tool-call.tsx      — (NEW) ToolCall + status system
src/index.ts           — export ToolCall + ToolCallStatus (+ props type)
tests/export-surface.test.ts — extend
package.json           — + ink-spinner dependency, lockfile refresh
CHANGELOG.md           — Added entry
```

#### Deep file dependency analysis
- `src/tool-call.tsx`: imports ink (Box, Text), ink-spinner (Spinner), `./theme.js`
  (useTheoTheme — status colors + system gray). No other internal deps.
- `src/index.ts`: gains `ToolCall`, `ToolCallStatus`, `ToolCallProps`.
- `package.json`: dependency addition audited by the manifest contract test? The contract
  test asserts peerDependencies keys unchanged (react only) — dependencies gains ink-spinner
  (assert updated: `dependencies` now `{ ink, ink-spinner }`).

#### Deep Dives
- Signature:

```pseudocode
type ToolCallStatus = "pending" | "running" | "success" | "failed"
ToolCall({ name, status, summary? }):
  guard: status ∉ union → TypeError `ToolCall: invalid status "…" — expected "pending" | "running" | "success" | "failed"` (FIRST statement, M0 EC-1 idiom)
  indicator = <Box minWidth={3}>{glyphFor(status, theme)}</Box>   -- spinner when running
  <Box>{indicator}<Text bold>{name}</Text>{summary && <Text dimColor> {summary}</Text>}</Box>
```

- Invariants: guard precedes hooks (react-hooks lint); indicator column exactly 3 cells;
  colors ONLY via theme tokens (DIP); header is ONE line — `name`/`summary` newlines
  sanitized to spaces (EC-8, D3 addenda); ANSI/control chars pass through (JSDoc note, EC-16).
- Edge cases: empty name (renders indicator only — legal, EC-9); summary omitted; invalid
  status (typed error — negative lens).
- The `running_shows_spinner_first_frame` oracle doubles as the EC-14 canary: it pins the
  coupling between `tests/helpers.tsx` `renderFrame`'s 0ms tick and cli-spinners' 80ms
  interval — add the WHY comment in `helpers.tsx` linking this test.

#### Tasks
1. RED suite (9 tests below) — fails (module absent)
2. `pnpm add ink-spinner@^5.0.0` (post-audit) + GREEN minimal
3. Exports + manifest-test dependency assertion update + CHANGELOG

#### TDD
```
RED:     renders_pending_with_circle_glyph() — const frame = await renderFrame(<ToolCall name="search" status="pending"/>); expect(frame).toContain("o"); expect(frame).toContain("search")
RED:     renders_success_with_check_glyph() — expect(frame).toContain("✓")
RED:     renders_failed_with_x_glyph() — expect(frame).toContain("x")
RED:     running_shows_spinner_first_frame() — expect(frame).toContain("⠋") (cli-spinners dots frame[0] at tick 0 — deterministic by construction, D6)
RED:     each_status_frame_matches_snapshot() — for each of the 4 statuses expect(frame).toMatchSnapshot(`tool-call-${status}`) inside <Box width={40}>
RED:     invalid_status_throws_typed_error() — expect(() => ToolCall({ name: "x", status: "done" as never })).toThrow(TypeError); expect(...).toThrow('ToolCall: invalid status "done" — expected "pending" | "running" | "success" | "failed"')
RED:     summary_renders_dim_after_name() — expect(frame).toContain("in 3 files")
RED:     empty_name_renders_indicator_only() — <ToolCall name="" status="success"/>; expect(frame.trim()).toBe("✓") (EC-9)
RED:     name_with_newline_renders_single_header_line() — name={"rm\n-rf"}; expect(frame.split("\n")).toHaveLength(1); expect(frame).toContain("rm -rf") (EC-8)
GREEN:   Implement tool-call.tsx until all pass
REFACTOR: Extract statusIndicator(status, theme) helper if the JSX branches exceed complexity 10
VERIFY:  pnpm vitest run src/tool-call.test.tsx
```

#### Concurrency tests

(none — single-threaded)

#### Acceptance Criteria
- [ ] `pnpm vitest run src/tool-call.test.tsx` exits 0 (9 tests); snapshots stable across two consecutive `pnpm test` runs
- [ ] `pnpm typecheck` exits 0; `pnpm lint` exits 0 with 0 warnings
- [ ] `pnpm audit` exits 0 after the dependency add (no new HIGH/CRITICAL)
- [ ] CHANGELOG updated — `grep -q "ToolCall" CHANGELOG.md` exits 0

#### DoD (Definition of Done)
- [ ] `pnpm gates` exits 0

### T1.2 — ToolCallCard (header + indented body)

#### Objective
`ToolCallCard({ name, status, summary?, children? })` composing the ToolCall header + body.

#### Why this step (action + reasoning)

1. **What:** RED tests (body indentation, no-children collapse to row, snapshot) then the
   minimal composition.
2. **Why now:** The card is the container ToolResult renders into (Phase 2 scenes).

#### Evidence
- Header/body decomposition: `knowledge-base/references/gemini-cli/packages/cli/src/ui/components/messages/ToolMessage.tsx:45-165`
  (minus borders/sticky — Blueprint §"D3").

#### Files to edit
```
src/tool-call.test.tsx — extend: card describe-block
src/tool-call.tsx      — add ToolCallCard
src/index.ts           — export ToolCallCard (+ props type)
tests/export-surface.test.ts — extend
CHANGELOG.md           — Added entry (grouped with T1.1)
```

#### Deep Dives
- `<Box flexDirection="column"><ToolCall …/>{hasBody && <Box paddingLeft={3}>{body}</Box>}</Box>` —
  body aligns under the name (indicator width). No borders (D3). STRING children are
  auto-wrapped in `<Text>` (raw string in `<Box>` crashes Ink — EC-4); empty-string children
  collapse to the bare row.
- Edge cases: no children (identical to bare ToolCall row — asserted); multi-line children;
  string children (EC-4).

#### Tasks
1. RED (5 tests below)
2. GREEN minimal
3. Exports + CHANGELOG

#### TDD
```
RED:     card_renders_header_and_indented_body() — const frame = await renderFrame(<ToolCallCard name="grep" status="success"><Text>12 matches</Text></ToolCallCard>); expect(frame).toContain("✓"); expect(frame).toContain("12 matches"); expect(frame.split("\n")[1]).toMatch(/^\s{3}/)
RED:     card_without_children_equals_row() — expect(cardFrame).toBe(rowFrame) (same name/status, no children)
RED:     card_frame_matches_snapshot() — expect(frame).toMatchSnapshot("tool-call-card") inside <Box width={40}>
RED:     card_with_string_children_renders_body() — <ToolCallCard name="ls" status="success">{"12 matches"}</ToolCallCard> renders without throwing; expect(frame).toContain("12 matches") (EC-4)
RED:     card_with_empty_string_children_equals_row() — children={""}; expect(cardFrame).toBe(rowFrame) (EC-4)
GREEN:   Implement ToolCallCard until all pass
REFACTOR: None expected
VERIFY:  pnpm vitest run src/tool-call.test.tsx
```

#### Concurrency tests

(none — single-threaded)

#### Acceptance Criteria
- [ ] `pnpm vitest run src/tool-call.test.tsx` exits 0 (14 tests)
- [ ] Pass: quality — `pnpm lint` exits 0; `wc -l src/tool-call.tsx` <= 500

#### DoD (Definition of Done)
- [ ] `pnpm gates` exits 0

---

## Phase 2: ToolResult

**Objective:** Output block with tail-truncation and shell envelope.

### T2.1 — truncateLines helper + plain ToolResult

#### Objective
Pure `truncateLines` (D7) + `ToolResult` rendering children/lines with `maxLines`/`expanded`.

#### Why this step (action + reasoning)

1. **What:** RED unit suite for the pure helper (edges: exact fit, one over, expanded, empty,
   20k cap) + render tests (indicator line, tail retention) — then implement.
2. **Why now:** Truncation is the critical path; the shell mode (T2.2) builds on it.

#### Evidence
- Tail retention + indicator: `knowledge-base/references/gemini-cli/packages/cli/src/ui/components/messages/ToolResultDisplay.tsx:219-253`,
  `knowledge-base/references/codex/codex-rs/tui/src/exec_cell/render.rs:254-260`.
- 20k pre-cap: `knowledge-base/references/gemini-cli/packages/cli/src/ui/components/shared/SlicingMaxSizedBox.tsx:12`.

#### Files to edit
```
src/tool-result.test.tsx — (NEW) RED suite (helper units + render)
src/tool-result.tsx      — (NEW) truncateLines + ToolResult
src/index.ts             — export ToolResult (+ props type)
tests/export-surface.test.ts — extend
CHANGELOG.md             — Added entry
```

#### Deep Dives
- Helper:

```pseudocode
truncateLines(lines, maxLines):
  guard: !Number.isInteger(maxLines) || maxLines < 1
         → TypeError `truncateLines: maxLines must be an integer >= 1 — got {maxLines}`   (EC-1)
  if lines.length <= maxLines: { visible: lines, hidden: 0 }
  if maxLines === 1:           { visible: [], hidden: lines.length }   -- EXPLICIT special case:
                               -- slice(-(1-1)) = slice(-0) = slice(0) returns ALL lines (EC-1)
  else: { visible: lines.slice(-(maxLines - 1)), hidden: lines.length - (maxLines - 1) }
# Example: 20 lines, maxLines 10 → visible = last 9, hidden = 11, indicator "… +11 lines hidden"
```

- Render: content from exactly ONE of `lines: string[]` | plain-string `children` | `shell`
  (2+ sources → TypeError; zero → renders nothing — D4 addenda EC-2); split on `\n` then strip
  trailing `\r` per line (CRLF, EC-6); pre-cap: total chars > 20 000 → cap then note in the
  indicator (applies even when `expanded` — EC-5); `expanded` bypasses LINE truncation only;
  indicator line dim.
- Edge cases: exactly maxLines (no indicator); maxLines+1 (indicator + last maxLines−1);
  maxLines = 1 (indicator only + hidden = all); blank `""` lines count and render (EC-11);
  empty content (renders nothing — the card's `(no output)` belongs to shell mode only).

#### Tasks
1. RED (17 tests below)
2. GREEN helper + component
3. Exports + CHANGELOG

#### TDD
```
RED:     helper_returns_all_lines_when_within_limit() — expect(truncateLines(["a","b"], 10)).toEqual({ visible: ["a","b"], hidden: 0 })
RED:     helper_exact_fit_has_no_hidden() — 10 lines, maxLines 10 → expect(result.hidden).toBe(0)
RED:     helper_one_over_keeps_tail() — 11 lines, maxLines 10 → expect(result.visible.length).toBe(9); expect(result.hidden).toBe(2); expect(result.visible[0]).toBe("line-2")
RED:     helper_max_lines_one_keeps_indicator_only() — expect(truncateLines(lines5, 1)).toEqual({ visible: [], hidden: 5 })
RED:     renders_tail_with_hidden_indicator() — 20 numbered lines maxLines 10; expect(frame).not.toContain("line-1\b-ish"); expect(frame).toContain("line-19"); expect(frame).toContain("… +11 lines hidden")
RED:     expanded_renders_everything() — expanded; expect(frame).toContain("line-0"); expect(frame).not.toContain("hidden")
RED:     exact_fit_renders_without_indicator() — expect(frame).not.toContain("hidden")
RED:     char_cap_fires_on_pathological_input() — one 30000-char line; expect(frame).toContain("output capped at 20000 chars")
RED:     result_frame_matches_snapshot() — truncated scene toMatchSnapshot("tool-result-truncated") inside <Box width={40}>
RED:     helper_rejects_zero_max_lines() — expect(() => truncateLines(["a"], 0)).toThrow(TypeError); expect(() => truncateLines(["a"], 0)).toThrow("truncateLines: maxLines must be an integer >= 1 — got 0") (EC-1)
RED:     helper_rejects_negative_max_lines() — expect(() => truncateLines(["a"], -2)).toThrow(TypeError) (EC-1)
RED:     helper_rejects_non_integer_max_lines() — expect(() => truncateLines(["a"], 2.5)).toThrow(TypeError) (EC-1)
RED:     helper_counts_blank_lines() — expect(truncateLines(["a","","b"], 2)).toEqual({ visible: ["b"], hidden: 2 }) (EC-11)
RED:     conflicting_content_sources_throw_typed_error() — <ToolResult lines={["a"]}>{"b"}</ToolResult>; expect render to throw TypeError "ToolResult: provide exactly one of children | lines | shell" (EC-2)
RED:     no_content_source_renders_nothing() — <ToolResult/>; expect(frame).toBe("") (EC-2)
RED:     cap_does_not_fire_at_exactly_20000_chars() — expect(frame).not.toContain("capped") (EC-5)
RED:     expanded_does_not_bypass_char_cap() — 30000 chars + expanded; expect(frame).toContain("output capped at 20000 chars") (EC-5)
RED:     crlf_content_splits_without_stray_carriage_returns() — lines from "a\r\nb"; expect(frame).not.toContain("\r"); expect(frame).toContain("a"); expect(frame).toContain("b") (EC-6)
GREEN:   Implement truncateLines + ToolResult until all pass
REFACTOR: Keep helper pure (no ink imports in the truncation math)
VERIFY:  pnpm vitest run src/tool-result.test.tsx
```

#### Concurrency tests

(none — single-threaded)

#### Acceptance Criteria
- [ ] `pnpm vitest run src/tool-result.test.tsx` exits 0 (17 tests)
- [ ] Pass: quality — `pnpm lint` exits 0; complexity <= 10; `wc -l src/tool-result.tsx` <= 500

#### DoD (Definition of Done)
- [ ] `pnpm gates` exits 0

### T2.2 — Shell envelope mode

#### Objective
`shell={{ stdout, stderr, exitCode }}` rendering per D5.

#### Why this step (action + reasoning)

1. **What:** RED tests (stderr label + color, non-zero badge, zero-exit silence, empty
   placeholder, truncation over combined list) then the shell branch.
2. **Why now:** Completes the roadmap's envelope requirement on top of T2.1's truncation.

#### Evidence
- Non-zero-only exit: `knowledge-base/references/codex/codex-rs/exec/src/event_processor_with_human_output.rs:137-142`.
- Empty-drop contrast (we render `(no output)`): `.../event_processor_with_human_output.rs:157-161`.

#### Files to edit
```
src/tool-result.test.tsx — extend: shell describe-block
src/tool-result.tsx      — shell branch
CHANGELOG.md             — Added entry (grouped with T2.1)
```

#### Deep Dives
- Combined lines = stdout.split + (stderr ? [label "stderr:"] + stderr.split : []) →
  truncation applies to the combined list; exit badge appended AFTER truncation (always
  visible when non-zero); `(no output)` when both empty AND exitCode === 0? — no: placeholder
  when both streams empty regardless; badge still shows for non-zero.
- Badge rule (D5 addenda EC-3): ONLY when `typeof exitCode === "number" && exitCode !== 0` —
  `exitCode` absent (mid-stream envelope) renders NO badge; non-zero values verbatim (EC-12).
- Edge cases: stderr-only; trailing newline normalization (split then drop trailing "" —
  EC-7 oracle below); exitCode 0 renders NO exit line.

#### Tasks
1. RED (10 tests below)
2. GREEN shell branch
3. CHANGELOG

#### TDD
```
RED:     shell_renders_stdout_plain() — expect(frame).toContain("total 42")
RED:     shell_labels_stderr_block() — expect(frame).toContain("stderr:"); expect(frame).toContain("permission denied")
RED:     nonzero_exit_renders_badge() — exitCode 2; expect(frame).toContain("exited 2")
RED:     zero_exit_renders_no_badge() — expect(frame).not.toContain("exited")
RED:     empty_streams_render_placeholder() — expect(frame).toContain("(no output)")
RED:     shell_truncation_covers_combined_streams() — 30 stdout + 5 stderr lines, maxLines 10; expect(frame).toContain("… +"); expect(frame).toContain("exited 1") (badge survives truncation)
RED:     shell_without_exit_code_renders_no_badge() — shell={{ stdout: "x", stderr: "" }}; expect(frame).not.toContain("exited") (EC-3)
RED:     exit_code_renders_verbatim() — exitCode 137; expect(frame).toContain("exited 137") (EC-12)
RED:     trailing_newline_does_not_add_blank_line() — stdout "one\ntwo\n", exitCode 2; const rows = frame.split("\n"); expect(rows[rows.indexOf(rows.find(r => r.includes("exited 2"))!) - 1]).toContain("two") (EC-7)
RED:     shell_conflicts_with_children_throw() — <ToolResult shell={sh}>{"x"}</ToolResult> throws TypeError "provide exactly one" (EC-2)
GREEN:   Implement shell branch until all pass
REFACTOR: Extract buildShellLines(shell) pure helper if branching exceeds complexity 10
VERIFY:  pnpm vitest run src/tool-result.test.tsx
```

#### Concurrency tests

(none — single-threaded)

#### Acceptance Criteria
- [ ] `pnpm vitest run src/tool-result.test.tsx` exits 0 (27 tests)
- [ ] Pass: quality — `pnpm lint` exits 0; complexity <= 10

#### DoD (Definition of Done)
- [ ] `pnpm gates` exits 0

---

## Phase 3: Integration + example + bench

**Objective:** Wiring closure + evidence artifacts.

### T3.1 — Animation test, transition tests, integration scene, NO_COLOR scene

#### Objective
The D6 test set that spans components: one real animation test, transition rerenders,
composition-root scene, NO_COLOR probe extension.

#### Why this step (action + reasoning)

1. **What:** The exhaust+dedup animation test (real timers, explicit timeout); rerender
   transition tests (running→success, running→failed); a public-entry scene (card + result
   inside a provider); the probe gains a 4-status tool scene.
2. **Why now:** Closes wiring pillar (b) and the M1-review lesson (M1 F-wire-1): the
   composition-root scene ships IN THE SAME MILESTONE as the components.

#### Evidence
- Exhaust idiom: `knowledge-base/references/ink-ui/test/spinner.tsx:10-26`.
- Transition idiom: `knowledge-base/references/gemini-cli/packages/cli/src/ui/components/messages/ShellToolMessage.test.tsx:89-127`.

#### Files to edit
```
src/tool-call.test.tsx — extend: animation + transition tests
tests/public-api.integration.test.tsx — extend: tool scene via src/index.js
tests/fixtures/no-color-probe.tsx — extend: 4-status tool scene
src/chat-message.test.tsx — extend no_color assertions (status glyphs, "exited")
CHANGELOG.md — entry (grouped with T3.2)
```

#### Deep Dives
- Animation test: render running ToolCall; `await delay(dots.frames.length * dots.interval + 50)`;
  dedup rendered frames; assert every unique spinner cell ∈ `cli-spinners.dots.frames`;
  explicit `{ timeout: 5000 }`.
- Transition: `rerender(<ToolCall status="success"/>)` → spinner absent, `✓` present.
- NO_COLOR probe: glyphs `o ✓ x` + running (spinner frame char is color-independent) + a
  shell result with `exited 2` AND the `stderr:` label (the label IS the D5 color-independence
  mechanism — EC-13) — all visible without ANSI.
- Same-status rerender must NOT reset the spinner interval (EC-10).

#### Tasks
1. RED tests (7 below)
2. GREEN (no production change expected; failures loop to T1/T2)
3. CHANGELOG

#### TDD
```
RED:     spinner_animates_through_dots_frames() — real timers; await delay(frames.length*interval+50); const cells = uniqueSpinnerCells(frames); expect(cells.length).toBeGreaterThan(1); for cell of cells expect(dotsFrames).toContain(cell)
RED:     transition_running_to_success_swaps_indicator() — rerender; expect(lastFrame()).toContain("✓"); expect(lastFrame()).not.toContain("⠋")
RED:     transition_running_to_failed_swaps_indicator() — rerender; expect(lastFrame()).toContain("x")
RED:     public_entry_composes_tool_card_with_result() — import { ToolCallCard, ToolResult } from "../src/index.js"; provider + card + shell result; expect(frame).toContain("✓"); expect(frame).toContain("stderr:")
RED:     no_color_render_contains_status_glyphs_without_ansi() — probe output: expect(out).toContain("✓"); expect(out).toContain("exited 2"); expect(out).not.toContain("[")
RED:     no_color_render_contains_stderr_label() — probe output: expect(out).toContain("stderr:") (EC-13)
RED:     same_status_rerender_does_not_reset_spinner() — mount running; await half the cycle; rerender SAME props; exhaust remainder; unique cells still advance (length > 1) and remain a subset of dots.frames (EC-10)
GREEN:   Wire the scenes; fix components if any fail
REFACTOR: None expected
VERIFY:  pnpm vitest run src/tool-call.test.tsx tests/public-api.integration.test.tsx && pnpm vitest run src/chat-message.test.tsx -t no_color
```

#### Concurrency tests

(none — single-threaded) — the animation test awaits real time sequentially.

#### Acceptance Criteria
- [ ] All suites exit 0; animation test < 5s wall
- [ ] `pnpm vitest run src/chat-message.test.tsx -t no_color` exits 0 with the extended asserts

#### DoD (Definition of Done)
- [ ] `pnpm gates` exits 0

### T3.2 — Example + tool-cards benchmark + committed baseline

#### Objective
`examples/tools.tsx` (demo caller + subprocess smoke) and `benchmarks/tool-cards.bench.tsx`
with `docs/benchmarks/m2-tool-cards-baseline.json`.

#### Why this step (action + reasoning)

1. **What:** RED — M2 baseline schema block (M0-parity + color_env, M1 review lesson) + example
   smoke test; then the demo (thread + tool cards, one running→success scripted transition)
   and the bench (50 mixed cards mount + 150 transitions + one 500-line truncated card),
   full run committed via `pnpm bench`.
2. **Why now:** Wiring pillar (a) human-runnable caller + pillar (c) runtime-evidence artifact;
   the cycle owner requires benchmark data.

#### Evidence
- Our harness pattern (M0/M1); mode/status workload per Blueprint Corner 3.

#### Files to edit
```
tests/bench-baseline.test.ts — extend: M2 block (parity oracle + color_env === "1")
tests/example-tools.integration.test.ts — (NEW) subprocess smoke
benchmarks/tool-cards.bench.tsx — (NEW) workload
docs/benchmarks/m2-tool-cards-baseline.json — (NEW) generated via pnpm bench, committed
examples/tools.tsx — (NEW) demo
package.json — "example:tools" script
CHANGELOG.md — Added entry
```

#### Deep Dives
- Bench workload: mount 100-message thread + 50 `ToolCallCard`s (statuses round-robin) with
  short results; then 150 steps: transition one running card to success/failed (rerender) —
  sampling identical to M0/M1 (frames, mean/peak ms, zero-frame guard, pinned env via
  run.ts); one card carries a 500-line output truncated at maxLines 10. The zero-frame guard
  covers MOUNT only — the bench additionally asserts frame count strictly increases across the
  150 transition steps, so memoization can never silently swallow the measured work (EC-15).
- Baseline JSON: same shape as M1 (single mode — `modes` omitted; top-level runs/aggregate like
  M0) + `workload {cards, transitions, long_output_lines}`.
- Example: non-TTY-safe (no composer) — thread + 3 cards + a scripted transition, exits clean.

#### Tasks
1. RED schema + smoke tests
2. Implement bench + example; `pnpm bench` full run; commit baseline
3. CHANGELOG

#### TDD
```
RED:     m2_tool_cards_baseline_exists_with_protocol() — parse docs/benchmarks/m2-tool-cards-baseline.json; expect(baseline.protocol.measured_runs).toBeGreaterThanOrEqual(3); expect(baseline.color_env.FORCE_COLOR).toBe("1"); every run/aggregate Number.isFinite; recomputed mean within 0.01; std_dev >= 0
RED:     tools_example_renders_and_exits_cleanly_when_piped() — execFileSync tsx examples/tools.tsx (env FORCE_COLOR=1, timeout 30000); expect(out).toContain("✓"); expect(out).toContain("… +"); exit 0
GREEN:   Implement bench + example; run pnpm bench; commit baseline
REFACTOR: Share stats/sampling helpers only on the third duplication (rule of three — M0/M1/M2 bench now qualify: extract benchmarks/sampling.ts)
VERIFY:  pnpm vitest run tests/bench-baseline.test.ts tests/example-tools.integration.test.ts && pnpm bench --smoke
```

#### Concurrency tests

(none — single-threaded) — sequential awaited rerender loop.

#### Acceptance Criteria
- [ ] `pnpm bench` exits 0; baseline committed with ≥ 3 finite self-consistent runs + pinned env
- [ ] `pnpm bench --smoke` exits 0 in < 120s
- [ ] `pnpm example:tools | cat` exits 0 with "✓" and the truncation indicator
- [ ] Pass: quality — `pnpm lint` exits 0 on benchmarks/ and examples/

#### DoD (Definition of Done)
- [ ] `pnpm gates` exits 0; real measured numbers committed

---

## Coverage Matrix

| # | Gap / Requirement (source) | Task(s) | Resolution |
|---|---|---|---|
| 1 | ToolCall/ToolCallCard with status lifecycle (ROADMAP M2 DoD-1) | T1.1, T1.2 | 4-status system + row + card |
| 2 | ToolResult collapsed/expanded + shell envelope (DoD-1) | T2.1, T2.2 | maxLines tail-truncation + envelope mode |
| 3 | Spinner while running via ink-spinner (DoD-2) | T1.1 | Dependency + first-frame determinism + animation test (T3.1) |
| 4 | Snapshots across statuses + long/truncated output (DoD-3) | T1.1, T2.1 | Per-status + truncated-scene snapshots |
| 5 | Benchmark data with statistical protocol (cycle owner) | T3.2 | Committed baseline, pinned env |
| 6 | Wiring triad (`rules/cycle-implement.md`) | T3.1, T3.2 | Integration scene + example + bench callers; baseline = runtime evidence |
| 7 | NO_COLOR readability of statuses (roadmap robustness) | T3.1 | Probe scene with glyphs + exit badge |
| 8 | CHANGELOG discipline (Rule 6) | T1.1, T1.2, T2.1, T2.2, T3.1, T3.2 | [Unreleased] per task |
| 9 | New-dep audit (deps-audit golden rule) | T1.1 | ink-spinner Rule 9 table + registry peers (Q-U1) |
| 10 | Edge-case review MUST-FIX EC-1..EC-4 + SHOULD EC-5..EC-9 (review 2026-07-06) | T1.1, T1.2, T2.1, T2.2, T3.1, T3.2 | Absorbed: ADR addenda (D3/D4/D5) + 21 added RED oracles + EC-14/15/16 notes |

**Coverage: 10/10 gaps covered (100%)**

## Global Definition of Done

- [ ] All phases completed
- [ ] All tests passing — `pnpm test` green (M0+M1 suites + ~32 new M2 tests)
- [ ] Zero type errors — `pnpm typecheck`; zero lint warnings — `pnpm lint`; format clean — `pnpm format:check`
- [ ] Build green — `pnpm build` produces `dist/index.js` + `dist/index.d.ts`
- [ ] Coverage ≥ 90% on `src/**` — `pnpm test:coverage` exits 0 (critical paths § above: 100% lines)
- [ ] File-size budget — `wc -l` <= 500 per changed source file
- [ ] CHANGELOG `[Unreleased]` updated per task (Rule 6)
- [ ] Backward compatibility — v0.2.0 API unchanged (M2 purely additive)
- [ ] **Benchmark proof** — `docs/benchmarks/m2-tool-cards-baseline.json` committed with real numbers (≥ 3 runs, mean ± std dev, finite, self-consistent, `color_env.FORCE_COLOR === "1"`)
- [ ] CI green on develop (node 20 + 22, 7 steps)
- [ ] **Plan archived** — after `/review` READY_TO_MERGE AND the release PR merges, move to `knowledge-base/plans/completed/`

## Failure scenarios (when I/O external)

(none — no external I/O touched)

## Final Phase: Integration Validation (MANDATORY)

**Objective:** Prove the M2 surface as a composed workload.

### Execution

```
pnpm gates                    # format:check → lint → typecheck → test → build
pnpm test:coverage            # >= 90% src/**
pnpm bench                    # full run — all three baselines refreshed under pinned env; commit diffs
pnpm example:tools | cat      # non-TTY smoke
pnpm vitest run               # second consecutive full run (stability)
```

### Acceptance Criteria

- [ ] `pnpm gates` exits 0; `pnpm test:coverage` exits 0
- [ ] Two consecutive `pnpm vitest run` green
- [ ] `pnpm example:tools | cat` exits 0 with status glyphs + truncation indicator
- [ ] All committed baselines pinned-env + self-consistent; refresh diffs committed
- [ ] Failure scenarios — skipped ("(none — no external I/O touched)")

### If Validation Fails

1. All failures are plan-caused — fix before declaring complete; re-run the chain
2. Document environment quirks in the PR description
