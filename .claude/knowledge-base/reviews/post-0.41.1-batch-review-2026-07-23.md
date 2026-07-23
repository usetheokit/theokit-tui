# Review: post-0.41.1-batch (ad-hoc range review)

**Date:** 2026-07-23
**Scope:** `v0.41.1..HEAD` — 15 commits (14 at spawn + `61f8734`), purpose: gate for `/release` 0.47.0
**Mode:** ad-hoc (no plan file) — ground truth = CHANGELOG `[Unreleased]` + commit messages. Deviation from the standard plan-bound contract recorded here per Rule 3 (honesty); authorized by the owner in-session (2026-07-23) as the release gate for the drifted 0.42–0.46 npm publishes.
**Reviewers (spawned agents):** 5 — architecture, tests, wiring, cross-validation, domain-tui (briefs at `.claude/agents/review-post-0.41.1-batch-2026-07-23/`)
**Code-quality gate:** PASS, 0 findings (standalone run, 2026-07-23)
**Quality gates:** format ✓ · lint 0 warnings ✓ · typecheck ✓ · 1270 tests ✓ · build + publint ✓
**Findings:** 30 raw → 19 unique (BLOCKER: 0, HIGH: 3, MEDIUM: 7, LOW: 9) + 11 INFO/no-issues
**Verdict:** NEEDS_FIXES (3 unique HIGH > the ≤2-HIGH gate of `cycle-review.md`)

## HIGH findings (must fix before READY_TO_MERGE)

### H1 — seedEditorState seeds cursorOffset in code POINTS; text-buffer consumes code UNITS
- Found by: **4/5 agents independently** (F-arch-1, F-tests-1, F-wire-1, F-tui-1) — each with an executed repro
- File: `src/composer-editor.ts:329` (`cursorOffset: [...text].length`)
- Contract violated: `src/text-buffer.ts:13` — "Cursor position as a code-unit offset"
- Repro (verified): seed `"ok 👋"` → cursorOffset 4 vs text.length 5; next insert splits the surrogate pair → `"ok \ud83dX\udc4b"`, `text.isWellFormed() === false` (mojibake). Shipped in npm 0.45.0/0.46.0 (`initialValue`).
- Existing test is tautological on BMP text (`[..."olá mund"].length` — counts coincide) and mis-comments the count as "grapheme-aware".
- Action: RED regression test with astral tail (`seedEditorState("ok 👋")` → cursorOffset 5; insert appends after emoji, result well-formed) → fix to `cursorOffset: text.length` (matches sibling `loadText`).

### H2 — formatToolHeader (shipped npm 0.42.0) has ZERO tests
- Found by: 3/5 agents (F-tests-2, F-xval-2, F-wire-2)
- File: `src/messages-to-events.ts:365` — commit `e92f775` touched only the source file (TDD-first violated); `grep formatToolHeader` in tests → no hits. Sibling `formatToolResult` has a full describe block.
- Action: describe block mirroring the sibling — override applied (name+summary), partial override (name only), `undefined` leaves event untouched, interaction with explored grouping.

### H3 — CHANGELOG omits 6 shipped user-visible changes; [Unreleased] misrepresents 3 more
- Found by: F-xval-1 (with full claims table)
- Missing ANYWHERE: formatToolHeader (0.42.0), ESC refocus fix (0.42.0), formatToolResult (0.43.0), word-wrap fix (0.44.0), initialValue (0.45.0), onChange (0.46.0). The 3 current [Unreleased] Added/Fixed entries (Explored block, inline diff, shell envelope) already shipped in 0.42.0. npm 0.42.0–0.46.0 have no CHANGELOG sections and no git tags.
- Action: add the 6 missing entries under [Unreleased]; head-note that 0.47.0 absorbs everything published since 0.41.1 (0.42.0–0.46.0 were npm-only cuts without changelog/tag). Rule 6 forbids editing released sections — since 0.42–0.46 were never written, absorbing into 0.47.0 with an explicit note is the honest reconciliation.

## MEDIUM findings (fix or accept WITH_CAVEATS in the PR)

