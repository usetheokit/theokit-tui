# Blueprint: M3 Agent surface — AgentEvent/AgentTimeline/AgentStreaming

> **Version 1.0** — Synthesizes the deep research over `gemini-cli` (HistoryItem union +
> HistoryItemDisplay dispatch + MainContent Static/pending split + LoadingIndicator),
> `codex` (HistoryCell trait objects, ReasoningSummaryCell, status_indicator_widget,
> insert_history) and `assistant-ui/react-ink` (messagePart union, chainOfThought/loading
> primitives) into the locked M3 decisions: 3-variant `AgentEvent` union (`kind`
> discriminant), SIBLING timeline (windowed-Static + own Row dispatch), dumb
> `AgentStreaming` indicator (elapsed via prop), zero new dependencies, exhaustive dispatch
> with typed unknown-kind error, and the heterogeneous-heights bench. All 6 research
> questions answered; 0 blocked.

**Slug:** `m3-agent-surface`
**Source plan:** `.claude/knowledge-base/discoveries/plans/m3-agent-surface-plan.md`
**Owner:** paulohenriquevn + Claude (assisted)
**Generated:** 2026-07-06 via `/discover-execute`
**Confidence verdict:** SHIPPABLE (99.5/100 — 2026-07-06, zero caps)

## Context

Inherited from the discovery plan: `ROADMAP.md § M3` — `AgentEvent` (thinking/action),
`AgentTimeline` (ordered event log), `AgentStreaming` (live indicator); composes with M1/M2;
snapshot tests for a representative multi-event turn. Risks: heterogeneous item heights;
event ordering under concurrency.

## Objective

Enable `/to-plan` to write the M3 plan with zero unresolved design questions.

---

## Coverage Corner 1 — Integration Tests

*(Answers Q4.)*

- **Mixed-scene snapshot idiom:** heterogeneous history array → one `toMatchSnapshot()` —
  `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/components/MainContent.test.tsx:509-529`;
  static+pending seam snapshot ("no gap") — `MainContent.test.tsx:580-635`.
- **Per-variant dispatch oracles:** one `it` per union variant, `toContain` distinctive text,
  snapshots only for layout-bearing variants —
  `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/components/HistoryItemDisplay.test.tsx:37-219`.
- **Prop-forwarding via mocked child** (dispatch tested without heavy children) —
  `HistoryItemDisplay.test.tsx:23-25, 273-280`.
- **Streaming-indicator per-state oracles + EXACT elapsed formats** (`'(esc to cancel, 2m 5s)'`) —
  `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/components/LoadingIndicator.test.tsx:57-146`.
- **Gemini mocks spinners in ALL timeline tests** (`vi.mock('ink-spinner')`) —
  `MainContent.test.tsx:44-46`; our kit instead pins the first frame (0ms tick before the
  80ms interval — `tests/helpers.tsx:9-13` + EC-14 canary), so NO mocking is needed.
- **Verified ABSENCES in gemini:** no ordering negative tests, no duplicate-id tests, no
  unknown-variant tests (guard chain silently renders nothing —
  `HistoryItemDisplay.tsx:87-249`). Our M1/M2 idioms fill the gap: duplicate-id TypeError
  (`src/chat-thread.test.tsx:111-122`), typed unknown-discriminant error
  (`src/tool-call.test.tsx:59-65`), repaint-scope spy oracles (`src/chat-thread.test.tsx:9-19,90-109`),
  frozen-Static oracle (`src/chat-thread.test.tsx:205-224`).
- **Flakiness warnings:** Static accumulates in lastFrame (never key-cycle a mounted timeline
  in one render instance); running-event snapshots inherit the 0ms-tick/80ms-interval
  coupling — no `waitFor` habits; identity discipline required for repaint counts.

### Synthesis for M3

Representative multi-event-turn snapshot (thinking → tool running → tool success → assistant
message) via `renderFrame` in `<Box width={40}>`; per-variant `toContain` + positional
oracles; duplicate-id and unknown-kind typed-error negatives (our idioms — gemini is silent);
windowing oracles reused from M1; streaming per-state oracles with exact elapsed strings;
NO_COLOR probe gains a timeline scene; no new real-timer animation test (M2's owns that
budget).

---

## Coverage Corner 2 — Dependencies

*(Answers Q5.)*

