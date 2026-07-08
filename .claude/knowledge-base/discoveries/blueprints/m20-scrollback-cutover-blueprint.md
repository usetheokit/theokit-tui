---
question: How do we add Static-equivalent scrollback to the custom renderer, run 100% of the component suite on it, produce comparative benches, and frame the Ink cutover?
milestone_id: M20
created_at: 2026-07-08
verdict: SHIPPABLE_WITH_CAVEATS
---

# M20 Blueprint — Scrollback semantics + component migration + cutover gate

M17 skeleton → M18 Yoga layout → M18 100% Ink parity (14/14 + SGR) → M19 input stack. M20's two remaining pillars before Ink can be dropped: (1) Static/scrollback, (2) 100% component suite on the new renderer. Plus comparative benches + a cutover ADR (human-approved).

## 1. Scrollback contract

### Ink's Static (the contract to reproduce)
- `Static.js`: `[index,setIndex]=useState(0)`; `itemsToRender=items.slice(index)`; `useLayoutEffect(()=>setIndex(items.length))` — **index advances by length ONLY** (the same-length trap). Wrapper `createElement("ink-box",{internal_static:true},children)`.
- `reconciler.js:152-158`: prop `internal_static` → `node.internal_static=true`, `rootNode.isStaticDirty=true` (immediate un-throttled render), `rootNode.staticNode=node` (O(1)).
- `renderer.js`: TWO passes — live `renderNodeToOutput(node, output, {skipStaticElements:true})`; static `renderNodeToOutput(staticNode, staticOutput, {skipStaticElements:false})`. Returns `{output, outputHeight, staticOutput}` (+trailing \n).
- `render-node-to-output.js:73`: `if (skipStaticElements && node.internal_static) return;` — live pass skips static subtree.
- `ink.js:785-786`: static written DIRECTLY to stdout (permanent scrollback): `log.clear(); stdout.write(staticOutput); log(outputToRender)`. `fullStaticOutput` accumulates all static (`ink.js:415-418`) for full-repaints.
- **Invariant:** a graduated item is emitted to scrollback exactly ONCE, above the live region, never re-rendered/erased.

### Our components' contract (chat-thread.tsx / agent-timeline.tsx — identical windowing, Rule-of-3 deferred)
- `tailStart = max(0, messages.length − max(0,windowSize) − max(0,windowOverscan))`; before tailStart → `<Static>`; last window+overscan rows → live tail.
- Rows `memo`'d by object identity (`prev.message===next.message`); streaming replaces the last object → only that row repaints.
- **Header slot (M11):** optional `header` folded as FIRST `<Static>` item via `HEADER_SENTINEL` (key `__theokit_tui_header__`); prints once, pinned above history; colliding id throws.
- **Mount-freeze (M11 D1):** `frozenHeader=useRef(header).current` — defends the same-length trap (shrinking union keeps items.length constant → would permanently skip a freshly graduated row).

### M11 oracles that MUST pass (DoD-1)
ChatThread (`chat-thread.test.tsx`): long_thread_splits_history_into_static_prefix (:52, rerender repaints ONLY 6 live rows), window_boundary_row_count_is_exact (:91), static_prefix_is_frozen_after_graduation (:206), window_size_zero_keeps_overscan_tail_live (:130), negative_window_values_clamp_to_zero (:157), header_stays_above_graduated_history (:239, `split("BANNER").length-1===1` print-once), header_change_is_ignored_after_mount (:275), header_removal_is_ignored_and_loses_no_rows (:306 same-length trap), late_header_is_ignored (:336), sentinel_key_collision_throws_typed (:360). AgentTimeline mirrors (:340,:373,:394,:418,:498,:522,:566).
- **Load-bearing:** oracles read `lastFrame()` = `fullStaticOutput + live frame` concatenated, asserting substring ORDER + occurrence COUNTS. The adapter's `lastFrame()` MUST reproduce that concatenation (scrollback text + live) — the tightest DoD-1↔DoD-2 coupling.

## 2. Scrollback engine design (Ink dual-pass, adapted to our differential engine — ADR D1)

Gap today: host-config ignores `internal_static`; render-node has no `skipStaticElements`; output-engine diff-paints one region and `CLEAR_SCREEN_HOME="\x1b[2J\x1b[H\x1b[3J"` even clears scrollback. renderer.paint rasterizes one grid.