| ID | File | Summary | Disposition |
|---|---|---|---|
| M1 (F-arch-4/F-xval-4/F-wire-3/F-wire-4) | `src/index.ts` | `DEFAULT_EXPLORE_TOOLS` + `AgentExploredEvent` not exported from root — CHANGELOG names an unreachable symbol; 4th union member interface missing | **FIX** (cheap; required for CHANGELOG honesty) |
| M2 (F-tests-3/F-xval-3/F-wire-5) | `src/chat-composer.tsx:636` | ESC-refocus bug fix shipped without regression test (no-menu interrupt path) | **FIX** (test-only) |
| M3 (F-tests-4/F-wire-6) | `chat-composer` tests | `initialValue` untested at component level; mount-fire `onChange` contract unpinned | **FIX** (test-only, rides H1's component regression) |
| M4 (F-tui-2) | `src/chat-message.tsx:81` | `width={stdout.columns}` + horizontal margin props → row overflows terminal, reintroducing mid-word wrap (repro at 40 cols, marginLeft 4 → 43-col lines) | CAVEAT — follow-up issue |
| M5 (F-tui-3) | `src/agent-timeline.tsx:156` | Inline-diff branch has no default `maxLines` cap (output/shell branch caps at 10) — giant diff floods the transcript | CAVEAT — follow-up issue |
| M6 (F-arch-2/F-tui-5) | `src/agent-timeline.tsx:117` | `assertValidEvents` doesn't recurse into `explored` tools (dup ids / invariants unchecked at the declared D8 boundary) | CAVEAT — follow-up issue |
| M7 (F-arch-3) | `src/agent-stream-event.ts` | Result-routing seam housed in the stream-event module (SRP) — safe internal refactor | CAVEAT — follow-up refactor |

## LOW findings (log; merge can proceed)

- F-arch-5 `ToolResultFormatter` return type permits multiple exclusive keys (compile-time union of singletons preferable)
- F-arch-6/F-tui-2-adjacent: ChatMessage couples to global `stdout.columns` (embedded-layout semantics)
- F-arch-7/F-tui-10: `onChange` re-fires on unstable inline callback identity (doc or latest-ref pattern)
- F-tests-6: dead `explore` helper silenced with `void explore;` in messages-to-events.test.ts
- F-tests-7: `failed`/`running` branches of the `explorable` predicate untested
- F-tests-8: fixed 50 ms sleep in onchange test (flake surface); PT comment in EN suite
- F-xval-5/6: mixed-concern commit `f274a86` (feature+bump+snapshot artifact); 0.44–0.46 bumps embedded in feature commits (root cause of the VERSION drift)
- F-xval-7: PT-language internal-config entry in the EN consumer changelog
- F-wire-7: `toShell`/`parseShellEnvelope`/`NormalizedShell` exported with no external consumer
- F-tui-4: ExploredBlock `└` rows lose gutter alignment on wrap (cosmetic)
- F-tui-6: formatToolHeader name-override silently opts a tool out of explored grouping (matches on overridden name)
- F-tui-7: ESC refocus has no opt-out for apps mapping ESC to intentional focus handoff
- F-xval-8: `.npmrc` pnpm behavior change undocumented for contributors

## Verified-safe (INFO highlights)

- **ai-sdk removal completeness: CLEAN** — zero residual refs (src/tests/examples/docs/lockfile/scripts); absence pinned by contract tests; BREAKING honesty confirmed with 1:1 migration (F-arch-11, F-tests-11/12/14, F-wire-8, claims table)
- **`<Static>` windowing invariant: SAFE** — explored group can only grow while trailing = always in live tail; id stable; no frozen-row divergence (F-tui-8)
- Shell-envelope degrade ladder NO_COLOR-safe (F-tui-9); shared routing DRY win in reducer (F-arch-10); closed-union discipline kept (F-arch-9)

## Cross-validation summary (claims table: see findings/cross-validation)

15 claims checked: 12 PASS · 1 PASS_WITH_CAVEAT (unreachable `DEFAULT_EXPLORE_TOOLS`) · 1 PARTIAL (ESC fix real, TDD violated) · 1 FAIL (formatToolHeader untested + unlogged) · release-discipline FAIL for the tag-less 0.42/0.43 npm cuts.

## Handoff decision

**NEEDS_FIXES** → fix batch H1+H2+H3+M1+M2+M3 (all mechanical: 1-line fix + tests + exports + changelog), then re-verify the batch once (house pattern: batch-fix, single re-run). M4–M7 and LOWs become follow-up issues / PR caveats. After the batch lands green: verdict flips to READY_TO_MERGE and `/release` 0.47.0 proceeds.

## Spawned agents (audit trail)

- `.claude/agents/review-post-0.41.1-batch-2026-07-23/{architecture,tests,wiring,cross-validation,domain-tui}.md` (briefs)
- Full YAML findings returned in-session (task outputs); consolidated dedup map above (30 raw → 19 unique + 11 INFO)
