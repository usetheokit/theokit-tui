# Edge Case Review — m0-walking-skeleton (implementation plan)

Date: 2026-07-05
Plan analyzed: .claude/knowledge-base/plans/m0-walking-skeleton-plan.md (v1.0)
Tasks analyzed: 7 (T0.1, T0.2, T1.1, T2.1, T2.2, T3.1, T3.2, T4.1)
Cases found: 7 (EDGE: 3, NEGATIVE: 4 | MUST FIX: 2, SHOULD TEST: 3, DOCUMENT: 2)

## MUST FIX

### EC-1: Runtime `role` outside the union crashes with an untyped TypeError
- **Affected task:** T2.1
- **Kind:** NEGATIVE (invalid input past the boundary)
- **Family:** Input
- **Scenario:** `@theokit/tui` is a PUBLIC library; a JavaScript consumer (no TS) renders
  `<ChatMessage role="system">`. `theme.role[role]` yields `undefined`; reading `.glyph` throws
  `TypeError: Cannot read properties of undefined` deep inside render — generic, no context.
- **Impact:** Crash with a message that doesn't name the contract violated; violates fail-clear
  (`rules/error-handling.md § 2` — typed, explicit errors at the system boundary).
- **Suggested fix:** 3-line guard at component entry:
  `if (role !== "user" && role !== "assistant") throw new TypeError(\`ChatMessage: invalid role "\${role}" — expected "user" | "assistant"\`);`
  + RED test `invalid_role_throws_typed_error_with_clear_message()` asserting the exact message.

### EC-2: Benchmark run with zero captured frames produces NaN aggregates in the committed JSON
- **Affected task:** T3.1
- **Kind:** NEGATIVE (failure midway)
- **Family:** State / Format
- **Scenario:** Ink coalesces all rerenders (or the fake stdout captures 0 new frames end-to-end);
  `mean = totalMs / frames` divides by zero → `NaN`/`Infinity` serialized into
  `docs/benchmarks/m0-chat-message-baseline.json`; the schema test checks "is number" and NaN IS
  typeof number — corrupt baseline gets committed silently.
- **Impact:** Corrupt committed baseline poisons every future regression comparison (silent-error
  class — the worst kind per `rules/error-handling.md § 1`).
- **Suggested fix:** guard in the harness: `if (run.frames === 0) { console.error("bench: 0 frames captured — aborting"); process.exit(1); }`
  + schema test asserts `Number.isFinite()` (not just typeof) on every aggregate.

## SHOULD TEST

### EC-3: Content wider than the snapshot Box wraps without crash
- **Affected task:** T2.1
- **Kind:** EDGE (extreme of valid)
- **Suggested test:** `long_content_wraps_inside_narrow_box_without_crash()` — render a 120-char
  string inside `<Box width={20}>`; assert frame is non-empty and contains the first word
  (correct result at the boundary; wrapping layout itself is Ink's contract).

### EC-4: Empty theme override object is identical to defaults
- **Affected task:** T1.1
- **Kind:** EDGE (empty-but-valid input)
- **Suggested test:** `empty_theme_override_yields_default_tokens()` — `<TheoTUIProvider theme={{}}>`;
  assert probe reads `defaultTheme.role.user.glyph` (exercise the merge's empty extreme).

### EC-5: `CI` env var can alter Ink/chalk output inside CI runners, drifting snapshots
- **Affected task:** T0.2
- **Kind:** NEGATIVE (environment-induced failure)
- **Suggested test/fix:** pin the full color environment in `vitest.config.ts` env block —
  `FORCE_COLOR: "1"`, `NO_COLOR: ""` AND `CI: ""` — so local and CI runs see identical
  color-detection inputs; the T4.1 matrix (node 20/22) then proves stability by construction.

## DOCUMENT

### EC-6: Malformed theme shapes from JS consumers are not runtime-validated at M0
- **Kind:** NEGATIVE
- **Accepted risk:** TS types + the shallow-merge fallback protect TS consumers; deep runtime
  schema validation of theme objects is disproportionate for a 2-token stub (KISS) and would be
  rewritten at M6 when the theme system is finalized. Revisit at M6.

### EC-7: Wrap/truncate policy for long lines is delegated to Ink defaults until M4
- **Kind:** EDGE
- **Accepted risk:** `DiffViewer`/`CodeBlock` (M4) own the wide-line policy per the roadmap; M0
  only smoke-tests no-crash at narrow width (EC-3). Deliberate non-goal, matches roadmap scoping.

## Summary

| Task | EDGE | NEGATIVE | MUST FIX | SHOULD TEST | DOCUMENT |
|------|------|----------|----------|-------------|----------|
| T0.1 | 0 | 0 | 0 | 0 | 0 |
| T0.2 | 0 | 1 | 0 | 1 (EC-5) | 0 |
| T1.1 | 1 | 1 | 0 | 1 (EC-4) | 1 (EC-6) |
| T2.1 | 2 | 1 | 1 (EC-1) | 1 (EC-3) | 1 (EC-7) |
| T2.2 | 0 | 0 | 0 | 0 | 0 |
| T3.1 | 0 | 1 | 1 (EC-2) | 0 | 0 |
| T3.2 | 0 | 0 | 0 | 0 | 0 |
| T4.1 | 0 | 0 | 0 | 0 | 0 |

**Coverage check:** every input-boundary task (T1.1 theme input, T2.1 role/children, T3.1 metric
capture) has both lenses considered; T0.1/T2.2/T3.2/T4.1 boundaries are config/CI-shaped and
covered by their own executable gates.

**Verdict:** PLAN NEEDS ADJUSTMENT (2 MUST FIX — both are ≤3-line guards + 1 RED test each)
