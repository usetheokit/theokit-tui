---
slug: m17-renderer-skeleton
milestone_id: M17
created_at: 2026-07-08
discovery_plan: .claude/knowledge-base/discoveries/plans/m17-renderer-skeleton-plan.md
question: How do we build a custom react-reconciler host + differential CSI-2026 output engine whose walking skeleton renders a React <Text> tree byte-parity with Ink, testable against a real terminal emulator?
---

# Blueprint: m17-renderer-skeleton

## Context

V4 program (ADR 0003). Fase B read end-to-end: Ink `reconciler.ts` (419
— the host-config hook map extracted), pi `tui.ts` render region
(:1254-1500 — coalescing, strategy ladder, CSI-2026 buffers, reasoned
fullRender), pi `test/virtual-terminal.ts` (218 — the @xterm/headless
oracle). Q1–Q5 all `done`.

## Objective

Lock the host-config subset, the output-engine strategy ladder, the
VirtualTerminal harness, the parity gate and the bytes-measured bench.

## Cross-cutting Comparison

| Aspect | Ink | pi/tui | OURS (M17 skeleton) |
|---|---|---|---|
| React bridge | full HostConfig w/ Yoga nodes (`reconciler.ts:204-361`) | none (imperative components) | minimal mutation-mode HostConfig, TEXT-only (no Yoga until M18) |
| render trigger | `resetAfterCommit` → `onComputeLayout`+`onRender` (`reconciler.ts:160-190`) | `requestRender()` coalesced via `renderRequested`+`renderTimer` (`tui.ts:306-307`) | resetAfterCommit → requestRender (pi coalescing on the React commit signal) |
| output strategy | full-frame string + log-update-style erase/rewrite, throttled | strategy ladder: first-render / width→fullRender(clear) / height→fullRender unless Termux / clearOnShrink / line-diff first..last changed / append fast-path / deleted-tail clear (`tui.ts:1335-1475`) | the SAME ladder minus kitty-image branches (M21) and overlays (out) |
| flicker control | none (relies on throttle) | every buffer wrapped `\x1b[?2026h…l` (`tui.ts:1286,1463`) | same CSI-2026 wrapping (EC-3: ignored gracefully where unsupported) |
| observability | none | `logRedraw(reason)` + `fullRedrawCount` (`tui.ts:1331,1285`) | same reasoned-fallback logging (a renderer bug is undebuggable without it) |
| test oracle | ink-testing-library fake stdout (string frames) | @xterm/headless REAL emulator (`virtual-terminal.ts:11-80`) | pi's VirtualTerminal shape — screen-state asserts, not stream asserts |

## Recommendations

