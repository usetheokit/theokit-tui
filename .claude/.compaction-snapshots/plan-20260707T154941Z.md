---
slug: m7-stream-adapter
milestone_id: M7
created_at: 2026-07-07
goal: Ship the M7 stream adapter (structural AgentStreamEvent union designed fresh from the real SDK, pure agentStreamReducer folding both granularities onto the M3 AgentEvent union with tail-replace-by-identity, useAgentStream hook with reset+factory+cancel fixing the mirror's StrictMode gap, reconnect/resume test, compile-time drift tripwire with @theokit/sdk as an import-type-only devDependency, deterministic fake-stream demo) with all gates green and the 6-bench regression re-run recorded.
---

# Plan: M7 Stream adapter + Harness bridge

> **Version 1.0** — Implements `ROADMAP.md § M7` on top of M0-M6: `AgentStreamEvent`
> (structural union designed FRESH from the real `SDKMessage`/`InteractionUpdate`
> tables — the theo-ui mirror's type drifts TODAY, tsc-proven), `agentStreamReducer`
> (pure fold implementing the blueprint's D2 mapping table: fine `text-delta` +
> coarse `assistant` turns onto the M3 `AgentEvent` union via tail-replace-by-identity
> — no sentinel; namespaced monotonic ids so the M3 duplicate-id throw can never
> fire; thinking mapped where the mirror drops it; error → state + non-terminal
> tools → failed, never frozen spinners; drop-deltas-after-done), `useAgentStream`
> (the mirror's 57-line loop + reset action + iterable|factory source + cancel —
> fixing the mirror's unguarded StrictMode double-fold), the reconnect test
> (producer-side exactly-once resuming fake) + reset+refold factory test, the D3
> drift tripwire (whole-union assignability + per-member diagnostics;
> `@theokit/sdk ^2.18.1` devDependency, import-type-only) + a runtime fixture
> contract test, and the deterministic fake-stream demo. No new bench (recorded
> justification + flip condition). All design decisions locked by the
> m7-stream-adapter blueprint (SHIPPABLE 100.0).

## Goal

Enable TypeScript agent-CLI developers to drive `AgentTimeline`/`ToolCallCard`/
`ChatThread` from a live `@theokit/sdk` stream with one hook — pure, reconnect-safe,
zero runtime coupling — measured by the CI gate chain (format → lint → typecheck →
test → coverage → build → bench smoke) exiting 0 on `develop`.

## Context

M0-M6 shipped the full primitive set + theme/robustness foundation. `ROADMAP.md § M7`
requires the SDK↔UI bridge. Risks: (1) structural-type drift — resolved: the drift
EXISTS today (tsc-proven: `SDKStatusMessage.message?: string` breaks whole-union
assignability against the mirror's type; the mirror's `text_delta` is unreachable
from any public SDK surface — the real fine event is `"text-delta"` in the `onDelta`
wrapper) → the type is designed fresh + a compile-time tripwire (Blueprint §"D1"/
§"D3"); (2) reducer complexity — resolved: the mirror's 181-line reducer is the
port base, with every divergence forced by the M3 boundary evidence-backed
(Blueprint §"D2") and the mirror's untested sub-paths closed (its suite covers only
≈10/21 paths). The DISCOVER cycle produced a SHIPPABLE blueprint (100.0) locking
eight ADRs.

## Baseline Context (deep review of current state)

### Files that will be touched

| File | LoC today | Last commit (sha) | Why it exists today | Invariants to preserve |
|---|---|---|---|---|
| `src/agent-stream-event.ts` (NEW) | 0 | — | structural AgentStreamEvent union + guards (pure) | — |
| `src/agent-stream-event.test.ts` (NEW) | 0 | — | guard tests | — |
| `src/agent-stream-reducer.ts` (NEW) | 0 | — | pure fold (the D2 mapping table) | — |
| `src/agent-stream-reducer.test.ts` (NEW) | 0 | — | exhaustive fold table | — |
| `src/use-agent-stream.ts` (NEW) | 0 | — | the hook (loop + reset + factory + cancel) | — |
| `src/use-agent-stream.test.tsx` (NEW) | 0 | — | hook lifecycle tests (probe component) | — |
| `src/use-agent-stream.reconnect.test.tsx` (NEW) | 0 | — | reconnect + refold tests | — |
| `tests/sdk-assignability.test.ts` (NEW) | 0 | — | D3 drift tripwire (type-only) + runtime fixture contract test | — |
| `src/index.ts` | 78 | `3089710` | composition root | existing exports unchanged |
| `tests/export-surface.test.ts` | 140 | `a49f412` | public-entry contract | grows: hook/reducer/state present; internals absent; sdk NOT in dependencies |
| `tests/public-api.integration.test.tsx` | 335 | — | integration scenes | grows: stream→AgentTimeline scene |
| `examples/stream.tsx` (NEW) | 0 | — | deterministic fake-stream demo (TTFATT caller) | — |
| `tests/example-stream.integration.test.ts` (NEW) | 0 | — | subprocess smoke | — |
| `package.json` | 86 | `3be6b79` | manifest | + `@theokit/sdk ^2.18.1` devDependency + `example:stream` script; dependencies/peers UNCHANGED |
| `CHANGELOG.md` | — | — | M6 entries under Unreleased | every task appends |

### Current callers / dependents

- **No existing production symbol is modified.** New symbols gain first callers inside
  this plan: the hook consumes the reducer; the integration scene + example consume
  the hook; `AgentTimeline`/`AgentStreaming` consume the folded state (their existing
  contracts untouched).
- **Symbols consumed (additive):** `AgentEvent`/`AGENT_EVENT_KINDS`
  (`src/agent-event.ts` — the reducer's OUTPUT vocabulary), `AgentTimeline` (renders
  `events`), `AgentStreaming` (renders `streaming`), `TOOL_CALL_STATUSES`
  (`src/tool-call.tsx` — the tool status vocabulary the mapping emits).
- **M3 boundary contracts the reducer MUST satisfy** (they THROW otherwise):
  duplicate event id (`src/agent-timeline.tsx:88-90`), `output`⊕`shell` exclusivity,
  role/status/kind membership; tail-replace-by-identity is the streaming contract
  (`src/agent-event.ts:17` — the id is the "streaming replace anchor").
- **Manifest contract test impact:** `tests/export-surface.test.ts`
  `manifest_declares_only_ink_and_ink_spinner_runtime_deps` asserts the dependencies
  array — UNCHANGED (sdk is a devDependency); a new assert pins `@theokit/sdk` OUT of
  `dependencies`/`peerDependencies`.

### Domain glossary

- **`AgentStreamEvent`** — OUR structural input union (fresh from the real SDK):
  coarse `SDKMessage`-shaped members (`assistant`, `thinking`, `tool_call` with
  `status: string` + `args?/result?: unknown`; `message` widened to
  `string | {content?: ReadonlyArray<{type?, text?}>}` — the tsc-proven fix) + fine
  `onDelta`-vocabulary members under their REAL names (`"text-delta"`,
  `"thinking-delta"`) + OUR synthetics (`"error"`, `"done"` — minted by the hook,
  documented as ours). Unknown types fold to no-op (forward-compat).
- **live message** — the tail `message` event opened by the first `text-delta`,
  REPLACED by identity (same id, new object) per delta, finalized IN PLACE by
  `assistant`/`done` (the M3 anchor contract; the mirror's `__streaming__` sentinel
  does not port — no such kind exists in our union). **Close-on-effectful-fold
  (EC-1):** any effectful NON-message fold (tool append/upsert, thinking graduation)
  finalizes the open live message at its buffer and clears `liveMessageId` — the
  live message is therefore ALWAYS the tail while open (the M3 only-the-tail rule
  holds literally; an open message can never graduate into `<Static>` frozen with
  partial text); the next delta opens `msg-${++seq}` (gemini split-message parity).
  `liveMessageId` clears on finalize/done/error/close-on-tool (EC-5).
- **namespaced ids** — `msg-${seq}` / `think-${seq}` / `tool-${call_id}` /
  `tool-#${seq}` (anonymous — the `#` prefix cannot collide with any producer
  `call_id` literal, EC-9) with monotonic in-state `seq` (never reset while events
  are retained): the M3 duplicate-id throw can never fire, unlike the mirror's
  proven `err-${items.length}` collision.
- **drop-after-terminal** — EVERY event arriving when `status ∈ {"done","error"}`
  is DROPPED (EC-3 — the mirror silently resurrects the stream after done, and the
  same hole existed after error since the reducer is public API; one guard covers
  both — accidental resurrection rejected on all terminal states).
- **reset+refold** — re-attach semantics: a factory source re-invocation folds into
  FRESH state (assistant-ui's rebuild-don't-merge; `Run.stream()` re-call replays
  from index 0 — total overlap makes merging impossible without dedup, and reducer
  dedup would contradict the M3 throw contract).
- **drift tripwire** — `tests/sdk-assignability.test.ts`: whole-union
  `SDKMessage → AgentStreamEvent` assignability (catches new-member field collisions
  — a per-member-only check would never have caught `SDKStatusMessage`) + per-member
  diagnostics + `InteractionUpdate` check; `import type` only (runtime-erased).
- **producer-side exactly-once** — the reconnect contract for `subscribe()`-shaped
  sources: the producer never re-yields folded events (`lastEventId` lives below the
  iterable; it never crosses the hook API — both first-party precedents).

### Architecture boundaries affected

Per `rules/architecture.md § 1-3`: `agent-stream-event.ts` + `agent-stream-reducer.ts`
are PURE (no ink/react — the critical paths; unit-testable in ms);
`use-agent-stream.ts` is the react seam (hooks only — no ink import; it renders
nothing); components stay untouched consumers. ZERO runtime coupling to
`@theokit/sdk` (structural typing; the devDep is reachable only from tests/examples).
No external I/O (the hook consumes a caller-provided AsyncIterable; transport is out
of scope).

## Prior Art & Related Work

- **Internal blueprint:** `knowledge-base/discoveries/blueprints/m7-stream-adapter-blueprint.md` —
  ADRs D1–D8 consumed verbatim (§ ADRs restates condensed); Corners 1–4 carry the evidence.
- **Patterns skills:** (none exist).
- **Reference projects** (key anchors):
  - `knowledge-base/references/theokit-ui/src/hooks/use-agent-stream/agent-stream-reducer.ts:25-180` — the mirror reducer (port base; its sentinel/err-id/frozen-spinner behaviors are evidence-backed rejections).
  - `knowledge-base/references/theokit-ui/src/hooks/use-agent-stream/use-agent-stream.ts:21-54` — the 57-line hook loop (ported verbatim + reset/factory/cancel).
  - `knowledge-base/references/theokit-ui/src/hooks/use-agent-stream/use-agent-stream.reconnect.test.tsx:19-57` — the resuming-fake scenario (ported).
  - `knowledge-base/references/theokit-sdk/packages/sdk/src/types/messages.ts:161-170` — the real `SDKMessage` union (the structural type's source).
  - `knowledge-base/references/theokit-sdk/packages/sdk/src/types/updates.ts:21-24,166-181` — the real fine vocabulary (`"text-delta"` hyphen).
  - `knowledge-base/references/theokit-sdk/packages/sdk/src/internal/agent-loop/tool-dispatch.ts:385-435` — tool_call construction (running/completed; `status:"error"` never constructed — failures = completed + exitCode≠0).
  - `knowledge-base/references/theokit-sdk/packages/sdk/src/internal/runtime/fixtures/fixture-run-base.ts:93-105` — `Run.stream()` total-replay semantics.
  - `knowledge-base/references/theokit-sdk/packages/sdk/src/subscription/theokit-subscribe.ts:53-109` — the real `lastEventId` + SDK-side auto-reconnect.
  - `knowledge-base/references/assistant-ui/packages/assistant-stream/src/resumable/ResumableStreamContext.ts:106-150` — rebuild-don't-merge resume decomposition.
  - `knowledge-base/references/gemini-cli/packages/cli/src/ui/hooks/useGeminiStream.ts:1467-1551` — production consumption loop (sampled).
- **External literature:** none beyond the above.

## Objective

- [ ] `AgentStreamEvent` structural union compiles against the REAL SDK types (whole-union tripwire green) with zero runtime coupling (sdk absent from dependencies/peers; `import type` only)
- [ ] `agentStreamReducer` implements the full D2 mapping table — every discriminator branch + the sub-paths the mirror leaves untested (both § 4.1 lenses) — and its output always satisfies the M3 boundary (no duplicate ids, no output⊕shell, valid kinds/statuses)
- [ ] `useAgentStream` consumes iterable|factory sources with reset-on-(re)start, cancel(), unmount teardown (`iterator.return`), synthetic done/error — StrictMode-shaped remount does NOT double-fold
- [ ] Reconnect/resume covered: the resuming-fake test (drop→resume, exactly-once text) AND the factory reset+refold test
- [ ] Integration: hook state drives `AgentTimeline` through the composition root; deterministic fake-stream demo (`pnpm example:stream`) piped-clean
- [ ] No new bench — justification + flip condition recorded; Final-Phase 6-bench regression re-run (ADVERSE-only rule)
- [ ] All gates green locally and in CI (node 20 + 22); coverage ≥ 90% on `src/**` (critical paths 100% lines)

## Dependencies

> Contract for `/deps-audit`. **Zero new RUNTIME dependencies** (Blueprint Corner 2:
> the mirror's only runtime import is react; no async-iteration helper anywhere —
> verified absence). ONE new devDependency (the drift tripwire + demo).

### Existing — use as-is

| Package | Version | Ecosystem | Why |
|---|---|---|---|
| `ink` | `^5.2.0` | npm | render layer (untouched by the adapter) |
| `react` | `^18.0.0 \|\| ^19.0.0` (peer) | npm | the hook's only runtime import |
| `ink-spinner`, `parse-diff`, `lowlight` (opt peer) | — | npm | unchanged, unused by M7 |

### New — to be introduced

| Package | Version | Ecosystem | Rule 9 rationale (libs evaluated) | Why this one |
|---|---|---|---|---|
| `@theokit/sdk` | `^2.18.1` (devDependency ONLY) | npm | Evaluated: no dep at all (rejected — the drift tripwire is the milestone's #1 risk mitigation and needs the real types); exact pin (rejected — caret + lockfile keeps reproducibility while a deliberate `pnpm update` exercises the tripwire, the sibling's exact precedent); `workspace:*` (unavailable — theokit-tui is a standalone pnpm project, verified) | First-party SDK; `import type` only (runtime-erased); consumed by `tests/sdk-assignability.test.ts` + the optional real-SDK demo variant. Registry v2.18.1 confirmed live |

### Removed

| Package | Last version | Why removed |
|---|---|---|
| (none) | | |

## ADRs

> D1–D8 originate in the blueprint (Blueprint §"ADRs" carries the evidence); restated
> condensed and self-contained. D9 is plan-local.

### D1 — `AgentStreamEvent`: structural union designed FRESH from the real SDK

**Decision:** `src/agent-stream-event.ts` (PURE) declares:

```ts
export interface AgentStreamEvent {
  type: string;                              // discriminator (open — unknown = no-op)
  // fine vocabulary (REAL names — onDelta family):
  text?: string;                             // "text-delta" | "thinking-delta" | coarse "thinking"
  // coarse vocabulary (SDKMessage family):
  message?: string | { content?: ReadonlyArray<{ type?: string; text?: string }> }; // widened — the tsc-proven SDKStatusMessage fix
  call_id?: string;
  name?: string;
  status?: string;                           // tool lifecycle ("running"|"completed"|"error") — but also cloud-status vocab: NEVER switch on status before type
  args?: unknown;
  result?: unknown;                          // {stdout, stderr, exitCode} today — declared unstable; parsed defensively
  // OUR hook synthetics:
  error?: string | { message?: string };     // type: "error" (client-side — no SDK stream carries it)
}
```

`"done"`/`"error"` are OUR synthetics (documented). Type guards exported for the
reducer's narrowing. The mirror's `SdkStreamMessage` is NOT copied (drifts today).

**Rationale:** Q2's compile-verified drift; the DoD's "text_delta" is honored via the
REAL `"text-delta"` + coarse assistant turns (both fold to the same UI state).

**Alternatives considered:** copying the mirror type (rejected: proven drift); runtime
SDK type import (forbidden by the DoD); onDelta-only (rejected: `Run.stream()` is the
primary local surface).

**Consequences:** the tripwire checks the REAL types against this union; an
onDelta→iterable bridge stays demo-side (not adapter API — YAGNI). Documented drops
(EC-11): assistant `tool_use` blocks are NOT folded (tool lifecycle arrives via
`tool_call` events); the fine `tool-call-*` camelCase updates no-op in v0 (an
onDelta-only consumer gets no tool cards — coarse `tool_call` is the lifecycle
surface); both noted in the union's JSDoc.

### D2 — Reducer output IS the M3 contract

**Decision:** `agentStreamReducer(state, event)` pure fold; state:

```ts
export interface AgentStreamState {
  events: AgentEvent[];                      // AgentTimeline's exact input
  streaming: { active: boolean; thought?: string };  // AgentStreaming props source
  status: "idle" | "streaming" | "done" | "error";
  error?: Error;
  seq: number;                               // monotonic id counter (in-state purity — mirror precedent)
  liveMessageId?: string;                    // the tail-replace anchor currently open
}
```

Mapping (the blueprint's D2 table, binding): `text-delta` → open a live tail message
(`msg-${++seq}`) or REPLACE the tail object (same id, text += delta); `assistant` →
finalize the live message IN PLACE (text = extracted content ?? buffer; mint-empty
rule: no event when both empty), else append fresh; `thinking` (coarse) +
`thinking-delta` (fine) → `streaming.thought` + on thinking completion/next
non-thinking event, graduate a `think-${++seq}` timeline event; `tool_call` running → CLOSE any open
live message (EC-1) then append `{kind:"tool", id: tool-${call_id} | tool-#${++seq},
status:"running"}`;
`tool_call` completed/error → upsert by id (new object, same id); result: shell
envelope (`{stdout|stderr|exitCode}` detected structurally) → `shell` passthrough,
else output/text/JSON ladder → `output` — NEVER both; SDK `status:"error"` maps to
`"failed"`; `error` (synthetic) → `status:"error"` + `error: Error` + every
non-terminal tool → `"failed"` (new objects, same ids) + live message finalized at
its buffer; `done` (synthetic) → finalize live message, every
non-terminal tool → `"failed"` (EC-2 — cancel's terminal action rides this branch;
never a frozen spinner), `streaming.active = false`, `status:"done"`; **EVERY event
after a terminal state (`done`/`error`) → DROPPED (EC-3)**; `system`/`user`/`status`
(cloud)/`task`/`request`/`object_delta`/unknown → state unchanged.

**Rationale:** every divergence from the mirror is FORCED by the M3 boundary
(duplicate-id throw, output⊕shell, tail-replace anchor, `<Static>` graduation
immutability) — evidence-backed in the blueprint, none is taste.

**Alternatives considered:** the mirror's sentinel (no such kind in our union);
`err-${length}` ids (proven collision); frozen running tools on error (fail-clear
violation); silent resurrection after done (accidental, untested upstream).

**Consequences:** graduation-stale tool upserts documented as accepted v0 (the 8+4
default window makes completion-after-graduation rare; gemini scrollback has the same
property); ChatThread consumers filter `kind === "message"` app-side.

### D3 — Drift tripwire: compile-time assignability, sdk = import-type-only devDependency

**Decision:** `tests/sdk-assignability.test.ts` with `import type { SDKMessage,
SDKAssistantMessage, SDKThinkingMessage, SDKToolUseMessage, SDKStatusMessage,
InteractionUpdate } from "@theokit/sdk"` (public barrel — verified): ONE whole-union
check (`const _all: AgentStreamEvent = {} as SDKMessage`) + per-member diagnostic
checks + `InteractionUpdate` fine-vocabulary check + ONE runtime contract test
folding a canonical fixture-shaped event script through the reducer (covers the
value-level drift types can't catch). `@theokit/sdk: "^2.18.1"` devDependency.

**Rationale:** risk #1 is ALREADY real; whole-union catches new members (per-member
alone would never have caught `SDKStatusMessage`); `import type` is runtime-erased.

**Alternatives considered:** exact pin (rejected — see Dependencies); no tripwire
(rejected: risk #1); runtime import (forbidden).

**Consequences:** manifest gains one devDep; export-surface pins sdk OUT of
dependencies/peers.

### D4 — Hook: the mirror's loop + reset + `iterable | factory` + cancel

**Decision:** `useAgentStream(source?: AgentStreamSource) → { events, streaming,
status, error, cancel }` where `AgentStreamSource = AsyncIterable<AgentStreamEvent> |
(() => AsyncIterable<AgentStreamEvent>)`. The hook's `useReducer` uses an INTERNAL
WRAPPER reducer `(state, action: AgentStreamEvent | {type:"__reset__"}) → state`
handling `__reset__` itself and delegating everything else to the PUBLIC
`agentStreamReducer` — the public reducer/union never see the reset action (EC-4:
routed through the public reducer it would NO-OP under the unknown→no-op contract,
silently killing the restart fix; its absence from the public surface is pinned).
Effect on `[source]`: dispatch `__reset__` →
resolve factory → manual iterator loop (`cancelled` flag checked after EVERY await) →
dispatch each event → synthetic `done` on completion / `error` on throw (skipped if
cancelled) → cleanup `cancelled = true; iterator.return?.()`. `cancel()` = same
teardown + a terminal `done`-shaped action (post-cancel events suppressed by the
flag). `undefined` source = idle. No AbortController (iterator-protocol teardown;
transport out of scope). `lastEventId` does NOT cross the hook API.

**Rationale:** smallest correct pattern (test-proven upstream). The reset is PROVEN
by the factory-restart test; StrictMode safety is proven by a REAL `<StrictMode>`
wrapper test (EC-6 — a manual unmount+mount creates a fresh useReducer instance and
passes trivially; the honest test double-invokes effects on one mounted instance).
SOURCE IDENTITY IS THE RESTART KEY (EC-7): an inline-arrow factory creates a new
identity every render → cleanup+reset+restart per folded event → restart livelock;
the source-param JSDoc mandates hoisting/memoizing the factory.

**Alternatives considered:** AbortController (producer-side concern); surfacing
lastEventId (no precedent; transport-specific).

**Consequences:** remount/factory-restart/cancel/unmount each get dedicated tests.

### D5 — Reconnect: reset+refold for re-attach; producer-side exactly-once; reducer replay-intolerant

**Decision:** Two pinned scenarios: (1) the resuming fake (drop after 2, resume from
lastEventId+1, no replay) → folded text exactly `"abcde"` — the `subscribe()`-shaped
producer-side exactly-once contract; (2) factory re-invocation (simulating
`Run.stream()` re-attach = total replay) → reset + refold from scratch → final state
identical, no duplicate ids. NO reducer-level dedup (contradicts the M3 throw + both
analog decompositions). The replay-free input contract is documented on the source
parameter.

**Rationale:** three analogs, one coherent rule — dedup lives below the iterable or
state is rebuilt; never merged in the fold.

**Alternatives considered:** fold-idempotent reducer (rejected: contradicts M3; no
analog does it).

**Consequences:** the DoD's reconnect requirement is proven at the iterable surface.

### D6 — Test strategy (Corner 1)

**Decision:** (1) reducer `fold` table — every discriminator branch + the mirror's
untested sub-paths (drop-after-done, error-object form, empty-buffer done,
never-started completion, missing call_id, error-mid-tool→failed, thinking both
targets, id uniqueness under interleaving, shell-vs-output ladder, boundary
compatibility: fold outputs pass `AgentTimeline` validation); (2) timer-free fakes:
pull generators + deferred-promise controllable stream (the mirror's 5ms setInterval
rebuilt); (3) hook tests via a probe component + bounded 0ms ticks (no waitFor):
unmount-cancels-iterator, StrictMode-shaped remount (no double-fold), factory
restart, cancel, undefined-source idle, error surface; (4) the two D5 reconnect
scenarios; (5) ONE integration test: hook → `AgentTimeline` + `AgentStreaming`
through the composition root + composed scene snapshot (anchored — ≤ 2 new snapshots
budget); (6) the D3 tripwire + runtime fixture contract test; (7) example smoke
(subprocess, dual timeouts, minimal env — house rules).

**Rationale:** Corner 1 evidence + our harness discipline; closes every mirror gap.

**Alternatives considered:** waitFor-style polling (no such API here; violates
determinism).

**Consequences:** ~35 new tests; spawn budget +1 (example smoke) → suite total 12.

### D7 — Evidence: no new bench (justification + flip condition recorded)

**Decision:** Per Corner 3 — the M3 bench already replays the adapter's exact output
shape (tail identity-replace + append per step); reducer cost is O(items) sub-frame
folding whose in-loop delta lands in the INCONCLUSIVE band. Evidence triple: the
exhaustive reducer table + the deterministic demo + the Final-Phase 6-bench
regression re-run (ADVERSE-only rule). Flip condition: super-linear folding or
render-path computation → adapter-in-the-loop A/B mode on the M3 workload.

**Rationale:** M6 D7 precedent; noise-as-signal is forbidden (analysis-golden-rule §3).

**Alternatives considered:** adapter-in-the-loop bench NOW (rejected: no falsifiable
claim at the current shape — the delta lands in the INCONCLUSIVE band); a reducer
micro-bench (rejected: string-concat theatre — decided by TDD tables, not timers).

**Consequences:** implementation log carries justification + the re-run table.

### D8 — Public surface

**Decision:** Entry exports `useAgentStream`, `agentStreamReducer`,
`initialAgentStreamState` + types (`AgentStreamEvent`, `AgentStreamState`,
`AgentStreamStatus`, `AgentStreamSource`). Internals (id generators, guards'
helpers, the fold sub-functions) stay module-local, absence-pinned.

**Rationale:** the DoD names the reducer as a deliverable; the mirror exports both
(`references/theokit-ui/src/index.ts`); a public reducer lets non-React consumers
fold without the hook.

**Alternatives considered:** hook-only (rejected: DoD + mirror precedent).

**Consequences:** export-surface grows presence + absence pins.

### D9 — Thinking graduation rule (plan-local pin)

**Decision:** thinking text accumulates in `streaming.thought` while thinking events
arrive; the accumulated thought GRADUATES into ONE `{kind:"thinking",
id: think-${++seq}, text}` timeline event at the first EFFECTFUL non-thinking fold
(message/tool/done/error) after thinking content exists — pure no-op folds
(`task`/`system`/`thinking-completed`/unknown) NEVER trigger graduation (EC-10) —
then `streaming.thought` clears. Coarse `thinking` (one replayed event) and fine
`thinking-delta` accumulate identically.

**Rationale:** the blueprint mandates the two-target mapping but leaves the
graduation trigger open; folding it at the thinking→other transition matches the
SDK's real ordering (thinking replayed immediately before the assistant turn —
`loop-llm-stream.ts:249-253`) and keeps the timeline append-ordered.

**Alternatives considered:** graduating per thinking event (rejected: coarse replay
would emit duplicates of the same reasoning); never graduating (rejected: the M3
thinking kind exists precisely for the timeline record).

**Consequences:** one clear TDD row pins the transition; `AgentStreaming` shows the
live thought, `AgentTimeline` keeps the record.

## Drawbacks & Risks

| Drawback / Risk | Severity | Mitigation | Owner |
|---|---|---|---|
| Value-level SDK drift (event names that never arrive) is invisible to the type tripwire | Medium | The runtime fixture contract test folds a canonical event script; the demo's optional real-SDK variant is the manual end-to-end check | implement |
| Graduation-stale tool upsert (tool completes after leaving the 8+4 live window) renders a frozen running glyph in scrollback | Medium | Documented accepted-v0 (gemini scrollback parity); windowSize default makes it rare; flip to pin-in-tail only on real demand | implement |
| The structural union's `status?: string` spans three SDK vocabularies (tool/cloud/task) | Low | The reducer NEVER switches on `status` before `type` (pinned by a cloud-status no-op test) | implement |
| `^2.18.1` devDep drift on lockfile refresh breaks the tripwire "unexpectedly" | Low | That IS the feature (documented); the failure is a compile error naming the offending member | implement |
| Hook consumes a caller iterable — a producer that throws synchronously on `[Symbol.asyncIterator]()` escapes the loop's try/catch | Low | The factory/iterator acquisition is wrapped in the same try → synthetic error path (pinned by a negative test) | implement |
| StrictMode remount with an INSTANCE source (single-shot generator) still loses the stream (closed generator → instant done) | Low | Inherent to single-shot iterables; documented on the source param (use the factory form); the reset action at least guarantees clean state, and a dedicated test pins the documented behavior | implement |
| Inline-arrow factory = new source identity per render → cleanup+reset+restart per folded event (restart livelock — EC-7) | Medium | Source-param JSDoc mandates hoisting/memoizing the factory (`useCallback`/module scope) — the M6 hoist-note precedent; the factory-restart test pins the restart semantics so the failure mode is at least legible | implement |

## Unresolved Questions

(none — every decision is resolved at plan time by blueprint ADRs D1–D8 + plan D9.)

## Critical paths

For `/code-quality` D4 when enabled: `src/agent-stream-reducer.ts` (the mapping
fold), `src/agent-stream-event.ts` (guards).

## Dependency Graph

```
Phase 1 (event union + reducer) ──▶ Phase 2 (hook + reconnect) ──▶ Phase 3 (tripwire + integration + example)
                                                                        │
                                                                        ▼
                                                              Final Phase (integration validation + 6-bench re-run)
```

Sequential — one vertical slice.

---

## Phase 1: Pure core

**Objective:** The structural union and the full mapping fold — every downstream
piece consumes these.

### T1.1 — agent-stream-event.ts: structural union + guards

#### Objective
The `AgentStreamEvent` union per D1 + narrowing guards the reducer consumes.

#### Why this step (action + reasoning)

1. **What:** RED — guard tests (shell-envelope detection, content-text extraction,
   fine/coarse discrimination) then the pure module.
2. **Why now:** The reducer's input vocabulary; pure tests are the fastest loop.

#### Evidence
- Real union: `knowledge-base/references/theokit-sdk/packages/sdk/src/types/messages.ts:161-170`; fine vocabulary `knowledge-base/references/theokit-sdk/packages/sdk/src/types/updates.ts:21-24`.
- Widened message fix: blueprint Corner 4 § Q2 (tsc-verified).

#### Files to edit
```
src/agent-stream-event.test.ts — (NEW) RED suite
src/agent-stream-event.ts      — (NEW) union + guards
CHANGELOG.md                   — Added entry
```

#### Deep Dives
- Guards: `isShellEnvelope(result): result is {stdout?, stderr?, exitCode?}`
  (structural: object with at least one of the three keys; stdout/stderr must be
  STRINGS when present and exitCode a number when present — EC-12: `{stdout: 42}`
  would flow unvalidated into ToolResult and misrender at depth); `extractAssistantText(message)`: string → itself; object →
  content-array text blocks concatenated (`type === "text"` or text present);
  undefined/garbage → "".
- The union is intentionally OPEN (`type: string`) — unknown kinds are data, not
  errors (forward-compat, mirror + our M3 EC-12 precedent).

#### Tasks
1. RED (6 tests below)
2. GREEN module
3. CHANGELOG

#### TDD
```
RED:     shell_envelope_detected_structurally() — const yes = isShellEnvelope({ stdout: "a", stderr: "", exitCode: 0 }); expect(yes).toBe(true); const partial = isShellEnvelope({ stdout: "x" }); expect(partial).toBe(true)
RED:     non_envelope_results_rejected() — for bad of [null, "text", 42, {}, { random: 1 }, { exitCode: "0" }, { stdout: 42 }, { stderr: {} }]: const out = isShellEnvelope(bad); expect(out).toBe(false) (EC-12 — string-when-present)
RED:     assistant_text_extracted_from_content_blocks() — const text = extractAssistantText({ content: [{ type: "text", text: "a" }, { type: "tool_use" }, { type: "text", text: "b" }] }); expect(text).toBe("ab")
RED:     assistant_text_from_string_message() — const text = extractAssistantText("plain"); expect(text).toBe("plain") (the SDKStatusMessage-widened arm)
RED:     assistant_text_empty_on_garbage() — for bad of [undefined, null, {}, { content: "x" }, { content: [{}] }]: const out = extractAssistantText(bad); expect(out).toBe("")
RED:     union_accepts_both_vocabularies_at_type_level() — type-level: const fine: AgentStreamEvent = { type: "text-delta", text: "x" }; const coarse: AgentStreamEvent = { type: "tool_call", call_id: "1", name: "t", status: "running" }; expect(fine.type).toBe("text-delta"); expect(coarse.call_id).toBe("1")
GREEN:   Implement agent-stream-event.ts until all pass
REFACTOR: Keep pure; guards single-purpose
VERIFY:  pnpm vitest run src/agent-stream-event.test.ts
```

#### Concurrency tests

(none — single-threaded)

#### Acceptance Criteria
- [ ] `pnpm vitest run src/agent-stream-event.test.ts` exits 0 (6 tests)
- [ ] `pnpm typecheck` + `pnpm lint` exit 0
- [ ] CHANGELOG updated — `grep -q "AgentStreamEvent" CHANGELOG.md` exits 0

#### DoD (Definition of Done)
- [ ] `pnpm gates` exits 0

### T1.2 — agent-stream-reducer.ts: the D2 mapping fold

#### Objective
The pure reducer implementing the FULL mapping table + D9 thinking graduation.

#### Why this step (action + reasoning)

1. **What:** RED — the exhaustive fold table (every discriminator branch, every
   divergence, every mirror-untested sub-path, M3-boundary compatibility) then the
   fold.
2. **Why now:** The milestone's core deliverable; everything else wires it.

#### Evidence
- Port base: `knowledge-base/references/theokit-ui/src/hooks/use-agent-stream/agent-stream-reducer.ts:25-180`.
- Divergence forcings: `src/agent-event.ts:17,46-50` (anchor + tail-replace), `src/agent-timeline.tsx:88-90` (dup throw).

#### Files to edit
```
src/agent-stream-reducer.test.ts — (NEW) RED fold table
src/agent-stream-reducer.ts      — (NEW) reducer + initial state
CHANGELOG.md                     — Added entry
```

#### Deep Dives
- `fold(...events)` test helper (mirror idiom).
- Live-message lifecycle: `liveMessageId` in state; text-delta with no live id →
  open `msg-${++seq}` role assistant; with live id → map events replacing the SAME id
  object at its position (it is always the tail while live — asserted).
- Thinking (D9): accumulate `streaming.thought`; graduate ONE think event at the
  first non-thinking fold (or done/error); coarse `thinking` = one accumulation step.
- Tool result ladder: `isShellEnvelope(result)` → `shell` (undefined-safe subset:
  stdout/stderr default "", exitCode default 0? NO — pass through only defined keys;
  our ToolResult validates); else `output` = string result | result.output |
  result.text | JSON.stringify (mirror ladder).
- After-done: EVERY event type except nothing folds — `status === "done"` → state
  returned unchanged (one guard at the top).
- M3-boundary compatibility oracle: a helper test renders `AgentTimeline` with folded
  events (direct invocation) asserting NO throw for every table scenario's final
  state.

#### Tasks
1. RED (20 tests below)
2. GREEN reducer
3. CHANGELOG

#### TDD
```
RED:     initial_state_is_idle_and_empty() — const s = initialAgentStreamState; expect(s.status).toBe("idle"); expect(s.events).toEqual([]); expect(s.streaming.active).toBe(false); expect(s.seq).toBe(0)
RED:     text_delta_opens_live_tail_message() — const s = fold({ type: "text-delta", text: "he" }); expect(s.events).toHaveLength(1); expect(s.events[0]).toMatchObject({ kind: "message", role: "assistant", text: "he", id: "msg-1" }); expect(s.status).toBe("streaming")
RED:     text_delta_replaces_tail_by_identity() — const s = fold(delta("he"), delta("llo")); expect(s.events).toHaveLength(1); expect(s.events[0]).toMatchObject({ id: "msg-1", text: "hello" }) (same id — the M3 streaming anchor; new object each fold)
RED:     assistant_finalizes_live_message_in_place() — const s = fold(delta("hi"), { type: "assistant", message: { content: [{ type: "text", text: "hi there" }] } }); expect(s.events).toHaveLength(1); expect(s.events[0]).toMatchObject({ id: "msg-1", text: "hi there" }); expect(s.status).toBe("streaming") (status stays streaming — mirror parity)
RED:     assistant_without_live_message_appends_fresh() — const s = fold(assistantMsg("solo")); expect(s.events[0]).toMatchObject({ id: "msg-1", text: "solo" })
RED:     assistant_empty_text_falls_back_to_buffer_then_mints_nothing() — const s1 = fold(delta("buf"), { type: "assistant", message: { content: [] } }); expect(s1.events[0]).toMatchObject({ text: "buf" }); const s2 = fold({ type: "assistant", message: { content: [] } }); expect(s2.events).toHaveLength(0); const s3 = fold({ type: "assistant", message: { content: [{ type: "tool_use" }] } }); expect(s3.events).toHaveLength(0) (mint-empty rule; tool_use-only assistants mint nothing — lifecycle comes from tool_call events, EC-11)
RED:     thinking_accumulates_in_streaming_thought() — const s = fold({ type: "thinking-delta", text: "pond" }, { type: "thinking-delta", text: "ering" }); expect(s.streaming.thought).toBe("pondering"); expect(s.events).toHaveLength(0)
RED:     thinking_graduates_once_on_transition() — const s = fold(thinkDelta("plan"), delta("hi")); expect(s.events[0]).toMatchObject({ kind: "thinking", id: "think-1", text: "plan" }); expect(s.events[1]).toMatchObject({ kind: "message" }); expect(s.streaming.thought).toBeUndefined() (D9 — one event, thought cleared)
RED:     coarse_thinking_event_folds_like_accumulation() — const s = fold({ type: "thinking", text: "replayed" }, doneEvt()); expect(s.events[0]).toMatchObject({ kind: "thinking", text: "replayed" })
RED:     tool_running_appends_namespaced_id() — const s = fold(toolRunning("c1", "build")); expect(s.events[0]).toMatchObject({ kind: "tool", id: "tool-c1", name: "build", status: "running" })
RED:     tool_fold_closes_open_live_message() — const s = fold(delta("he"), toolRunning("c1", "t"), delta("llo")); expect(s.events.map((e) => e.id)).toEqual(["msg-1", "tool-c1", "msg-2"]); expect(s.events[0]).toMatchObject({ text: "he" }); expect(s.events[2]).toMatchObject({ text: "llo" }) (EC-1 close-on-effectful-fold — the live message is ALWAYS the tail while open)
RED:     tool_completed_upserts_same_slot_with_shell_passthrough() — const s = fold(delta("x"), toolRunning("c1", "sh"), toolCompleted("c1", { stdout: "ok", stderr: "", exitCode: 0 })); const tool = s.events.find((e) => e.id === "tool-c1"); expect(tool).toMatchObject({ status: "success", shell: { stdout: "ok", exitCode: 0 } }); expect(tool).not.toHaveProperty("output") (never both — M3 throw; msg-1 was CLOSED at "x" by the tool fold per EC-1)
RED:     tool_nonzero_exit_still_success_status_completed() — folds completed + exitCode 2; expect status "success" AND shell.exitCode 2 (the SDK never constructs status:"error" — failures ARE completed+exitCode; the exit badge renders the failure)
RED:     tool_sdk_error_status_maps_to_failed() — fold(toolRunning("c1", "t"), toolEvt("c1", "error")); expect(find("tool-c1")).toMatchObject({ status: "failed" }) (declared member honored even if unconstructed today)
RED:     tool_missing_call_id_gets_anon_namespaced_id() — const s = fold(toolRunningNoId(), toolRunningNoId()); expect(s.events).toHaveLength(2); expect(new Set(s.events.map((e) => e.id)).size).toBe(2); expect(s.events[0]!.id).toMatch(/^tool-#/) (never the mirror's shared "tool" collapse; the # prefix cannot collide with a producer call_id "anon-N" — EC-9)
RED:     tool_completion_for_unknown_id_appends_terminal() — const s = fold(toolCompleted("ghost", { stdout: "", stderr: "", exitCode: 0 })); expect(s.events[0]).toMatchObject({ id: "tool-ghost", status: "success" }) (mirror parity — no throw, no running phase)
RED:     non_shell_result_uses_output_ladder() — completed with result "plain" → output "plain"; with { text: "t" } → "t"; with { weird: 1 } → JSON string; expect(tool).not.toHaveProperty("shell")
RED:     error_fails_open_tools_and_closes_live_message() — const s = fold(delta("partial"), toolRunning("c1", "t"), { type: "error", error: { message: "boom" } }); expect(s.status).toBe("error"); expect(s.error?.message).toBe("boom"); expect(find("tool-c1")).toMatchObject({ status: "failed" }); expect(find("msg-1")).toMatchObject({ text: "partial" }); expect(s.streaming.active).toBe(false) (EC-6 — never the mirror's frozen spinner / lost text)
RED:     error_string_form_and_fallback_message() — fold(errEvt("plain")) → error.message "plain"; fold({ type: "error" }) → a non-empty fallback message
RED:     done_finalizes_and_drops_later_events() — const s = fold(delta("hi"), doneEvt(), delta("ZOMBIE"), toolRunning("z", "t")); expect(s.status).toBe("done"); expect(s.events).toHaveLength(1); expect(s.events[0]).toMatchObject({ text: "hi" }) (drop-after-terminal — the mirror's resurrection rejected)
RED:     done_fails_non_terminal_tools() — const s = fold(toolRunning("c1", "t"), doneEvt()); expect(s.events[0]).toMatchObject({ id: "tool-c1", status: "failed" }) (EC-2 — cancel's terminal action rides this branch; never a frozen spinner)
RED:     error_state_drops_later_events() — const s = fold(errEvt("boom"), delta("ZOMBIE"), toolRunning("z", "t")); expect(s.status).toBe("error"); expect(s.events).toHaveLength(0) (EC-3 — terminal means terminal for the PUBLIC reducer too)
RED:     second_delta_run_opens_fresh_message() — const s = fold(delta("a"), assistantMsg("a"), delta("b")); expect(s.events).toHaveLength(2); expect(s.events[1]).toMatchObject({ id: "msg-2", text: "b" }); expect(s.events[0]).toMatchObject({ id: "msg-1", text: "a" }) (EC-5 — liveMessageId cleared on finalize; msg-1 never resurrected)
RED:     unknown_and_ignored_kinds_are_noops() — const s = fold({ type: "system" }, { type: "user" }, { type: "status", status: "RUNNING", message: "cloud" }, { type: "task", text: "not thinking" }, { type: "thinking-completed" }, { type: "wat" }); expect(s).toEqual({ ...initialAgentStreamState }) (cloud status NEVER folds as tool status; a task.text NEVER folds as thinking — EC-10)
RED:     folded_state_always_passes_the_m3_boundary() — for each scenario above: AgentTimeline({ events: finalState.events }) does not throw (direct invocation — unique ids, valid kinds/statuses, output⊕shell)
GREEN:   Implement agent-stream-reducer.ts until all pass
REFACTOR: Extract per-branch helpers; complexity <= 10 per function
VERIFY:  pnpm vitest run src/agent-stream-reducer.test.ts
```

#### Concurrency tests

(none — single-threaded)

#### Acceptance Criteria
- [ ] `pnpm vitest run src/agent-stream-reducer.test.ts` exits 0 (20 tests)
- [ ] Pass: quality — `pnpm lint` exits 0; `wc -l src/agent-stream-reducer.ts` <= 500
- [ ] CHANGELOG updated

#### DoD (Definition of Done)
- [ ] `pnpm gates` exits 0

---

## Phase 2: The hook

**Objective:** `useAgentStream` with the mirror's loop + our fixes, fully
lifecycle-tested.

### T2.1 — use-agent-stream.ts: loop + reset + factory + cancel

#### Objective
The hook per D4; probe-component tests for every lifecycle path.

#### Why this step (action + reasoning)

1. **What:** RED — probe-component tests (fold-through, unmount teardown, remount
   no-double-fold, factory restart, cancel, undefined idle, sync-throw source,
   error surface) then the hook.
2. **Why now:** The react seam; reconnect (T2.2) builds on it.

#### Evidence
- Loop: `knowledge-base/references/theokit-ui/src/hooks/use-agent-stream/use-agent-stream.ts:21-54`.
- StrictMode gap analysis: blueprint Corner 4 § Q3.

#### Files to edit
```
src/use-agent-stream.test.tsx — (NEW) RED suite (probe component + timer-free fakes)
src/use-agent-stream.ts       — (NEW) the hook
CHANGELOG.md                  — Added entry
```

#### Deep Dives
- Probe: an Ink component calling the hook and reporting state via a captured ref +
  minimal `<Text>` (frame assertions secondary; state assertions primary).
- Fakes: `finiteStream(events)` pull generator; `deferredStream()` — `next()` blocks
  on a promise the TEST resolves (and `return()` resolves) — zero timers (the
  mirror's 5ms interval rebuilt).
- Effect body: `let cancelled = false; dispatch({type:"__reset__"})` (handled by
  the hook's INTERNAL wrapper reducer — never part of the public union, EC-4) →
  resolve factory (inside try — sync-throw becomes the error path) → loop; cleanup
  sets flag + `iterator.return?.()`.
- Source-param JSDoc: hoist/memoize factories — inline arrows restart the stream
  every render (EC-7).
- `cancel()`: stable callback flipping the same flag + `return()` + dispatching done.

#### Tasks
1. RED (8 tests below)
2. GREEN hook
3. CHANGELOG

#### TDD
```
RED:     hook_folds_finite_stream_to_done() — probe with finiteStream([delta("a"), delta("b"), doneless…]) exhausted; after bounded ticks: state.status === "done"; state.events[0].text === "ab" (synthetic done on completion)
RED:     hook_undefined_source_stays_idle() — probe without source; state.status === "idle"; state.events length 0
RED:     unmount_returns_iterator_and_stops_folding() — deferredStream; mount probe; unmount; const returned = fake.wasReturned(); expect(returned).toBe(true); resolve pending next AFTER unmount; state snapshot unchanged (no setState-after-unmount — console.error spy clean)
RED:     strict_mode_multi_shot_folds_once() — render(<StrictMode><Probe source={multiShotIterable}/></StrictMode>); bounded ticks; final text === "ab" NOT "abab"; console.error spy clean (EC-6 — real double-invoked effects on ONE mounted instance; the reset + cancelled-flag make run-1's aborted iteration invisible)
RED:     strict_mode_single_shot_instance_documented_behavior() — render(<StrictMode><Probe source={singleShotGenerator}/></StrictMode>); the closed-generator remount yields clean done/idle state, never corruption (pins the documented Drawback)
RED:     factory_restart_resets_state() — factory returning fresh finiteStream each call; rerender with a NEW factory identity; state refolds from scratch; events length stable, ids unchanged (msg-1 again — fresh seq)
RED:     cancel_stops_consumption_and_marks_done() — deferredStream; call state.cancel(); expect(fake.wasReturned()).toBe(true); status "done"; later resolves are dropped
RED:     stream_throw_surfaces_error_status() — generator throwing after one delta; status "error"; error.message pinned; events keep the pre-error fold
RED:     sync_throwing_source_becomes_error_state() — factory that throws synchronously; status "error" (never an unhandled rejection — the Drawbacks negative)
GREEN:   Implement use-agent-stream.ts until all pass
REFACTOR: Keep the loop one function; complexity <= 10
VERIFY:  pnpm vitest run src/use-agent-stream.test.tsx
```

#### Concurrency tests

(none — single-threaded) — the loop is sequential awaited iteration; the cancelled
flag after every await is the async-safety mechanism, pinned by the unmount/cancel
tests above.

#### Acceptance Criteria
- [ ] `pnpm vitest run src/use-agent-stream.test.tsx` exits 0 (8 tests)
- [ ] Pass: quality — `pnpm lint` exits 0; `wc -l src/use-agent-stream.ts` <= 500

#### DoD (Definition of Done)
- [ ] `pnpm gates` exits 0

### T2.2 — Reconnect + refold tests

#### Objective
The DoD's reconnect requirement: both D5 scenarios pinned.

#### Why this step (action + reasoning)

1. **What:** RED — the resuming-fake test (ported from the mirror, timer-free) + the
   factory reset+refold test (the Run.stream() total-replay shape); GREEN should be
   zero-or-minimal code (the D4/D5 design already covers it — these tests PROVE it).
2. **Why now:** DoD line 3; validates the D5 contract end-to-end.

#### Evidence
- Scenario: `knowledge-base/references/theokit-ui/src/hooks/use-agent-stream/use-agent-stream.reconnect.test.tsx:19-57`.
- Total-replay fact: `knowledge-base/references/theokit-sdk/packages/sdk/src/internal/runtime/fixtures/fixture-run-base.ts:93-105`.

#### Files to edit
```
src/use-agent-stream.reconnect.test.tsx — (NEW) both scenarios
CHANGELOG.md — entry (grouped with T2.1)
```

#### Deep Dives
- `resumingStream(deltas, dropAfter)`: internal lastEventId, drop WITHOUT advancing,
  resume from lastEventId+1 — one continuous iterable (producer-side exactly-once).
- Refold: factory whose stream REPLAYS everything (index 0); new factory identity on
  "re-attach"; assert final state identical to a single clean fold + zero duplicate
  ids (the M3 boundary oracle re-used).

#### Tasks
1. RED (2 tests below)
2. GREEN (design-proving; minimal code)
3. CHANGELOG

#### TDD
```
RED:     reconnect_resumes_exactly_once() — resumingStream(["a","b","c","d","e"], 2) through the hook; bounded ticks to done; const text = finalMessageText(state); expect(text).toBe("abcde") (no dup of a,b; no loss of c,d,e — the mirror's oracle, timer-free)
RED:     reattach_with_replaying_factory_refolds_fresh() — factory v1 folds ["a","b"] then drops (throw); factory v2 (new identity) replays ALL of ["a","b","c"]; final text === "abc"; ids unique; AgentTimeline direct invocation does not throw (reset+refold — total-replay re-attach)
GREEN:   (expected: no adapter changes — the tests prove D4/D5)
REFACTOR: None expected
VERIFY:  pnpm vitest run src/use-agent-stream.reconnect.test.tsx
```

#### Concurrency tests

(none — single-threaded)

#### Acceptance Criteria
- [ ] `pnpm vitest run src/use-agent-stream.reconnect.test.tsx` exits 0 (2 tests)
- [ ] ZERO snapshot changes — `git status --porcelain -- '**/__snapshots__/**'` outputs nothing

#### DoD (Definition of Done)
- [ ] `pnpm gates` exits 0

---

## Phase 3: Tripwire + integration + example

**Objective:** Drift-proofing, wiring closure, evidence artifacts.

### T3.1 — Drift tripwire + runtime contract test + sdk devDependency

#### Objective
`tests/sdk-assignability.test.ts` per D3; `@theokit/sdk ^2.18.1` devDep; manifest
pins.

#### Why this step (action + reasoning)

1. **What:** RED — the runtime fixture contract test (folding a canonical
   SDK-shaped script — fails until the union/reducer accept the real shapes...
   expected GREEN if Phase 1 was faithful; the COMPILE-time checks are the real
   gate) + manifest pins; then `pnpm add -D @theokit/sdk` + the type checks.
2. **Why now:** Risk #1 mitigation; needs the finished union.

#### Evidence
- Barrel exports: `knowledge-base/references/theokit-sdk/packages/sdk/src/index.ts:207`, `knowledge-base/references/theokit-sdk/packages/sdk/src/types/index.ts:16`.
- tsc experiment: blueprint Corner 4 § Q2 (whole-union failure isolated to SDKStatusMessage).

#### Files to edit
```
tests/sdk-assignability.test.ts — (NEW) type checks + runtime fixture contract test
tests/export-surface.test.ts    — extend: sdk NOT in dependencies/peers; adapter exports present; internals absent
package.json                    — + @theokit/sdk ^2.18.1 devDependency
CHANGELOG.md                    — Added entry
```

#### Deep Dives
- Type block: `import type { SDKMessage, SDKAssistantMessage, SDKThinkingMessage,
  SDKToolUseMessage, SDKStatusMessage, InteractionUpdate } from "@theokit/sdk"`;
  const-assignment checks (whole union + members + InteractionUpdate); a `_typecheck
  only` comment explains the tripwire contract (failures are compile errors naming
  the member).
- Runtime contract test: a canonical script (system → user → thinking → assistant
  with tool_use → tool_call running → tool_call completed w/ shell result → done)
  shaped EXACTLY like the SDK builders construct them (agent_id/run_id present) —
  folded through the reducer; asserts the final state (message text, tool success,
  thinking event) + the M3 boundary oracle.
- Export-surface: dependencies STILL `["ink","ink-spinner","parse-diff"]`; peers
  unchanged; devDependencies gains the sdk (asserted present in devDependencies AND
  absent from the other two).

#### Tasks
1. RED (3 tests below) + `pnpm add -D @theokit/sdk@^2.18.1`
2. GREEN (type checks compile; contract test folds)
3. CHANGELOG

#### TDD
```
RED:     sdk_types_assignable_to_structural_union() — type-only: const _all: AgentStreamEvent = {} as SDKMessage; const _a: AgentStreamEvent = {} as SDKAssistantMessage; const _t: AgentStreamEvent = {} as SDKThinkingMessage; const _tc: AgentStreamEvent = {} as SDKToolUseMessage; const _st: AgentStreamEvent = {} as SDKStatusMessage; const _u: AgentStreamEvent = {} as InteractionUpdate; expect(true).toBe(true) (the assertion is the COMPILE — a drift fails typecheck naming the member)
RED:     canonical_sdk_script_folds_to_expected_state() — the fixture-shaped script folded via reduce; expect(final.status).toBe("done"); expect message text; expect(find("tool-…")).toMatchObject({ status: "success", shell: { exitCode: 0 } }); AgentTimeline direct invocation does not throw
RED:     manifest_keeps_sdk_out_of_runtime_graph() — read package.json; expect(Object.keys(pkg.dependencies).sort()).toEqual(["ink","ink-spinner","parse-diff"]); expect(pkg.peerDependencies).not.toHaveProperty("@theokit/sdk"); expect(pkg.devDependencies["@theokit/sdk"]).toMatch(/^\^2\./)
GREEN:   Add devDep; write the checks
REFACTOR: None expected
VERIFY:  pnpm vitest run tests/sdk-assignability.test.ts tests/export-surface.test.ts && pnpm typecheck
```

#### Concurrency tests

(none — single-threaded)

#### Acceptance Criteria
- [ ] Suites exit 0; `pnpm typecheck` exits 0 (the tripwire IS a typecheck gate)
- [ ] `pnpm audit` exits 0 after the devDep (no new HIGH/CRITICAL)

#### DoD (Definition of Done)
- [ ] `pnpm gates` exits 0

### T3.2 — Integration scene + entry exports + example + smoke

#### Objective
Hook → `AgentTimeline`/`AgentStreaming` through the composition root; the
deterministic demo; public surface closed.

#### Why this step (action + reasoning)

1. **What:** RED — integration test (composition-root imports; scripted stream →
   rendered timeline frames) + composed snapshot (anchored) + export pins + example
   smoke; then the wiring + `examples/stream.tsx`.
2. **Why now:** Wiring pillars (a)+(b); DoD line 1 end-to-end.

#### Evidence
- Example conventions: `examples/agent.tsx` (scripted reveal; static final scene piped) + house smoke shape.

#### Files to edit
```
tests/public-api.integration.test.tsx — extend: stream scene via src/index.js
src/index.ts — export hook/reducer/state/types (D8)
tests/export-surface.test.ts — extend: presence pins
examples/stream.tsx — (NEW) deterministic fake-stream demo
tests/example-stream.integration.test.ts — (NEW) subprocess smoke (dual timeouts, minimal env)
package.json — "example:stream" script
CHANGELOG.md — Added entry
```

#### Deep Dives
- Integration: render a component calling `useAgentStream(finiteStream(script))`
  feeding `<AgentTimeline events>` + `<AgentStreaming …streaming>`; bounded ticks to
  done; assert thinking row, tool success glyph, final message; then the anchored
  composed snapshot (≤ 2 new snapshots budget).
- Example: a scripted agent turn (thinking → tool running → completed(shell) →
  text-delta typing → done) through the REAL hook + AgentTimeline. UNMOUNT RULE
  (EC-8): the demo unmounts via an effect when `status === "done"` — deterministic,
  no timer (the agent.tsx 0ms precedent does NOT transfer: it renders a PRE-BUILT
  static scene, while folding N events through the hook needs N await/dispatch
  rounds that are not complete at 0ms). The real-SDK variant is a commented pointer
  (devDep-gated, not executed in CI).
- Smoke asserts: thinking glyph, ✓ tool, message text, exit 0.

#### Tasks
1. RED (3 tests below)
2. GREEN wiring + example
3. CHANGELOG

#### TDD
```
RED:     public_entry_composes_stream_adapter() — import { useAgentStream, agentStreamReducer, initialAgentStreamState } from "../src/index.js"; scripted fold through the HOOK rendering AgentTimeline; after ticks: expect(frame).toContain("✓"); expect(frame).toContain(final message text); expect(typeof agentStreamReducer).toBe("function")
RED:     composed_stream_scene_matches_snapshot() — <Box width={60}> scene at the done state; anchors FIRST (message text, tool name, "✓"), then toMatchSnapshot("stream-adapter-scene")
RED:     stream_example_renders_and_exits_cleanly_when_piped() — execFileSync tsx examples/stream.tsx (timeout 30000 both layers, minimal env + FORCE_COLOR=1); expect thinking marker, "✓", final text; exit 0
GREEN:   Wire exports + scene + example
REFACTOR: None expected
VERIFY:  pnpm vitest run tests/public-api.integration.test.tsx tests/example-stream.integration.test.ts tests/export-surface.test.ts
```

#### Concurrency tests

(none — single-threaded)

#### Acceptance Criteria
- [ ] Suites exit 0; two consecutive `pnpm test` runs green with identical snapshots; ≤ 2 new snapshots total (`git diff --stat -- '**/__snapshots__/**'`)
- [ ] `pnpm example:stream | cat` exits 0 with the agent-turn scene
- [ ] Subprocess spawn count ≤ 12 suite-wide — `grep -rc "execFileSync(" tests/ src/ | awk -F: '{n+=$2} END {print n}'` outputs <= 12

#### DoD (Definition of Done)
- [ ] `pnpm gates` exits 0

---

## Coverage Matrix

| # | Gap / Requirement (source) | Task(s) | Resolution |
|---|---|---|---|
| 1 | Hook/reducer maps AsyncIterable of SDK events → UI state (ROADMAP M7 DoD-1) | T1.1, T1.2, T2.1, T3.2 | Union + fold + hook + composition-root scene |
| 2 | Drives ChatThread/ToolCallCard/AgentTimeline (DoD-1) | T1.2, T3.2 | events = AgentEvent[] (AgentTimeline 1:1; cards via tool events; ChatThread = app-side message filter, documented) |
| 3 | Pure exhaustively-tested reducer mirroring agentStreamReducer (DoD-2) | T1.2 | 20-test fold table: 6/6 discriminators + the mirror's untested sub-paths + M3-boundary oracle |
| 4 | ZERO runtime coupling; structural type; sdk devDep only (DoD-2) | T1.1, T3.1 | Fresh structural union; import-type-only tripwire; manifest pins (sdk out of deps/peers) |
| 5 | Reconnect/resume across a dropped stream, opaque lastEventId (DoD-3) | T2.2 | Resuming-fake exactly-once test + reset+refold factory test (lastEventId below the iterable — both first-party precedents) |
| 6 | Roadmap risk 1 — structural drift | T3.1 | Whole-union + member tripwire (tsc-proven necessity) + runtime fixture contract test |
| 7 | Roadmap risk 2 — reducer complexity/correctness | T1.2 | The D2 table is binding; every divergence evidence-forced; boundary oracle per scenario |
| 8 | Mirror's untested edges closed (blueprint Corner 1) | T1.2, T2.1 | drop-after-done, error forms, never-started completion, anon call_id, error-mid-tool, StrictMode remount |
| 9 | Performance evidence without a fake bench (blueprint D7) | T3.2 | Final-Phase 6-bench re-run + recorded justification + flip condition (T3.2 lands the last render-path change the re-run guards) |
| 10 | Wiring triad (`rules/cycle-implement.md`) | T2.1, T3.2 | Hook consumes reducer (callers); integration scene + example (tests/callers); regression re-run (runtime evidence) |
| 11 | CHANGELOG discipline (Rule 6) | T1.1, T1.2, T2.1, T2.2, T3.1, T3.2 | [Unreleased] per task |
| 12 | New-dep audit (deps-audit golden rule) | T3.1 | sdk devDep Rule 9 table; /deps-audit PASS 2026-07-07 (registry 2.19.0 noted; re-audit at T3.1 is an AC) |
| 13 | Edge-case review MUST-FIX EC-1..EC-8 + SHOULD EC-9..EC-12 (review 2026-07-07) | T1.1, T1.2, T2.1, T3.2 | Absorbed: close-on-effectful-fold rule, done-fails-tools, drop-after-terminal, internal wrapper reducer for reset, liveMessageId lifecycle, real StrictMode tests, factory-identity Drawback+doc, done-gated example unmount, tool-# anon prefix, effectful-only thinking graduation, documented drops, string-when-present shell guard — 8 new/strengthened TDD rows |

**Coverage: 13/13 gaps covered (100%)**

## Global Definition of Done

- [ ] All phases completed
- [ ] All tests passing — `pnpm test` green (M0-M6 suites + ~42 new M7 tests)
- [ ] Zero type errors — `pnpm typecheck` (the tripwire rides this gate); zero lint warnings; format clean
- [ ] Build green — `pnpm build` produces `dist/index.js` + `dist/index.d.ts`; `grep -c "@theokit/sdk" dist/index.d.ts` outputs 0 (no sdk types leak into the public surface)
- [ ] Coverage ≥ 90% on `src/**` — `pnpm test:coverage` exits 0 (critical paths § above: 100% lines)
- [ ] File-size budget — `wc -l` <= 500 per changed source file
- [ ] CHANGELOG `[Unreleased]` updated per task (Rule 6)
- [ ] Backward compatibility — existing API unchanged (M7 purely additive): all pre-M7 suites pass unmodified and `git diff --name-only <m7-base>..HEAD -- 'src/*.test.*' 'tests/*'` lists only NEW files plus the two extended contract suites (export-surface, public-api)
- [ ] **Snapshot budget** — ≤ 2 new snapshots; ZERO existing snapshots changed: `git diff --stat <m7-base>..HEAD -- '**/__snapshots__/**'` shows insertions only, ≤ 2 new snapshot names
- [ ] **Bench regression evidence** — full `pnpm bench` re-run committed (quiet machine); no ADVERSE delta beyond run-to-run variance vs the M6 numbers; table + no-new-bench justification in the implementation log
- [ ] CI green on develop (node 20 + 22, 7 steps) — NOTE: GitHub Actions billing-blocked (human action pending); all steps mirrored locally until resolved
- [ ] **Plan archived** — after `/review` READY_TO_MERGE AND the release PR merges, move to `knowledge-base/plans/completed/`

## Failure scenarios (when I/O external)

(none — no external I/O touched; the hook consumes a caller-provided AsyncIterable —
stream failures are DATA (the error path), covered by the T2.1 negative tests;
transport is out of scope by design)

## Final Phase: Integration Validation (MANDATORY)

**Objective:** Prove the M7 surface as a composed workload + the regression evidence.

### Execution

```
pnpm gates                    # format:check → lint → typecheck → test → build
pnpm test:coverage            # >= 90% src/**
pnpm bench                    # full run on a QUIET machine (load < ~9) — all six baselines refreshed; commit diffs; record the M7-vs-M6 comparison table (ADVERSE-only rule) in the implementation log (D7)
pnpm example:stream | cat     # non-TTY smoke
pnpm vitest run               # second consecutive full run (stability)
```

### Acceptance Criteria

- [ ] `pnpm gates` exits 0; `pnpm test:coverage` exits 0
- [ ] Two consecutive `pnpm vitest run` green
- [ ] `pnpm example:stream | cat` exits 0 with the agent-turn scene
- [ ] All committed baselines pinned-env + self-consistent; M7-vs-M6 table shows no ADVERSE regression beyond run-to-run variance (else investigate — D7 flip condition)
- [ ] Failure scenarios — skipped ("(none — no external I/O touched)")

### If Validation Fails

1. All failures are plan-caused — fix before declaring complete; re-run the chain
2. Document environment quirks in the PR description
