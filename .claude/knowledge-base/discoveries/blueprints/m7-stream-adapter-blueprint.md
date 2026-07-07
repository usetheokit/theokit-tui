# Blueprint: M7 Stream adapter + Harness bridge

> **Version 1.0** — Synthesizes the deep research over the FIRST-PARTY mirror
> (`theokit-ui/use-agent-stream`: reducer 181 L + hook 57 L + reconnect suite), the
> REAL `@theokit/sdk` source (all three stream surfaces located; payload shapes
> compile-verified with the repo's tsc), `assistant-ui`'s resumable-stream design and
> `gemini-cli`'s production consumption loop into the locked M7 decisions: the
> structural input type is designed FRESH from the real `SDKMessage`/`InteractionUpdate`
> tables (the mirror's `SdkStreamMessage` drifts TODAY in both directions —
> `text_delta` never arrives from any public surface, and `SDKStatusMessage.message:
> string` breaks whole-union assignability, tsc-proven); the reducer folds BOTH
> granularities (coarse `Run.stream()` turns + fine hyphenated `text-delta` updates)
> onto OUR M3 `AgentEvent` union with tail-replace-by-identity (no sentinel);
> re-attach = RESET + refold (never merge — `Run.stream()` re-call replays from
> index 0); the drift tripwire is a compile-time whole-union assignability test +
> per-member diagnostics with `@theokit/sdk ^2.18.1` as an import-type-only
> devDependency; no new bench (recorded justification + flip condition). All 6
> research questions answered; 0 blocked.

**Slug:** `m7-stream-adapter`
**Source plan:** `.claude/knowledge-base/discoveries/plans/m7-stream-adapter-plan.md`
**Owner:** paulohenriquevn + Claude (assisted)
**Generated:** 2026-07-07 via `/discover-execute`
**Confidence verdict:** SHIPPABLE (100.0/100 — 2026-07-07, zero caps)

## Context

Inherited from the discovery plan: `ROADMAP.md § M7` — hook/reducer maps an
`AsyncIterable` of SDK events → UI state driving `ChatThread`/`ToolCallCard`/
`AgentTimeline`; pure exhaustively-tested reducer mirroring theo-ui's
`agentStreamReducer`; ZERO runtime coupling (structural type; sdk devDep for the demo
only); reconnect/resume (opaque `lastEventId`) covered by a test. Risks: (1)
structural-type drift; (2) reducer complexity/correctness.

## Objective

Enable `/to-plan` to write the M7 plan with zero unresolved design questions.

---

## Coverage Corner 1 — Integration Tests

*(Answers Q4.)*

- **The mirror's reducer idiom:** a `fold(...msgs)` reduce helper + one behavior per
  AAA test — exhaustive at the DISCRIMINATOR level (6/6 switch arms) but only ≈10 of
  ≈21 subsidiary paths
  (`.claude/knowledge-base/references/theokit-ui/src/hooks/use-agent-stream/agent-stream-reducer.test.ts:10-12,15-85`).
  UNCOVERED upstream: delta-after-done (silent stream resurrection), error-object
  form, empty-buffer done, never-started tool completion, missing `call_id` — exactly
  our EC-1/EC-6 MUST-FIXes. Port the idiom; close the gaps (both §4.1 lenses).
- **Fake streams are PULL-BASED generators** — `finiteStream(msgs)` yields from an
  array, zero timers
  (`.claude/knowledge-base/references/theokit-ui/src/hooks/use-agent-stream/use-agent-stream.test.tsx:38-40`).
  BUT the mirror's cancellation probe hangs on a REAL 5ms `setInterval`
  (`use-agent-stream.test.tsx:17-24`) and its oracles are `waitFor` real-time polling
  (reconnect sets `{timeout: 5000}` —
  `.claude/knowledge-base/references/theokit-ui/src/hooks/use-agent-stream/use-agent-stream.reconnect.test.tsx:49`)
  — the mirror does NOT enforce our no-real-timers discipline. Ours: deferred-promise
  hang resolved by `return()` (no interval); `waitFor` → bounded `await tick()` loops
  (each yield→dispatch→rerender settles in one 0ms macrotask).
- **Hook oracles:** the mirror probes STATE via `renderHook` (`@testing-library/react`
  + happy-dom) — no frames. Our harness has NO renderHook/waitFor/act
  (ink-testing-library): use a probe component capturing the hook state + ONE
  frame-level test feeding the state into `AgentTimeline` (closing the wiring loop the
  mirror never tests). Reducer tests port unchanged (pure, node env).
- **Reconnect scenario anatomy** (`use-agent-stream.reconnect.test.tsx:19-57`):
  a `resumingStream` generator with internal `lastEventId`, drops after 2 events
  WITHOUT advancing past the last ack, resumes from `lastEventId + 1` — the hook sees
  ONE continuous iterable; oracle = final text exactly `"abcde"` (no dup, no loss).
- **Streaming-progression tests need a held-open instance** — `renderFrame` unmounts
  immediately (`tests/helpers.tsx:15-21`); use the M3 idiom render → tick → assert →
  rerender (`src/agent-timeline.test.tsx` shape; the mirror's hook suite drives the
  same progression via `renderHook` —
  `.claude/knowledge-base/references/theokit-ui/src/hooks/use-agent-stream/use-agent-stream.test.tsx:48-57`); running-status frames must beat the
  ~80ms spinner interval (0ms ticks only).

---

## Coverage Corner 2 — Dependencies

*(Answers Q5.)*

- **ZERO new runtime dependencies — mirror-proven:** the entire module's only external
  runtime import is `react`
  (`.claude/knowledge-base/references/theokit-ui/src/hooks/use-agent-stream/use-agent-stream.ts:13`);
  the reducer imports types only; NO async-iteration helper lib anywhere (verified
  absence — the iterator is hand-driven, `use-agent-stream.ts:28-53`).
- **The sdk devDependency precedent (internal-live):** theo-ui pins
  `"@theokit/sdk": "^2.18.1"` under devDependencies (registry range, NOT workspace —
  `../theokit-ui/package.json`), consumed only by demo scripts; NO production source
  imports it (grep-verified zero hits in src/tests). theo-ui has NO dedicated
  assignability test — our D3 tripwire IMPROVES on the mirror.
- **Workspace verdict:** `pnpm-workspace.yaml` does not exist at theokit-tui/
  theokit-tools/usetheo levels — theokit-tui is a STANDALONE pnpm project;
  `workspace:*` is unavailable; the devDep resolves from the registry (caret +
  lockfile; a tripwire failure after a deliberate `pnpm update` IS the feature).
- **SDK package facts (internal-live — the references snapshot carries src only, no
  package.json — recorded honestly):** `@theokit/sdk` v2.18.1, ESM-first,
  `engines.node >= 22.12.0`, Apache-2.0.

---

## Coverage Corner 3 — Tools

*(Answers Q6.)*

- **NO new bench — the existing M3 bench already replays the adapter's exact output
  shape:** `benchmarks/agent-timeline.bench.tsx:104-139` measures tail
  identity-replace (token append / status transition) + one append per step — the
  same `{events: AgentEvent[]}` mutations the reducer produces. Per-event reducer
  cost is O(items) pure-JS folding (string concat + one filter/spread — mirror
  `agent-stream-reducer.ts:138-146`): sub-frame micro work whose in-loop delta lands
  inside the bench's declared 1-std-dev INCONCLUSIVE band — measuring it would report
  noise as signal (the M6 D7 precedent; the mirror ships no perf machinery for this
  module — verified absence).
- **The honest evidence triple:** (1) the exhaustive reducer table (discriminator
  branches + the sub-paths the mirror skips); (2) a deterministic fake-stream demo
  (`examples/` entry, piped-clean, pull-based scripted stream; real-SDK variant gated
  on the devDep); (3) the full 6-bench regression re-run at Final Phase (bar: no
  ADVERSE delta beyond run-to-run variance — the M6 evidence rule).
- **Flip condition (recorded):** if folding becomes super-linear in history length OR
  any mapping computation moves into a component render path, add an
  adapter-in-the-loop mode to `agent-timeline.bench.tsx` (fold the identical 300+150
  workload through the reducer per step; same protocol/matrix; A/B vs the M3
  baseline) — a real A/B on the same workload, never a fabricated micro-bench.

---

## Coverage Corner 4 — Techniques

*(Answers Q1, Q2, Q3.)*

### Q2 — The REAL SDK contract (drift is present TODAY, tsc-verified)

- **Three public stream surfaces:** `Run.stream(): AsyncGenerator<SDKMessage>`
  (coarse — whole assistant turns, tool lifecycle, ONE accumulated thinking event —
  `.claude/knowledge-base/references/theokit-sdk/packages/sdk/src/types/run.ts:352`,
  impl `.claude/knowledge-base/references/theokit-sdk/packages/sdk/src/internal/runtime/fixtures/fixture-run-base.ts:93-105`);
  `SendOptions.onDelta` CALLBACK of `{update: InteractionUpdate}` (fine per-token —
  `run.ts:262`, emitted
  `.claude/knowledge-base/references/theokit-sdk/packages/sdk/src/internal/agent-loop/loop-llm-stream.ts:259-277`);
  `subscribe()` generic AsyncGenerator (sub-export;
  `.claude/knowledge-base/references/theokit-sdk/packages/sdk/src/subscription/theokit-subscribe.ts:53-109`).
- **How each SDKMessage is constructed:** system/user/assistant/thinking builders at
  `.claude/knowledge-base/references/theokit-sdk/packages/sdk/src/internal/agent-loop/message-builders.ts:18-55`;
  cloud status/assistant at
  `.claude/knowledge-base/references/theokit-sdk/packages/sdk/src/internal/runtime/cloud/real-cloud-run.ts:208-224`;
  multi-round driver `agent.streamToCompletion?()` at
  `.claude/knowledge-base/references/theokit-sdk/packages/sdk/src/types/agent.ts:705-712`.
- **`SDKMessage` union** (9 members, all with `agent_id`/`run_id` —
  `.claude/knowledge-base/references/theokit-sdk/packages/sdk/src/types/messages.ts:161-170`):
  `assistant` (`message.content: Array<TextBlock | ToolUseBlock>` —
  `messages.ts:58-66`); `thinking` (`text`, `thinking_duration_ms?` —
  `messages.ts:73-79` — ONE replayed event, not deltas); `tool_call` (`call_id`,
  `name`, `status: "running"|"completed"|"error"`, `args?`, `result?` —
  `messages.ts:89-99`; **`"error"` is DECLARED but has ZERO construction sites** —
  failures arrive as `completed` + `result.exitCode ≠ 0`,
  `.claude/knowledge-base/references/theokit-sdk/packages/sdk/src/internal/agent-loop/tool-dispatch.ts:414-435`);
  `status` (cloud; **`message?: string`** — `messages.ts:106-112`); plus
  system/user/task/request/object_delta.
- **NO `text_delta`, NO `error`, NO `done` member exists on any public stream.** The
  fine delta is `"text-delta"` (HYPHEN) inside the `onDelta` wrapper
  (`.claude/knowledge-base/references/theokit-sdk/packages/sdk/src/types/updates.ts:21-24`;
  union of 15 camelCase members incl. `thinking-delta`, `tool-call-started/completed`
  (`.claude/knowledge-base/references/theokit-sdk/packages/sdk/src/types/updates.ts:51-80`)
  and `turn-ended` with usage
  (`.claude/knowledge-base/references/theokit-sdk/packages/sdk/src/types/updates.ts:118-126`)
  — full union `updates.ts:166-181`). The mirror's `error`/`done` are CLIENT-SIDE synthetics of
  its hook (`use-agent-stream.ts:37,45`) — ours too, documented as OURS.
- **Resume:** `Run.stream()` has NO cursor — re-calling it replays from index 0
  (TOTAL overlap — `fixture-run-base.ts:93-105`); `subscribe()` DOES expose
  `lastEventId` under exactly that name, opaque by design, with auto-reconnect +
  exponential backoff SDK-side (`theokit-subscribe.ts:72-107,271-278`; tracked-id
  envelopes `.claude/knowledge-base/references/theokit-sdk/packages/sdk/src/subscription/types.ts:63-99`; server
  `Last-Event-ID` header —
  `.claude/knowledge-base/references/theokit-sdk/packages/sdk/src/subscription/internal/server-integration.ts:260-267`).
- **Drift delta vs the mirror's structural type
  (`.claude/knowledge-base/references/theokit-ui/src/hooks/use-agent-stream/types.ts:13-30`),
  compile-verified with tsc 5.9.3:** whole-union `SDKMessage → SdkStreamMessage`
  FAILS (TS2322 — `SDKStatusMessage.message?: string` vs the object shape);
  per-member assistant/thinking/tool_call PASS (extra required fields are
  assignability-safe); the mirror's `text_delta` branch is UNREACHABLE from any raw
  SDK surface (value-level drift a type tripwire cannot catch — needs one runtime
  contract test against the SDK's fixture shapes).

### Q1 — The mirror's reducer + THE D2 mapping onto our M3 union

- **Mirror helpers:** `withoutStreaming` sentinel filter
  (`.claude/knowledge-base/references/theokit-ui/src/hooks/use-agent-stream/agent-stream-reducer.ts:55-57`),
  `finalizeText`
  (`.claude/knowledge-base/references/theokit-ui/src/hooks/use-agent-stream/agent-stream-reducer.ts:63-78`),
  `renderToolResult` shell-flatten ladder
  (`.claude/knowledge-base/references/theokit-ui/src/hooks/use-agent-stream/agent-stream-reducer.ts:87-105`).
- **Mirror state** `{items, streamingText, status: idle|streaming|done|error, error?,
  seq}` — `seq` kept IN state for purity
  (`.claude/knowledge-base/references/theokit-ui/src/hooks/use-agent-stream/agent-stream-reducer.ts:25-39`);
  the SDK message IS the action (no action layer). Branches: text_delta rebuilds a
  `__streaming__` sentinel at the tail (`:138-147`); assistant mints `msg-${seq+1}`
  (`:148-152` — status STAYS "streaming"); tool_call upserts by `call_id` in-slot
  (`:108-122`; missing id → shared `"tool"` fallback — silent collapse); error
  appends an item with **`err-${items.length}` — a PROVEN duplicate-id generator**
  (delta→error→error collides — `:164`) and leaves running tools FROZEN (`:160-173`);
  done finalizes the buffer (`:174-177`); unknown kinds ignored (`:178-179` —
  **thinking is DROPPED**, no branch exists).
- **EC-1/EC-6 mirror behavior:** never-started tool completion → appends directly in
  terminal status (no throw — `:117-118`); delta-after-done → SILENT RESURRECTION
  (status flips back to streaming, unguarded, untested); error-mid-tool → spinner
  frozen forever + partial text silently lost. ALL untested upstream.
- **THE MAPPING TABLE (D2 — the centerpiece):** adapter state
  `{events: AgentEvent[], streaming: {active, thought?}, status, error?, seq}`;
  `elapsedSeconds`/ticking stays hook/caller-side (`src/agent-streaming.tsx` is
  deliberately dumb). Per event: fine `text-delta` → open/replace the TAIL live
  message BY IDENTITY (same id from first delta — `src/agent-event.ts:17` names the
  id "streaming replace anchor"; NO sentinel kind exists in our union — the mirror's
  sentinel does not port); `assistant` → finalize the live tail IN PLACE (same id —
  the mirror's id-swap would remount the row and violates `<Static>` graduation
  immutability, `src/agent-timeline.tsx:28-34`), else append `msg-${++seq}`;
  mint-empty rule ported (no event when text empty); `thinking` → `streaming.thought`
  (live) + optionally a graduated `think-${seq}` event (WE DIVERGE DELIBERATELY — our
  union was built for it); `tool_call` running → append `tool-${call_id}` (NAMESPACED
  ids so producer ids can never collide with `msg-*`; missing call_id →
  `tool-anon-${seq}` — never the mirror's shared fallback); completed/error → upsert
  by id, shell envelopes pass THROUGH as `shell` (our first-class
  `AgentToolEvent.shell` — never both `output` and `shell`, the M3 throw), non-shell
  → the output/text/JSON ladder; `status`(cloud)/`system`/`user`/unknown → ignored
  (forward-compat); synthetic `error` → `status:"error"` + `error` in state + every
  non-terminal tool → `"failed"` (new objects, same ids — NEVER the frozen spinner) +
  live message closed at its buffered text; synthetic `done` → finalize in place,
  `streaming.active:false`, and **deltas after done are DROPPED** (the mirror's
  resurrection is accidental, not designed).
- **Id-uniqueness invariant (our boundary THROWS on duplicates —
  `src/agent-timeline.tsx:88-90`):** three namespaced generators (`msg-`, `think-`,
  `tool-`) with monotonic in-state `seq`, never reset while events are retained.
- **Graduation hazard (ours, not the mirror's):** a tool that completes AFTER leaving
  the live window would upsert a graduated (frozen) row — the plan must pin the rule:
  document accepted-stale (gemini's scrollback has the same property) as v0, with the
  window default (8+4) making it rare; revisit only on demand.
- **Render target:** the mirror's item mix is the structural analog of
  `AgentTimeline`, NOT ChatThread — `events: AgentEvent[]` is a 1:1 fit; ChatThread
  is app-level filtering, not adapter state.

### Q3 — Hook + reconnect

- **The mirror's 57-line hook is the smallest correct loop:** `useEffect([stream])`,
  manual `iterator.next()` with a `cancelled` flag checked after EVERY await,
  cleanup = `cancelled = true; iterator.return?.()`
  (`.claude/knowledge-base/references/theokit-ui/src/hooks/use-agent-stream/use-agent-stream.ts:26-54`);
  synthesizes done/error. Unmount mid-stream is TEST-PROVEN
  (`use-agent-stream.test.tsx:85-91`). No AbortController needed (the
  iterator-protocol-native teardown; gemini needs one only because it CREATES its
  producer —
  `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/hooks/useGeminiStream.ts:250,1624-1626`
  — transport is out of our scope).
- **StrictMode/restart is the mirror's REAL gap (unguarded, untested):** single-shot
  iterables die on remount (closed generator → instant done, stream lost); multi-shot
  iterables DOUBLE-FOLD (state survives, re-iteration appends — "abcdeabcde"). Fix:
  dispatch `reset` at effect start + accept `iterable | factory` (a consumed
  generator cannot be re-iterated; a factory gives restart/reconnect-by-recreation
  for free).
- **The mirror's cancellation probe** (rebuilt timer-free by us):
  `.claude/knowledge-base/references/theokit-ui/src/hooks/use-agent-stream/use-agent-stream.test.tsx:8-35`.
- **assistant-ui's client half:** pending streamId in sessionStorage + one-shot
  resume-on-mount
  (`.claude/knowledge-base/references/assistant-ui/examples/with-resumable-stream/README.md`).
- **Reconnect contract:** the mirror's is PRODUCER-side exactly-once (`subscribe()`
  owns `lastEventId`; the hook never sees the drop — reconnect test
  `use-agent-stream.reconnect.test.tsx:19-57`); assistant-ui's is server-side byte
  replay into FRESH client state (rebuild, don't merge —
  `.claude/knowledge-base/references/assistant-ui/packages/assistant-stream/src/resumable/ResumableStreamContext.ts:106-150`,
  example README). Q2 adds: `Run.stream()` re-call = TOTAL replay. Coherent v0:
  **re-attach = RESET + refold** (factory → fresh state — the assistant-ui
  decomposition), producer-side exactly-once for `subscribe()` (the mirror's), and
  the reducer stays replay-intolerant (id-dedup would contradict the M3
  throw-on-duplicate contract). `lastEventId` does NOT cross the hook API (both
  first-party precedents keep it below the iterable; it flows app→SDK when the app
  constructs the source).
- **cancel() affordance:** same flag + `iterator.return()` + terminal action (the
  gemini ESC lesson: post-cancel events suppressed at the fold boundary).

## Cross-cutting Comparison

| Dimension | theo-ui mirror | real SDK | assistant-ui | gemini-cli | OURS (M7 target) |
|---|---|---|---|---|---|
| Input type | fictional `SdkStreamMessage` (drifts today) | `SDKMessage` / `InteractionUpdate` | ReadableStream chunks | server events | FRESH structural union from the real tables |
| Fine deltas | `text_delta` (unreachable) | `text-delta` via onDelta callback | chunk parts | in-band | `text-delta` (real name); coarse-only streams still work |
| Live text | sentinel item + buffer | n/a | store replay | pending item | tail message replaced BY IDENTITY (M3 anchor) |
| thinking | dropped | one replayed event (+ deltas on onDelta) | n/a | n/a | streaming.thought + optional timeline event |
| error ids | `err-${len}` (collides) | n/a | n/a | history item | namespaced monotonic seq |
| Reconnect | producer exactly-once | stream(): total replay; subscribe(): lastEventId | rebuild from byte 0 | n/a | reset+refold (factory) + producer exactly-once |
| StrictMode | broken (both shapes) | n/a | n/a | n/a | reset action + factory |
| Runtime deps | react only | — | — | — | react only (peer) |

## ADRs

### D1 — The structural input type is designed FRESH from the real SDK tables

**Decision:** `src/agent-stream-event.ts` (pure) declares the structural
`AgentStreamEvent` union the adapter reads — covering the REAL `SDKMessage` members
we fold (`assistant`, `thinking`, `tool_call` with `status: string` + `args?/result?:
unknown`, everything else structurally ignorable) AND the fine `onDelta` vocabulary
under its REAL names (`"text-delta"`, `"thinking-delta"`, `"tool-call-*"` — accepted
alongside so both granularities fold); `message` widened to
`string | { content?: ReadonlyArray<{type?: string; text?: string}> }` (the
tsc-proven `SDKStatusMessage` fix). `done`/`error` are OUR hook synthetics,
documented as such. The mirror's `SdkStreamMessage` is NOT copied (it drifts today).

**Rationale:** Q2's compile-verified drift + the unreachable `text_delta`; the
roadmap DoD's "text_delta" is honored via the REAL hyphenated event plus coarse
assistant turns (both fold to the same UI state).

**Alternatives considered:** copying the mirror type (rejected: proven drift);
importing SDK types at runtime (rejected: DoD forbids); onDelta-only (rejected:
Run.stream() is the primary local surface).

**Consequences:** the tripwire (D3) checks the REAL types against this union; a tiny
pure `interactionUpdatesToIterable` bridge helper is OPTIONAL demo-side, not adapter
API (the adapter takes any AsyncIterable of the union).

### D2 — Reducer output IS the M3 contract: `{events: AgentEvent[], streaming, status, error?, seq}`

**Decision:** Per the Corner 4 mapping table — tail-replace-by-identity live message
(no sentinel), in-place finalization (same id), namespaced monotonic ids
(`msg-`/`think-`/`tool-` + `tool-anon-`), thinking mapped (streaming.thought +
optional timeline event), shell envelopes passed through as `shell`, error →
state.status + non-terminal tools → `failed` (never frozen spinners) + live message
closed, done → finalize + **drop-deltas-after-done**, unknown kinds ignored.
Graduation-stale tool upserts documented as accepted v0 behavior.

**Rationale:** `events` feeds `AgentTimeline` 1:1 (the mirror's item mix is its
structural analog); the M3 boundary (duplicate-id throw, output⊕shell, tail-replace
anchor) FORCES every divergence listed — each is evidence-backed, none is taste.

**Alternatives considered:** porting the sentinel (rejected: no such kind in our
union; violates tail-replace); `err-${length}` ids (rejected: proven collision +
boundary throw); freezing running tools on error (rejected: fail-clear).

**Consequences:** the reducer is pure `(state, event) → state`, exhaustively
table-tested; ChatThread consumers filter `kind === "message"` app-side.

### D3 — Drift tripwire: compile-time whole-union assignability + per-member diagnostics; sdk = import-type-only devDependency

**Decision:** `tests/sdk-assignability.test.ts` imports `import type { SDKMessage,
SDKAssistantMessage, SDKThinkingMessage, SDKToolUseMessage, SDKStatusMessage,
InteractionUpdate } from "@theokit/sdk"` (public barrel exports — verified:
`.claude/knowledge-base/references/theokit-sdk/packages/sdk/src/index.ts:207` →
`.claude/knowledge-base/references/theokit-sdk/packages/sdk/src/types/index.ts:16`) and
asserts SDK→structural assignability: ONE whole-union check (catches new members'
field collisions — a pure per-member tripwire would never have caught
`SDKStatusMessage`) + per-member checks as diagnostics + an `InteractionUpdate`
check for the fine vocabulary. `@theokit/sdk: "^2.18.1"` lands as devDependency
(registry caret + lockfile — the sibling's exact precedent; no workspace exists).
What the tripwire CANNOT catch is recorded: value-level drift (names that never
arrive) — covered by one runtime contract test folding a canonical fixture-shaped
event script through the reducer.

**Rationale:** the drift risk is the milestone's #1 risk and it is ALREADY real;
`import type` is runtime-erased — zero coupling survives even accidental bundling;
theo-ui itself has no such test (we improve on the mirror).

**Alternatives considered:** exact version pin (rejected: caret+lockfile keeps
reproducibility while letting deliberate updates exercise the tripwire); runtime
type import (forbidden); no tripwire (rejected: risk #1).

**Consequences:** manifest gains ONE devDependency; the export-surface test pins that
nothing from the sdk leaks into the entry.

### D4 — Hook: the mirror's 57-line loop + reset action + `iterable | factory` source

**Decision:** `useAgentStream(source?: AsyncIterable<AgentStreamEvent> | (() =>
AsyncIterable<AgentStreamEvent>)) → {events, streaming, status, error?, cancel()}`.
Core loop verbatim from the mirror (manual iterator, `cancelled` flag after every
await, cleanup `iterator.return?.()`, synthetic done/error). Fixes over the mirror:
`reset` dispatch at effect start (kills the double-fold/dead-generator StrictMode
gap); factory form for restart/reconnect-by-recreation; `cancel()` imperative (flag +
return + terminal action). `lastEventId` does NOT cross the hook API — it flows
app→SDK at source construction (both first-party precedents; the reconnect DoD is
proven by the resuming-fake test at the iterable surface).

**Rationale:** smallest correct pattern, test-proven; the two real gaps found get
targeted fixes; no AbortController (iterator-protocol teardown suffices — transport
is out of scope).

**Alternatives considered:** AbortController (rejected: gemini needs it only as a
producer); surfacing lastEventId (rejected: no precedent puts it in the hook; Q2
shows it is transport-specific).

**Consequences:** remount/StrictMode + unmount-cancels-iterator + factory-restart all
get dedicated tests.

### D5 — Reconnect: re-attach = RESET + refold; producer-side exactly-once; reducer stays replay-intolerant

**Decision:** The reconnect test ports the mirror's resuming-fake (drop after 2, no
replay, resume from lastEventId+1 → exactly "abcde") — the `subscribe()`-shaped
contract. For `Run.stream()` re-attach (total replay — Q2), the contract is
factory → reset → refold from scratch (the assistant-ui rebuild-don't-merge
decomposition); NO reducer-level id-dedup (it would contradict the M3
throw-on-duplicate contract and both analog decompositions).

**Rationale:** three analogs, one coherent rule: dedup lives BELOW the iterable
(producer) or state is rebuilt — never merged in the fold.

**Alternatives considered:** fold-idempotent reducer (rejected: contradicts M3 +
no analog does it).

**Consequences:** the DoD's reconnect test exercises the hook+reducer half; the
replay-free input contract is documented on the source parameter.

### D6 — Test strategy per Corner 1

**Decision:** (1) reducer `fold` table: every discriminator branch + the sub-paths
the mirror skips (delta-after-done DROPPED, error-object form, empty-buffer done,
never-started completion, missing call_id namespacing, error-mid-tool → failed,
thinking both targets, id-uniqueness across interleaved folds — both §4.1 lenses);
(2) timer-free fakes: pull generators + deferred-promise controllable stream (no
setInterval — the mirror's is rebuilt); (3) hook tests via probe component + bounded
0ms ticks (no waitFor); unmount-cancels-iterator (the floor), StrictMode-shaped
remount (reset proof), factory restart, cancel(); (4) reconnect = the resuming-fake
scenario; (5) ONE integration test feeding hook state into `AgentTimeline` through
the composition root + composed scene snapshot (anchored); (6) the D3 tripwire +
one runtime fixture-script contract test; (7) example smoke (deterministic fake
stream, piped-clean).

**Rationale:** Corner 1 evidence + our harness discipline; closes every gap the
mirror's suite leaves.

**Alternatives considered:** porting waitFor-based tests (rejected: no such API in
our harness; real-time polling violates determinism).

**Consequences:** ~30-40 new tests; zero new snapshots beyond the composed scene
(≤ 2 budget).

### D7 — Evidence: no new bench (justification + flip condition recorded)

**Decision:** Per Corner 3 — the M3 bench already replays the adapter's output shape;
the evidence triple is the reducer table + the deterministic demo + the Final-Phase
6-bench regression re-run (ADVERSE-only rule, M6 precedent). Flip condition recorded
(super-linear folding or render-path computation → adapter-in-the-loop A/B mode on
the M3 workload).

**Rationale:** reducer cost is sub-frame micro work; an in-loop delta lands in the
INCONCLUSIVE band — noise as signal (M6 D7 precedent; analysis-golden-rule § 3).

**Alternatives considered:** adapter-in-the-loop now (rejected: no falsifiable claim
at current shape); reducer micro-bench (rejected: string-concat theatre).

**Consequences:** implementation log carries the justification + the re-run table.

### D8 — Module layout + public surface

**Decision:** `src/agent-stream-event.ts` (structural union + type guards, pure),
`src/agent-stream-reducer.ts` (pure fold + initial state), `src/use-agent-stream.ts`
(the hook). Entry exports: `useAgentStream`, `agentStreamReducer`,
`initialAgentStreamState`, and the types (`AgentStreamEvent`, `AgentStreamState`,
`AgentStreamStatus`, source type) — the reducer is public API per the DoD ("pure,
exhaustively-tested reducer" is the deliverable, and theo-ui exports both —
`.claude/knowledge-base/references/theokit-ui/src/index.ts` `useAgentStream` +
`agentStreamReducer`). Internals (id generators, fold helpers) stay module-local.

**Rationale:** mirror precedent exports both hook + reducer; the reducer being
public lets non-React consumers (harness bridges) fold without the hook.

**Alternatives considered:** hook-only export (rejected: the DoD names the reducer;
the mirror exports it).

**Consequences:** export-surface test grows presence + absence pins.

## Recommendations for the project

| # | Recommendation | Linked to | Priority |
|---|---|---|---|
| 1 | `src/agent-stream-event.ts` structural union (real names, widened message) | Q2, D1 | HIGH |
| 2 | `src/agent-stream-reducer.ts` per the D2 mapping table (all divergences) | Q1, D2 | HIGH |
| 3 | `src/use-agent-stream.ts` (mirror loop + reset + factory + cancel) | Q3, D4 | HIGH |
| 4 | Reconnect test (resuming fake) + reset/refold factory test | Q3, D5 | HIGH |
| 5 | D3 tripwire (whole-union + members + InteractionUpdate) + runtime fixture contract test + sdk devDep ^2.18.1 | Q2, D3 | HIGH |
| 6 | Test kit per D6 (timer-free fakes; probe component; both lenses) | Q4, D6 | HIGH |
| 7 | `examples/stream.tsx` deterministic fake-stream demo + smoke (+ optional real-SDK variant) | Q6, D7 | HIGH |
| 8 | Defer: onDelta→iterable bridge as public API, ChatThread-level adapter, reducer id-dedup, AbortController, elapsed ticking inside the hook | D1-D5 YAGNI | LOW |

## Blocked questions (if any)

(none — all 6 answered)

## Halt-loop progress (audit trail)

- Iterations used: 1 (inline — 4 parallel research agents + synthesis; Stop hook active)
- Questions answered: 6/6 · blocked: 0
- EC-1..EC-6 all answered with evidence (EC-1 mirror branch table + the proven
  `err-${length}` collision; EC-2 three-analog reconnect decomposition + the
  Run.stream() total-replay fact; EC-3 tsc-verified tripwire direction + the
  whole-union necessity; EC-4 unmount test-proven + the StrictMode double-fold
  shapes; EC-5 pull-based fakes + the mirror's real-timer honesty note; EC-6
  frozen-spinner behavior + the never-constructed `status:"error"` fact)
- Honesty notes preserved: the mirror's suite covers only ≈10/21 sub-paths; the
  mirror has NO thinking branch, NO StrictMode guard, NO assignability test; the
  references/theokit-sdk snapshot lacks package.json (version cited from the live
  sibling); `text_delta` (underscore) exists only in the SDK's INTERNAL LLM layer;
  gemini sampled by regions (2158 L, recorded)
- Citations verified: pre-synthesis path-existence sweep (all reference paths resolve)

## Related

- Discovery plan: `.claude/knowledge-base/discoveries/plans/m7-stream-adapter-plan.md`
- Project rules linked: `.claude/rules/architecture.md`, `.claude/rules/testing.md`,
  `.claude/rules/error-handling.md`, `.claude/rules/parsimony-ladder.md`
