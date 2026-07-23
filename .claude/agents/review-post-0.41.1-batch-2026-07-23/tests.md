# Review agent: tests — post-0.41.1-batch (2026-07-23)

Ad-hoc range review (no plan file). Ground truth: CHANGELOG.md `## [Unreleased]` at HEAD + commit messages. Scope: `git diff v0.41.1..HEAD`.

Focus: test depth and quality of the NEW/CHANGED tests:

- `src/messages-to-events.test.ts` (+326 lines) — covers explored grouping, formatToolHeader/formatToolResult seams, shell-envelope, diff routing? Edge cases AND negative cases (testing.md § 4.1)?
- `src/agent-stream-event.test.ts`, `src/agent-stream-reducer.test.ts` — shared routing covered in BOTH projections?
- `src/chat-composer.onchange.test.tsx`, `src/composer-editor.seed.test.ts` — initialValue/onChange behavior; grapheme edge cases?
- `src/agent-timeline.test.tsx` — ExploredBlock render, diff-in-timeline.
- `src/chat-message.test.tsx` — word-wrap fix regression test present?
- Contract tests: `tests/package-manifest.test.ts`, `tests/export-surface.test.ts` — pin the ABSENCE of the removed ai peer/subpath?
- Determinism: no time/randomness leaks; AAA structure; behavior-named tests.

Rules of reference: `.claude/rules/testing.md` (esp. § 4.1 edge vs negative).

Read-only. Enumerate every touched test file; verdict per file.
