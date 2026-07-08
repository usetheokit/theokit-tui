---
slug: m20-scrollback-cutover
milestone_id: M20
created_at: 2026-07-08
goal: Add Static-equivalent scrollback + the missing Ink hooks (useStdout/useFocus) to the custom renderer, prove 100% of the component suite renders on it via the screen-comparison harness, produce comparative benches, and write the conservative cutover ADR.
---

# Plan: m20-scrollback-cutover

## Goal

Complete the V4 renderer's parity with Ink so the whole component set renders on
it: port Ink's **dual-pass Static/scrollback** (graduated history written ONCE
above the M18 differential live frame, preserving the M11 header-slot + windowing
oracles), implement the remaining Ink hooks the shipped components need
(**useStdout**, **useFocus**/**useFocusManager**), and prove **100% of the
component suite renders byte-identical to Ink on the new renderer** via the
@xterm/headless screen-comparison harness (the M18-blessed proxy, extended to
every component + the scrollback scenes). Produce the **comparative bench matrix**
(all baselines, both engines) and the **conservative cutover ADR** (Ink stays
default+fallback, v4 opt-in, drop deferred to the owner). The irreversible
"drop Ink" decision is the human owner's — this cycle produces the evidence.

## Baseline Context

### Files that will be touched

| File | Role | Change |
|---|---|---|
| `src/renderer/host-config.ts` | reconciler | mark `internal_static`, cache `root.staticNode` + `isStaticDirty` |
| `src/renderer/render-node.ts` | tree→grid | add `skipStaticElements` (skip static subtree in the live pass) |
| `src/renderer/output-engine.ts` | paint | `writeStatic(lines)` — write graduated lines once, NOT tracked in `previousLines` |
| `src/renderer/renderer.ts` | orchestration | two-region paint: live pass (skip static) + static pass (staticNode) |
| `src/renderer/components/static.tsx` | NEW | `<Static items>` over the host `internal_static` marker |
| `src/renderer/hooks/use-stdout.ts` | NEW | `StdoutContext` proxying the Terminal dims (welcome-banner) |
| `src/renderer/hooks/use-focus.ts` | NEW | `FocusContext` + `useFocus`/`useFocusManager` (composer) |
| `tests/renderer/itl-adapter.tsx` | NEW | itl-compatible `render()` composing renderer + VirtualTerminal + InputSource |
| `tests/renderer/component-parity.test.tsx` | NEW | 100% of the component set dual-rendered vs Ink (screen equality) |
| `benchmarks/comparative.bench.tsx` | NEW | the ink-vs-v4 matrix over the component baselines |
| `docs/renderer/m20-parity-report.md` / `docs/renderer/m20-comparative-bench.md` | NEW | evidence artifacts |
| `.claude/knowledge-base/adrs/0004-renderer-cutover.md` | NEW | the cutover ADR (conservative, owner sign-off) |

### Current callers / dependents

- `src/chat-thread.tsx` / `src/agent-timeline.tsx` use Ink's `<Static>` for graduated history; the M11 oracles (`chat-thread.test.tsx:52,91,206,239,275,306,336,360`, `agent-timeline.test.tsx:340,373,394,498,522,566`) MUST pass on the new renderer.
- `src/welcome-banner.tsx:165` uses `useStdout()` (reads `stdout.columns/rows/isTTY`).
- `src/chat-composer.tsx:294-295` uses `useFocus`/`useFocusManager` (ESC-refocus).
- The renderer today renders everything transiently (no `internal_static`, no `skipStaticElements`).

### Domain glossary

- **Static / scrollback** — graduated history emitted ONCE above the live frame, never re-rendered/erased.
- **staticNode / isStaticDirty** — the cached static subtree + the flag that forces a static re-emit.
- **skipStaticElements** — the live-pass flag that skips the static subtree.
- **screen-comparison proxy** — dual-render a scene through Ink AND our renderer on `@xterm/headless`, compare the emulator screen (M18 approach; snapshots are Ink-authoritative, not diffed across engines).
- **focus manager** — the registry + `focus(id)` + Tab/ESC arbiter Ink's App owns.

### Architecture boundaries affected

- `src/renderer/` gains `components/` (Static) + `hooks/` (useStdout/useFocus) — still zero imports from the Ink component path (island purity). The hooks use our own React contexts, never Ink's.
- The output-engine's two-region split is internal; the `createRenderer` public API is unchanged.

## Prior Art

- **Blueprint:** `.claude/knowledge-base/discoveries/blueprints/m20-scrollback-cutover-blueprint.md` (SHIPPABLE_WITH_CAVEATS) — Ink dual-pass map + ADRs D1–D5 + the 7 risks.
- **Ink 7 (MIT, studied):** `node_modules/ink/build/components/Static.js`, `renderer.js`, `render-node-to-output.js:73`, `reconciler.js:152-158`, `ink.js:415-418,785-786`, `hooks/use-focus.js`, `hooks/use-focus-manager.js`, `hooks/use-stdout.js`.
- **M18 parity report + parity-corpus.test.tsx** — the screen-comparison-proxy precedent (the M20 harness extends it).
- **M17/M18/M19 renderer:** `src/renderer/` — the seams this builds on.

## ADRs

### D1 — Static = Ink dual-pass (static written once above the differential live frame)
**Alt:** pi unified line buffer (re-derives graduation from line diffs → re-opens every oracle); re-emit-every-frame (defeats the diff). Chosen: our components encode Ink's Static contract exactly; the oracles assert it directly.

### D2 — Component-suite migration via an itl-compat adapter + the screen-comparison proxy, NOT raw snapshot diff
**Alt:** diff the 37 `.snap` across engines (Ink ANSI ordering ≠ our normalized readback — M18 established); rewrite all 214 assertions natively (enormous, throws away the Ink oracle). Chosen: dual-render screen equality across the full component set.

### D3 — Cutover = conservative: Ink stays default+fallback, v4 opt-in, drop deferred to the next major with a SECOND owner-signed ADR
**Alt:** flip default to v4 now / drop Ink at M20 — both rejected (insufficient soak; irreversible in the milestone that only just produces the evidence). The renderer is already subpath-only (opt-in is the current shape). **The drop-Ink decision is the human owner's.**

### D4 — Implement `Static`/`useStdout`/`useFocus`/`useFocusManager`; NOT `useApp`/`useStdin`/`Transform`/`measureElement`
**Alt:** full Ink hook surface — rejected (YAGNI; grep shows zero shipped consumers of the latter set).

### D5 — Comparative bench: add an `engine` (ink|v4) axis + `bytes_written` to the existing baseline schema; ≥3 runs mean±std_dev; throttled+unthrottled; regressions carry citable causes
**Alt:** a new bench format — rejected (DRY: extend `docs/benchmarks/*.json`; the renderer benches already dual-run with the bytes axis).

## Dependencies

(none new — Static/hooks/adapter are built from React + the existing renderer + @xterm/headless + node-pty already installed. deps-audit: no new runtime deps.)

## Critical paths

- `src/renderer/output-engine.ts` — the two-region write (static-once-above vs differential-live-below).
- `src/renderer/renderer.ts` — the dual-pass paint.
- `src/renderer/hooks/use-focus.ts` — the focus arbiter (the hardest gap).
- `tests/renderer/component-parity.test.tsx` — the DoD-2 gate.

## Phase 1: Static scrollback engine + useStdout

### T1.1 — Static dual-pass + `<Static>` + useStdout

#### Objective
Port Ink's dual-pass Static so graduated history writes once above the differential live frame (M11 oracles pass on the new renderer), ship a `<Static>` component, and implement `useStdout` (welcome-banner's dependency).

#### Why this step (action + reasoning)
1. **What:** RED — scrollback oracle (graduated rows appear once above the live tail on the VirtualTerminal); host-config marks `internal_static`; render-node skips it in the live pass; output-engine.writeStatic writes once; useStdout returns the terminal dims. GREEN — the two-region paint + `<Static>` + `StdoutContext`.
2. **Why now:** ChatThread/AgentTimeline/WelcomeBanner cannot render on our engine without Static + useStdout; they gate DoD-2.

#### Evidence
Blueprint §1 (contract), §2 (engine design), §5 (useStdout), ADR D1/D4; Ink `Static.js`, `renderer.js`, `render-node-to-output.js:73`, `reconciler.js:152-158`, `ink.js:785-786`, `hooks/use-stdout.js`.

#### Files to edit
```
src/renderer/host-config.ts / src/renderer/render-node.ts / src/renderer/output-engine.ts / src/renderer/renderer.ts
src/renderer/components/static.tsx (NEW) / src/renderer/hooks/use-stdout.ts (NEW)
tests/renderer/scrollback-corpus.test.tsx (NEW) / CHANGELOG.md
```

#### TDD
```
RED: host_config_marks_internal_static_and_caches_staticNode() — createInstance on an internal_static box → node.internal_static true; root.staticNode set
RED: render_node_skips_static_subtree_in_live_pass() — renderNodeToOutput({skipStaticElements:true}) omits the static subtree; the static pass renders it
RED: output_engine_writeStatic_writes_once_and_is_not_diffed() — writeStatic(["a","b"]) then a live render → "a","b" written once, NOT in previousLines (a later render never erases them)
RED: static_component_renders_each_item_once() — <Static items={["x","y"]}> through createRenderer → both appear; a rerender with a 3rd item appends only "z" (append-once)
RED: chatthread_graduated_prefix_appears_once_above_live_tail() — a 20-msg ChatThread on VirtualTerminal → graduated rows above the live tail, each once (the M11 print-once contract)
RED: use_stdout_returns_terminal_dimensions() — a component calling useStdout() sees columns/rows/isTTY from the injected Terminal
VERIFY: pnpm vitest run tests/renderer/scrollback-corpus.test.tsx src/renderer/output-engine.test.ts
```

#### Concurrency tests
(none — single-threaded)

#### Failure scenarios (external I/O — terminal writes)
- Resize during scrollback: the full-redraw path (`CLEAR_SCREEN_HOME`) must re-emit `fullStaticOutput` OR the divergence is documented + budgeted (M18 precedent). A test asserts the accumulator re-emits (or the report records the budget).

#### Acceptance Criteria
- [ ] `pnpm vitest run tests/renderer/scrollback-corpus.test.tsx` exits 0; the graduated-once-above-live oracle passes; output-engine at 100% lines
- [ ] RED exit recorded (progress notes)
- [ ] `<Static>` + `useStdout` render on the new renderer; ChatThread/WelcomeBanner mount without throwing
- [ ] Zero Ink-component-path imports in `src/renderer/`

#### DoD (Definition of Done)
- [ ] `pnpm gates` exits 0

## Phase 2: Focus manager + itl-compat adapter

### T2.1 — useFocus/useFocusManager + the itl adapter

#### Objective
Implement the focus manager (`useFocus`/`useFocusManager` over a `FocusContext`, with the Tab/ESC arbiter) so ChatComposer renders on our engine, and build an itl-compatible `render()` adapter composing renderer + VirtualTerminal + InputSource.

#### Why this step (action + reasoning)
1. **What:** RED — useFocus reports isFocused; focusManager.focus(id) re-focuses; Tab cycles; ESC blurs before useInput subscribers; the adapter exposes lastFrame/stdin/rerender/unmount/frames. GREEN — FocusContext + arbiter + the adapter.
2. **Why now:** the composer + the whole-suite harness both need focus + the adapter.

#### Evidence
Blueprint §3 (adapter), §5 (useFocus), risk R2; Ink `hooks/use-focus.js`, `hooks/use-focus-manager.js`, App focus ordering; M19 InputSource + `composer-compat.test.tsx`.

#### Files to edit
```
src/renderer/hooks/use-focus.ts (NEW) / src/renderer/hooks/use-focus.test.tsx (NEW)
tests/renderer/itl-adapter.tsx (NEW) / tests/renderer/itl-adapter.test.tsx (NEW) / CHANGELOG.md
```

#### TDD
```
RED: use_focus_reports_focused_for_the_autofocus_id() — a component with useFocus({autoFocus:true}) → isFocused true
RED: focus_manager_focus_id_moves_focus() — focus("b") → component b isFocused, a not
RED: tab_cycles_focus_and_esc_blurs() — Tab advances to the next focusable; ESC blurs (arbiter runs before useInput subscribers)
RED: itl_adapter_lastFrame_matches_screen() — adapter.render(<Box><Text>hi</Text></Box>); adapter.lastFrame() contains "hi"
RED: itl_adapter_stdin_write_drives_useInput() — adapter.stdin.write("\x1b[D") reaches a useInput handler in the mounted tree
RED: itl_adapter_lastFrame_includes_scrollback_prefix() — a ChatThread with graduated history → adapter.lastFrame() = scrollback text + live frame (the M11 concatenation contract)
VERIFY: pnpm vitest run src/renderer/hooks/use-focus.test.tsx tests/renderer/itl-adapter.test.tsx
```

#### Concurrency tests
(none — single-threaded)

#### Acceptance Criteria
- [ ] `pnpm vitest run src/renderer/hooks/use-focus.test.tsx tests/renderer/itl-adapter.test.tsx` exits 0; use-focus at 100% lines
- [ ] RED exit recorded (progress notes)
- [ ] ChatComposer renders on the new renderer via the adapter (useFocus resolved, no throw)
- [ ] `adapter.lastFrame()` reproduces Ink's `fullStaticOutput + live` concatenation (asserted against a graduated ChatThread)

#### DoD (Definition of Done)
- [ ] `pnpm gates` exits 0

## Phase 3: 100% component parity + comparative bench + cutover ADR

### T3.1 — component-parity harness + comparative bench + cutover ADR

#### Objective
Prove 100% of the component set renders byte-identical to Ink on the new renderer (screen-comparison harness over every component + scrollback scenes), produce the comparative bench matrix, and write the conservative cutover ADR.

#### Why this step (action + reasoning)
1. **What:** RED — the component-parity gate (every shipped component dual-rendered vs Ink, screen equal, divergences ≤ budget + documented) + the M11 scrollback oracles on the new renderer + the comparative baseline contract. GREEN — the harness, the bench matrix, the parity + bench reports, the cutover ADR.
2. **Why now:** terminal evidence + the go/no-go gate; release follows review.

#### Evidence
Blueprint §4 (migration), §6 (bench), §7 (cutover ADR), ADR D2/D3/D5; M18 `parity-corpus.test.tsx` + `m18-parity-report.md`; the 11 baselines in `docs/benchmarks/`.

#### Files to edit
```
tests/renderer/component-parity.test.tsx (NEW) / benchmarks/comparative.bench.tsx (NEW)
docs/benchmarks/m20-comparative-baseline.json (NEW) / docs/renderer/m20-parity-report.md (NEW) / docs/renderer/m20-comparative-bench.md (NEW)
.claude/knowledge-base/adrs/0004-renderer-cutover.md (NEW) / tests/bench-banner-baseline.test.ts / CHANGELOG.md
```

#### TDD
```
RED: component_parity_all_render_byte_identical_to_ink() — for EVERY shipped component (ChatMessage/ChatThread/ToolCallCard/DiffViewer/CodeBlock/MarkdownText/AppStatusBar/AgentTimeline/AgentStreaming/WelcomeBanner/ContextWindowBar/CostMeter/TokenUsageChart/ChatComposer): dual-render vs Ink on VirtualTerminal, assert screen equal OR the divergence is in m20-parity-report.md; total pass-rate ≥ 90% documented (target 100%)
RED: m11_scrollback_oracles_pass_on_new_renderer() — the header-slot + windowing + print-once oracles for ChatThread/AgentTimeline pass through the new renderer
RED: m20_comparative_baseline_contract() — baseline JSON: each component mode has {ink, v4} with mean_ms_per_frame finite + bytes_written; load<4
GREEN: the harness; comparative.bench.tsx (ink vs v4, ms + bytes, both throttled+unthrottled) + committed baseline; m20-parity-report.md + m20-comparative-bench.md; ADR 0004 (conservative cutover, owner sign-off, alternatives A/B/C)
VERIFY: pnpm vitest run tests/renderer/component-parity.test.tsx tests/bench-banner-baseline.test.ts
```

#### Concurrency tests
(none — single-threaded)

#### Acceptance Criteria
- [ ] `pnpm vitest run tests/renderer/component-parity.test.tsx` exits 0 — **100% of the component set renders on the new renderer** (byte-identical vs Ink, or documented divergence ≤ budget)
- [ ] The M11 header-slot + windowing + print-once oracles pass on the new renderer
- [ ] `docs/benchmarks/m20-comparative-baseline.json` committed (load<4); the ink-vs-v4 ms + bytes matrix stated in `m20-comparative-bench.md`; regressions carry citable causes
- [ ] `.claude/knowledge-base/adrs/0004-renderer-cutover.md` written — conservative decision (Ink default+fallback, v4 opt-in, drop deferred), alternatives A/B/C, **owner sign-off placeholder** (the drop-Ink call is the human's)

#### DoD (Definition of Done)
- [ ] `pnpm gates` exits 0

## Edge cases absorbed
(EC-1 same-length-trap / mount-freeze preserved on the new renderer → T1.1 scrollback oracle; EC-2 resize-during-scrollback fullStaticOutput re-emit → T1.1 failure scenario; EC-3 lastFrame concatenation contract → T2.1 adapter; EC-4 ESC/Tab arbiter before useInput subscribers → T2.1 focus; EC-5 ambiguous-width glyph divergence → T3.1 budget/document; EC-6 snapshot ANSI ordering not diffed across engines → T3.1 screen-proxy)

## Coverage Matrix

| # | Gap / Requirement (source) | Task(s) | Resolution |
|---|---|---|---|
| 1 | M20 DoD-1: Static-equivalent append-once scrollback; M11 header-slot + windowing oracles pass (ROADMAP § M20) | T1.1, T3.1 | dual-pass Static + scrollback oracle + M11 oracles on the new renderer |
| 2 | M20 DoD-2: 100% component suite green on the new renderer (ROADMAP § M20) | T2.1, T3.1 | itl-adapter + screen-comparison harness over every component |
| 3 | M20 DoD-3: full comparative bench, both engines, regressions with citable causes (ROADMAP § M20) | T3.1 | comparative.bench.tsx (ink|v4, ms+bytes, throttled+unthrottled) + baseline |
| 4 | M20 DoD-4: cutover ADR, human-approved (ROADMAP § M20) | T3.1 | ADR 0004 (conservative, alternatives, owner sign-off) |
| 5 | M20 DoD-5: gates/coverage/CHANGELOG (ROADMAP § M20) | T1.1–T3.1 | per-task gates |
| 6 | M20 risk-1: hidden Ink behaviors never pinned (blueprint R6) | T3.1 | screen-proxy surfaces per-scene; divergence budget |
| 7 | M20 risk-2: throttled vs unthrottled bench paths (blueprint) | T3.1 | bench both paths |
| 8 | Missing hooks (useStdout/useFocus/useFocusManager) for suite-on-new-renderer (blueprint §5) | T1.1, T2.1 | implemented over own contexts |

**Coverage: 8/8 (100%)**

## Drawbacks & Risks

| Drawback / Risk | Severity | Mitigation | Owner |
|---|---|---|---|
| Static composing with the differential engine (erase/scrollback) | High | writeStatic bypasses previousLines; fullStaticOutput re-emit on resize; budget resize-during-scrollback | implement |
| useFocus without Ink's focus manager | High | FocusContext + Tab/ESC arbiter at the input-source level before useInput dispatch | implement |
| lastFrame concatenation contract (scrollback + live) | High | adapter reads the emulator scrollback buffer / prepends fullStaticOutput | implement |
| Ink-component tests on a non-Ink renderer (snapshot ANSI ordering) | Medium | screen-comparison proxy, not raw snapshot diff | implement |
| Ambiguous-width glyph divergence | Medium | align string-width with the emulator or budget + document | implement |

## Failure scenarios (when I/O external)
The renderer writes to a Terminal (in-process). The resize-during-scrollback re-emit is the one non-happy path (T1.1 failure scenario). No network/DB/queue.

## Unresolved Questions
- Two-region (Ink) vs unified (pi) scrollback → **two-region** (blueprint ADR D1 — the oracles assert it).
- Ship our own `Box`/`Text`/`Static` re-exports now, or keep importing Ink's factory? → **keep importing Ink's Box/Text; ship OUR `<Static>`** (the components already emit `ink-box`/`ink-text` our host receives; a full re-export is the M-next Ink-drop, not M20's opt-in gate).
- Focus-manager scope → **minimal single-focus + ESC-refocus + Tab-cycle** (what the composer uses); full Ink focus parity deferred.
- `.frames` history → **document as best-effort** (diff-stream vs full-frame); assert on lastFrame/screen not raw `.frames` bytes.

## Test Plan
Scrollback engine oracles (host-config marker / render-node skip / output-engine writeStatic / Static append-once / ChatThread graduated-once) + useStdout dims + useFocus/manager/arbiter + itl-adapter (lastFrame/stdin/scrollback-concat) + the 100%-component screen-parity harness + the M11 oracles on the new renderer + the comparative baseline contract. Discipline per `.claude/rules/testing.md` (§4.1 negatives — resize-during-scrollback, ESC-blur, focus-none; §6 determinism — emulator + microtask coalescing, no real timers). Two consecutive full runs green.

## Global Definition of Done
- [ ] All tasks committed gates-gated (1 task = 1 commit, FULL `pnpm gates`)
- [ ] Static scrollback: M11 header-slot + windowing + print-once oracles pass on the new renderer
- [ ] 100% of the component set renders on the new renderer (screen-parity, divergences documented)
- [ ] Comparative bench matrix committed (both engines, ms+bytes, load<4); regressions with citable causes
- [ ] Cutover ADR 0004 written (conservative; owner sign-off placeholder for the drop-Ink call)
- [ ] Plan archived post-release
