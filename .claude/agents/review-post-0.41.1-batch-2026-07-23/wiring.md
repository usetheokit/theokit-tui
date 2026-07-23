# Review agent: wiring — post-0.41.1-batch (2026-07-23)

Ad-hoc range review (no plan file). Ground truth: CHANGELOG.md `## [Unreleased]` at HEAD + commit messages. Scope: `git diff v0.41.1..HEAD`.

Focus: every NEW public symbol has (a) a caller/production path, (b) test coverage; no dead exports; removal is COMPLETE:

- New exports since v0.41.1: check `src/index.ts` diff — e.g. `ToolHeaderFormatter`/`ToolResultFormatter` types, `messagesToAgentEvents` options, `DEFAULT_EXPLORE_TOOLS`, explored event kind, `AgentToolEvent.diff`, ChatComposer `initialValue`/`onChange`. Each: exported? consumed (by components/examples)? tested?
- Removal completeness: NO remaining reference to `@theokit/tui/ai-sdk`, `uiMessagesToChatThread`, `uiMessagesToAgentEvents`, `from "ai"` anywhere in src/tests/examples/docs/README. package.json has no `ai` in peers/devDeps/meta; tsup entry list has 2 entries; `.npmrc` auto-install-peers=false present and lockfile has no `ai`/`figlet`.
- Examples still runnable: no example imports the removed subpath; `example:ai-sdk` script gone.
- VERSION constant (src/index.ts) === package.json version.

Read-only. Enumerate every new/removed export; per-symbol verdict.