1. `src/renderer/` (new, self-contained, ZERO imports from the Ink path):
   `host-config.ts` (reconciler), `output-engine.ts` (strategy ladder),
   `renderer.ts` (`createRenderer(terminal)` public seam), `terminal.ts`
   (Terminal interface — pi's shape, so VirtualTerminal plugs in).
2. Host-config minimal set (from Ink's map): `createInstance`,
   `createTextInstance`, `appendChild(+InitialChild/ToContainer)`,
   `insertBefore`, `removeChild(+FromContainer)`, `commitUpdate`,
   `commitTextUpdate`, `resetAfterCommit`, `clearContainer`,
   `supportsMutation: true` — everything else stubbed honestly.
3. Node tree: plain objects `{type:"text", value}` + root; line assembly
   = depth-first text concat with `\n` splits (no layout at M17).
4. Bench: same scene on Ink vs ours; metrics = ms/frame AND
   bytes-written/frame (EC-5 — the diff win IS bytes).

## Coverage Corner 1 — Integration Tests

Oracle set: (a) mount renders the tree to the emulator screen (assert
via xterm buffer lines, not stream); (b) update rewrites ONLY changed
lines (spy on `terminal.write` — the buffer must NOT contain unchanged
lines; the diff strategy oracle); (c) append fast-path (new tail lines
written without touching prior rows); (d) deleted-tail clears rows
(`\x1b[2K` path); (e) width-resize triggers fullRender(clear) WITH a
logged reason (EC-1); (f) unmount restores cursor + screen consumable
(EC-2 — `\x1b[?25h` observed); (g) CSI-2026 wrapping present on every
write AND content parity holds when the emulator ignores it (EC-3);
(h) React 19 commit behavior pinned EMPIRICALLY (double-render canary —
the M10 lesson, EC-4); (i) PARITY GATE — the same `<Text>` scene through
Ink (itl) and ours (VirtualTerminal): final screen text equal
line-by-line (divergences documented per-diff). Snapshot budget ≤ 2
(one screen-state snapshot per engine scene).

## Coverage Corner 2 — Dependencies

`react-reconciler ^0.33.0` (prod — Ink 7's exact pin, collapses API-churn
risk) + `@xterm/headless 5.5.0` (devDep — pi's pin). Both MIT. deps-audit
required in the plan chain (new prod dep = full CVE pass). NO chalk, NO
yoga at M17.

## Coverage Corner 3 — Tools

**Bench (REQUIRED):** `benchmarks/renderer-skeleton.bench.tsx` — modes
`ink` vs `own` on an identical 200-line append+update scene; metrics
ms/frame AND total bytes written (count via the Terminal.write spy);
baseline committed with `load_1min_at_start`. **Example:**
`examples/renderer-skeleton.tsx` (opt-in entry, TTY only). **Parity
artifact:** `docs/renderer/m17-parity-report.md` — per-line diff table
vs Ink with a verdict per divergence.

## Coverage Corner 4 — Techniques

**Host config (Ink-extracted):** mutation mode; `resetAfterCommit(root)`
is THE render trigger (`reconciler.ts:160-190` — Ink calls
onComputeLayout/onRender there; ours calls `engine.requestRender()`);
`commitTextUpdate(node,_,new)` mutates the text node (`:361`);
`clearContainer: () => false` (`:159`); text-only host context.

**Output engine (pi-extracted ladder, in order):** first-render → write
all (no clear); widthChanged → fullRender(clear) [wrapping changes];
heightChanged → fullRender(clear) [viewport realign; Termux exception
NOT ported — YAGNI, documented]; clearOnShrink when content < prior max;
line-diff: scan first..last changed (`tui.ts:1370-1390`); pure-append
fast path; deleted-tail: move + `\x1b[2K` per row, fullRender if
extraLines > height (`:1420-1440`); firstChanged above viewport →
fullRender (scrollback immutable, `:1455-1460`). ALL buffers
`\x1b[?2026h…\x1b[?2026l`. `logRedraw(reason)` + counter on every
fallback.

**Coalescing:** `requestRender()` sets a flag + `setImmediate`-class
timer (pi `renderRequested`/`renderTimer`) — N commits in one tick = one
paint.

**Harness:** port pi's VirtualTerminal shape (Terminal interface:
`write/columns/rows/start/stop/hideCursor/showCursor`) reading the
xterm buffer for asserts: `term.buffer.active.getLine(i)` text — the
oracle is the SCREEN, not the byte stream (bytes are asserted only in
the diff-strategy spy oracles).

## ADRs

### D1 — react-reconciler ^0.33.0, mutation mode, text-only host (FINAL)

Ink's exact pin + hook subset. **Alternatives:** latest reconciler
(churn); no-React engine (violates ADR 0003's thesis); react-dom/server
(no incremental commits).

### D2 — pi's strategy ladder + CSI-2026 + reasoned fallbacks (FINAL)

Ported minus kitty/overlay/Termux branches (M21/out/YAGNI).
**Alternatives:** always-full (bytes/flicker); cell-grid diff (xterm
complexity, YAGNI at skeleton).

### D3 — @xterm/headless as the test oracle (FINAL)

pi's proven harness; screen-state asserts. **Alternatives:** fake stdout
strings (cannot validate cursor/clear/CSI semantics — the whole point);
node-pty e2e (heavier, flakier; reserved for M19).

### D4 — Evidence: dual-engine bench with BYTES metric + parity report (FINAL)

**Alternatives:** frames-only bench (hides the diff win — EC-5);
claimed parity without the per-line artifact (fabrication risk).
