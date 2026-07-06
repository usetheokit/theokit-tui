# Changelog

All notable changes to `@theokit/tui` are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `system` role for `ChatMessage` — `· ` gray glyph tokens (`defaultTheme.role.system`,
  overridable), exported `ChatRole` union (m1-chat-surface T1.1)
- `ChatThread` — ordered chat surface with windowed `<Static>` history (frozen
  append-only prefix in terminal scrollback), identity-memoized live rows for
  flicker-free streaming, duplicate-id fail-fast guard (m1-chat-surface T2.1)
- Grapheme-aware text-buffer reducer (`Intl.Segmenter` — cursor ops never split
  emoji), pure and TTY-free (m1-chat-surface T3.1)
- `ChatComposer` — multi-line terminal input (Enter submits, Ctrl+J newline —
  Shift+Enter honored on kitty-protocol terminals), inverse-video cursor, dimmed
  placeholder, whitespace-only submit guard (m1-chat-surface T3.2)
- Thread benchmark with plain-vs-windowed mode matrix — committed baseline shows
  windowed history ~64× faster per frame under streaming+append load
  (`docs/benchmarks/m1-chat-thread-baseline.json`) (m1-chat-surface T4.1)

### Changed

- Invalid-role error message now names the three-role union
  (`"user" | "assistant" | "system"`) (m1-chat-surface T1.1)

### Deprecated

### Removed

### Fixed

### Security

## [0.1.0] - 2026-07-06

### Added

- Publishable package scaffold: ESM-only manifest (types-first `exports`, react-only peer,
  `ink ^5` dependency, Node ≥ 20), Apache-2.0 LICENSE + NOTICE, protected by an executable
  manifest-contract test (m0-walking-skeleton T0.1)
- Five-gate toolchain — format (prettier) → lint (eslint flat + typescript-eslint,
  complexity ≤ 10) → typecheck (strict tsc) → test (vitest, deterministic color env) →
  build (tsup ESM + dts) — plus the `src/index.ts` public entry (m0-walking-skeleton T0.2)
- Theme stub: flat semantic tokens (`role`, `status`), `<TheoTUIProvider>` with leaf-level
  partial override, `useTheoTheme()` with default fallback, `defaultTheme` export
  (m0-walking-skeleton T1.1)
- `ChatMessage` primitive (user/assistant) with role glyph prefix + themed colors,
  per-role snapshots, typed invalid-role error, narrow-width wrap and NO_COLOR degraded
  render coverage (m0-walking-skeleton T2.1)
- Render benchmark harness (`pnpm bench`, `--smoke` mode) with committed baseline —
  100-message thread + 300-token streaming, 5 measured runs + warmup, mean ± std dev;
  authoritative numbers live in `docs/benchmarks/m0-chat-message-baseline.json`
  (m0-walking-skeleton T3.1)
- Runnable example (`pnpm example`) — provider + user/assistant exchange; degrades
  cleanly when piped/non-TTY (m0-walking-skeleton T3.2)
- GitHub Actions CI: gate chain (format → lint → typecheck → test → build → bench smoke)
  on Node 20 + 22 for pushes to `develop` and PRs, including a coverage gate step
  (m0-walking-skeleton T4.1)

### Changed

- Review-batch hardening (m0-walking-skeleton review 2026-07-06): theme context value
  memoized (stable identity for consumers), `defaultTheme` deep-frozen, nested-provider
  reset semantics documented + pinned by test, exported `VERSION` now contract-tested
  against `package.json`, benchmark runner pins the color env (baseline regenerated),
  `eslint-plugin-react-hooks` enabled
