---
slug: m3-agent-surface
milestone_id: M3
created_at: 2026-07-06
goal: Ship the M3 agent surface (AgentEvent 3-variant union, AgentTimeline windowed event log with exhaustive dispatch, AgentStreaming dumb live indicator) composing with M1/M2, with all gates green in CI and a committed agent-timeline benchmark baseline.
---

# Plan: M3 Agent surface — AgentEvent + AgentTimeline + AgentStreaming

> **Version 1.0** — Implements `ROADMAP.md § M3` on top of the M2 tool surface: `AgentEvent`
> (`kind: "message" | "thinking" | "tool"`, caller-provided ids), `AgentTimeline` (sibling of
> ChatThread — windowed `<Static>` history + identity-memoized rows + exhaustive kind
> dispatch with typed unknown-kind error), `AgentStreaming` (dumb one-line indicator:
> M2 spinner + italic thought + dim `(esc to cancel, Ns)` suffix; elapsed via prop), a
> thinking row (dim+italic, system-glyph color), ZERO new dependencies, the representative
> multi-event-turn snapshot the roadmap demands, an agent demo and a heterogeneous-heights
> benchmark (bounded vs unbounded matrix, peak metric) with committed baseline. All design
> decisions locked by the m3-agent-surface blueprint (SHIPPABLE 99.5).

## Goal

Enable TypeScript agent-CLI developers to render a full agent turn (thinking → running tool
→ finished tool → assistant message) as one ordered timeline plus a live streaming indicator
from the built `@theokit/tui` package, measured by the CI gate chain (format → lint →
typecheck → test → coverage → build → bench smoke) exiting 0 on `develop`.

## Context

v0.2.0 shipped chat (M1); the M2 tool surface is READY_TO_MERGE on `develop` (review
2026-07-06). `ROADMAP.md § M3` now requires the agent surface: AgentEvent (thinking/action),
AgentTimeline (ordered event log), AgentStreaming (live indicator), composing with M1/M2 —
a timeline mixes messages + tool-calls. Risks: (1) heterogeneous item heights — resolved by
per-item `maxLines` bounding + the D7 bench matrix (Blueprint §"D7"); (2) event ordering
under concurrency — resolved by an ordering CONTRACT (caller-ordered array + unique ids +
duplicate TypeError + immutable-graduated-events, Blueprint §"D2"). The DISCOVER cycle
produced a SHIPPABLE blueprint (99.5) locking seven ADRs from gemini-cli/codex/react-ink
evidence.

## Baseline Context (deep review of current state)

### Files that will be touched

