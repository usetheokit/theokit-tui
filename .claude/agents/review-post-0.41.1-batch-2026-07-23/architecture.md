# Review agent: architecture — post-0.41.1-batch (2026-07-23)

Ad-hoc range review (no plan file). Ground truth: CHANGELOG.md `## [Unreleased]` at HEAD + commit messages (`commit-range.txt` in this directory). Scope: `git diff v0.41.1..HEAD`.

Focus: SOLID compliance, DIP/layer boundaries, coupling, design-pattern misuse in the changed modules:

- `src/agent-stream-event.ts` — new shared routing (`routeToolResult`, `looksLikeUnifiedDiff`, `toShell`/`parseShellEnvelope`) consumed by BOTH projections (messages-to-events + agent-stream-reducer). Is the shared seam cohesive or a grab-bag?
- `src/messages-to-events.ts` — `formatToolHeader`/`formatToolResult` app seams, `applyResultOverride`, explored grouping. Exclusive `output|shell|diff` invariant enforcement.
- `src/agent-timeline.tsx` — `ExploredBlock`, `EXPLORE_LABELS` table, `toolBody` extraction.
- `src/chat-composer.tsx` / `src/composer-editor.ts` — `initialValue` seed + `onChange` notify.
- `src/agent-event.ts` — new `explored` kind, `diff` field on `AgentToolEvent` (closed-union discipline).
- Removal completeness: `src/ai-sdk/` deletion, package.json/tsup surface.

Rules of reference: `.claude/rules/architecture.md` (layering, DIP, cohesion), CLAUDE.md SOLID section.

Read-only. Enumerate every touched file; trivial files get `INFO: no issues found`.
