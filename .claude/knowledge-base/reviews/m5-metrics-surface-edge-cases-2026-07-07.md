# Edge-case review: m5-metrics-surface (fresh-eyes agent, 2026-07-07)

**Plan:** `.claude/knowledge-base/plans/m5-metrics-surface-plan.md`
**Verdict:** 5 MUST-FIX + 7 SHOULD — ALL absorbed into the plan (ADR addenda + added RED oracles) on 2026-07-07.
**Disposition summary:** EC-1 'left' single-authority derivation; EC-2 integer-numerator fill formula; EC-3 all-zero chart NaN; EC-4 single-char glyph contract; EC-5 real degrade boundary pair; EC-6 bench cadence pin; EC-7 ESC-prefixed probe assert; EC-8 chart tiny/huge + single-category oracles; EC-9 cost multi-group separators + cents pad; EC-10 formatTokens promotion saturation at "b"; EC-11 warning-threshold boundary pair; EC-12 unknown-limit ignores baseline.

---

## MUST-FIX

**EC-1 — `'left'` label is a SECOND rounding site: `formatPercent(1 − usedRatio)` breaks the single-authority contract at extremes**
- Verified: `usedTokens=1, limitTokens=2e16` → `1 − 5e-17 === 1` exactly → label "100% left" while the bar shows 1 filled cell; interior drift: usedRatio 0.335 → "34% used" but "67% left" (sums 101). T1.1's agreement oracle never exercises the 'left' composition.
- Fix: `leftPercent = 100 − displayPercent(usedRatio)` — never a second `formatPercent(1 − usedRatio)` call. Oracles: `left_label_never_100_while_used_nonzero()`, `used_plus_left_display_percents_sum_to_100()`.

**EC-2 — Fill-cell formula `rounding(displayPercent/100 * width)` has verified float divergences under ceil/floor/round at realistic widths**
- Verified sweep (p 0..100 × w 1..120): 25 divergent pairs — `p=7, w=100 → 7.000000000000001` (ceil → 8), `p=29, w=50 → 14.499999999999998` (round → 14, true half-up 15). Width-10 tables all land exact, so the suite would green a formula that mis-renders elsewhere.
- Fix: `cells = rounding((displayPercent * width) / 100)` (integer numerator). Rows: `renderFillBar(0.07, 100, {rounding:"ceil"}).filledCells === 7`; `renderFillBar(0.29, 50).filledCells === 15`.

**EC-3 — TokenUsageChart with all present values 0 computes `0/0 = NaN` → core throws TypeError on a VALID input**
- `usage {input: 0}` is valid ("present 0 renders empty bar + 0") but `value/max = 0/0 = NaN` and the core throws on NaN. No TDD row pins the max-0 special case.
- Fix oracle: `all_present_zero_renders_zero_rows_without_throw()`.

**EC-4 — `fullChar`/`emptyChar` "any non-empty string" silently breaks the width invariant and every glyph-count oracle**
- `"ab"` at 5 cells = 10 columns; emoji `"🟩"` (2 UTF-16 units, EAW-wide) breaks cells⇔columns twice.
- Fix: single UTF-16-length-1 char contract + typed TypeError; negatives `""`, `"ab"`, `"🟩"`; also pin ±Infinity ratio negatives.

**EC-5 — Label-only degrade "boundary pair" is not at the boundary (40 vs 12), and the fixed-column definition is unspecified**
- Fix: fixed columns = full label INCLUDING detail clause + 1 spacer; degrade is binary; test the exact computed pair (W=30 bar present / W=29 label-only for the 64k/128k fixture).

## SHOULD

**EC-6 — Bench mode symmetry under-pinned:** exactly ONE rerender per step in BOTH modes; shared pre-generated step arrays. (EC-15-fires-spuriously worry checked: unfounded — the tail append drives frames in both modes.)
**EC-7 — Probe assert `not.toContain("[")` brittle:** use the house ESC-prefixed form `not.toContain("\u001b[")` (matches `src/chat-message.test.tsx:148`).
**EC-8 — Chart missing oracles:** `tiny_category_next_to_huge_keeps_one_cell()` (1 vs 1_000_000 → ≥1 █) and `single_category_renders_full_bar()`.
**EC-9 — formatCost:** add `[1_234_567.891, "~$1,234,567.89"]` (multi-group commas) and `[3.05, "~$3.05"]` (cents pad) — both verified float-safe.
**EC-10 — formatTokens promotion past "b" undefined:** saturate at last unit; pin `[999_950_000_000, "1000b"]`.
**EC-11 — Warning threshold accent-side untested + partial snapshot sits exactly ON 0.5:** boundary pair 63_999 (no [33m) / 64_000 ([33m); anchor [33m before the partial snapshot.
**EC-12 — `baselineTokens` with unknown limit unspecified:** absolute-only render ignores baselineTokens (raw used — baseline is a ratio concept); pinned row.

## CONSIDERED-OK (verified)

- formatTokens k/m oracle rows all land on the claimed side (1049/1050/999_949/999_950/9999/1_050_000 computed).
- formatCost rows float-safe (0.005*100 = 0.5 exact; 999.994; 1234.5).
- 0.995 → "99%" passes via the endpoint reserve (doubles as a reserve test).
- Width-10 fill rows all float-exact (divergence only bites other widths — EC-2).
- baseline_tokens_shift_ratio (12k/24k/12k → "100% left") correct.
- endpoint_honesty_99_6 row passes as written.
- NO_COLOR probe line-offset worry: existing asserts are per-line regex/toContain, never index-based — appending the metrics scene cannot break them.
- Bench without-metrics frame starvation: none (tail append drives frames in both modes).
- Sub-cent renders WITHOUT `~`: already pinned exactly.
- Export-surface absence pins complete; displayPercent module-private (pre-EC-1; now exported module-level, still entry-absent).
- Color-byte oracles match the house idiom.
- Test-count estimates immaterial.