| File | LoC today | Last commit (sha) | Why it exists today | Invariants to preserve |
|---|---|---|---|---|
| `src/index.ts` | 26 | `537747c` | Composition root | Existing exports unchanged; `VERSION === package.json.version` |
| `src/chat-thread.tsx` | 90 | `ae00ca0` | M1 windowed thread | UNTOUCHED at M3 (D2 sibling verdict — windowing mechanics duplicated, occurrence #2) |
| `src/chat-message.tsx` | 39 | `fa2c74e` | M0 message | ADDITIVE ONLY: export `CHAT_ROLES` as const array + derive `ChatRole` from it (D8/EC-2); guard message unchanged; existing tests stay green |
| `src/tool-call.tsx` | 143 | `de0504f` | M2 card family | ADDITIVE ONLY: module-export the statuses array as `TOOL_CALL_STATUSES` (D8/EC-2); consumed by the timeline Row |
| `src/tool-result.tsx` | 275 | `de0504f` | M2 output block | UNTOUCHED — consumed by the timeline Row |
| `src/agent-event.ts` (NEW) | 0 | — | AgentEvent union + kinds array + guard | — |
| `src/agent-timeline.tsx` (NEW) | 0 | — | windowed timeline + kind dispatch | — |
| `src/agent-timeline.test.tsx` (NEW) | 0 | — | co-located tests | — |
| `src/agent-streaming.tsx` (NEW) | 0 | — | live indicator + formatElapsed | — |
| `src/agent-streaming.test.tsx` (NEW) | 0 | — | co-located tests | — |
| `tests/export-surface.test.ts` | 69 | `537747c` | public-entry contract | grows with new exports |
| `tests/public-api.integration.test.tsx` | 143 | `de0504f` | integration via composition root | grows: agent-turn scene |
| `tests/fixtures/no-color-probe.tsx` | ~40 | `de0504f` | NO_COLOR subprocess probe | gains a timeline + streaming scene |
| `src/chat-message.test.tsx` | ~170 | `de0504f` | NO_COLOR assertions | extends: thinking/streaming asserts |
| `benchmarks/agent-timeline.bench.tsx` (NEW) | 0 | — | M3 benchmark | — |
| `docs/benchmarks/m3-agent-timeline-baseline.json` (NEW) | 0 | — | committed baseline | M0/M1/M2 baselines untouched |
| `tests/bench-baseline.test.ts` | ~240 | `de0504f` | baseline schema oracles | gains M3 block (mode-matrix parity like M1 + color_env) |
| `examples/agent.tsx` (NEW) | 0 | — | agent-turn demo (TTFATT caller) | existing examples untouched |
| `tests/example-agent.integration.test.ts` (NEW) | 0 | — | subprocess smoke | — |
| `package.json` | 74 | `de0504f` | manifest | + `example:agent` script ONLY (zero new deps) |
| `CHANGELOG.md` | — | `de0504f` | M2 entries under Unreleased | every task appends |

### Current callers / dependents

- **No existing production symbol is modified.** New symbols gain first callers inside this
  plan: `examples/agent.tsx`, `benchmarks/agent-timeline.bench.tsx`, integration/probe tests.
- **Symbols consumed (additive):** `useTheoTheme` (`src/theme.tsx` — role.system.prefix,
  status.warning), `ChatMessage`/`ChatRole` (`src/chat-message.tsx`), `ToolCallCard`/
  `ToolResult`/`ToolCallStatus` (`src/tool-call.tsx`, `src/tool-result.tsx`), `Spinner`
  (ink-spinner — M2 dependency), windowing IDIOM from `src/chat-thread.tsx:60-90`
  (duplicated ~25 lines per D2, NOT imported).
- External: v0.2.0+M2 public API — M3 is purely additive.

### Domain glossary

- **agent event** — `{ id, kind: "message" | "thinking" | "tool", ... }`; the discriminant is
  `kind` (NOT `type` — reserved-word-ambiguous, blueprint Q1 W2; deliberate divergence from
  all three analogs, recorded in D1).
- **ordering contract** — caller-ordered array; unique ids (duplicate → TypeError);
  graduated (Static) events are IMMUTABLE; only the tail event may be replaced by identity
  (streaming repaint).
- **graduation** — an event crossing `tailStart` into `<Static>` (frozen scrollback), M1
  mechanics.
- **dumb indicator** — AgentStreaming holds NO timer; `elapsedSeconds` arrives as a prop
  (gemini LoadingIndicator idiom — ticking is the caller's/M7's concern).
- **turn snapshot** — the roadmap-mandated representative scene: thinking → tool running →
  tool success → assistant message.

### Architecture boundaries affected

Per `rules/architecture.md § 1-3`: all new modules are interface-layer; theme via
`useTheoTheme()` only (DIP); `src/agent-event.ts` is PURE types+constants (no ink import —
M7 adapters import it without render deps); `formatElapsed` is a pure helper inside
`src/agent-streaming.tsx`; `src/index.ts` remains the only public surface. No external I/O.

## Prior Art & Related Work

- **Internal blueprint:** `knowledge-base/discoveries/blueprints/m3-agent-surface-blueprint.md` —
  ADRs D1–D7 consumed verbatim (§ ADRs restates condensed); Corners 1–4 carry the evidence.
- **Patterns skills:** (none exist).
- **Reference projects** (key anchors):
  - `knowledge-base/references/gemini-cli/packages/cli/src/ui/types.ts:161-452` — HistoryItem union.
  - `knowledge-base/references/gemini-cli/packages/cli/src/ui/components/HistoryItemDisplay.tsx:79-250` — dispatch guard chain (no exhaustiveness — the hole D3 fixes).
  - `knowledge-base/references/gemini-cli/packages/cli/src/ui/components/MainContent.tsx:308-321` — single-Static timeline.
  - `knowledge-base/references/gemini-cli/packages/cli/src/ui/components/LoadingIndicator.tsx:25,67-77,107,151` — dumb indicator, subject-only italic, cancel suffix.
  - `knowledge-base/references/gemini-cli/packages/cli/src/ui/components/LoadingIndicator.test.tsx:57-146` — per-state + exact elapsed oracles.
  - `knowledge-base/references/codex/codex-rs/tui/src/history_cell/messages.rs:196-267` — dim+italic reasoning cell.
  - `knowledge-base/references/codex/codex-rs/tui/src/status_indicator_widget.rs:65-78` — elapsed format.
  - `knowledge-base/references/gemini-cli/packages/cli/src/ui/AppContainer.tsx:609` — staticAreaMaxItemHeight (height-bounding precedent for the bench).
  - `knowledge-base/references/assistant-ui/packages/react-ink/src/primitives/message/MessageContent.tsx:24-223` — switch dispatch + Extract-typed overrides.
- **External literature:** none beyond the above.

## Objective

- [ ] `AgentEvent` union exported (3 kinds, `kind` discriminant, caller ids) with runtime kinds array as single source
- [ ] `AgentTimeline` renders ordered mixed events with windowed Static history, identity-memoized rows, duplicate-id TypeError, unknown-kind TypeError, compile-time exhaustiveness
- [ ] Thinking rows render dim+italic behind the system-glyph color
- [ ] `AgentStreaming` renders spinner + thought/`Thinking…` + optional dim `(esc to cancel, {elapsed})` suffix; pure `formatElapsed`
- [ ] The representative multi-event-turn snapshot exists (roadmap DoD-3)
- [ ] Composes with M1/M2: timeline rows reuse ChatMessage + ToolCallCard/ToolResult (DoD-2)
- [ ] NO_COLOR probe proves timeline + streaming readability without color
- [ ] `benchmarks/agent-timeline.bench.tsx` baseline committed (bounded|unbounded matrix, ≥ 3 runs, mean ± std dev, pinned env, peak called out)
- [ ] All gates green locally and in CI (node 20 + 22); coverage ≥ 90% on `src/**` (critical paths 100% lines)

## Dependencies

> Contract for `/deps-audit`. ZERO new packages (Blueprint §"Coverage Corner 2" Rule 9 verdict).

### Existing — use as-is

| Package | Version | Ecosystem | Why |
|---|---|---|---|
| `ink` | `^5.2.0` | npm | Box/Text/Static primitives |
| `ink-spinner` | `^5.0.0` | npm | streaming glyph (M2 dependency reused) |
| `react` | `^18.0.0 \|\| ^19.0.0` (peer) | npm | component model |
| `cli-spinners` | `^2.7.0` (devDep) | npm | dots frame typing in tests (M2 devDep reused) |

### New — to be introduced

| Package | Version | Ecosystem | Rule 9 rationale (libs evaluated) | Why this one |
|---|---|---|---|---|
| (none) | — | — | Elapsed ticker + duration formatting evaluated against deps: every analog hand-rolls them as internals (gemini `useTimer.ts` 65 LoC; react-ink inline 56 LoC; codex `Instant`); no id-generation dep exists in any analog manifest (ids are caller-provided). `formatElapsed` is ~10 LoC — under the parsimony-ladder helper threshold | Zero-dep milestone by evidence |

### Removed

| Package | Last version | Why removed |
|---|---|---|
| (none) | | |

## ADRs

> D1–D7 originate in the blueprint (Blueprint §"ADRs" carries the evidence); restated
> condensed and self-contained. D8 is plan-local.

### D1 — `AgentEvent`: 3-variant closed union, `kind` discriminant, caller-provided string ids

**Decision:** `src/agent-event.ts` (pure — no ink import):
```ts
const AGENT_EVENT_KINDS = ["message", "thinking", "tool"] as const;
type AgentEventKind = (typeof AGENT_EVENT_KINDS)[number];
type AgentEvent =
  | { id: string; kind: "message"; role: ChatRole; text: string }
  | { id: string; kind: "thinking"; text: string }
  | { id: string; kind: "tool"; name: string; status: ToolCallStatus;
      summary?: string; output?: string; shell?: ShellEnvelope; maxLines?: number };
```
Plain per-variant object types (NOT `Base &` intersections); the `as const` array drives the
type, the runtime guard and the error message (M2 `VALID_STATUSES` idiom).

**Rationale:** Roadmap scopes thinking/action + message/tool composition. `kind` not `type`
(naming rule; deliberate divergence from all three analogs — recorded). Intersections give
worse narrowing errors under exactOptionalPropertyTypes; dual enum+union is gemini's drift
hazard.

**Alternatives considered:** gemini's ~25-variant union incl. info/error/panels (rejected:
YAGNI — info ≈ `role:"system"` message; error/diff variants arrive additively M4/M5);
message-parts heterogeneity inside events (rejected: flat events suffice); tool_group
batching + subagent nesting (deferred per blueprint YAGNI table).

**Consequences:** M4/M5 add variants + dispatch branches; M7 adapters import the union from
the entry.

### D2 — AgentTimeline is a SIBLING: windowed-Static + own event-Row dispatch

**Decision:** `AgentTimeline({ events, windowSize = 8, windowOverscan = 4 })` duplicates the
M1 windowing MECHANICS (~25 lines: tailStart slice, `<Static>` prefix keyed by id, memo Row
by object identity, `assertUniqueEventIds` TypeError as FIRST statement) with a Row that
dispatches on `event.kind` to ChatMessage / thinking row / ToolCallCard(+ToolResult).
ChatThread untouched.

