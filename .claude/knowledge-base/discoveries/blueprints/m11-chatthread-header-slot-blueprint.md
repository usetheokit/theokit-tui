---
slug: m11-chatthread-header-slot
milestone_id: M11
created_at: 2026-07-08
discovery_plan: .claude/knowledge-base/discoveries/plans/m11-chatthread-header-slot-plan.md
question: How does a header fold as the FIRST item of the existing single <Static> without breaking windowing, and what is the honest immutability contract?
---

# Blueprint: m11-chatthread-header-slot

## Context

M11 adds `header?: ReactElement` to ChatThread + AgentTimeline as the first
item of each component's OWN `<Static>`, resolving the recorded M9 D4
drawback. Two research agents read ink7's `Static.tsx` (58 lines) end-to-end
plus the ink.tsx static regions and traced the failure scenarios
numerically. Q1–Q5 all `done`.

## Objective

Lock the design (sentinel union + MOUNT-FREEZE), the immutability contract,
the oracle set and the evidence plan for the M11 plan.

## Cross-cutting Comparison

| Aspect | gemini | naive sentinel | OURS (mount-freeze) |
|---|---|---|---|
| header placement | first Static item (`.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/components/MainContent.tsx:222-319`) | same | same |
| header change | refreshStatic = clearTerminal + remount key (`.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/AppContainer.tsx:646-698`) | silently broken (see risks) | IGNORED by contract (mount-time prop) |
| removal mid-life | n/a | PERMANENT row loss on same-length shrink+grow | impossible (frozen) |

## Recommendations

1. Implement the mount-freeze design (Corner 4) in BOTH components.
2. Oracle set Corner 1 verbatim (incl. the same-length shrink+grow trap
   test proving the freeze).
3. Zero deps; evidence = headerless bench re-run (flip condition FIRES —
   chat-thread.tsx is a benched file) + example/smoke deltas (Corner 3).

## Coverage Corner 1 — Integration Tests

**Harness fact:** itl4 `debug:true` ⇒ every frame = `fullStaticOutput +
output` (`.claude/knowledge-base/references/ink/src/ink.tsx:582-591`) — so
`lastFrame()` ORDER proves static-above directly (`indexOf(header) <
indexOf(graduated row)`), and print-once is countable on `lastFrame()`
(never across `instance.frames` — each re-contains the accumulator).

**Oracle set (plan consumes verbatim):** (a) drawback-resolution — header +
`thread(6)` w4/o2 (nothing graduated), append to 20 → header above msg-0
above msg-19 + count===1; (b) print-once across 6→12→20 batches; (c)
immutability — changed header element ignored (`toContain(BANNER)` 1×,
`not.toContain(CHANGED)`, row-render spy count unchanged); (d) removal —
`header={undefined}` post-print ignored AND the same-length trap (removal +
graduation in ONE rerender → no row lost — THE test that catches a
non-frozen design; `Static.tsx:36-38` advances index keyed by LENGTH only);
(e) sentinel-key collision → TypeError at the boundary (extend
`assertUniqueIds`/`assertValidEvents`); (f) both components (extend
`heterogeneous_graduation_keeps_output_ordered`,
`src/agent-timeline.test.tsx:394-416`); (g) ≤1 new snapshot (AgentTimeline
representative frame; ChatThread suite stays snapshot-free by design).

## Coverage Corner 2 — Dependencies

**Zero.** Imports stay ink(`Box`,`Static`)+react+internal; the prop type
adds `ReactElement` (react already peer `^19.2.0`). Manifest untouched.
gemini's header is likewise dep-free composition. Rule 9 PASS by
composition.

## Coverage Corner 3 — Tools

**Evidence:** no new bench/mode (header prints once — no per-frame path;
`benchmarks/chat-thread.bench.tsx:51-59` mounts headerless and stays
untouched). **BUT the M9 flip condition FIRES:** `src/chat-thread.tsx` IS a
benched render-path file — so ONE load-gated headerless re-run of the
existing chat-thread bench vs the M10 baselines is REQUIRED (M7 `4a7bf1d`
precedent) proving the added union/ternary didn't regress the headerless
path. Flip-to-bench-mode condition: header ever gains a per-frame path.
**Example/smoke:** `examples/chat.tsx` gets the banner in the slot (+3
smoke asserts: contain, order, print-once — deterministic under the ink7
single-final-frame pipe contract); `tests/fixtures/no-color-probe.tsx`
moves the banner INTO the slot (3 degrade scenes exercise header-in-Static
for free; byte-equality covers the new mount condition);
`examples/banner.tsx` UNCHANGED (preserves the EC-2 width-fallback smoke).

## Coverage Corner 4 — Techniques

**Static semantics (source-proven):** `index` state starts 0; render emits
`items.slice(index)`; `useLayoutEffect(() => setIndex(items.length),
[items.length])` (`.claude/knowledge-base/references/ink/src/components/Static.tsx:30-38`).
Print-once ordering GUARANTEED iff (i) sentinel present in the FIRST commit
of the Static instance and (ii) items append-only thereafter. Every flush
with content writes ABOVE the dynamic frame and accumulates
(`.claude/knowledge-base/references/ink/src/ink.tsx:660-668`).

**The traps (numerically traced):** late-arriving header PREPENDS →
`slice(index)` duplicates the last graduated row and never prints the
header; header removal + graduation in the SAME commit keeps
`items.length` constant → the layout effect never refires → the graduated
row is skipped PERMANENTLY. Conditional Static unmount also resets
`fullStaticOutput` (`.claude/knowledge-base/references/ink/src/ink.tsx:542-545`
via `onStaticChange`) losing the replay buffer.

**THE DESIGN — mount-freeze:** `const frozenHeader = useRef(header).current`
(evaluated once at mount); `items = frozenHeader !== undefined ?
[HEADER_SENTINEL, ...prefix] : prefix`; Static mounts when
`frozenHeader !== undefined || prefix.length > 0`. The sentinel's length
contribution is CONSTANT for the component's life — eliminates late-arrival,
removal, and unmount-cycle traps in one move. Contract (ADR): **`header` is
a MOUNT-TIME prop; later changes to content, identity AND presence are
ignored** (gemini parity without refreshStatic) — the same documented
precedent as `windowSize`/`windowOverscan` (`src/chat-thread.tsx:23-29`).
Reserved sentinel key `"__theokit_tui_header__"` rejected as a row id at
the validation boundary (fail-fast).

**Exit note:** with a header, `fullStaticOutput` is non-empty from frame 1,
so ink7's unmount skip-final-render branch
(`.claude/knowledge-base/references/ink/src/ink.tsx:797-808`) engages even
in short sessions — pinned by the example smoke (content asserts hold).

## ADRs

### D1 — Sentinel union + MOUNT-FREEZE (FINAL)

Decision/consequences per Corner 4. **Alternatives:** naive sentinel
(rejected: two permanent-corruption traps, traced); latch-once-printed
(rejected: still duplicates on late arrival); separate Static (FORBIDDEN —
single-consumer invariant); throw-on-change (rejected: legitimate
re-renders recreate elements).

### D2 — Mount-time immutability contract (FINAL)

First render wins; content/identity/presence changes ignored; documented on
the prop + pinned by tests (c)/(d). **Alternatives:** refreshStatic-style
escape (rejected: clearTerminal is host-app machinery).

### D3 — Evidence (FINAL)

Headerless chat-thread bench re-run vs M10 baselines (the flip condition
fired); zero new deps; example/smoke per Corner 3.