- **Zero new runtime dependencies.** Elapsed-time tickers are hand-rolled internals in every
  analog: gemini `useTimer.ts` 65 LoC
  (`.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/hooks/useTimer.ts:15-65`),
  react-ink inline 56 LoC
  (`.claude/knowledge-base/references/assistant-ui/packages/react-ink/src/primitives/loading/LoadingElapsedTime.tsx:7-53`),
  codex `std::time::Instant`
  (`.claude/knowledge-base/references/codex/codex-rs/tui/src/status_indicator_widget.rs:55-78`).
- **Duration formatting:** internal in all three (gemini `formatters.ts:29-64` ~36 LoC;
  react-ink ~8 LoC; codex ~14 LoC).
- **No id-generation dep anywhere** (grep nanoid|uuid in both manifests: zero hits) — ids are
  caller-provided.
- **Real analog deps that do NOT transfer:** `tinygradient` (brand rainbow spinner —
  `GeminiSpinner.tsx:13`), `@assistant-ui/store`/`core` (state/transport plumbing — M7
  territory; `react-ink/package.json:41-43`), gemini's ink fork (`@jrichman/ink`) for
  screen-reader hooks.
- **Spinner:** our existing `ink-spinner` (M2) covers the streaming glyph; `cli-spinners`
  already a devDep for frame typing.

---

## Coverage Corner 3 — Tools

*(Answers Q6.)*

- **Gemini bounds Static items:** `staticAreaMaxItemHeight = Math.max(terminalHeight * 4, 100)` —
  `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/AppContainer.tsx:609`,
  applied per non-expandable item (`MainContent.tsx:118-122`); plus the huge absolute cap
  `MAX_GEMINI_MESSAGE_LINES = 65536` (`constants.ts:13-15`); plus proactive message SPLITTING
  at safe points so the committed prefix graduates early
  (`useGeminiStream.ts:1100-1134` — the anti-flicker rationale is verbatim at :1110-1118).
- **Codex pays O(wrapped rows) exactly once per insertion, no cap** —
  `.claude/knowledge-base/references/codex/codex-rs/tui/src/insert_history.rs:1-4, 130-161, 176-181`;
  safe only because history is never re-laid-out by a reconciler.
- **M3 bench design:** `benchmarks/agent-timeline.bench.tsx` on the M2 harness
  (`benchmarks/sampling.ts`, EC-2/EC-15 guards, pinned env) — ~300 mixed events (≈50%
  1-line messages, ≈30% tool cards incl. one 500-line output, ≈20% thinking), mutation loop =
  identity-replace last event + append (graduating one event per step under windowSize 8+4);
  matrix: tool outputs bounded (`maxLines=10`) vs unbounded — the delta quantifies gemini's
  reason to cap; **peak_ms_per_frame is the heterogeneous-heights metric** (tall-item
  graduation spike; mean averages it away).

---

## Coverage Corner 4 — Techniques

*(Answers Q1, Q2, Q3.)*

### Q1 — Event taxonomy + dispatch

- **gemini:** closed discriminated union `HistoryItem` (~25 variants, `type` literal
  discriminant) — `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/types.ts:161-452`;
  dispatch = guard chain in ONE component, NO exhaustiveness —
  `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/components/HistoryItemDisplay.tsx:79-250`;
  parallel `MessageType` enum duplicates the literals (drift hazard — `types.ts:455-477`);
  tool calls are GROUPED items (`tool_group`, `types.ts:259`).
- **codex:** trait objects (`Box<dyn HistoryCell>`), vtable dispatch, per-kind structs —
  `.claude/knowledge-base/references/codex/codex-rs/tui/src/history_cell/mod.rs:189-332`;
  streaming tail cell mutates in place (`messages.rs:404`).
- **react-ink:** message-parts union (`type` discriminant) shared with web
  (`.claude/knowledge-base/references/assistant-ui/packages/core/src/types/message.ts:226-241`
  — EC-1 one-hop crossing recorded); `switch` + `default: return null` + override props typed
  `Extract<Part, {type:"x"}>` + registries —
  `.claude/knowledge-base/references/assistant-ui/packages/react-ink/src/primitives/message/MessageContent.tsx:24-223`.

### Q2 — Ordering + static/pending split

- Gemini commits items into ONE `<Static>` (graduation is a STATE transition, not render
  slicing) — `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/components/MainContent.tsx:308-321`,
  `useGeminiStream.ts:1088-1135`; ids are monotonic numbers from the state layer
  (`useHistoryManager.ts:51-55`); pending rows use a reserved namespace (negative ids /
  `pending-${i}` keys — `MainContent.tsx:172-177`).