Three layered changes:
- **(a) host-config** — `createInstance` detects `props.internal_static` → `node.internal_static=true`, cache `root.staticNode=node`, set `root.isStaticDirty`. Add `internal_static?`/`staticNode?` to RendererNode/RootNode. (createInstance lacks the root ref — read in commitUpdate/append or thread a ref.)
- **(b) render-node** — add `skipStaticElements` to WalkOptions; `if (opts.skipStaticElements && node.internal_static) return;` at top; thread through recursion.
- **(c) renderer + output-engine — two-region paint** — live pass over root `{skipStaticElements:true}`; static pass over `root.staticNode` `{skipStaticElements:false}` (Yoga must lay out the static subtree — separate calculateLayout or read the computed subtree geometry). New `OutputEngine.writeStatic(lines)` writes graduated lines DIRECTLY to terminal ONCE, NOT recorded in `previousLines` (so the differential engine never re-diffs/erases them); live frame paints below. Only emit static delta when staticNode changed (isStaticDirty watermark). Reconcile full-redraw (`CLEAR_SCREEN_HOME`) with unerasable scrollback: keep a `fullStaticOutput` accumulator, re-emit on resize (Ink `ink.js:415-418`), OR budget resize-during-scrollback divergence.

Reject pi's unified-buffer scroll (`tui.ts:1461-1476`) — would force re-deriving the graduation boundary from line diffs, re-opening every oracle.

Test oracle: `tests/renderer/scrollback-corpus.test.tsx` — render ChatThread/AgentTimeline through both engines on VirtualTerminal; assert graduated rows appear once above the live tail (the emulator models scrollback via `buffer.getLine(viewportY+i)`).

## 3. The itl-compatible test adapter (ADR D2)

Building blocks exist: `createRenderer(terminal)`, `VirtualTerminal` (write/resize/flush/screenLines/writeStream), `createInputSource`+`InputContext`+`useInput` (M19), and the dual-run precedent `parity-corpus.test.tsx` (Ink vs ours, 14/14).

itl surface to implement (`tests/renderer/itl-adapter.ts`, drop-in `render`):
- `render(element)` = createRenderer(new VirtualTerminal()) + r.render — trivial.
- `.lastFrame()` = flush + join screenLines() **prepended with accumulated scrollback text** (§1.3) — medium; needs the §2 accumulator exposed.
- `.frames` = append screenLines().join after each tick — medium (our engine writes diffs; assert on lastFrame/screen not raw `.frames` bytes — M18 methodology caveat).
- `.rerender` = r.render again — trivial. `.unmount` = r.unmount — trivial.
- `.stdin` = wrap createFakeStdin → createInputSource mounted via InputContext.Provider; `.stdin.write` = fakeStdin.send — medium (auto-wire the provider).
- `.stdout` = expose writeStream + columns/rows (welcome-banner reads stdout.columns) — medium (satisfy useStdout).

Determinism point: `tests/helpers.tsx` `renderFrame` (render + setTimeout(0) + lastFrame + unmount) used 214×. Re-point it at the adapter (behind `THEO_TUI_ENGINE=v4`) → bulk migrates in one edit. Verify the 0ms-tick vs microtask-coalesce landing (like `react19_commit_behavior_pinned_empirically`).

## 4. Component-suite migration (dual-run, not replace — matches M18 divergence discipline)

Scope: 21 component test files, 214 renderFrame, 71 render, 37 toMatchSnapshot, 16 files import itl.
1. Adapter + hooks (§5) + scrollback (§2) landed + unit-tested.
2. Re-point `renderFrame` behind `THEO_TUI_ENGINE=v4` → same 214 assertions run on either engine (dual-run). Default stays Ink; CI adds a v4 matrix leg.
3. **Snapshots:** do NOT diff the 37 `.snap` across engines (Ink ANSI ordering ≠ our normalized readback — M18 established). Extend the screen-comparison proxy (`parity-corpus.test.tsx`) to cover scrollback + composer + full set. Snapshots stay Ink-authoritative; parity via dual-render screen equality.
4. Direct `render` tests (stdin/frames) migrate via the adapter.

Divergence budget (M18 ≥90% + documented-verdict): ambiguous-width glyphs (`✦` 1 vs 2 — M18 watch item, align width table or budget); spinner timing frames; `.frames` diff-vs-full-frame; SGR ordering (excluded by design). Target 100% assertions green on the v4 leg via screen-proxy + adapter; document every divergence in `docs/renderer/m20-parity-report.md`.

## 5. Missing Ink hooks (grep-confirmed; ADR D4)

| Hook | Used by | M20 action |
|---|---|---|
| useInput/usePaste | chat-composer | DONE (M19) — adapter wires the provider |
| Static | chat-thread, agent-timeline | **IMPLEMENT** (§2) — the core work; ship `<Static>` over host `internal_static` |
| useStdout | welcome-banner (`stdout.columns/rows/isTTY`) | **IMPLEMENT** — small `StdoutContext` proxying Terminal dims |
| useFocus | chat-composer (`{isFocused}=useFocus({autoFocus,id})`) | **IMPLEMENT** — focus manager (hardest gap) |
| useFocusManager | chat-composer (`focus(id)` on ESC-refocus) | **IMPLEMENT** — FocusContext registry + focus(id); Ink's App intercepts ESC/Tab BEFORE subscribers |
| Box/Text | all | DONE (M17/M18); full drop needs our own re-exports emitting the same host element types |