**Rationale:** Production precedent = ONE heterogeneous list, per-kind dispatch (gemini
MainContent single Static). Wrapping ChatThread breaks its `{id, role, content: string}`
contract or forfeits M2 components (SRP); two sibling Statics cannot interleave frozen
output — ordering corruption = roadmap risk 2 at architecture level.

**Alternatives considered:** (a) WRAP ChatThread (rejected: contract break); (c) compose two
Statics (rejected: partitioned-by-component output, not by time).

**Consequences:** Windowing knowledge occurrence #2 — Rule-of-3 documented: extract an
internal `WindowedStatic` shell only when a third windowed surface appears (M4/M5). Ordering
contract: caller-ordered array; duplicate id → TypeError; graduated events IMMUTABLE; only
the tail event may be replaced by identity (streaming). Window-growth hazard documented in
JSDoc with M1's wording.

### D3 — Exhaustive dispatch + typed unknown-kind error

**Decision:** Row dispatch = `switch (event.kind)` whose `default` throws
`TypeError: AgentTimeline: unknown event kind "…" — expected "message" | "thinking" | "tool"`
(message built from `AGENT_EVENT_KINDS`); the runtime kind check runs in `assertValidEvents`
alongside the duplicate-id guard (FIRST statement, before hooks — M0 EC-1 idiom);
compile-time `never` exhaustiveness in the switch so a new variant breaks the build.

**Rationale:** gemini renders unknown types as NOTHING (guard chain, no default); react-ink
`default: return null` — the silent-swallow hole `rules/error-handling.md § 2` forbids.

**Alternatives considered:** render-as-blank with a warning (rejected: swallowed error).

**Consequences:** M7 adapters version-match the union — loud, honest failure mode.
Coverage note (EC-7): the switch `default` is UNREACHABLE through the public API (D8's
boundary guard screens first) — it carries a scoped, justified `/* v8 ignore */` (M1/M2
pragma precedent) rather than a contrived internal test.

### D4 — AgentStreaming is a DUMB one-line indicator; elapsed arrives as a prop

**Decision:** `AgentStreaming({ thought?, elapsedSeconds?, showCancelHint = false })`:
M2 spinner cell (ink-spinner dots, `status.warning`, 3-cell min-width) + italic
`wrap="truncate-end"` primary (`thought ?? "Thinking…"`) + dim suffix when `showCancelHint`:
`(esc to cancel)` without elapsed, `(esc to cancel, {formatElapsed(s)})` with it. Pure
`formatElapsed(seconds)`: FLOORS fractional input first (EC-4 — `Date.now()` diffs produce
59.9), then `0s`…`59s`, `1m 5s`, `1h 2m 3s`, no days unit (`86400` → `24h 0m 0s`, EC-11);
exported from `src/agent-streaming.tsx` for unit tests but NOT re-exported from
`src/index.ts` (EC-10 — export-surface asserts the absence, truncateLines/D7 precedent). NO
internal interval. Empty-string `thought` falls back to `Thinking…` (`||`, not `??` —
EC-3 resolved: a contentless thought renders the default, Deep Dive claim now normative).

**Rationale:** gemini's indicator receives elapsed as a PROP — ticking is upstream; no
timers = deterministic tests with zero mocking; `rules/testing.md § 6` satisfied by
construction. The example demonstrates a 5-line useState/useEffect ticker.

**Alternatives considered:** internal `useElapsedSeconds` hook (rejected at M3: adds a timer
+ test complexity to a render library); phrase cycler / gradient spinner / narrow-width
column re-layout / details block / rightContent slot / rebindable keys / accordion (ALL
deferred — blueprint YAGNI table with per-item analog evidence).

**Consequences:** M7/app owns the 1s ticker; the prop contract stays.

### D5 — Thinking row: dim+italic full text behind the system-glyph color; visibility is caller policy

**Decision:** `kind: "thinking"` renders `<Box>` with a `·`-glyph prefix cell in
`role.system.prefix` color + `dimColor italic` text (full `text`, wrapping normally). No
duration, no accordion, no hidden flag — the caller filters events it doesn't want shown.

**Rationale:** Convergent de-emphasis contract (codex dim+italic; gemini italic
subject-only live; react-ink caller-styled); visibility-as-policy (gemini inlineThinkingMode
gate; codex transcript_only) — the LIBRARY renders what it is given.

**Alternatives considered:** subject/description split (rejected: `text` IS the summary the
adapter chose); collapse/accordion (deferred — interactivity M6+).

**Consequences:** M6 may add thinking theme tokens; M7 decides what text arrives.

### D6 — Test strategy: dispatch oracles + turn snapshot + negatives the analogs lack; no new animation tests

**Decision:** (1) per-kind dispatch oracles (`toContain` distinctive text + positional
startsWith where a glyph leads); (2) THE turn snapshot (thinking → tool running → tool
success → assistant message) in `<Box width={40}>` via `renderFrame` — running pinned to
dots frame[0], NO spinner mocking; (3) duplicate-id TypeError + unknown-kind TypeError
negatives (exact messages); (4) windowing oracles reused from M1: repaint-scope spy counts,
frozen-prefix-after-graduation, tail-identity repaint; (5) AgentStreaming per-state oracles
with EXACT suffix strings + `formatElapsed` unit edges (0/59/60/61/3600/3661); (6) NO_COLOR
probe gains the timeline+streaming scene; (7) NO new real-timer animation test (M2's exhaust
test owns that budget); (8) no `waitFor` — tick-based determinism only.

**Rationale:** Corner 1 evidence + flakiness warnings (Static accumulation, identity
discipline) baked in; gemini mocks spinners instead — our first-frame pin replaces that
policy (one policy per kit).

**Alternatives considered:** mock-the-spinner in timeline tests (rejected: two policies).

**Consequences:** Deterministic-by-construction suite.

### D7 — Bench: `agent-timeline.bench.tsx`, mixed 300 events, bounded|unbounded matrix

**Decision:** M2 harness verbatim (`benchmarks/sampling.ts`, 1 warmup + 5 measured, pinned
env via run.ts, EC-2 zero-frame + EC-15 stdout-frames guards); workload = 300 mixed events
(≈50% 1-line messages, ≈30% tool cards incl. ONE 500-line output, ≈20% thinking 2-3 lines);
per step: identity-replace the tail (alternating token-append on a message / status
transition on a tool) + append one event, under windowSize 8+4 (every step graduates one
event); TWO modes: `bounded` (tool maxLines=10) vs `unbounded` (maxLines ≥ output height);
baseline `docs/benchmarks/m3-agent-timeline-baseline.json` with `workload.event_mix`;
methodology names **peak_ms_per_frame as the heterogeneous-heights metric** (tall-item
graduation spike — mean averages it away).

