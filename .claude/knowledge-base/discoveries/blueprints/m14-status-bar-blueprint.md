---
slug: m14-status-bar
milestone_id: M14
created_at: 2026-07-08
discovery_plan: .claude/knowledge-base/discoveries/plans/m14-status-bar-plan.md
question: How do production agent CLIs compose a persistent status bar responsively, and how does turn-elapsed integrate with a spinner whose contract forbids internal timers?
---

# Blueprint: m14-status-bar

## Context

gemini `Footer.tsx` (543 lines) read end-to-end: `FooterRow` slot layout
(:103-165), width-budgeted columns with priority (:170-280 `FooterColumn`
+ `addCol` width estimates + `isHighPriority`), `CwdIndicator` with
`shortenPath`/`tildeifyPath` (:41-66). mastracode `status-duration.ts`
(22-line bucket formatter) + `status-line.ts` model/path slots. House:
`AgentStreaming.elapsedSeconds` EXISTS with formatting and an explicit
no-internal-timer ADR (M3 D4); M12 shipped the bounded-interval +
fake-timer idiom. Q1–Q5 all `done`.

## Objective

Lock the slot row design, cwd truncation, the elapsed driver (hook), the
degrade ladder, oracle set and bench modes.

## Cross-cutting Comparison

| Aspect | gemini | mastracode | OURS |
|---|---|---|---|
| layout | FooterRow: per-item Box flexGrow/flexShrink + separator Box (minWidth 3, dim `·` when labels off) (`Footer.tsx:113-165`) | manual string assembly with badge tinting (`status-line.ts:97-150`) | gemini row shape, 4 FIXED slots (D1) — no config system |
| slot set | configurable footerItems + system indicators (vim/debug/sandbox/quota/memory) | model/mode/memory/path | model · cwd · tokens · state (AI-native minimum; YAGNI on the rest) |
| cwd | `shortenPath(tildeifyPath(dir), budget)` with debug suffix budget (`Footer.tsx:49-66`) | Fireworks path rewriting | tildeify (replace home prefix) + ink `truncate-start` (keeps the path TAIL — the informative end) |
| width priority | estimated column widths + `isHighPriority` drop logic (`Footer.tsx:170-280`) | fixed | cwd shrinks first (flexShrink 1), others flexShrink 0 (EC-3); floor renders state-only |
| elapsed | app-side timers in contexts | `formatStatusDuration` buckets (`status-duration.ts`) | `useTurnElapsed(active)` hook — 1 s bounded interval, M12 driver idiom; feeds the EXISTING `AgentStreaming.elapsedSeconds` (M3 D4 no-timer ADR untouched) |

## Recommendations

1. `AppStatusBar` (new `src/app-status-bar.tsx`): props `model?`, `cwd?`,
   `tokens?: {used, limit}`, `state?` — one row, dim `·` separators
   emitted BETWEEN PRESENT slots only (EC-1); cwd slot `wrap="truncate-
   start"` + flexShrink 1; tokens rendered as `used/limit` compact
   (reuses `formatTokens`-style compaction if present in `src/format.ts`).
2. `useTurnElapsed(active: boolean): number` (new `src/use-turn-elapsed.ts`):
   0 when inactive; ticks 1/s while active; RESETS to 0 on re-activation
   (EC-2); clears on unmount (M12 teardown oracle idiom).
3. Example: `examples/chat.tsx` mounts the bar under the thread + drives
   `AgentStreaming elapsedSeconds={useTurnElapsed(streaming)}`.
4. OWN bench (M9 flip condition — the ticking bar IS a per-frame path).

## Coverage Corner 1 — Integration Tests

Oracle set: (a) all-slots order + separator count (`model · cwd · tokens
· state` → exactly 3 separators); (b) missing-slot omission — `{model,
state}` renders `model · state`, ONE separator, no dangling `·` (EC-1);
(c) narrow width — cwd truncate-start keeps the tail, state slot intact
(EC-3); floor width renders state only; (d) tokens compaction
`12.3k/128k` shape; (e) `useTurnElapsed` fake-timer script: inactive→0,
active ticks 1..N, deactivate freezes→reactivate RESETS to 0 (EC-2),
unmount leaves zero timers (M12 oracle f idiom); (f) AgentStreaming
integration — elapsed rendered inside the cancel hint (existing prop, one
composed scene); (g) degrade — monochrome scene (no color SGR; separator
survives), pipe scene stable. Snapshot budget ≤ 2 (full bar + narrow).

## Coverage Corner 2 — Dependencies

**Zero new.** ink `Box`/`Text` + theme tokens; cwd tildeify is
`replace(homedir prefix)` via `node:os.homedir()` (stdlib, rung 2);
NO ink-ui, NO gemini config machinery. Rule 9 PASS.

## Coverage Corner 3 — Tools

**Bench (REQUIRED):** `benchmarks/app-status-bar.bench.tsx`, two modes:
`ticking` (bar under a static thread; drive 60 elapsed ticks via real
timers at compressed cadence OR 1 s fake-forwarded — bench uses REAL
timers per M12 precedent, so a shortened tick interval parameter for
bench only? NO — measure the REAL 1 Hz path with a 10-tick run; wall ≈
10 s is acceptable for 3 runs) and `static` (rerender loop, bar present,
no ticking). Baseline `docs/benchmarks/m14-status-bar-baseline.json` with
`load_1min_at_start` (M12 convention). **Example/smoke:** chat example
bar + elapsed; pipe smoke asserts bar content once (ink7 single-final-
frame).

## Coverage Corner 4 — Techniques

**Row recipe (gemini :113-165 reduced):** slots render as `<Box
flexShrink={slot === "cwd" ? 1 : 0}>`; separators as `<Text dimColor> ·
</Text>` between present slots; the row is `<Box flexWrap="nowrap">`.
Width behavior delegated to ink flexbox + `truncate-start` on cwd (no
manual width estimation — gemini needs it for its drop-columns logic;
our 4 fixed slots don't, KISS).

**Elapsed driver:** `useTurnElapsed(active)`: `useState(0)` +
`useEffect([active])` — on active: reset to 0, `setInterval(1000)`
incrementing; cleanup clears (M12 `useRevealPhase` shape, unbounded while
active but externally stopped by `active=false`, unlike M12's
self-clearing N — a turn has no known end).

**Degrade:** all colors via theme tokens (dim separator is an attribute);
monochrome zeroes color, keeps dim; non-TTY renders the same line (the
bar is presentational — no gate needed, it never animates by itself; the
TICKING comes from the hook the consumer drives).

## ADRs

### D1 — Four fixed AI-native slots + dim `·` separators (FINAL)

Per Corner 4. **Alternatives:** generic items[] (rejected: one step from
the out-of-scope generic layout widget; gemini needs it for user config —
we don't); bordered footer (rejected: peers render a LINE; a border
spends a row).

### D2 — `useTurnElapsed` hook; AgentStreaming stays dumb (FINAL)

Per Corner 4. **Alternatives:** `autoElapsed` prop on AgentStreaming
(rejected: violates the M3 D4 no-timer ADR pinned by tests); caller-only
as today (rejected: fails DoD-2 "integrated" — the lib must ship the
driver).

### D3 — Evidence: own bench (ticking + static) + example/smoke (FINAL)

Per Corner 3. **Alternatives:** reuse metrics-footer bench (rejected: that
measures the M5 widgets under streaming, not the 1 Hz bar path); no bench
(rejected: recorded flip condition).
