# Implementation: m10-react19-ink7

**Date:** 2026-07-07/08
**Plan:** `plans/m10-react19-ink7-plan.md` (SHIPPABLE 95.2)
**Blueprint:** `discoveries/blueprints/m10-react19-ink7-blueprint.md` (SHIPPABLE 96.8)
**Verdict:** IMPLEMENTATION_COMPLETE · validation exit 0 · code-quality PASS
**Shipped:** `@theokit/tui@0.11.0` (PR 16, tag v0.11.0, npm latest)

## Task ledger

| Task | Commit | Delivered |
|---|---|---|
| T1.1 bump | `c546529` | ink ^7.1.0 + react ^19.2.0 peer + devDeps 19.2.7/@types 19.2 + engines >=22; typecheck 0 FIRST RUN; audit clean; pins flipped RED-first |
| T1.2-T1.4 suite | `4f79f9a` | 457/457 green; never-weaken guard; pipe-contract pin; 2 snapshots re-recorded + review table (multi-task commit — logged deviation, see review) |
| T2.1 canary | `643bb5e` | strict-effects canary — EMPIRICAL single-invoke pinned (source-inferred flip REFUTED — D5's purpose) |
| T2.2 bench | `ef3dc62` | 6 new-stack baselines + `stack` provenance + 20-metric jump table + engine A/B; spinner-phase normalization |
| T2.3 release | `68a7a6d` + release commits | CI [22.x,24.x], README platform, TTFATT 5.4 s, published 0.11.0 |
| validation fixes | `849a6b9` | provenance suite extracted (file budget); real T2.3 sha |

## Triage table (D2 — reconstructed for the audit trail; the bump produced

exactly 4 failures out of 456)

| Failure | Class | Resolution | Citation |
|---|---|---|---|
| `package_manifest_declares_apache2_license_and_node20_floor` | version-pin flip (by design) | pin → `>=22`, test renamed `node22_floor` | blueprint Corner 2 |
| `tool-call-pending` (+4 sibling snapshots, same file) | (a) ink behavior | re-record; SGR resequencing `[1m…[2m…[22m` → `[1m…[22m[2m…[22m`; visible text byte-identical | blueprint Corner 4 / F3; m10-snapshot-review.md |
| `tool-call-card` | (a) ink behavior | same | same |
| `light-theme-scene` | (a) ink behavior | same | same |
| (post-T2.2 flake) `term_dumb_scene_matches_no_color_bytes_modulo_marker` | (a) ink behavior — single-final-frame makes spinner PHASE process-timing-dependent | normalize dots glyphs both sides (phase was never the oracle); 3× green | blueprint Corner 4 pipe contract |

Zero class-(b) (our bugs), zero class-(c) (harness ports) — the blueprint's
harness-keep verdicts held exactly.

## Bench evidence — honest causal statement (supersedes the jump-table's

original "uniform 4–6×" wording, which the review found overstated)

The 20/20 ADVERSE deltas are explained by the ink 7 engine on the
unthrottled debug/testing path as **fixed ~6.5–10 ms per render PLUS a
component proportional to tree content (~1.6–2.4× on heavy frames)**:

- Micro A/B (minimal `<Text>`): 1.6→10.5 ms wall (~6.5×), 0.15→6-8 ms
  CPU-pure (~40×) — isolates the FIXED term only.
- Fixed-cost fit (`new = old + 8.5`): near-perfect on cheap frames
  (m3-bounded residual −0.07 ms) but leaves large residuals on heavy frames
  (m4-full +122 ms) — hence the proportional term.
- m2 anomaly (residual multiplier 5.25×) resolved by a directed A/B:
  20-row card fixture on ink7 = ~54 ms/rerender static (per-node cost) and
  the animated spinner adds +35–48 EXTRA full-tree frames per run (each
  timer tick renders the whole tree on the unthrottled path) — engine
  behavior, NOT our regression (fixture unchanged since M2).
- Context: real TTY consumers run ink7's throttled default (~34 ms
  coalescing); gemini-cli's ink fork exists over exactly this territory.

Gate (plan D3): every ADVERSE has a citable, experimentally isolated cause
→ documented-and-proceed; new baselines are THE reference.

## Deviations (logged)

- **DV-1 — release preceded /review.** The plan embedded release+publish in
  T2.3; the 6-role review ran post-publish as a corrective (findings shipped
  as the 0.11.1 batch). RULE captured: release is NEVER a plan task.
- **DV-2 — T2.1 AC superseded by experiment.** The plan expected the
  StrictMode 2/1 flip; the experiment refuted the source inference — canary
  pins the OBSERVED 1/0 and the DV-1(M7) claim stands. Honest supersession,
  recorded in canary header + CHANGELOG.
- **DV-3 — multi-task commit 4f79f9a** (T1.2+T1.3+T1.4) — anti-pattern
  noted; progress file maps all three; 1-task-1-commit going forward.

## Review outcome

Corrective review 2026-07-08 (2 triple-role subagents covering the 6
roles): 2 HIGH (shallow-CI guard break; missing summary — this file), 4
MEDIUM (triage table — above; snapshot-review guard test; flip SHA; jump
table wording — rewritten above), 6 LOW, 3 INFO — ALL addressed in the
0.11.1 corrective batch. Report:
`reviews/m10-react19-ink7-review-2026-07-08.md`.
