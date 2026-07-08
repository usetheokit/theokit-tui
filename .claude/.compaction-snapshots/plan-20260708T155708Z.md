---
slug: m17-renderer-skeleton
milestone_id: M17
created_at: 2026-07-08
goal: Own renderer walking skeleton — a custom react-reconciler host mounting a React <Text> tree into a differential CSI-2026 output engine, opt-in at src/renderer/, byte-parity-gated against Ink on a minimal scene via an @xterm/headless harness, with a dual-engine bytes bench. Zero impact on the shipped Ink path.
---

# Plan: m17-renderer-skeleton

## Goal

Ship the V4 renderer walking skeleton per blueprint
`.claude/knowledge-base/discoveries/blueprints/m17-renderer-skeleton-blueprint.md`
(D1 react-reconciler ^0.33.0 text-only host, D2 pi strategy ladder +
CSI-2026 + reasoned fallbacks, D3 @xterm/headless oracle, D4 dual-engine
bytes bench): a self-contained `src/renderer/` (Terminal interface +
output engine + host config + `createRenderer`) that mounts a React
`<Text>` tree to a real terminal emulator, diffs line-by-line, wraps every
write in synchronized-output, and is proven byte-parity with Ink on a
minimal scene. Zero imports from the Ink component path; the shipped
components and their 575 tests are untouched. Release (0.18.0) follows
READY_TO_MERGE — NEVER a plan task (M10 DV-1 rule).

## Baseline Context

Repo state: develop @ v0.17.0 published (ink 7.1.0 / react 19.2.7;
575/575 green after the M16 flake fix). This is the FIRST V4 milestone —
a new architecture behind a new entry, not a change to existing surface.

### Files that will be touched

| File | LoC | Role |
|---|---|---|
| `package.json` | — | +`react-reconciler ^0.33.0` (prod), +`@xterm/headless 5.5.0` (dev), +`@types/react-reconciler` (dev) |
| `src/renderer/terminal.ts` | new (~70) | `Terminal` interface + `ProcessTerminal` (real stdout) |
| `src/renderer/output-engine.ts` | new (~200) | the pi strategy ladder: previousLines diff, first/width/height/shrink fallbacks, line-diff, append fast-path, deleted-tail, CSI-2026 wrapping, `logRedraw` |
| `src/renderer/output-engine.test.ts` | new (~180) | strategy oracles (write-spy: only-changed-lines, append, deleted-tail, fullRender-reasons) |
| `src/renderer/host-config.ts` | new (~120) | react-reconciler HostConfig (text-only, mutation mode) |
| `src/renderer/renderer.ts` | new (~80) | `createRenderer(terminal)` — reconciler container + resetAfterCommit→requestRender + unmount teardown |
| `src/renderer/index.ts` | new (~15) | opt-in entry: `createRenderer`, `Text`, types (NOT re-exported from the package root) |
| `src/renderer/renderer.test.tsx` | new (~200) | mount/update/unmount + CSI-2026 + React-19 canary + PARITY gate vs Ink (via VirtualTerminal) |
| `tests/renderer/virtual-terminal.ts` | new (~120) | `@xterm/headless` harness (pi shape) — screen-state reader + write spy |
| `benchmarks/renderer-skeleton.bench.tsx` | new (~160) | ink vs own modes; ms/frame AND bytes-written |
| `docs/benchmarks/m17-renderer-skeleton-baseline.json` | new | committed baseline (load field) |
| `docs/renderer/m17-parity-report.md` | new | per-line parity table vs Ink |
| `tests/bench-banner-baseline.test.ts` | +40 | M17 baseline contract |
| `examples/renderer-skeleton.tsx` | new (~40) | opt-in TTY demo |
| `tsup.config.ts` / `package.json` exports | — | add the `./renderer` subpath export |
| `CHANGELOG.md` | — | per task |

### Current callers / dependents

- NONE — `src/renderer/` is a brand-new island. The Ink-based `src/*`
  components import nothing from it and vice versa (blueprint Rec 1).
- The package gains a `./renderer` subpath export (opt-in); the root
  entry `@theokit/tui` is byte-unchanged (pinned by the export-surface
  test).

### Domain glossary

- **Terminal** = the write sink interface (`write/columns/rows/start/stop/
  hideCursor/showCursor`) — pi's shape, so `ProcessTerminal` (real) and
  `VirtualTerminal` (xterm) are interchangeable.
- **output engine** = the stateful differ: holds `previousLines[]`,
  computes `newLines`, picks a strategy (first/width/height/shrink/
  line-diff/append/deleted-tail), wraps writes in `\x1b[?2026h…l`.
