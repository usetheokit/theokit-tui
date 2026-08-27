# @theokit/tui — Project Guide for Claude Code

> This project is built with the **Cycle 6+1 pipeline** (installed under `.claude/`).
> Every feature travels from idea → merge with **evidence, not assumptions**: hard gates,
> audit trails, and runtime hooks keep plans from being vague and stop code from shipping
> on assumptions. Read this before starting any non-trivial change.

## What this project is

`@theokit/tui` — a **TUI component library for AI-agent surfaces** (coding agents + chat),
built on **Ink** (React for the terminal). It is the terminal-native sibling of `@theokit/ui`:
it mirrors the same AI primitives (`AgentEvent`, `ToolCall`, `ChatMessage`, `DiffViewer`,
`TokenUsageChart`, …) as terminal components, so agent CLIs get one coherent primitive set
instead of rebuilding streaming/tool-call/diff render from scratch. Apache-2.0 community
auxiliary of the Theo ecosystem (the UI pillar's terminal counterpart).

- **Stack:** TypeScript (strict) · Ink (React for terminal) · Node · npm package `@theokit/tui`.
- **North-star:** TTFATT — time-to-first-agent-turn-in-terminal — target **< 10 min** (`npm i` → mount `<TheoTUIProvider>` + `<ChatThread>` + a stream adapter → a real agent turn renders).

## The Cycle — how we work (the cadence)

A macro super-loop. **Enter at the lightest point that fits the work; never skip a cycle,
never advance past an `INVALID` verdict.** Every cycle writes a dated artifact under
`.claude/knowledge-base/`, so decisions and evidence are traceable after the fact.

```
ROADMAP (macro) → [DISCOVER] → PLAN → IMPLEMENT → CODE-QUALITY → REVIEW → RELEASE → (loop)
```

| # | Cycle | Entry command | Gate / verdict |
|---|---|---|---|
| — | **ROADMAP** | `ROADMAP.md` (M0..M8) drives selection; `/auto-plan M<N>` picks the next milestone | milestone `[ ]`→`[x]` on release |
| 1 | **DISCOVER** (optional) | `/discover-plan` — prior-art study when the approach is unknown | blueprint ≥ SHIPPABLE_WITH_CAVEATS |
| 2 | **PLAN** | `/grill-me` (if vague) → `/to-plan` → `/edge-case-plan` → `/deps-audit` → `/plan-confidence` | ≥ SHIPPABLE_WITH_CAVEATS (else back to `/to-plan`) |
| 3 | **IMPLEMENT** | `/implement {slug}` — halt-loop: RED → GREEN → REFACTOR → WIRING triad → COMMIT (TDD) | `IMPLEMENTATION_COMPLETE` |
| 4 | **CODE-QUALITY** | `/code-quality {slug}` — dead code + fabricated symbols + wiring gaps | PASS / PASS_WITH_CAVEATS (FAIL_HARD/INVALID block) |
| 5 | **REVIEW** | `/review {slug}` — 5–7 specialist agents in parallel | READY_TO_MERGE / NEEDS_FIXES |
| 6 | **RELEASE** | `/release` — semver bump + CHANGELOG + `develop→main` PR + ROADMAP checkbox flip | RELEASED |

**Shortcut:** `/auto-plan M<N>` chains the whole cycle for one milestone (or `/auto-plan {slug}` ad-hoc).
The cheapest cycle is the one you don't run — for a one-line fix, just write the failing test and fix it.

## Where things live

- **Kit** (skills / rules / hooks / commands / scripts): `.claude/`
- **Cycle contracts** (source of truth per cycle): `.claude/rules/cycle-*.md`
- **Roadmap:** `ROADMAP.md` (repo root) — M0..M8, one checkbox per milestone
- **Artifacts:** `.claude/knowledge-base/` — `grills/` (the roadmap grill lives here), `plans/`, `reviews/`, `audits/`, and `references/` (SOTA TUI clones: Ink, ink-ui, gemini-cli, codex, bubbletea, bubbles, assistant-ui — reproducible via `_catalog.md`, gitignored)
- **Operational guide:** `.claude/HOW-TO-USE.md`

## Unbreakable principles (enforced by hooks where automatable)

- Work on **`develop`**. `main` is release-only — never commit / merge / rebase / reset / cherry-pick on it (enforced by `.claude/hooks/validate-command.sh`); release lands via a `develop→main` PR.
- Never `git checkout` / `revert` / `push --force` / `reset --hard` — use `switch` / `restore --staged` / `stash` / `reset --soft`. See `.claude/rules/git-safety.md`.
- **TDD-first:** a failing test before code; every bug fix starts with a regression test. See `.claude/rules/testing.md`.
- **CHANGELOG discipline:** every change under `## [Unreleased]` with a ticket/PR ref.
- **Fail-fast error handling**, typed errors — see `.claude/rules/error-handling.md`.
- **95% confidence:** ask when unsure; never proceed on assumptions. `/grill-me` operationalizes this.
- Full principles: `/home/paulo/.claude/CLAUDE.md`.

## Stack conventions

- TypeScript strict; Ink function components; tests co-located (`*.test.tsx`) or under `tests/`.
- Once source lands, enable the language gate: uncomment `typescript` in `.claude/rules/code-quality-languages.txt` (already staged for JS/TS elsewhere in the ecosystem) so `/code-quality` runs dead-code + symbol-fabrication detectors.

## Next step

The roadmap is ready (M0..M8, grill complete — all 7 dimensions answered). Start the first
milestone with **`/auto-plan M0`**, or `/to-plan "{first feature}"` if you want to drive PLAN manually.