Do NOT implement useApp/useStdin/Transform/measureElement (zero shipped consumers — YAGNI).

## 6. Comparative bench (DoD-3, ADR D5)

11 baselines (M0-M18) + 13 bench files. The two RENDERER benches (renderer-skeleton, renderer-layout) ALREADY dual-run Ink vs ours with the honest bytes-written methodology. The 9 COMPONENT benches render Ink-only → need the adapter for a v4 leg. Extend the baseline JSON schema with an `engine` (ink|v4) axis + `bytes_written` + delta column; ≥3 runs mean±std_dev; both throttled+unthrottled (M20 risk #2). Regressions need citable causes (e.g. "v4 slower on chat-message: per-cell colorize on the full grid vs Ink's transform cache"). Bytes axis should show v4 winning decisively — headline cutover evidence.

## 7. Cutover ADR (DoD-4 — human-approved; ADR D3)

Options: **A** keep Ink default+fallback, v4 opt-in (`@theokit/tui/renderer`), drop deferred to next major with a SECOND signed ADR ← **recommended (conservative)**; B flip default to v4 now; C drop Ink at M20 (reject — irreversible, insufficient soak). Why A: M20 PRODUCES the parity evidence; consuming it in the same milestone to drop a battle-tested dep violates the divergence-budget caution governing the whole program; the renderer is already subpath-only (opt-in is the current shape); A is the smallest reversible step. Evidence the ADR cites: m20-parity-report (100% suite), comparative bench table, scrollback oracles green, missing-hooks matrix complete, resize-during-scrollback documented. Governance: alternatives + owner sign-off; the drop-Ink flip requires a separate ADR gated on real-use soak (dogfood golden rule). **The irreversible drop decision is the human owner's — the blueprint frames it.**

## 8. Risks

- R1 (HIGH) Static composing with differential engine — writeStatic bypasses previousLines; fullStaticOutput re-emit on resize; budget resize-during-scrollback.
- R2 (HIGH) useFocus without Ink's focus manager — build FocusContext + Tab/ESC arbiter at the input-source level BEFORE dispatching to useInput subscribers (mirror Ink App ordering). Largest unknown.
- R3 (MED) Ink-component tests on non-Ink renderer — screen-proxy not raw snapshot; assert lastFrame/screen.
- R4 (HIGH) lastFrame() concatenation contract — adapter must read the emulator scrollback buffer too (getLine below viewportY) or prepend fullStaticOutput.
- R5 (MED) ambiguous-width glyphs — align string-width with the emulator or budget.
- R6 (MED) hidden Ink behaviors — divergence budget + screen-proxy surfaces per-scene.
- R7 (MED) Yoga layout of the static subtree — separate calculateLayout or read computed subtree geometry.

Open (grill): two-region vs unified scrollback (recommend two-region); ship own Box/Text/Static re-exports now or keep importing Ink's factory (defer for opt-in coexistence); focus-manager scope (full Tab-cycling vs minimal single-focus+ESC-refocus — the composer only uses the latter); `.frames` history (implement per-commit capture or document unsupported + migrate the few readers).

## ADRs
- **D1** Static = Ink dual-pass (static written once above the differential live frame). Alt: pi unified buffer (re-opens oracles); re-emit-every-frame (defeats diff).
- **D2** Migration via itl-compat adapter + screen-comparison proxy, NOT raw snapshot diff. Alt: diff .snap across engines (ANSI ordering mismatch); rewrite 214 assertions (enormous).
- **D3** Cutover conservative — Ink default+fallback, v4 opt-in, drop deferred to next major (separate signed ADR). Alt: flip now / drop at M20 (insufficient soak). Human owner's call.
- **D4** Implement Static/useStdout/useFocus/useFocusManager; NOT useApp/useStdin/Transform/measureElement (YAGNI, zero consumers).
- **D5** Comparative bench: `engine`(ink|v4) axis + bytes_written on the existing schema; ≥3 runs mean±std_dev; throttled+unthrottled; regressions carry citable causes.

**Bottom line:** M20 = port Ink's dual-pass Static (write graduated history once above the M18 differential live frame) + implement useStdout/useFocus/useFocusManager + build an itl-compat adapter so the existing 214-assertion component suite runs on the new renderer via the screen-comparison proxy + a comparative bench matrix + a conservative cutover ADR (Ink stays default, v4 opt-in, drop deferred to the owner). Hardest parts: Static-vs-differential composition (R1/R4) and the focus manager (R2).