- **host config** = the react-reconciler HostConfig — the ~12 load-bearing
  hooks for a text-only mutation-mode tree (blueprint Corner 4).
- **parity gate** = the SAME React `<Text>` scene rendered through Ink
  (itl) and through ours (VirtualTerminal); the emulator screen text must
  match line-by-line (documented divergences only).

### Architecture boundaries affected

New TOP-LEVEL island `src/renderer/` — its own layering (terminal ←
output-engine ← host-config ← renderer). Zero coupling to the Ink path.
The `rules/architecture.md` DIP holds: renderer depends on the `Terminal`
interface, not on `process.stdout`.

## Prior Art

- Blueprint Corners 1–4 + ADRs D1–D4 (ink `reconciler.ts` host map, pi
  `tui.ts:1254-1500` strategy ladder, pi `virtual-terminal.ts` harness —
  all cited there with line numbers).
- react-reconciler ^0.33.0 is Ink 7's exact pin (already transitively in
  the pnpm store — no new resolution risk).
- Test discipline per `.claude/rules/testing.md` (§ 4.1 negatives; § 6
  determinism — the emulator is deterministic, no timers in unit oracles).

## ADRs

### D1 — Text-only react-reconciler host, mutation mode

**Decision:** `src/renderer/host-config.ts` implements the ~12 hooks Ink
uses in mutation mode (createInstance/createTextInstance/appendChild(+
InitialChild/ToContainer)/insertBefore/removeChild(+FromContainer)/
commitUpdate/commitTextUpdate/resetAfterCommit/clearContainer,
supportsMutation:true); node tree is `{type:"text-root"|"text", …}` plain
objects; everything else stubbed with honest no-ops.
**Rationale:** blueprint D1 — Ink's exact pin collapses API-churn risk;
text-only keeps the skeleton minimal (Yoga is M18).
**Alternatives considered:** newer reconciler (churn risk the register
names); no-React engine (violates ADR 0003 thesis); react-dom/server (no
incremental commits).
**Consequences:** `resetAfterCommit` is THE render trigger — it calls
`engine.requestRender()`; layout is trivial (depth-first text concat with
`\n` splits) until M18.

### D2 — pi's strategy ladder + CSI-2026 + reasoned fallbacks

**Decision:** port pi's render region in order — first-render / width→
fullRender(clear) / height→fullRender(clear) [Termux exception NOT
ported, documented] / clearOnShrink / line-diff(first..last changed) /
append fast-path / deleted-tail(`\x1b[2K`) / firstChanged-above-viewport→
fullRender; ALL buffers wrapped `\x1b[?2026h…\x1b[?2026l`; `logRedraw
(reason)` + a `fullRedrawCount` on every fallback.
**Rationale:** blueprint D2 — the diff win IS fewer bytes + no flicker;
reasons make renderer bugs debuggable.
**Alternatives considered:** always-full (bytes/flicker); cell-grid diff
(xterm complexity — YAGNI at skeleton); kitty-image branches (M21).
**Consequences:** the engine is Terminal-agnostic (writes strings) →
testable against the xterm emulator with a write-spy.

### D3 — @xterm/headless as the test oracle (screen-state asserts)

**Decision:** `tests/renderer/virtual-terminal.ts` ports pi's
VirtualTerminal (implements `Terminal`, feeds writes into an
`@xterm/headless` instance, reads `buffer.active.getLine(i)` for asserts);
strategy oracles additionally spy on `write` to prove only-changed-lines.
**Rationale:** blueprint D3 — a real emulator validates cursor/clear/CSI
semantics a fake stdout string cannot.
**Alternatives considered:** fake stdout strings (blind to the point);
node-pty e2e (heavier/flakier — reserved for M19).
**Consequences:** `@xterm/headless` is a devDep (deps-audit clears it);
the harness lives under `tests/renderer/` (not shipped).

### D4 — Evidence: dual-engine bench (bytes metric) + per-line parity report

**Decision:** `benchmarks/renderer-skeleton.bench.tsx` runs the SAME
append+update scene on ink and on ours; metrics = ms/frame AND total
bytes written (Terminal.write spy sum); baseline committed with
`load_1min_at_start`. `docs/renderer/m17-parity-report.md` is a per-line
diff table vs Ink with a verdict per divergence.
**Rationale:** blueprint D4 — frames-only hides the diff win (EC-5);
claimed parity without the artifact is a fabrication risk.
**Alternatives considered:** frames-only bench (rejected); prose-only
parity claim (rejected).
**Consequences:** the bench is a per-frame path — the M9 flip condition
is INHERENTLY satisfied (a renderer IS the per-frame path).

