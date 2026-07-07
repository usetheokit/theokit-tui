# Discovery Plan: M7 Stream adapter + Harness bridge

**Slug:** `m7-stream-adapter`
**Owner:** paulohenriquevn + Claude (assisted)
**Created:** 2026-07-07
**Time budget:** 5h (per-project breakdown in ADR D1)

## Context

`ROADMAP.md § M7` — the `@theokit/sdk` stream adapter that drives the primitives (the
`useAgentStream` analog): a hook/reducer maps an `AsyncIterable` of SDK events
(`text_delta`, `tool_call` lifecycle, `assistant`) → UI state driving
`ChatThread`/`ToolCallCard`/`AgentTimeline`; the reducer is PURE and exhaustively
tested (mirrors theo-ui's `agentStreamReducer`); ZERO runtime coupling to
`@theokit/sdk` (structural input type; sdk a devDependency for the demo only);
reconnect/resume across a dropped stream (opaque `lastEventId`) covered by a test.
Depends on M3 (RELEASED-track). Risks: (1) structural-type drift vs the real SDK
output; (2) reducer complexity/correctness.

**Decisive advantage over prior milestones:** the MIRROR and the REAL SDK are both
first-party and snapshotted into references (catalog updated 2026-07-07):
`references/theokit-ui/src/hooks/use-agent-stream/` (reducer 181 L + hook 57 L +
structural `SdkStreamMessage` types 33 L + 3 test files incl. a dedicated reconnect
suite) and `references/theokit-sdk/packages/sdk/src/` (the real event source — kills
risk 1 by direct verification instead of guessing).

## Objective

Answer the 6 research questions below with cited evidence so `/to-plan` can write the
M7 implementation plan with zero unresolved design questions.

## In-Scope / Out-of-Scope

### In-Scope (per reference project)

- `theokit-ui` (internal mirror) — `use-agent-stream/` end-to-end: reducer contract,
  hook lifecycle, reconnect semantics, test idioms.
- `theokit-sdk` (internal, the real producer) — where the stream events are emitted
  (subscribe/onDelta seams), the exact tool_call lifecycle shape, resume/lastEventId
  semantics, drift check vs theo-ui's structural type.
- `assistant-ui` — `packages/assistant-stream` + `examples/with-resumable-stream` +
  `packages/react-data-stream` (the OSS SOTA for resumable assistant streams).
- `gemini-cli` — `useGeminiStream` (the Ink production stream-consumption hook).
- `codex` — event dispatch loop (patterns only).
- OUR tree — M3 `AgentEvent` union + `AgentTimeline` (the render target), M5/M6
  provider/bench harness conventions.

### Out-of-Scope (explicit)

- Transport (SSE/WebSocket/fetch) — the adapter consumes an `AsyncIterable`; how the
  app obtains it is app/SDK concern.
- Session persistence beyond the opaque `lastEventId` passthrough.
- Multi-turn conversation management / history compaction (SDK concern).
- New rendering primitives (M7 drives M0-M6 components only).

## ADRs

### D1 — Time budget + stop conditions

**Decision:** `theokit-ui` mirror: 1.5h; `theokit-sdk` events: 1h; `assistant-ui`
stream packages: 1h; `gemini-cli`/`codex` consumption loops: 1h; our-tree mapping:
0.5h. Total 5h.

**Rationale:** the mirror is the contract source (DoD names it); the real SDK kills
the drift risk; assistant-ui is the only OSS analog with RESUMABLE streams as a
first-class example; gemini is the Ink production consumer.

**Stop condition — per question (mandatory):** Fase A empty on named hotspots → ONE
alternative Grep spelling; still empty → `blocked` with attempts recorded. Never
fabricate.

**Stop condition — per project (mandatory):** Budget exhausted → remaining questions
`blocked (budget)`.

**Anti-pattern:** NEVER fabricate Fase B answers (Unbreakable Rule 3).

**Consequences:** Blocked questions seed the next discovery.

### D2 — The TUI adapter maps SDK events onto the EXISTING M3 `AgentEvent` union (hypothesis to verify)

**Decision:** Q1×Q3 verify whether the adapter's output state can be exactly
`{ events: AgentEvent[], streaming: AgentStreamingState }` — the shapes
`AgentTimeline`/`AgentStreaming` already consume — or whether a parallel state model
(theo-ui has web-shaped messages) is required. The blueprint locks the mapping table
event-by-event (text_delta folding → tail message text; tool_call lifecycle →
`AgentToolEvent.status`; thinking → thinking event/streaming thought; assistant →
message finalization) with evidence.

**Rationale:** M7's value is driving OUR primitives with zero new render surface;
re-modeling state that AgentTimeline already validates would duplicate M3's boundary.

**Alternatives considered:** porting theo-ui's state verbatim (web-shaped — rejected
if it fights the M3 union; verified, not assumed).

**Consequences:** The M7 plan's reducer tasks hang off this mapping table.

