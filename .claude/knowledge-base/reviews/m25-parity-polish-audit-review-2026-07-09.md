# Review — m25-parity-polish-audit (2026-07-09)

**Verdict:** READY_TO_MERGE

## Method

Three adversarial passes: two parity-refutation specialists (one on tables +
intra-line diff, one on interactive-expand + OSC + cross-validation) that tried to
REFUTE each M25 matrix ✓, plus a Staff-Engineer architecture/wiring reviewer over
the whole diff (DIP/dep-boundary, wiring triad, SRP/DRY, error-handling, latent
bugs). Plus `pnpm gates` (prettier, lint, typecheck, 1043 tests, build) run twice
consecutively.

## Parity re-audit (exit gate)

All four M25 rows NOT-REFUTED — see `docs/renderer/m25-parity-report.md`. Exit gate
PASSED; borderline rows (intra-line diff, OSC helpers ~3.5/7) ship ✓ with an honesty
note in `docs/v4-parity-matrix.md`.

## Architecture findings (all resolved before merge)

| # | Sev | Finding | Resolution |
|---|---|---|---|
| H1 | HIGH | `ExpandableOutput` composed `CollapsibleBlock`, which registered a SECOND focusable per instance → a phantom Tab-stop that swallowed keys (broken toggle after one Tab). | Inlined the `▶`/`▼` glyph render in `ExpandableOutput` (it already owns state + focus + input); dropped the CollapsibleBlock composition. Now exactly one focusable per instance. Regression test: two instances, Tab moves focus directly (no dead stop), ctrl+o expands the second. |
| M2 | MEDIUM | Interactive mode suppressed the whole cap indicator, hiding the CHAR-cap notice (silent data loss signal — the char cap was designed to be observable). | Interactive mode now shows a dedicated char-cap notice (`charCapIndicator`) alongside the line-cap affordance. Regression test: a both-line-and-char-capped result shows "output capped" + "ctrl+o". |
| M1 | MEDIUM | The `intraLineHighlight` doc overclaimed "no jsdiff import on the default path" — `diff` is statically imported (in-bundle) even when off. | Corrected the doc: jsdiff is never CALLED when off (runtime-gated); `diff` is a regular dependency of the diff feature (Rule 9), in the bundle but inert. |
| L1 | LOW | `stripLeadingWhitespace` left an inert `{text:"",changed:true}` segment on indentation changes. | Dropped the empty remainder — no wasted node / latent empty-span trap. |
| L2 | LOW | `setTerminalTitle` gates on TTY but not multiplexer (correct — tmux passes OSC-0 through) but looked inconsistent. | Added a comment explaining the asymmetry (OSC-0 passthrough vs unreliable OSC-8 forwarding). |

## Confirmed clean (verified by the panel)

- Table width math exact (`gridRowWidth` = Σw+3n+1 matches the rendered border); no overflow, CJK/emoji safe, fail-soft malformed, no infinite loop.
- Intra-line opt-in OFF strictly byte-identical (`===`); no false/non-adjacent/unequal highlights; `inverse` survives NO_COLOR.
- Interactive: ctrl+o toggles; 20k char guard never bypassed when expanded; per-component state; unfocused no-op.
- OSC helpers pure, no-op off-TTY, multiplexer-suppressed, exact bytes.
- Non-interactive ToolResult/CodeBlock byte-identical to baseline; dual-render parity (Ink vs V4) holds for the table + intra-line scenes.
- Complexity ≤10 across all M25 files (extractions did not shuffle complexity into oversized helpers).

## Determinism note

Two subprocess/dual-render tests (`approval-pty-e2e` READY wait, `component-parity`
full suite) flaked under heavy parallel-suite load with tight 5s timeouts — fixed by
generous load-tolerant timeouts (30s / 15s), not fixed sleeps (testing.md §6). After
the fix, `pnpm gates` green twice consecutively (1043 tests).

## Evidence

- `pnpm gates` green twice consecutively (1043 tests); new pure modules (`markdown-table.ts`, `diff-word.ts`, `terminal-osc.ts`) 100% branch-covered.
- Width-matrix oracle green; intra-line off byte-identical; OSC no-op-off-TTY proven; char-cap observable in interactive mode; H1 Tab-stop regression green (3×).