## Dependencies

| Dependency | Version | New? | Rule 9 evaluation |
|---|---|---|---|
| `react-reconciler` | ^0.33.0 (prod) | YES | Ink 7's exact pin; the SOLVED hard part of a React host — reusing it, not hand-rolling a fiber (Rule 9 core). Already transitive in the store. |
| `@types/react-reconciler` | ^0.33.0 (dev) | YES | types for the above |
| `@xterm/headless` | 5.5.0 (dev) | YES | pi's proven test emulator — the SOLVED terminal-emulation part (Rule 9); test-only, never shipped |

**deps-audit REQUIRED** (new prod dep). No chalk, no yoga at M17.

## Critical paths

- `src/renderer/output-engine.ts` strategy-selection branches — 100% lines
  (each ladder rung has an oracle).
- `src/renderer/host-config.ts` mutation hooks — 100% lines (exercised by
  the mount/update/remove oracles).

## Phase 1: Terminal + harness + output engine

### T1.1 — Terminal interface + @xterm/headless harness + output engine

#### Objective

The Terminal seam, the VirtualTerminal oracle, and the pi strategy ladder
with full write-spy oracles.

#### Why this step (action + reasoning)

1. **What:** RED — output-engine strategy oracles (executed before the
   engine exists); GREEN — Terminal interface + ProcessTerminal +
   VirtualTerminal harness + the D2 strategy ladder.
2. **Why now:** the engine is Terminal-agnostic and independently
   testable; the reconciler (T2.1) only feeds it lines.

#### Evidence

- Blueprint Corner 4 (the pi ladder, line-cited) + Corner 1 oracles
  (a)–(d) + D3 harness.

#### Files to edit

```
src/renderer/terminal.ts / src/renderer/output-engine.ts
src/renderer/output-engine.test.ts / tests/renderer/virtual-terminal.ts
package.json (deps) / CHANGELOG.md
```

#### TDD

```
RED:     first_render_writes_all_lines_wrapped_in_csi2026() — const eng = new OutputEngine(term); eng.render(["a","b","c"]); const writes = spy.calls.join(""); expect(writes).toContain("\x1b[?2026h"); expect(writes).toContain("\x1b[?2026l"); expect(term.screenLines()).toEqual(["a","b","c"]) (via xterm buffer)
RED:     update_rewrites_only_changed_lines() — render ["a","b","c"] then render ["a","B","c"]; const secondWrite = spy.calls.at(-1); expect(secondWrite).toContain("B"); expect(secondWrite).not.toContain("a"); expect(secondWrite).not.toContain("c") (line-diff strategy — only row 1 touched)
RED:     append_fast_path_writes_only_new_tail() — render ["a","b"] then render ["a","b","c","d"]; the second write contains "c" and "d" but not "a"/"b"
RED:     deleted_tail_clears_rows() — render ["a","b","c"] then render ["a"]; the write contains a clear-line sequence "\x1b[2K"; expect(term.screenLines()).toEqual(["a"])
RED:     width_change_triggers_full_render_with_reason() — render ["hello world"]; term.resize(5); eng.render(["hello world"]); expect(eng.lastRedrawReason).toMatch(/width/); the full-clear "\x1b[2J" is present
RED:     virtual_terminal_reads_screen_state() — term.write("x\r\ny"); expect(term.screenLines().slice(0,2)).toEqual(["x","y"]) (harness self-test)
VERIFY:  pnpm vitest run src/renderer/output-engine.test.ts
```

#### Concurrency tests

(none — single-threaded)

#### Acceptance Criteria

- [ ] `pnpm vitest run src/renderer/output-engine.test.ts` exits 0; coverage report shows `output-engine.ts` at 100% lines
- [ ] `wc -l src/renderer/output-engine.ts` ≤ 240
- [ ] `pnpm vitest run src/renderer/output-engine.test.ts` exits NON-ZERO before `output-engine.ts` exists (RED exit recorded in the progress notes)
- [ ] `grep -rn "from \"../.*\.js\"" src/renderer/` shows ZERO imports from the Ink component path (island purity)

#### DoD (Definition of Done)

- [ ] `pnpm gates` exits 0

## Phase 2: The reconciler host

### T2.1 — host-config + createRenderer (mount/update/unmount + parity)

#### Objective

The react-reconciler host mounting a React `<Text>` tree through the
engine, with the parity gate vs Ink.