- **Analogs are SILENT on duplicate/out-of-order render guards** (verified absence) —
  fallback per plan EC-2: OUR M1 precedent `assertUniqueIds` (`src/chat-thread.tsx:42-52`) +
  caller-ordered array contract.

### Q3 — Thinking/streaming presentation

- Thinking is DE-EMPHASIZED text in all three: codex dim+italic body with dim `• ` prefix,
  full summary shown, `transcript_only` binary hide —
  `.claude/knowledge-base/references/codex/codex-rs/tui/src/history_cell/messages.rs:196-267`;
  gemini shows ONLY `thought.subject` italic truncate-end in the live line
  (`LoadingIndicator.tsx:67-72,107,151`); react-ink leaves styling to the caller
  (`MessagePartReasoning.tsx:43-53`).
- Live indicator anatomy: spinner + primary line + dim `(esc to cancel, Ns)` suffix
  (`LoadingIndicator.tsx:74-77,121`); elapsed arrives as a PROP (the indicator is dumb —
  `LoadingIndicator.tsx:25`); codex format `0s/59s/1m 00s` (`status_indicator_widget.rs:65-78`).
- Thinking visibility is a POLICY over one variant, not two variants (gemini
  `inlineThinkingMode` gate `HistoryItemDisplay.tsx:87-93`; codex `transcript_only`).

## Cross-cutting Comparison

| Dimension | gemini-cli | codex | react-ink |
|---|---|---|---|
| Item typing | closed union, `type` literal (`types.ts:161-452`) | trait objects (`mod.rs:189`) | parts union shared w/ web (`message.ts:226-241`) |
| Dispatch | guard chain, no exhaustiveness (`HistoryItemDisplay.tsx:79-250`) | vtable | `switch` + `default: null` + overrides |
| Static/live split | commit-time graduation into one Static (`MainContent.tsx:308-321`) | scrollback escape-writes (`insert_history.rs:1-4`) | store-driven |
| Dup/order guard | none at render (verified absence) | n/a | none |
| Thinking | subject-only live line (`LoadingIndicator.tsx:67`) | dim+italic summary cell (`messages.rs:225-242`) | caller-styled text part |
| Elapsed | prop + upstream useTimer (65 LoC) | Instant in-widget | inline hook (56 LoC) |
| Height bound | `max(rows*4,100)` + 65536 + splitting | none (O(rows) once) | n/a |

## ADRs

### D1 — `AgentEvent`: 3-variant closed union, `kind` discriminant, caller-provided string ids

**Decision:**
```ts
type AgentEvent =
  | { id: string; kind: "message"; role: ChatRole; text: string }   // → <ChatMessage>
  | { id: string; kind: "thinking"; text: string }                  // → new thinking row
  | { id: string; kind: "tool"; name: string; status: ToolCallStatus;
      summary?: string; result?: ToolResultProps-shaped }           // → <ToolCallCard>/<ToolResult>
```
Plain per-variant object types (NOT `Base &` intersections); a single `as const` kinds array
drives the type, the runtime guard and the error message (our M2 `VALID_STATUSES` idiom).

**Rationale:** Roadmap scopes M3 to thinking/action + composing messages and tool-calls.
`kind` (not `type`) — our naming rule bans reserved-word-ambiguous names; divergence from all
three analogs recorded here deliberately (Q1 W2). Intersections give worse errors under
exactOptionalPropertyTypes (W4); dual enum+union is a drift hazard (W3).

**Alternatives considered:** gemini's ~25-variant union incl. info/error/panels (rejected:
YAGNI — info ≈ `role: "system"` message today; error/diff/plan variants arrive additively at
M4/M5); message PARTS heterogeneity inside events (rejected: flat events suffice; parts can
widen `text` additively later); `tool_group` batching and subagent nesting (deferred — Q1
YAGNI table).

**Consequences:** M4/M5 add variants + dispatch branches; the union is exported so M7
adapters emit it.

### D2 — AgentTimeline is a SIBLING: windowed-Static + own event-Row dispatch (composition verdict (b))

**Decision:** `AgentTimeline({ events, windowSize = 8, windowOverscan = 4 })` reuses the M1
windowed-Static MECHANICS (tailStart slice, `<Static>` prefix, identity-memoized Row,
`assertUniqueEventIds` TypeError) with its own `Row` that dispatches on `event.kind`.
ChatThread is untouched.

