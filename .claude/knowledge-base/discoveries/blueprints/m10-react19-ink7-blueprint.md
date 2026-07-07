---
slug: m10-react19-ink7
milestone_id: M10
created_at: 2026-07-07
discovery_plan: .claude/knowledge-base/discoveries/plans/m10-react19-ink7-plan.md
question: What exactly breaks moving @theokit/tui from ink5/react18 to ink7/react19, mapped onto OUR real surface?
---

# Blueprint: m10-react19-ink7

## Context

M10 migrates the foundation: ink ^5.2.1 → ^7.1.0, react peer ^18.2.0 →
^19.2.0 (every ink ≥ 6 is react-19-only — registry-verified pre-lock), node
engines ≥ 20 → ≥ 22. Four research agents read BOTH versions side by side
(installed 5.2.1 build vs the 7.1.0 source clone at
`.claude/knowledge-base/references/ink/`), downloaded and verified the
react-reconciler 0.33.0 tarball, and pre-mapped every failure class onto our
455-test suite. Questions Q1–Q6: all `done`.

## Objective

Give the M10 plan a task-by-task migration map with zero surprises: what
changes, what stays, which pins flip, and the evidence protocol.

## Cross-cutting Comparison

| Dimension | ink 5.2.1 (installed) | ink 7.1.0 (target) | Consequence for us |
|---|---|---|---|
| Pipe (non-TTY) output | EVERY throttled frame + eraseLines escapes (`node_modules/ink/build/log-update.js:9-18`) | ONLY staticOutput incrementally + ONE final frame at unmount, zero escapes (`.claude/knowledge-base/references/ink/src/ink.tsx:594-603` buffered main frame; `.claude/knowledge-base/references/ink/src/ink.tsx:858-865` single final write; `.claude/knowledge-base/references/ink/src/write-synchronized.ts:7-16` sync gating) | degrade-matrix/example smokes see ink5-CI-shaped output — assertions on final content survive; frame-count/erase assumptions die |
| Interactive gate | `isInCi` only | `!isInCi && stdout.isTTY` (`.claude/knowledge-base/references/ink/src/ink.tsx:1054-1056`) | itl fake stdout (no isTTY) → non-interactive in-process; debug:true keeps full-frame writes (`.claude/knowledge-base/references/ink/src/ink.tsx:582-592`) |
| StrictMode effects | NEVER double-invoked on legacy roots (reconciler 0.29: "Strict effects should never run on legacy roots") | ALWAYS double-invoked in dev builds — gate removed, root is always ConcurrentMode internally (react-reconciler 0.33 dev build, verified tarball — case REACT_STRICT_MODE_TYPE mode|=24 unconditional; FiberRootNode always ConcurrentMode; cross-checked against `.claude/knowledge-base/references/ink/src/ink.tsx:432` createContainer isStrictMode=false and `.claude/knowledge-base/references/ink/src/reconciler.ts:286-293` scheduler config) | M7 DV-1 claim FLIPS; assertions already env-robust; comments/docs updated; probe re-run as confirmation |
| Reconciler | 0.29, updateContainer everywhere | 0.33, legacy = updateContainerSync+flushSyncWork (`.claude/knowledge-base/references/ink/src/ink.tsx:696-703`); passive flush still a scheduler macrotask on unmount (default mode) | cleanup-one-tick-after-unmount pin HOLDS in default mode |
| Border glyphs | cli-boxes 3 | cli-boxes 4 — **all 8 styles deep-equal verified** | border snapshots glyph-stable |
| Width measurement | string-width 7 etc. | string-width 8 + wrap-ansi 10 + slice-ansi 9 + cli-truncate 6 | ASCII/latin unaffected; emoji/keycap/CJK clusters shift — snapshot diffs concentrated in truncate-end consumers + EAW tests |
| Input | raw chunks, sync handler via batchedUpdates | input-parser (complete CSI still SYNC via discreteUpdates); bare-ESC buffered 20 ms (`.claude/knowledge-base/references/ink/src/components/App.tsx:273-284`); paste channel (`.claude/knowledge-base/references/ink/src/hooks/use-paste.ts:38-60`); `key.meta` no longer true for ESC | sync-throw pin survives (verify-at-bump); no current test writes bare ESC |
| Nested Text squash | raw concat | + `sanitizeAnsi` (strips non-SGR CSI, keeps SGR/OSC — `.claude/knowledge-base/references/ink/src/squash-text-nodes.ts:46` + `.claude/knowledge-base/references/ink/src/sanitize-ansi.ts:9-33`) | our content is SGR-only — unaffected |
| render options | 6 options | + maxFps(30)/concurrent/interactive/alternateScreen/kittyKeyboard etc.; throttle default except debug | benches measure a throttled engine — citable re-baseline cause |
| unmount | always final re-render | skips final re-render when static output exists (issue #397, `.claude/knowledge-base/references/ink/src/ink.tsx:797-808`); non-interactive writes trailing `"\n"` frame (F1) | never read lastFrame() AFTER unmount (no current test does) |
| Platform | node ≥ 18/20, react ≥ 18 | node ≥ 22, react ≥ 19.2.0 exactly | engines bump + CI matrix 22.x/24.x + README |

## Recommendations

1. Implement per D1–D5; the plan's tasks mirror the Corner sections
   task-by-task (deps→suite-triage→pipe-repin→snapshots→evidence).
2. Version matrix Corner 2 verbatim (react peer `^19.2.0` exactly — never
   loosen below ink's floor, `.claude/knowledge-base/references/ink/package.json:107-110`).
3. Bench/snapshot evidence per Corner 3's 7-step protocol; the jump table is
   MANDATORY before new baselines land.
4. Release as 0.11.0 explicit-minor (D4) — entries worded "Requires:", never
   "BREAKING:".
5. Review guards: no fork, no concurrent:true adoption (default mode keeps
   every timing pin — `.claude/knowledge-base/references/ink/src/ink.tsx:913-918`), sync-throw pin
   verified at bump (`.claude/knowledge-base/references/ink/src/hooks/use-input.ts:253-255`).

## Coverage Corner 1 — Integration Tests

**Harness verdicts (Q3 — every idiom KEEP except snapshots):**
`renderAtColumns` getter-shadow survives (itl4 prototype getter,
`node_modules/ink-testing-library/build/index.js:3-6`; ink7 reads columns
per-render at `.claude/knowledge-base/references/ink/src/ink.tsx:531`; caveat:
never pass falsy columns — ink7 falls back to REAL terminal-size,
`.claude/knowledge-base/references/ink/src/utils.ts:12-22`). `debug:true` +
lastFrame keep (full-frame writes, unthrottled — `.claude/knowledge-base/references/ink/src/ink.tsx:357-364`).
Unmount-timing pins keep (default mode passive flush stays a macrotask —
unmount never calls flushPassiveEffects in default mode). Cursor ▏ pins keep (Text inverse chain unchanged,
`.claude/knowledge-base/references/ink/src/components/Text.tsx:94-131`;
CursorContext only manifests in the interactive log path). stdin sync-throw
pin survives via discreteUpdates
(`.claude/knowledge-base/references/ink/src/hooks/use-input.ts:253-255`) —
marked verify-at-bump. itl `instance.frames` gains a trailing `"\n"` after
unmount (F1) — no current test trips it.

**Failure-class pre-map (D2 consumes verbatim):** F1 post-unmount `"\n"`
frame (latent); F2 falsy-columns → machine-dependent (guard: never test 0);
F3 snapshot mass-diff (12 .snap files; concentrated in truncate-end
consumers `src/agent-streaming.tsx:76`, `src/diff-viewer.tsx:122`,
`src/tool-result.tsx:261`, `src/tool-call.tsx:89`, EAW tests
`src/diff-viewer.test.tsx:266,287` — batch re-record, each diff reviewed);
F4 bare-ESC async 20 ms (`.claude/knowledge-base/references/ink/src/input-parser.ts:265-282`
— no current writer); F5 paste channel (irrelevant until composer adopts);
F6 reconciler timing (pins bounded — expect green); F7 throttle/settle
idioms stable (debug unthrottled).

**StrictMode flip (Q2):** dev builds double-invoke under `<StrictMode>` now.
Tests that FLIP: `tests/package-manifest.test.ts:65-68` +
`tests/package-contract.test.ts:33-41` (version pins — by design);
`src/use-agent-stream.test.tsx:139-144` COMMENT (claim inverts; assertion
survives — multi-shot source + reset). Tests that HOLD by construction:
single-shot documented-behavior, double_effect deterministic pin, all
bounded-tick teardown tests. Confirmation experiment: re-run the M7 probe
(count create/destroy) expecting 2/1 under StrictMode, 1/0 without.

## Coverage Corner 2 — Dependencies

**Version matrix (Q4e, registry+source confirmed):** ink `^7.1.0`; react
peer **`^19.2.0`** (mirror ink's exact floor — `.claude/knowledge-base/references/ink/package.json:107-110`);
react devDep `^19.2.7`; `@types/react ^19.2.0`; itl `^4.0.0` (unchanged —
already installed; its declared peer `ink ^5` is a devDep-style artifact,
never author-validated on ink7 — our suite IS the validation);
ink-spinner `^5.0.0` (unchanged — imports ONLY `Text`,
`node_modules/ink-spinner/build/index.js:1-3`; gemini ships it on react 19.2
in production); tsx unchanged (ink7 itself runs examples via tsx ^4.21);
engines `node >=22`. TS19 risk sweep: ZERO removed-type hits in our tree
(no JSX.Element/React.FC/defaultProps); useReducer/useRef call shapes
already 19-compatible; `skipLibCheck` absorbs ink-spinner's stale
`JSX.Element` dts.

**Gemini fork (Q5): IGNORE.** `@jrichman/ink@6.6.9` = upstream + gemini's
terminal-buffer/flicker patches at their own cadence (fork holds node>=20 +
old measure deps; owner @jacob314 per registry; gemini changelog credits the
buffer-mode work). We are a component library with an 8-symbol surface —
plan D1 already rejects forking. Adopted lesson: the fork exists over
RENDER-ENGINE behavior — exactly where our re-baseline focuses.

## Coverage Corner 3 — Tools

**Re-baseline protocol (Q6a — plan D3 consumes verbatim):** (1) freeze
v0.10.0 baselines as the last ink5 reference (git ref); (2) M7 run
conditions (isolated, load-gated < 4, FORCE_COLOR=1, env-invalid rounds
DISCARDED); (3) documented jump table 0.10.0→new for all 20 metrics; (4)
every ADVERSE delta must cite a stack cause (throttle default `.claude/knowledge-base/references/ink/src/ink.tsx:357`,
measure-dep majors, reconciler 0.33) — gate: "PASS unless an ADVERSE delta
has NO citable stack cause; unexplained ADVERSE >1σ AND >2× old mean
BLOCKS"; (5) pre-run: record whether the harness hits the throttled or debug
path; (6) new baselines become THE reference + additive schema field
`"stack": {ink, react, ink_testing_library}`; (7) snapshots regenerated only
where a Q1 delta justifies, each reviewed.

**Semver memo (Q6b): 0.11.0.** semver spec item 4 (0.y.z — anything may
change) + npm caret (`^0.10.0` never auto-resolves to 0.11.0 — the breaking
narrowing is strictly opt-in and fails LOUD via peer/engines checks);
1.0.0 independently blocked by the dogfood golden rule. Prominence via
CHANGELOG "Requires: react >=19.2, node >=22" entries + release-notes
header + README peer table. **Release-tooling note:** never prefix entries
`BREAKING:` (would auto-derive major = 1.0.0, forbidden) — invoke the
release with explicit minor + a one-line ADR recording the 0.x convention.

**CI diff (Q6c):** matrix `[20.x, 22.x]` → `[22.x, 24.x]` + engines >=22 +
README "Node ≥ 22" (same commit).

## Coverage Corner 4 — Techniques

**Per-symbol migration table (Q1a — condensed; full citations in the
research record):** Box/Text/Static/useFocus API-compatible for OUR usage (`.claude/knowledge-base/references/ink/src/hooks/use-focus.ts:5-47`)
(Box defaultProps→inline styles: render-equivalent, `.claude/knowledge-base/references/ink/src/components/Box.tsx:84-87`; Text `wrap` union drops
legacy 'end'/'middle' we never used, keeps `truncate-end` identical, `.claude/knowledge-base/references/ink/src/wrap-text.ts:36-48`;
squashTextNodes now sanitizes non-SGR CSI — our content SGR-only);
useApp.exit widens to accept a result value (additive); useStdout signature
unchanged (pipe write behavior via Q1b); useInput: `key.meta` no longer true
for ESC (`.claude/knowledge-base/references/ink/src/hooks/use-input.ts:195`
vs ink5's forced meta-on-escape) — grep shows we never read `key.meta`;
render(): new options additive, cleanup() now unmounts
(`.claude/knowledge-base/references/ink/src/render.ts:230-232`),
waitUntilExit created eagerly + resolves with exit value. NOTHING our
surface consumes was removed or renamed.

**Pipe-mode contract (Q1b — the migration's biggest behavioral shift):**
ink7 non-interactive = ink5's CI mode (incremental static + one final
frame, zero escapes) — where ink5 pipes received N throttled frames WITH
eraseLines. Our degrade-matrix asserts CONTENT + absence of escapes (`not
toContain("[")`) — the absence assert gets STRONGER (trivially true);
content asserts survive; the TERM=dumb byte-equality test compares two
piped runs — both flip shape together, equality preserved modulo existing
normalizations. Example smokes assert final-content strings — survive.
Width caveat: ink7 piped layout may read the CONTROLLING terminal via
/dev/tty (`terminal-size` fallback) where ink5 pinned `columns || 80` — in
CI both settle at 80; local piped smoke assertions must not depend on exact
width (ours don't — string containment). is-in-ci 1→2 narrows detection to
CI/CONTINUOUS_INTEGRATION only (stray `CI_*` vars no longer flip modes).

**Input pipeline (Q1d):** complete sequences (ENTER, arrows, backspace) are
parsed AND delivered synchronously (write→readable→parse→discreteUpdates→
handler) — the sync-throw pin survives; bare ESC buffers 20 ms (F4); paste
splits to its own channel only when usePaste is mounted.

## ADRs

### D1 — One-slice upgrade; tasks per surface (FINAL)

**Decision:** single milestone bumps ink+react+types+engines together;
tasks: (T-deps) bump + typecheck sweep; (T-suite) suite green with
failure-class triage; (T-pipe) degrade/example probes re-pinned to the
ink7 pipe contract; (T-snap) snapshot re-record with per-diff review;
(T-evidence) re-baseline + rehearsal + publish.
**Alternatives:** ink6 stepping stone (rejected: same react wall, double
migration); fork (rejected: gemini's fork lesson — that's an app-vendor
play, not a library's).
**Consequences:** the plan's tasks mirror this blueprint's sections.

### D2 — Never-weaken triage over the F1-F7 pre-map (FINAL)

**Decision:** every post-bump failure classified against the pre-map:
ink-behavior-change → assert the NEW behavior citing this blueprint; our
bug → fix; harness → port. Zero deletions/loosening; the sync-throw pin
verified explicitly at bump.
**Consequences:** the implementation log records the triage table.

### D3 — Re-baseline protocol (FINAL — Corner 3 verbatim)

### D4 — Version 0.11.0, explicit-minor release (FINAL)

**Decision:** publish 0.11.0; CHANGELOG entries worded "Requires: …" (never
`BREAKING:` — auto-derivation would compute the dogfood-forbidden 1.0.0);
release invoked with explicit minor; one-line ADR records the 0.x
convention; README/notes carry the platform table prominently.
**Alternatives:** 1.0.0 (rejected: dogfood gate); patch (rejected:
dishonest for a platform narrowing).

### D5 — StrictMode flip absorption (FINAL)

**Decision:** re-run the M7 probe as the bump's confirmation experiment
(expect 2/1 strict, 1/0 without); update the DV-1-era comments/docs
(use-agent-stream.ts:14,25-27 guidance becomes ACTIVE behavior — "pass a
FACTORY under StrictMode" is now mandatory-in-practice); assertions stay
as-written (already env-robust by M7 design).
**Consequences:** no test weakening; documentation truthful again.

## Verified-absence notes

- No symbol we consume was removed/renamed in ink 7 (full sweep).
- cli-boxes 4 glyphs deep-equal to 3 — border snapshots stable.
- We never read `key.meta` (ESC semantics change is a no-op for us).
- ansi-tokenize 0.3 internals not deep-dived (consumed only via ink paths
  already characterized) — honest low-risk gap, watched at bump.
