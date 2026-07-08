# Implementation: m15-composer-autocomplete

**Date:** 2026-07-08
**Plan:** `plans/m15-composer-autocomplete-plan.md` (SHIPPABLE 97.6)
**Blueprint:** `discoveries/blueprints/m15-composer-autocomplete-blueprint.md` (SHIPPABLE)
**Verdict:** IMPLEMENTATION_COMPLETE · validation exit 0 · code-quality PASS · 557/557 tests

## Task ledger

| Task | Commit | Delivered |
|---|---|---|
| T1.1 model | `3e581c6` | `slash-menu-model` (pure — codex token filter, prefix match, clamp, 5-row window) + `complete-command` buffer action via table-driven reducer dispatch (the 10-case switch tripped complexity); TRUE REDs both suites |
| T2.1 composer | `cf89bfe` | `commands`/`hint` props; `useSlashMenuState` hook + interception branch (menu keys never leak); windowed render (▲/▼ + counter + `❯`); completion latch (exact match closes); **ESC refocus** — ink's App handler blurs on ESC BEFORE subscribers (source-verified `App.tsx:258`), the composer takes focus back on menu-dismiss; 2 anchored snapshots |
| T3.1 evidence | `e452bf5` | example slash commands (interactive-only, honest note); typing bench menu vs plain + committed baseline; TRUE RED (ENOENT) |

## Wiring triad

- **Caller:** `examples/chat.tsx` composer registers 3 commands + hint
  (interactive-only — raw-mode; documented honestly).
- **Integration tests:** 12 fake-stdin script oracles (open/narrow/
  mid-text/arrows-no-leak/window/tab/enter-dual/esc-latch/line-2/
  monochrome/snapshot/hint); the piped smoke pins the non-interactive
  path unchanged (3× green).
- **Runtime observability:** the menu IS the observable; the bench pins
  the per-keystroke cost.

## Bench evidence (typing — the M9 flip condition fired)

Load **1.30** (`load_1min_at_start` in the JSON), 120 keystrokes,
50 commands, 1 warmup + 5 runs per mode:

| Mode | mean ms/keystroke-frame | Reading |
|---|---|---|
| menu | 6.487 ± 0.188 | derive (filter+clamp+window) + menu render per keystroke |
| plain | 6.191 ± 0.040 | the pre-M15 composer cost (same script, no commands) |

Delta +0.296 ms (+4.8%) — marginally > 1σ; CITABLE CAUSE: the menu
re-derives and re-renders its rows on every keystroke by design (D1
derived state — no memo; the model is allocation-light).

## Empirical findings during implement

- **ink ESC-blur:** `App.tsx:258` resets focus on ESC whenever focus is
  enabled, and App's handler runs BEFORE useInput subscribers — probed
  empirically (the `e` after ESC never arrived; the composer was
  defocused). The menu's ESC-dismiss therefore re-focuses the composer
  via `useFocusManager().focus(id)`; outside the menu, ink's default
  blur is preserved.
- The lone-ESC parse needs its timeout window in tests (double settle
  after ESC before the next byte).

## Deviations (logged)

- **DV-1 — composer LoC 415 vs plan 400.** The complexity≤10 lint forced
  three extractions (useSlashMenuState, SlashMenuList, InputRow,
  handleBufferKey) — signatures/docblocks cost the overrun (M13 DV-3
  precedent).
- **DV-2 — 2 snapshots re-recorded within the task** (cosmetic refactor
  of the menu render between first record and the extraction — same
  task, same feature; not a cross-era re-record).

## Review outcome

(recorded post-review in `reviews/m15-composer-autocomplete-review-2026-07-08.md`)