### D3 — Drift-proofing is a TEST, not a promise (roadmap risk 1)

**Decision:** Q2 must deliver the exact delta between theo-ui's structural
`SdkStreamMessage` and what `theokit-sdk` emits TODAY (field-by-field), plus the
mechanism to keep it honest: a devDependency-only compile-time assignability test
(real SDK type → our structural type) that fails the suite on drift while adding ZERO
runtime coupling. The blueprint locks the structural-type shape + the assignability
test design.

**Rationale:** "structural input type" without a drift tripwire rots silently — the
roadmap names this as risk 1; the SDK being first-party makes the tripwire cheap.

**Alternatives considered:** importing SDK types at runtime (rejected: DoD forbids
runtime coupling); no tripwire (rejected: the drift risk is the milestone's #1 risk).

**Consequences:** The M7 plan gets an assignability-test task with the sdk pinned as
devDependency.

## Research Questions

| # | Question | Corner | Reference project(s) | Fase A (broad — map hotspots) | Fase B (deep — Read at each hotspot) | Expected answer shape |
|---|---|---|---|---|---|---|
| Q1 | The mirror's reducer contract: state shape, action folding (text_delta accumulation, tool_call lifecycle transitions, thinking, assistant finalization, error/done), ordering/id rules, edge semantics (delta after done? unknown kinds? interleaved tools?) — and the EXACT mapping onto OUR M3 `AgentEvent` union + `AgentStreaming` props | techniques | `.claude/knowledge-base/references/theokit-ui/src/hooks/use-agent-stream/agent-stream-reducer.ts`, `.claude/knowledge-base/references/theokit-ui/src/hooks/use-agent-stream/types.ts`, OUR `src/agent-event.ts` + `src/agent-timeline.tsx` + `src/agent-streaming.tsx` | Grep `case \|kind\|status` in the reducer; map every branch | Read the reducer + types end-to-end; build the branch-by-branch mapping table onto AgentEvent | Reducer contract + D2 mapping table (SDK event → reducer action → AgentEvent mutation) with divergences (web vs TUI) called out — citations |
| Q2 | The REAL SDK contract + drift: where events are emitted (subscribe/onDelta seams), exact payload shapes for text_delta/tool_call/assistant/thinking/error/done, resume semantics (lastEventId — does the SDK expose it? under what name?), field-by-field delta vs theo-ui's structural type | techniques | `.claude/knowledge-base/references/theokit-sdk/packages/sdk/src/` (agent.ts, client/, stream-related modules — locate via grep), `.claude/knowledge-base/references/theokit-ui/src/hooks/use-agent-stream/types.ts` | Grep `text_delta\|tool_call\|subscribe\|onDelta\|resume\|lastEventId\|last_event_id\|AsyncIterable\|AsyncGenerator` across the sdk src | Read the emitting module(s) + the public stream API end-to-end; diff against the mirror's structural type | SDK event-shape table + resume mechanism + drift delta + the D3 assignability-test design — citations |
| Q3 | Hook + AsyncIterable consumption + reconnect: the mirror's hook lifecycle (iteration loop, unmount/cancel, error surface, StrictMode double-run), its reconnect test semantics; assistant-ui's resumable-stream design (what state survives a drop, how resume is keyed); gemini's Ink production consumption loop | techniques | `.claude/knowledge-base/references/theokit-ui/src/hooks/use-agent-stream/use-agent-stream.ts`, `.claude/knowledge-base/references/theokit-ui/src/hooks/use-agent-stream/use-agent-stream.reconnect.test.tsx`, `.claude/knowledge-base/references/assistant-ui/examples/with-resumable-stream/`, `.claude/knowledge-base/references/assistant-ui/packages/assistant-stream/src/` (core loop — sample if > 800 L), `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/hooks/useGeminiStream.ts` | Grep `for await\|AbortController\|cancel\|resume\|reconnect\|useEffect` | Read hook + reconnect test fully; sample assistant-stream's consumption core; read useGeminiStream's loop regions | Hook-design table (iteration/cancel/error/remount) + reconnect state contract (what is kept, what is replayed, lastEventId flow) — citations |
| Q4 | Testing idioms for reducers + async hooks: the mirror's exhaustive reducer table + hook tests (fake streams? deterministic ticks?), reconnect test anatomy; how to drive an AsyncIterable deterministically under OUR harness (renderFrame ticks, no real timers) | tests | `.claude/knowledge-base/references/theokit-ui/src/hooks/use-agent-stream/agent-stream-reducer.test.ts`, `.claude/knowledge-base/references/theokit-ui/src/hooks/use-agent-stream/use-agent-stream.test.tsx`, `.claude/knowledge-base/references/theokit-ui/src/hooks/use-agent-stream/use-agent-stream.reconnect.test.tsx`, OUR `tests/helpers.tsx` + `src/agent-timeline.test.tsx` idioms | `wc -l` first; Grep `async function\*\|yield\|await act\|vi.fn` | Read all three test files fully | Test-strategy: reducer TDD table shape, fake-AsyncIterable helper design, hook-level oracles (frames? state probes?), reconnect scenario script — citations |
| Q5 | Dependencies + coupling discipline: ZERO runtime deps confirmed in the mirror? how is the sdk wired as devDependency (workspace link? version?) for its demo/tests; any helper lib for async iteration (verified absence expected) | deps | `.claude/knowledge-base/references/theokit-ui/src/hooks/use-agent-stream/types.ts` (the structural-type discipline), theo-ui package.json (read from `../theokit-ui/package.json` — internal, verifiable), OUR package.json | Grep `import` in the module (expect react-only); grep `theokit-sdk\|@theokit` in theo-ui's manifest | Trace the devDependency wiring + demo usage | Rule 9 verdict (ZERO new runtime deps; sdk devDep pinning strategy for OUR demo — workspace vs registry) — citations |
| Q6 | Evidence artifact: is a bench meaningful (the adapter drives rerenders the M5 metrics-footer bench shape already measures) or is the honest evidence the reducer's exhaustive table + an end-to-end demo (example wired to a FAKE stream — deterministic; the real-SDK demo gated on the devDep)? Cycle owner requires data — decide with rationale | tools | OUR `benchmarks/agent-timeline.bench.tsx` (the streaming-shape bench that already exists) + `benchmarks/sampling.ts`; the mirror's absence/presence of any perf machinery | Map whether the adapter adds per-frame work beyond the rerenders the M3 bench already measures (reducer cost per event?) | Decide: reuse/extend the M3 bench with a reducer-driven event stream (adapter-in-the-loop mode) OR recorded justification + full-suite regression re-run | M7 evidence proposal (bench mode OR justification) — citations |

## Coverage Matrix

| Corner | Questions mapped | Status |
|---|---|---|
| Integration tests | Q4 | Covered |
| Dependencies | Q5 | Covered |
| Tools | Q6 | Covered |
| Techniques | Q1, Q2, Q3 | Covered |

**Coverage: 4/4 corners covered (100%)**

## Edge cases absorbed (from /discover-edge-cases 2026-07-07)

- **EC-1 (MUST-FIX, absorbed into Q1):** out-of-order and duplicate events — a
  `tool_call` completion for an id never started, a `text_delta` after `done`, a
  duplicate event id (our M3 boundary THROWS on duplicate ids — the adapter must
  either guarantee uniqueness or the mapping table must define the reconcile rule).
  Evidence must state what the mirror does branch-by-branch.
- **EC-2 (MUST-FIX, absorbed into Q3):** reconnect REPLAY overlap — after resume with
  `lastEventId`, does the producer replay events already folded? The state contract
  must define idempotency (fold-twice-safe? id-based dedup?) with mirror/assistant-ui
  evidence.
- **EC-3 (MUST-FIX, absorbed into Q2):** the drift tripwire's direction —
  assignability must be checked SDK→structural (the SDK payload satisfies what we
  read), not the reverse; and optional/extra SDK fields must not break it (structural
  typing semantics pinned by a compile-time test design).
- **EC-4 (SHOULD, absorbed into Q3):** unmount mid-stream — the iteration loop must
  stop consuming (no setState-after-unmount, no leaked iterator); StrictMode
  double-mount must not double-fold (React 18 dev semantics).
- **EC-5 (SHOULD, absorbed into Q4):** deterministic fake-stream helper — pull-based
  (yield on demand) vs push-based; the tests must advance the stream WITHOUT real
  timers (our 0ms-tick harness discipline).
- **EC-6 (SHOULD, absorbed into Q1):** error mid-tool — a stream `error` while a
  tool_call is `running`: terminal state mapping (failed? error event? both?) must be
  pinned by the mapping table.

## Halt-loop Checkpoints

- After each question: citations verified on disk before recording.
- After Q1/Q2: D2 mapping table + D3 drift delta drafted.
- Before blueprint synthesis: every question `done` or `blocked`; EC sampling recorded
  for any file > 800 lines.

## Acceptance Criteria

- [ ] All 6 questions answered with `path:line` citations that resolve on disk (or honestly `blocked`)
- [ ] Blueprint drafted at `.claude/knowledge-base/discoveries/blueprints/m7-stream-adapter-blueprint.md` with 4/4 corners populated and ≥ 1 ADR incl. the D2 mapping table + D3 drift-tripwire design
- [ ] `python3 .claude/skills/discover-confidence/scripts/run_blueprint_score.py` on the blueprint returns verdict ≥ SHIPPABLE_WITH_CAVEATS
- [ ] Zero fabricated citations — path-existence sweep passes

## Global Definition of Done

- [ ] Blueprint SHIPPABLE(_WITH_CAVEATS) committed on `develop`
- [ ] `/to-plan` can start with zero unresolved design questions (mapping table + SDK contract/drift tripwire + hook/reconnect design + test strategy + deps verdict + evidence artifact all locked)