**Rationale:** Corner 3 — the bounded/unbounded delta reproduces gemini's reason for
`staticAreaMaxItemHeight` with our numbers; codex's no-cap is safe only without a
reconciler. Per-item `maxLines` stays OUR bounding mechanism (library, not app).

**Alternatives considered:** windowed-vs-plain matrix again (rejected: M1 proved it — M3's
question is height heterogeneity).

**Consequences:** Roadmap risk 1 carries real numbers in the DoD.

### D8 — `src/agent-event.ts` is a pure types module; the timeline owns FULL per-variant validation

**Decision:** `agent-event.ts` exports the union, `AGENT_EVENT_KINDS` and a
`isAgentEventKind(value): value is AgentEventKind` predicate — no ink import, no React.
`assertValidEvents(events)` in `agent-timeline.tsx` is a FULL structural boundary check
(one pass, FIRST statement, before hooks): known `kind`; unique `id` (empty string legal —
M1 parity, EC-5); per-variant fields — `role ∈ CHAT_ROLES`, `status ∈ TOOL_CALL_STATUSES`,
and tool `output`/`shell` MUTUAL EXCLUSIVITY (EC-1) — every violation throws a TypeError
whose message starts `AgentTimeline:`. Extra/unknown properties are tolerated (EC-12 — M7
adapters forward enriched objects).

**Rationale:** Edge-case review EC-1/EC-2: delegating variant-field validation to child
guards (ChatMessage/ToolCall/ToolResult) fires MID-RENDER where Ink's boundary swallows
throws (F10) and the error names the wrong component. One boundary site makes D8's claim
literally true (`rules/error-handling.md § 2`). Requires exporting the runtime union arrays
from their owning modules (module-level, NOT the public entry): `CHAT_ROLES` added to
`src/chat-message.tsx` (deriving `ChatRole` from it — the M2 `VALID_STATUSES` single-source
idiom retrofitted to M0 code) and `TOOL_CALL_STATUSES` (existing `VALID_STATUSES` renamed on
export) from `src/tool-call.tsx` — additive, no behavior change, existing tests stay green.