**Rationale:** Production precedent is ONE heterogeneous list with per-kind dispatch
(gemini). Wrapping ChatThread forfeits M2 components or breaks its public contract (SRP);
composing two Statics corrupts interleaving order — roadmap risk 2 at the architecture level
(Q2 argument 3). Memo/identity + window-growth hazards carry over verbatim.

**Alternatives considered:** (a) WRAP ChatThread — rejected (contract break / serialization
loss); (c) compose both — rejected (two frozen Static regions cannot interleave).

**Consequences:** ~25 lines of windowing mechanics duplicated (occurrence #2 — Rule-of-3:
extract an internal `WindowedStatic` shell only when M4/M5 spawns the third surface;
documented, not silent). Ordering contract: caller-ordered array + unique ids (duplicate →
TypeError); committed (graduated) events are IMMUTABLE — only the tail repaints, streaming =
replace-the-last-object (M1 contract, W5).

### D3 — Exhaustive dispatch + typed unknown-kind error (fixes the analogs' silent hole)

**Decision:** Row dispatch is a `switch (event.kind)` whose `default` throws
`TypeError: AgentTimeline: unknown event kind "…" — expected "message" | "thinking" | "tool"`
(guard evaluated at the component boundary BEFORE hooks, M0 EC-1 idiom) + compile-time
`never` exhaustiveness so a new variant breaks the build.

**Rationale:** gemini renders unknown types as NOTHING (silent-swallow —
`HistoryItemDisplay.tsx:79-250` has no default); react-ink `default: return null` — same
hole. `rules/error-handling.md § 2` forbids it; JS consumers get the contract.

**Alternatives considered:** render-as-blank with warning log (rejected: swallowed error).

**Consequences:** M7 adapters must version-match the union — an honest, loud failure mode.

### D4 — AgentStreaming is a DUMB one-line indicator; elapsed arrives as a prop

**Decision:** `AgentStreaming({ thought?, elapsedSeconds?, showCancelHint = false })` renders:
M2 spinner cell (`ink-spinner` dots, `status.warning`, 3-cell indicator) + italic
`wrap="truncate-end"` primary line (`thought ?? "Thinking…"`) + dim suffix
`(esc to cancel, {formatElapsed(elapsedSeconds)})` when `showCancelHint` (elapsed omitted →
hint without timer). Pure `formatElapsed(seconds)` helper (`59s` → `1m 5s` → `1h 2m 3s`,
~10 LoC, module-internal). NO internal interval.

**Rationale:** gemini's indicator receives `elapsedTime` as a PROP (`LoadingIndicator.tsx:25`)
— ticking belongs upstream (M7/the app; our example demonstrates a 5-line useState/useEffect
ticker). No timers in the component = deterministic tests with zero mocking (Corner 1), and
`rules/testing.md § 6` (inject time) satisfied by construction.

**Alternatives considered:** internal `useElapsedSeconds` hook (rejected at M3: adds a timer
+ its test complexity to a render library; analogs keep the indicator dumb); phrase cycler /
gradient spinner / narrow-width column re-layout / details block / rightContent slot /
rebindable keys / accordion (ALL deferred — Q3 YAGNI table with per-item analog evidence).

**Consequences:** M7's adapter (or the app) owns the 1s ticker; the prop contract stays.

### D5 — Thinking row: dim+italic text behind a dim `·` system-style prefix; visibility is caller policy

**Decision:** `kind: "thinking"` renders one dim+italic text block prefixed by the theme's
system glyph color (`role.system.prefix`), full `text` shown (codex contract), no duration,
no accordion. Whether thinking events are INCLUDED is the caller's filter (one variant, no
"hidden" flag).

**Rationale:** Convergent de-emphasis contract (codex dim+italic `messages.rs:225-242`;
gemini italic; react-ink caller-styled); visibility-as-policy is W6 (gemini
`inlineThinkingMode` gate, codex `transcript_only`) — the LIBRARY renders what it's given.

**Alternatives considered:** subject/description split rendering (rejected at M3: our
`thinking.text` is already the summary the adapter chose — no double summarization);
collapse/accordion (deferred — interactivity M6+).

**Consequences:** M6 theming may expose thinking tokens; M7 decides what text arrives.

### D6 — Test strategy: dispatch oracles + turn snapshot + our negative idioms; no new animation tests