#### Why this step (action + reasoning)

1. **What:** RED — renderer oracles + parity gate (executed); GREEN —
   host-config + createRenderer wiring resetAfterCommit→requestRender +
   unmount teardown.
2. **Why now:** the engine (T1.1) is proven; the reconciler only assembles
   lines and feeds it.

#### Evidence

- Blueprint Corner 4 (host config, ink-cited) + Corner 1 oracles
  (e)–(i) + D1.

#### Files to edit

```
src/renderer/host-config.ts / src/renderer/renderer.ts / src/renderer/index.ts
src/renderer/renderer.test.tsx / CHANGELOG.md
```

#### TDD

```
RED:     mount_renders_react_text_tree_to_screen() — const term = new VirtualTerminal(); const r = createRenderer(term); r.render(<Text>{"hello"}</Text>); await tick; expect(term.screenLines()[0]).toContain("hello")
RED:     update_rerenders_changed_text() — a stateful component flips its text on a prop; r.render(v1); r.render(v2); expect(term.screenLines()[0]).toContain("world"); expect(term.screenLines()[0]).not.toContain("hello")
RED:     coalesced_commits_paint_once() — render a tree whose N children commit in one React batch; the engine's fullRedrawCount / write-count increments by exactly 1 for that batch (requestRender coalescing)
RED:     unmount_restores_cursor_and_screen() — r.unmount(); const writes = spy.calls.join(""); expect(writes).toContain("\x1b[?25h") (cursor shown); screen consumable (no dangling synchronized-output)
RED:     react19_commit_behavior_pinned_empirically() — a canary counting renders under the reconciler (the M10 StrictMode lesson: assert the OBSERVED count, whatever it is — 1, document it)
RED:     parity_with_ink_on_text_scene() — const scene = <Box flexDirection="column">... rows of Text ...</Box>; render via ink itl → inkLines; render the SAME tree via ours → ourLines (VirtualTerminal); expect(ourLines).toEqual(inkLines) OR every divergence is logged in the parity report (assert the report file lists them)
VERIFY:  pnpm vitest run src/renderer/renderer.test.tsx
```

#### Concurrency tests

(none — single-threaded)

#### Acceptance Criteria

- [ ] `pnpm vitest run src/renderer/renderer.test.tsx` exits 0; coverage report shows `host-config.ts` at 100% lines
- [ ] `wc -l src/renderer/host-config.ts` ≤ 150 AND `wc -l src/renderer/renderer.ts` ≤ 110
- [ ] The parity oracle passes line-by-line OR `docs/renderer/m17-parity-report.md` documents every divergence with a verdict
- [ ] `src/index.ts` (root entry) diff is EMPTY — the renderer is a subpath-only export (`git diff v0.17.0..HEAD -- src/index.ts` shows nothing)

#### DoD (Definition of Done)

- [ ] `pnpm gates` exits 0

## Phase 3: Wiring + evidence

### T3.1 — Subpath export + example + dual-engine bench + parity report

#### Objective

The `./renderer` entry, the TTY example, the bytes bench with a committed
baseline, and the parity artifact.

#### Why this step (action + reasoning)

1. **What:** RED — baseline contract + export-subpath assert (executed);
   GREEN — `./renderer` export in package.json/tsup, `examples/
   renderer-skeleton.tsx`, the dual-engine bench + one load-gated run, the
   parity report.
2. **Why now:** terminal evidence step (release follows review, NOT here).

#### Evidence

- Blueprint Corner 3 (bench modes + parity artifact) + D4.

#### Files to edit

```
package.json (exports) / tsup.config.ts
examples/renderer-skeleton.tsx
benchmarks/renderer-skeleton.bench.tsx / docs/benchmarks/m17-renderer-skeleton-baseline.json
docs/renderer/m17-parity-report.md
tests/bench-banner-baseline.test.ts / CHANGELOG.md
```

#### TDD

```
RED:     m17_renderer_baseline_contract() — const b = JSON.parse(read docs/benchmarks/m17-renderer-skeleton-baseline.json); const modes = b.modes.map(pick mode); expect(modes).toEqual(expect.arrayContaining(["ink", "own"])); expect(b.load_1min_at_start).toBeLessThan(4); every mode has bytes_written finite AND mean_ms_per_frame finite
RED:     renderer_subpath_export_resolves() — const mod = await import("../src/renderer/index.js"); expect(typeof mod.createRenderer).toBe("function")
GREEN:   ./renderer export in package.json + tsup; example; bench (ink vs own, ms + bytes) + one load-gated run committed; parity report written
VERIFY:  pnpm vitest run tests/bench-banner-baseline.test.ts
```