**Alternatives considered:** validation inside agent-event.ts (rejected: error message is
boundary-owned); duplicating the role/status literals in agent-event.ts (rejected: DRY —
two sources of truth for the same unions, gemini's MessageType drift hazard); classes/zod
(rejected: YAGNI).

**Consequences:** M7 imports `AgentEvent`/`AGENT_EVENT_KINDS` cheaply; child-component
guards become true defense-in-depth (unreachable via AgentTimeline's public API — their
coverage exemption is documented at the D3 switch default, EC-7). M4/M5 extend both files
together (compile-time exhaustiveness enforces it).

## Drawbacks & Risks

| Drawback / Risk | Severity | Mitigation | Owner |
|---|---|---|---|
| Windowing mechanics duplicated (occurrence #2) drift from ChatThread over time | Medium | Duplication is ~25 lines, both sites carry the same JSDoc wording + tests; Rule-of-3 extraction trigger documented in D2 (third surface at M4/M5) | implement |
| Turn snapshot contains a running spinner — inherits the 0ms-tick/80ms-interval coupling; any added await flakes it | Medium | EC-14 canary already guards the coupling; D6 bans `waitFor`; snapshot uses plain `renderFrame` | implement |
| Bench unbounded mode renders a 500-line item through the reconciler per graduation — could be slow enough to blow the run budget | Medium | `--smoke` skips it (1 run, bounded only if needed); measured runs stay at 5; budget checked at T3.2 AC (< 10 min full bench) | implement |
| `kind` vs `type` divergence surprises readers coming from the analogs | Low | Recorded in D1 + JSDoc on the union; error messages spell the contract | implement |
| Static accumulation in lastFrame makes timeline tests order-sensitive if a test remounts | Low | D6 rule: never key-cycle a mounted timeline in one render instance; frozen-prefix oracle pins the behavior | implement |

## Unresolved Questions

(none — every decision is resolved at plan time by blueprint ADRs D1–D7 + plan D8.)

## Critical paths

For `/code-quality` D4 when enabled: `src/agent-timeline.tsx` (validation + dispatch +
windowing), `src/agent-streaming.tsx` (`formatElapsed` + suffix branching).

## Dependency Graph

```
Phase 1 (AgentEvent + AgentTimeline) ──▶ Phase 2 (AgentStreaming) ──▶ Phase 3 (integration + example + bench)
                                                                            │
                                                                            ▼
                                                                  Final Phase (integration validation)
```

Sequential — one vertical slice; the turn snapshot and bench compose all three components.

---

## Phase 1: AgentEvent + AgentTimeline

**Objective:** The event union and the windowed heterogeneous timeline, oracle-covered.

### T1.1 — AgentEvent union + timeline dispatch (no windowing yet)

#### Objective
`src/agent-event.ts` (union + kinds + predicate) and `src/agent-timeline.tsx` rendering an
ordered mixed list (all events in the live tail), with duplicate-id + unknown-kind typed
errors and compile-time exhaustiveness.

#### Why this step (action + reasoning)

1. **What:** RED tests (per-kind dispatch renders, thinking styling, duplicate-id TypeError,
   unknown-kind TypeError with exact message, empty events) then the minimal union + Row
   dispatch per D1/D3/D5/D8.
2. **Why now:** The union + dispatch is the milestone's core; windowing (T1.2), streaming
   (T2.1), bench and example all consume it.

#### Evidence
- Union shape + dispatch hole to fix: `knowledge-base/references/gemini-cli/packages/cli/src/ui/types.ts:161-452`,
  `knowledge-base/references/gemini-cli/packages/cli/src/ui/components/HistoryItemDisplay.tsx:79-250`.
- Thinking styling: `knowledge-base/references/codex/codex-rs/tui/src/history_cell/messages.rs:196-267`.
- Dispatch-with-overrides idiom: `knowledge-base/references/assistant-ui/packages/react-ink/src/primitives/message/MessageContent.tsx:24-223`.

#### Files to edit
```
src/agent-timeline.test.tsx — (NEW) RED suite
src/agent-event.ts          — (NEW) union + AGENT_EVENT_KINDS + isAgentEventKind
src/agent-timeline.tsx      — (NEW) assertValidEvents + Row dispatch + list render
src/index.ts                — export AgentEvent types + AgentTimeline (+ props)
tests/export-surface.test.ts — extend
CHANGELOG.md                — Added entry
```

#### Deep file dependency analysis
- `src/agent-event.ts`: imports ONLY types from `./chat-message.js` (ChatRole),
  `./tool-call.js` (ToolCallStatus), `./tool-result.js` (ShellEnvelope) — type-only imports,
  no runtime ink/React.
- `src/agent-timeline.tsx`: imports ink (Box, Static), react (memo), `./agent-event.js`,
  `./chat-message.js`, `./tool-call.js`, `./tool-result.js`, `./theme.js`.
- `src/index.ts`: gains `AgentTimeline`, `AGENT_EVENT_KINDS`, types
  `AgentEvent`, `AgentEventKind`, `AgentTimelineProps`.

#### Deep Dives
- Validation (FIRST statement, before hooks — F10/M0 idiom):

```pseudocode
assertValidEvents(events):   -- FULL per-variant structural check (D8, EC-1/EC-2)
  seen = Set()
  for event in events:
    if !isAgentEventKind(event.kind)      → TypeError `AgentTimeline: unknown event kind "…" — expected "message" | "thinking" | "tool"`
    if seen.has(event.id)                 → TypeError `AgentTimeline: duplicate event id "…"`   -- "" legal (EC-5)
    if kind message && role ∉ CHAT_ROLES  → TypeError `AgentTimeline: …`
    if kind tool && status ∉ TOOL_CALL_STATUSES → TypeError `AgentTimeline: …`
    if kind tool && output && shell       → TypeError `AgentTimeline: tool event "…" — provide only one of output | shell`
    seen.add(event.id)
# Extra/unknown properties tolerated (EC-12); text ANSI passes through unsanitized
# (M2 EC-16 parity — JSDoc note, EC-13).
```

- Row dispatch: `switch (event.kind)` → message → `<ChatMessage role>{text}</ChatMessage>`;
  thinking → `<Box>` glyph cell (`·` in role.system.prefix) + `<Text dimColor italic>`;
  tool → `<ToolCallCard name status summary>` with body `<ToolResult lines|shell maxLines>`
  when output/shell present; `default` → compile-time `never` + the D3 TypeError (defense in
  depth — assertValidEvents already screened).
- Edge cases: empty events (renders nothing); tool event without output/shell (bare card
  row); duplicate id (negative); unknown kind via `as never` (negative).

#### Tasks
1. RED suite (13 tests below) — fails (modules absent)
2. GREEN minimal (union + dispatch)
3. Exports + CHANGELOG

#### TDD
```
RED:     message_event_dispatches_to_chat_message() — const frame = await renderFrame(<AgentTimeline events={[{ id: "m1", kind: "message", role: "assistant", text: "hello there" }]}/>); expect(frame).toContain("✦"); expect(frame).toContain("hello there")
RED:     thinking_event_renders_dim_italic_text() — events=[{ id: "t1", kind: "thinking", text: "planning the diff" }]; expect(frame).toContain("planning the diff"); expect(frame).toContain("·")
RED:     tool_event_dispatches_to_tool_card_with_result() — events=[{ id: "x1", kind: "tool", name: "grep", status: "success", output: "3 matches" }]; expect(frame).toContain("✓"); expect(frame).toContain("grep"); expect(frame).toContain("3 matches")
RED:     tool_event_without_output_renders_bare_row() — no output/shell; expect(frame).toContain("✓"); expect(frame.split("\n")).toHaveLength(1)
RED:     empty_events_render_nothing() — events={[]}; expect(frame).toBe("")
RED:     duplicate_event_ids_throw_typed_error() — two events id "e1"; const call = () => AgentTimeline({ events }); expect(call).toThrow(TypeError); expect(call).toThrow('AgentTimeline: duplicate event id "e1"')
RED:     unknown_event_kind_throws_typed_error() — kind "weird" as never; expect(call).toThrow(TypeError); expect(call).toThrow('AgentTimeline: unknown event kind "weird" — expected "message" | "thinking" | "tool"')
RED:     shell_tool_event_renders_envelope() — shell={{stdout:"", stderr:"boom", exitCode:1}}; expect(frame).toContain("stderr:"); expect(frame).toContain("exited 1")
RED:     tool_event_with_output_and_shell_throws_typed_error() — both output+shell; expect(call).toThrow(TypeError); expect(call).toThrow('AgentTimeline: tool event "x1" — provide only one of output | shell') (EC-1)
RED:     invalid_message_role_throws_at_boundary() — role "bot" as never; expect(call).toThrow(TypeError); expect(call).toThrow(/^AgentTimeline:/) (EC-2)
RED:     invalid_tool_status_throws_at_boundary() — status "weird" as never; expect(call).toThrow(TypeError); expect(call).toThrow(/^AgentTimeline:/) (EC-2)
RED:     empty_string_id_is_legal_and_duplicate_empty_throws() — one id "" renders; two id "" throw 'AgentTimeline: duplicate event id ""' (EC-5, M1 parity)
RED:     extra_event_properties_are_tolerated() — event with extra timestamp field renders identically, no throw (EC-12)
GREEN:   Implement agent-event.ts + agent-timeline.tsx until all pass
REFACTOR: Extract eventRow(event) helper if the switch exceeds complexity 10
VERIFY:  pnpm vitest run src/agent-timeline.test.tsx
```

#### Concurrency tests

(none — single-threaded)

#### Acceptance Criteria
- [ ] `pnpm vitest run src/agent-timeline.test.tsx` exits 0 (13 tests)
- [ ] `pnpm typecheck` exits 0; `pnpm lint` exits 0 with 0 warnings
- [ ] CHANGELOG updated — `grep -q "AgentTimeline" CHANGELOG.md` exits 0

#### DoD (Definition of Done)
- [ ] `pnpm gates` exits 0

### T1.2 — Windowed Static history + identity-memoized rows

#### Objective
Add the M1 windowing mechanics to AgentTimeline: `windowSize`/`windowOverscan` props,
`<Static>` prefix, memo Row by event identity, with the M1 oracle suite adapted.

#### Why this step (action + reasoning)

1. **What:** RED tests (repaint-scope spy counts, frozen-prefix-after-graduation,
   tail-identity repaint, window knobs) then the windowing per D2.
2. **Why now:** Roadmap risk 1 lives here; the bench (T3.2) measures exactly this mechanism
   under heterogeneous heights.

#### Evidence
- Our own mechanics + oracles: `src/chat-thread.tsx:60-90`, `src/chat-thread.test.tsx` (spy
  idiom, frozen-prefix, window-growth doc).
- Single-Static precedent: `knowledge-base/references/gemini-cli/packages/cli/src/ui/components/MainContent.tsx:308-321`.

#### Files to edit
```
src/agent-timeline.test.tsx — extend: windowing describe-block
src/agent-timeline.tsx      — windowing mechanics + JSDoc (ordering contract + window-growth hazard)
CHANGELOG.md                — Added entry (grouped with T1.1)
```

#### Deep Dives
- Mechanics duplicated from `chat-thread.tsx:60-90` (~25 lines — D2 occurrence #2, Rule-of-3
  note in a code comment); Row memo `(prev, next) => prev.event === next.event`; Static items
  keyed by `event.id`.
- JSDoc: ordering contract (caller-ordered, unique ids, graduated events immutable, tail
  replaced by identity) + window-growth duplication hazard (M1 F-arch-2 wording).
- Edge cases: windowSize 0 + overscan 0 (all events graduate immediately);
  heterogeneous graduation (a multi-line tool card crossing tailStart).

#### Tasks
1. RED (7 tests below)
2. GREEN windowing
3. CHANGELOG

#### TDD
```
RED:     only_tail_rows_repaint_on_identity_replace() — mount 20 events windowSize 8/overscan 4; spy-wrapped Row (vi.mock idiom from chat-thread.test.tsx); rerender with NEW tail object only; expect(rowRenderCount).toBe(1)
RED:     static_prefix_is_frozen_after_graduation() — mutate a graduated event's object (new array, changed text, same id) + rerender; expect(lastFrame()).not.toContain("MUTATED") for the graduated row
RED:     same_array_rerender_repaints_nothing() — rerender with the SAME events array; expect(rowRenderCount).toBe(0)
RED:     window_size_zero_graduates_everything() — windowSize 0 overscan 0, 3 events; frame contains all 3 (Static accumulates); rerender appending one; expect only the appended row rendered live
RED:     heterogeneous_graduation_keeps_output_ordered() — 5 messages + 1 multi-line tool card + 5 messages, windowSize 2; expect frame order: card content appears BETWEEN the message groups (index comparison on frame lines)
RED:     negative_window_knobs_clamp_to_zero() — windowSize={-3} windowOverscan={-1} with 3 events behaves exactly like 0/0 (all graduate; frame shows all 3) (EC-6, M1 clamp parity)
RED:     in_place_push_on_same_array_pins_hybrid_behavior() — push a 4th event onto the SAME array + rerender same ref; pin observed frame + row-render count; JSDoc gains "always pass a new array" (EC-8)
GREEN:   Implement windowing until all pass
REFACTOR: None expected (mechanics mirror chat-thread)
VERIFY:  pnpm vitest run src/agent-timeline.test.tsx
```

#### Concurrency tests

(none — single-threaded)

#### Acceptance Criteria
- [ ] `pnpm vitest run src/agent-timeline.test.tsx` exits 0 (20 tests)
- [ ] Pass: quality — `pnpm lint` exits 0; `wc -l src/agent-timeline.tsx` <= 500

#### DoD (Definition of Done)
- [ ] `pnpm gates` exits 0

---

## Phase 2: AgentStreaming

**Objective:** The dumb live indicator + pure elapsed formatting.

### T2.1 — formatElapsed + AgentStreaming

#### Objective
`src/agent-streaming.tsx`: pure `formatElapsed` (module-internal) + `AgentStreaming` per D4.

#### Why this step (action + reasoning)

1. **What:** RED unit suite for `formatElapsed` edges + per-state render oracles with EXACT
   suffix strings — then implement.
2. **Why now:** Completes the roadmap's third component; the example/bench/probe scenes
   (Phase 3) compose it.

#### Evidence
- Dumb-indicator + suffix wording: `knowledge-base/references/gemini-cli/packages/cli/src/ui/components/LoadingIndicator.tsx:25,67-77,107,151`.
- Exact-string oracles: `knowledge-base/references/gemini-cli/packages/cli/src/ui/components/LoadingIndicator.test.tsx:57-146`.
- Elapsed format shape: `knowledge-base/references/codex/codex-rs/tui/src/status_indicator_widget.rs:65-78`.

#### Files to edit
```
src/agent-streaming.test.tsx — (NEW) RED suite
src/agent-streaming.tsx      — (NEW) formatElapsed + AgentStreaming
src/index.ts                 — export AgentStreaming (+ props type)
tests/export-surface.test.ts — extend
CHANGELOG.md                 — Added entry
```

#### Deep Dives
- `formatElapsed(seconds)`: guard — non-negative finite number → TypeError
  `formatElapsed: seconds must be a finite number >= 0 — got {value}` (fail-fast, negative
  lens); `0s`…`59s`; `1m 0s`…; `1h 2m 3s` (hours only when ≥ 3600).
- Render: `<Box>` → spinner cell (M2 idiom verbatim: minWidth 3, ink-spinner dots,
  `status.warning`) + `<Text italic wrap="truncate-end">{thought ?? "Thinking…"}</Text>` +
  suffix `<Text dimColor>` when `showCancelHint`: without elapsedSeconds `(esc to cancel)`,
  with it `(esc to cancel, {formatElapsed})`.
- Edge cases: thought with newline (single-line contract — sanitize like ToolCall EC-8);
  elapsedSeconds provided WITHOUT showCancelHint (no suffix — elapsed alone renders nothing);
  thought empty string falls back to `Thinking…` (EC-3: `||`, normative per D4); fractional
  seconds floored (EC-4); no days unit (EC-11).

#### Tasks
1. RED (14 tests below)
2. GREEN
3. Exports (formatElapsed NOT on the entry — export-surface asserts absence, EC-10) + CHANGELOG

#### TDD
```
RED:     format_elapsed_renders_seconds_under_a_minute() — expect(formatElapsed(0)).toBe("0s"); expect(formatElapsed(59)).toBe("59s")
RED:     format_elapsed_renders_minutes_and_seconds() — expect(formatElapsed(60)).toBe("1m 0s"); expect(formatElapsed(61)).toBe("1m 1s"); expect(formatElapsed(125)).toBe("2m 5s")
RED:     format_elapsed_renders_hours() — expect(formatElapsed(3600)).toBe("1h 0m 0s"); expect(formatElapsed(3661)).toBe("1h 1m 1s")
RED:     format_elapsed_rejects_negative_and_non_finite() — const call = () => formatElapsed(-1); expect(call).toThrow(TypeError); expect(call).toThrow("got -1"); expect(() => formatElapsed(Number.NaN)).toThrow(TypeError)
RED:     streaming_renders_spinner_and_default_thought() — const frame = await renderFrame(<AgentStreaming/>); expect(frame).toContain("⠋"); expect(frame).toContain("Thinking…")
RED:     streaming_renders_thought_subject() — thought="Analyzing the failure"; expect(frame).toContain("Analyzing the failure"); expect(frame).not.toContain("Thinking…")
RED:     streaming_suffix_exact_with_elapsed() — showCancelHint elapsedSeconds={125}; expect(frame).toContain("(esc to cancel, 2m 5s)")
RED:     streaming_suffix_exact_without_elapsed() — showCancelHint only; expect(frame).toContain("(esc to cancel)"); expect(frame).not.toContain(",")
RED:     streaming_no_suffix_without_hint() — elapsedSeconds={5} only; expect(frame).not.toContain("esc to cancel"); expect(frame).not.toContain("5s")
RED:     streaming_thought_with_newline_stays_single_line() — thought={"a\nb"}; expect(frame.split("\n")).toHaveLength(1)
RED:     streaming_frame_matches_snapshot() — <Box width={40}><AgentStreaming thought="Reading files" showCancelHint elapsedSeconds={12}/></Box> toMatchSnapshot("agent-streaming")
RED:     empty_thought_falls_back_to_default() — thought=""; expect(frame).toContain("Thinking…") (EC-3 — || not ??)
RED:     format_elapsed_floors_fractional_seconds() — expect(formatElapsed(59.9)).toBe("59s"); expect(formatElapsed(60.2)).toBe("1m 0s") (EC-4)
RED:     format_elapsed_has_no_days_unit() — expect(formatElapsed(86400)).toBe("24h 0m 0s") (EC-11)
GREEN:   Implement formatElapsed + AgentStreaming until all pass
REFACTOR: Keep formatElapsed pure (no ink imports in the math)
VERIFY:  pnpm vitest run src/agent-streaming.test.tsx
```

#### Concurrency tests

(none — single-threaded)

#### Acceptance Criteria
- [ ] `pnpm vitest run src/agent-streaming.test.tsx` exits 0 (14 tests)
- [ ] Pass: quality — `pnpm lint` exits 0; complexity <= 10; `wc -l src/agent-streaming.tsx` <= 500

#### DoD (Definition of Done)
- [ ] `pnpm gates` exits 0

---

## Phase 3: Integration + example + bench

**Objective:** Wiring closure + evidence artifacts.

### T3.1 — Turn snapshot, composition-root scene, NO_COLOR scene

#### Objective
The roadmap DoD-3 snapshot + public-entry agent scene + probe extension.

#### Why this step (action + reasoning)

1. **What:** The representative multi-event-turn snapshot (thinking → tool running → tool
   success → assistant message); a composition-root scene importing everything from
   `src/index.js`; the NO_COLOR probe gains timeline + streaming rows; extended no_color
   asserts.
2. **Why now:** Closes wiring pillar (b) and DoD-2/DoD-3 in the same milestone (M1 F-wire-1
   lesson).

#### Evidence
- Mixed-scene snapshot idiom: `knowledge-base/references/gemini-cli/packages/cli/src/ui/components/MainContent.test.tsx:509-529`.
- Our first-frame pin: `tests/helpers.tsx` EC-14 comment + `src/tool-call.test.tsx` canary.

#### Files to edit
```
src/agent-timeline.test.tsx — extend: turn snapshot
tests/public-api.integration.test.tsx — extend: agent scene via src/index.js
tests/fixtures/no-color-probe.tsx — extend: timeline + streaming scene
src/chat-message.test.tsx — extend no_color assertions (thinking text, Thinking…)
CHANGELOG.md — entry (grouped with T3.2)
```

#### Deep Dives
- Turn snapshot events: `[{thinking "inspecting the failing test"}, {tool "vitest" running},
  {tool "eslint" success output "0 problems"}, {message assistant "All green now."}]` in
  `<Box width={40}>` — running spinner pinned to frame[0] (NO added awaits — D6/Drawbacks).
- Probe scene: one thinking row + AgentStreaming with showCancelHint + elapsed — asserts
  `(esc to cancel, 12s)` and thinking text readable without ANSI.
- Composition scene asserts M1+M2+M3 in ONE provider tree (timeline + separate ChatThread
  coexistence NOT asserted — one timeline per screen is the documented model).

#### Tasks
1. RED tests (4 below)
2. GREEN (wiring only; failures loop to T1/T2)
3. CHANGELOG

#### TDD
```
RED:     representative_turn_matches_snapshot() — the 4-event turn above; expect(frame).toMatchSnapshot("agent-turn"); plus content oracles: toContain("inspecting"), toContain("⠋"), toContain("✓"), toContain("All green now.")
RED:     public_entry_composes_agent_surface() — import { AgentTimeline, AgentStreaming } from "../src/index.js"; provider + timeline(3 kinds) + streaming; expect(frame).toContain("·"); expect(frame).toContain("✓"); expect(frame).toContain("Thinking…")
RED:     no_color_render_contains_thinking_and_streaming() — probe output: expect(out).toContain("inspecting the failing test"); expect(out).toContain("(esc to cancel, 12s)")
RED:     agent_events_export_kinds_array() — import { AGENT_EVENT_KINDS } from "../src/index.js"; expect(AGENT_EVENT_KINDS).toEqual(["message", "thinking", "tool"])
GREEN:   Wire the scenes; fix components if any fail
REFACTOR: None expected
VERIFY:  pnpm vitest run src/agent-timeline.test.tsx tests/public-api.integration.test.tsx && pnpm vitest run src/chat-message.test.tsx -t no_color
```

#### Concurrency tests

(none — single-threaded)

#### Acceptance Criteria
- [ ] All suites exit 0; turn snapshot stable across two consecutive `pnpm test` runs
- [ ] `pnpm vitest run src/chat-message.test.tsx -t no_color` exits 0 with the extended asserts

#### DoD (Definition of Done)
- [ ] `pnpm gates` exits 0

### T3.2 — Example + agent-timeline benchmark + committed baseline

#### Objective
`examples/agent.tsx` (agent-turn demo with a 5-line elapsed ticker) and
`benchmarks/agent-timeline.bench.tsx` with `docs/benchmarks/m3-agent-timeline-baseline.json`.

#### Why this step (action + reasoning)

1. **What:** RED — M3 baseline schema block (M1-mode-matrix parity + color_env + event_mix)
   + example smoke; then the demo (scripted turn: thinking → tool transitions → message,
   with a live ticker driving AgentStreaming; static final scene when piped — M2
   dom-frontend-2 lesson) and the bench per D7; full run committed via `pnpm bench`.
2. **Why now:** Wiring pillars (a)+(c); the cycle owner requires benchmark data; roadmap
   risk 1 numbers.

#### Evidence
- Harness: `benchmarks/sampling.ts` + M2 bench precedents; height-bound rationale
  `knowledge-base/references/gemini-cli/packages/cli/src/ui/AppContainer.tsx:609`.

#### Files to edit
```
tests/bench-baseline.test.ts — extend: M3 block (mode matrix like M1 + color_env + event_mix + max_lines fields)
tests/example-agent.integration.test.ts — (NEW) subprocess smoke (execFileSync timeout + minimal env — M2 review lessons)
benchmarks/agent-timeline.bench.tsx — (NEW) workload per D7
docs/benchmarks/m3-agent-timeline-baseline.json — (NEW) generated via pnpm bench, committed
examples/agent.tsx — (NEW) demo (TTY animates; piped renders final scene statically)
package.json — "example:agent" script
CHANGELOG.md — Added entry
```

#### Deep Dives
- Bench modes array like M1 (`modes: [{mode: "bounded"|"unbounded", runs, aggregate}]`);
  EC-15 stdout-frames guard (M2 post-review version) applied PER MODE — the unbounded mode
  legitimately produces more/larger frames; the guard compares each run against its own
  mount count, never a cross-mode threshold (EC-9); event mix constants + one 500-line
  output; per-step tail identity-replace + append.
- Example: non-TTY → final turn rendered once, exit 0 (no ANSI erase spray); TTY → thinking
  1s → tool running 1.2s → success → message, ticker via useState/useEffect (the 5-line
  pattern D4 promises).
- Baseline JSON: M1 shape (modes) + `workload {events, event_mix, long_output_lines,
  max_lines_bounded}`.

#### Tasks
1. RED schema + smoke tests
2. Implement bench + example; `pnpm bench` full run; commit baseline
3. CHANGELOG

#### TDD
```
RED:     m3_agent_timeline_baseline_exists_with_mode_matrix() — parse docs/benchmarks/m3-agent-timeline-baseline.json; expect(baseline.modes.map(m => m.mode).sort()).toEqual(["bounded", "unbounded"]); expect(baseline.color_env.FORCE_COLOR).toBe("1"); per mode: runs.length === protocol.measured_runs >= 3, every metric Number.isFinite, recompute mean/peak/frames_mean within 0.01, std_dev >= 0; expect(baseline.workload.events).toBeGreaterThan(0); expect(baseline.workload.long_output_lines).toBeGreaterThan(0)
RED:     agent_example_renders_and_exits_cleanly_when_piped() — execFileSync tsx examples/agent.tsx (timeout: 30000, minimal env PATH/HOME/FORCE_COLOR); expect(out).toContain("✓"); expect(out).toContain("·"); expect(out).toContain("All green"); exit 0
GREEN:   Implement bench + example; run pnpm bench; commit baseline
REFACTOR: None expected (harness shared via sampling.ts)
VERIFY:  pnpm vitest run tests/bench-baseline.test.ts tests/example-agent.integration.test.ts && pnpm bench --smoke
```

#### Concurrency tests

(none — single-threaded) — sequential awaited rerender loop.

#### Acceptance Criteria
- [ ] `pnpm bench` exits 0 in < 10 min; baseline committed with both modes, ≥ 3 finite self-consistent runs each + pinned env
- [ ] `pnpm bench --smoke` exits 0 in < 180s
- [ ] `pnpm example:agent | cat` exits 0 with "✓" and thinking glyph
- [ ] Pass: quality — `pnpm lint` exits 0 on benchmarks/ and examples/

#### DoD (Definition of Done)
- [ ] `pnpm gates` exits 0; real measured numbers committed

---

## Coverage Matrix

| # | Gap / Requirement (source) | Task(s) | Resolution |
|---|---|---|---|
| 1 | AgentEvent (thinking/action) + AgentTimeline + AgentStreaming (ROADMAP M3 DoD-1) | T1.1, T1.2, T2.1 | 3-variant union + windowed timeline + dumb indicator |
| 2 | Composes with M1/M2 — timeline mixes messages + tool-calls (DoD-2) | T1.1, T3.1 | Row dispatch reuses ChatMessage + ToolCallCard/ToolResult; composition-root scene |
| 3 | Snapshot tests for a representative multi-event turn (DoD-3) | T3.1 | 4-event turn snapshot + content oracles |
| 4 | Roadmap risk 1 — heterogeneous item heights | T1.2, T3.2 | Windowing oracles incl. heterogeneous graduation + bounded/unbounded bench matrix (peak metric) |
| 5 | Roadmap risk 2 — event ordering under concurrency | T1.1, T1.2 | Ordering contract: unique-id TypeError, caller-ordered array, immutable graduated events (frozen-prefix oracle) |
| 6 | Benchmark data with statistical protocol (cycle owner) | T3.2 | Committed baseline, pinned env, mode matrix |
| 7 | Wiring triad (`rules/cycle-implement.md`) | T3.1, T3.2 | Integration scene + example + bench callers; baseline = runtime evidence |
| 8 | NO_COLOR readability (project robustness lineage) | T3.1 | Probe scene: thinking + streaming suffix without ANSI |
| 9 | CHANGELOG discipline (Rule 6) | T1.1, T1.2, T2.1, T3.1, T3.2 | [Unreleased] per task |
| 10 | Zero-new-deps verdict (deps-audit golden rule) | T2.1 | Rule 9 table (none) + formatElapsed/ticker as internals |
| 11 | Edge-case review MUST-FIX EC-1..EC-3 + SHOULD EC-4..EC-10 (review 2026-07-06) | T1.1, T1.2, T2.1, T3.2 | Absorbed: D8 full boundary validation, D4 ||-fallback + floor + export site, D3 coverage note, 11 added RED oracles, EC-9 per-mode guard |

**Coverage: 11/11 gaps covered (100%)**

## Global Definition of Done

- [ ] All phases completed
- [ ] All tests passing — `pnpm test` green (M0+M1+M2 suites + ~41 new M3 tests)
- [ ] Zero type errors — `pnpm typecheck`; zero lint warnings — `pnpm lint`; format clean — `pnpm format:check`
- [ ] Build green — `pnpm build` produces `dist/index.js` + `dist/index.d.ts`
- [ ] Coverage ≥ 90% on `src/**` — `pnpm test:coverage` exits 0 (critical paths § above: 100% lines)
- [ ] File-size budget — `wc -l` <= 500 per changed source file
- [ ] CHANGELOG `[Unreleased]` updated per task (Rule 6)
- [ ] Backward compatibility — v0.2.0+M2 API unchanged (M3 purely additive)
- [ ] **Benchmark proof** — `docs/benchmarks/m3-agent-timeline-baseline.json` committed with real numbers (2 modes × ≥ 3 runs, mean ± std dev, finite, self-consistent, `color_env.FORCE_COLOR === "1"`)
- [ ] CI green on develop (node 20 + 22, 7 steps)
- [ ] **Plan archived** — after `/review` READY_TO_MERGE AND the release PR merges, move to `knowledge-base/plans/completed/`

## Failure scenarios (when I/O external)

(none — no external I/O touched)

## Final Phase: Integration Validation (MANDATORY)

**Objective:** Prove the M3 surface as a composed workload.

### Execution

```
pnpm gates                    # format:check → lint → typecheck → test → build
pnpm test:coverage            # >= 90% src/**
pnpm bench                    # full run — all four baselines refreshed under pinned env; commit diffs
pnpm example:agent | cat      # non-TTY smoke
pnpm vitest run               # second consecutive full run (stability)
```

### Acceptance Criteria

- [ ] `pnpm gates` exits 0; `pnpm test:coverage` exits 0
- [ ] Two consecutive `pnpm vitest run` green
- [ ] `pnpm example:agent | cat` exits 0 with the turn scene
- [ ] All committed baselines pinned-env + self-consistent; refresh diffs committed
- [ ] Failure scenarios — skipped ("(none — no external I/O touched)")

### If Validation Fails

1. All failures are plan-caused — fix before declaring complete; re-run the chain
2. Document environment quirks in the PR description