**Decision:** (1) per-variant dispatch oracles (`toContain` + positional startsWith); (2) THE
roadmap turn snapshot: thinking → tool running → tool success → assistant message in
`<Box width={40}>` via `renderFrame` (running pinned to dots frame[0] — no spinner mocking);
(3) duplicate-id TypeError + unknown-kind TypeError negatives (our M1/M2 idioms — gemini has
none); (4) windowing oracles reused: repaint-scope spy counts, frozen-prefix, window-growth;
(5) AgentStreaming per-state oracles with EXACT suffix strings (`(esc to cancel, 2m 5s)`)
+ pure formatElapsed unit edges (0s/59s/60s/61s/3600s); (6) NO_COLOR probe gains the timeline
scene (thinking + statuses distinguishable); (7) NO new real-timer animation test (M2's
exhaust test owns that budget).

**Rationale:** Corner 1 evidence; flakiness warnings (Static accumulation, no waitFor,
identity discipline) baked into the oracles.

**Alternatives considered:** gemini's mock-the-spinner policy (rejected: our first-frame
determinism already covers it; one policy per kit).

**Consequences:** The M3 suite stays deterministic-by-construction.

### D7 — Bench: `agent-timeline.bench.tsx`, mixed 300 events, bounded-vs-unbounded matrix

**Decision:** M2 harness verbatim (sampling.ts, 1+5 runs, pinned env, EC-2/EC-15 guards);
workload = 300 mixed events (≈50% messages / ≈30% tool cards incl. one 500-line output /
≈20% thinking), per step identity-replace the tail (token append or status transition,
alternating) + append one event under windowSize 8+4; TWO modes: `bounded` (tool
`maxLines=10`) vs `unbounded` (maxLines ≥ height); baseline
`docs/benchmarks/m3-agent-timeline-baseline.json` with `workload.event_mix`;
**peak_ms_per_frame called out as the heterogeneous-heights metric** in the methodology.

**Rationale:** Corner 3 — the tall-item graduation spike is a PEAK phenomenon; the
bounded/unbounded delta reproduces, with our numbers, gemini's reason for
`staticAreaMaxItemHeight`. Do NOT adopt codex's no-cap (safe only without a reconciler);
keep per-item `maxLines` as OUR bounding mechanism (library, not app).

**Alternatives considered:** windowed-vs-plain matrix again (rejected: M1 proved it;
the M3 question is height heterogeneity, not windowing).

**Consequences:** M3's DoD carries real numbers for roadmap risk 1.

## Recommendations for the project

| # | Recommendation | Linked to | Priority |
|---|---|---|---|
| 1 | `AgentEvent` 3-variant union + kinds array (single source) | Q1, D1 | HIGH |
| 2 | `AgentTimeline` sibling with windowed-Static + exhaustive kind dispatch + unique-id guard | Q2, D2, D3 | HIGH |
| 3 | `AgentStreaming` dumb indicator + pure `formatElapsed` | Q3, D4 | HIGH |
| 4 | Thinking row dim+italic, visibility = caller policy | Q3, D5 | HIGH |
| 5 | Test kit per D6 (turn snapshot, negatives gemini lacks, exact elapsed strings, NO_COLOR scene) | Q4, D6 | HIGH |
| 6 | `benchmarks/agent-timeline.bench.tsx` + baseline (bounded/unbounded matrix, peak metric) | Q6, D7 | HIGH |
| 7 | Zero new deps (Rule 9 verdict — analogs hand-roll elapsed/format) | Q5 | HIGH |
| 8 | Document WindowedStatic extraction trigger (3rd windowed surface) + M4/M5 additive variants | D2, D1 | LOW |

## Blocked questions (if any)

(none — all 6 answered)

## Halt-loop progress (audit trail)

- Iterations used: 1 (inline — 4 parallel research agents + synthesis; ralph-loop not
  spawned: session Stop hook active, per `rules/loop-engine-convention.md § Anti-patterns`)
- Questions answered: 6/6 · blocked: 0
- EC discipline honored: AppContainer.tsx (2867 L), MainContent.test.tsx (932 L), codex
  history_cell (per-file wc) sampled with recorded regions; EC-1 one-hop crossings into
  `@assistant-ui/core` recorded (types + state, no web-render reuse)
- Citations verified: Step 7 path-existence sweep after synthesis

## Related

- Discovery plan: `.claude/knowledge-base/discoveries/plans/m3-agent-surface-plan.md`
- Edge-case review: `.claude/knowledge-base/reviews/m3-agent-surface-edge-cases-2026-07-06.md`
- Project rules linked: `.claude/rules/architecture.md`, `.claude/rules/testing.md`,
  `.claude/rules/error-handling.md`, `.claude/rules/parsimony-ladder.md`
