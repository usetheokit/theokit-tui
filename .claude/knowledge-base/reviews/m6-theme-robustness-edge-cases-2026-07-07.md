# Edge-case review: m6-theme-robustness (fresh-eyes agent, 2026-07-07)

**Plan:** `.claude/knowledge-base/plans/m6-theme-robustness-plan.md`
**Verdict:** 4 MUST-FIX + 6 SHOULD — ALL absorbed into the plan on 2026-07-07.

## MUST-FIX (absorbed)

- **EC-1 — TERM=dumb === NO_COLOR byte-equality broken by the composer marker; cursor
  still invisible under dumb/bare-pipe.** RESOLUTION: equality asserted after
  normalizing the `▏` marker; the in-process invariance scene EXCLUDES the focused
  composer; Drawbacks row added documenting the honest scope — the cursor is an
  INTERACTIVE affordance (meaningless in non-interactive pipes; TERM=dumb interactive
  is rare and NO_COLOR is the standard opt-out); extending detection to chalk level 0
  would require declaring the transitive chalk (phantom-dep) — deferred with
  rationale (D8 consequence updated).
- **EC-2 — probe fixture mounts NO provider → the NO_COLOR swap never executes in the
  probe (vacuous coverage).** RESOLUTION: fixture wrapped in `<TheoTUIProvider>`;
  the `▏` marker assert is exactly the only-our-swap-can-produce oracle.
- **EC-3 — spawn budget arithmetic wrong (real count 10, not ≤ 8).** RESOLUTION: AC
  corrected to ≤ 10 (3 probe + 1 canary + 6 example smokes — 5 existing + themes).
- **EC-4 — "initialText+focus" names a nonexistent API; typed text in the render-once
  fixture breaks the 0ms-tick spinner determinism.** RESOLUTION: fixture uses the
  EMPTY focused + placeholder composer shape (marker renders with zero typing);
  "initialText" struck; the mid-text `▏hi` oracle stays in-process in T3.1.

## SHOULD (absorbed)

- **EC-5** — union-prop negatives pinned: `theme={null}` / `42` / `[]` → OUR typed
  TypeError (never the engine's bare `in`-operator error; arrays not silently
  accepted).
- **EC-6** — `name` semantics pinned: `{}` → `"dark"`; `{base:"light"}` (no/empty
  override) → `"light"` AND `captured === themes.light`; override equal-to-default →
  `"custom"` (form-based identity).
- **EC-7** — NO_COLOR-wins discards glyph overrides too: full-swap semantics kept
  (KISS — merging non-color overrides onto the no-color base risks leaks); pinned by
  test + Drawbacks + CHANGELOG note.
- **EC-8** — pending-color decoupling from `role.system.prefix` is a consumer-visible
  behavior change: promoted to Drawbacks + explicit CHANGELOG `Changed` line.
- **EC-9** — "absent-degrade path also exercised" claim false (lowlight resolves in
  the subprocess; the plain frame is a load race): claim amended, asserts text-only;
  `code-block-absent.test.tsx` remains the absent-path oracle.
- **EC-10** — provider-less consumers get zero NO_COLOR support: documented in
  JSDoc + CHANGELOG ("NO_COLOR handling requires mounting the provider");
  useTheoTheme-level fallback rejected (per-call env read).

## CONSIDERED-OK (verified by the reviewer)

21 snapshots exact; highlightLine = exactly 3 direct call sites; asymmetric
toolStatus.running maps 1:1 onto current code; chalk NO_COLOR absence re-verified
independently; useInput safe in the piped fixture; stubEnv/memo timing OK with fresh
mounts; forced-color canary correctly stays in chat-message.test.tsx; ESC-prefixed
assert form is the honest one (shorthand in the plan TDD noted).