#### Concurrency tests

(none — single-threaded)

#### Acceptance Criteria

- [ ] Baseline JSON `load_1min_at_start` < 4; the implementation log shows the ink-vs-own bytes AND ms table with the bytes delta stated
- [ ] `docs/renderer/m17-parity-report.md` exists with ≥ 1 scene, per-line, verdict per divergence
- [ ] `pnpm exec publint` (if run) sees the new subpath export cleanly OR the export-surface test covers `./renderer`

#### DoD (Definition of Done)

- [ ] `pnpm gates` exits 0

## Edge cases absorbed

(discovery MUST-FIX set: EC-1 resize→fullRender → T1.1 width oracle; EC-2
unmount restores cursor → T2.1 oracle; EC-3 CSI-2026 graceful → T1.1
wrap oracle; EC-4 React-19 commit empirical → T2.1 canary; EC-5 bytes
metric → T3.1 bench)

## Coverage Matrix

| # | Gap / Requirement (source) | Task(s) | Resolution |
|---|---|---|---|
| 1 | M17 DoD-1: deep discover blueprint (ROADMAP § M17) | (done in discover) | blueprint SHIPPABLE with citations |
| 2 | M17 DoD-2: walking skeleton mounts React <Text>, unmount restores, zero Ink imports (ROADMAP § M17) | T2.1, T1.1 | createRenderer + island-purity AC |
| 3 | M17 DoD-3: differential rendering v0 + CSI-2026, @xterm/headless verified (ROADMAP § M17) | T1.1 | strategy ladder + harness oracles |
| 4 | M17 DoD-4: byte-parity gate vs Ink (ROADMAP § M17) | T2.1, T3.1 | parity oracle + report artifact |
| 5 | M17 DoD-5: OWN bench (frames + bytes) + gates/coverage/CHANGELOG (ROADMAP § M17) | T3.1 | dual-engine bytes bench |
| 6 | M17 risk-1: reconciler API churn (ROADMAP § M17) | T2.1 | pinned ^0.33.0 (Ink's version); host-config studied first |
| 7 | M17 risk-2: @xterm/headless new infra (ROADMAP § M17) | T1.1 | pi's exact harness patterns |
| 8 | Deps: new prod dep CVE pass (blueprint Corner 2) | (deps-audit gate) | react-reconciler + @xterm/headless audited |

**Coverage: 8/8 (100%)**

## Drawbacks & Risks

| Drawback / Risk | Severity | Mitigation | Owner |
|---|---|---|---|
| react-reconciler internals under-documented | Medium | pinned to Ink 7's version; Ink's host-config read end-to-end as the map (blueprint Corner 4) | implement |
| Parity divergences from Ink's subtle SGR/width behavior | Medium | the parity report documents each per-diff (not silent); the gate accepts documented divergences, blocks silent ones | implement |
| @xterm/headless resize/CSI semantics differ from real terminals | Low | it is pi's PROVEN harness; the bench also runs the real ProcessTerminal path | implement |
| Scope creep into layout/input at the skeleton | Low | text-only host; Yoga/input are M18/M19 (blueprint Out) | implement |

## Failure scenarios (when I/O external)

(none — the renderer writes to a Terminal interface; no network/DB/queue.
The stdout/emulator write is synchronous and in-process.)

## Unresolved Questions

(none — every decision is resolved at plan time by blueprint ADRs D1–D4.)

## Test Plan

Output-engine strategy oracles (write-spy) + reconciler mount/update/
unmount + React-19 canary + parity gate + baseline contract; discipline
per `.claude/rules/testing.md` (§ 4.1 negatives — width-change, deleted-
tail; § 6 determinism — the emulator is deterministic, no timers in unit
oracles). Two consecutive full runs green.

## Final Phase: Integration Validation (MANDATORY)

- `run_validation.py m17-renderer-skeleton` exit 0; `/code-quality` PASS;
  coverage: output-engine + host-config 100% lines.
- Review (multi-role) BEFORE any release — the release chain (0.18.0
  minor) runs only on READY_TO_MERGE (M10 DV-1 rule).

## Global Definition of Done

- [ ] All tasks committed gates-gated (1 task = 1 commit, `gates && commit`)
- [ ] 575+ tests green; zero weakened tests; zero Ink-path changes
- [ ] Baseline committed (bytes + ms, load < 4); parity report present
- [ ] `./renderer` subpath export; root entry byte-unchanged
- [ ] Plan archived post-release
