# Blueprint: M0 Walking Skeleton — Ink 5 library scaffold + ChatMessage primitive

> **Version 1.0** — Synthesizes the deep research over `assistant-ui/packages/react-ink` (direct
> analog), `ink`, `ink-ui`, and `gemini-cli` into the locked decisions for `@theokit/tui`'s M0:
> package/build shape (ESM-only), test discipline (vitest + ink-testing-library, deterministic
> snapshots), ChatMessage v0 API, `<TheoTUIProvider>` theme-token stub, and a render-benchmark
> harness with real metrics. All 7 research questions from the source plan answered; 0 blocked.

**Slug:** `m0-walking-skeleton`
**Source plan:** `.claude/knowledge-base/discoveries/plans/m0-walking-skeleton-plan.md`
**Owner:** paulohenriquevn + Claude (assisted)
**Generated:** 2026-07-05 via `/discover-execute`
**Confidence verdict:** SHIPPABLE (99.5/100 — 2026-07-05, zero hard/soft caps)

## Context

Inherited from the discovery plan: `ROADMAP.md § M0` requires the thinnest vertical slice proving
the whole toolchain (Ink 5 + tsup ESM-only + vitest + ink-testing-library + TS strict +
Apache-2.0), with one `ChatMessage` primitive, snapshot-tested, all gates green. Declared risks:
Ink 5/React/ESM interop; snapshot flakiness from ANSI/width. The cycle owner additionally requires
benchmark data as an acceptance signal.

## Objective

Enable `/to-plan` to write the M0 implementation plan with zero unresolved toolchain or API-shape
questions.

---

## Coverage Corner 1 — Integration Tests

*(Answers Q1, Q2 — how the analogs test Ink component output deterministically.)*

### assistant-ui/react-ink (vitest + ink-testing-library, plain-text assertions)

- **Render library:** `ink-testing-library` v4 as devDependency —
  `.claude/knowledge-base/references/assistant-ui/packages/react-ink/package.json:65`
  (`"ink-testing-library": "^4.0.0"`); imported in the shared helper
  `.claude/knowledge-base/references/assistant-ui/packages/react-ink/src/tests/helpers.tsx:2`.
- **Async frame helper:** one React tick before capture —
  `.claude/knowledge-base/references/assistant-ui/packages/react-ink/src/tests/helpers.tsx:13`:

```ts
// .claude/knowledge-base/references/assistant-ui/packages/react-ink/src/tests/helpers.tsx:13-17
export const renderFrame = async (node: ReactElement) => {
  const instance = render(node);
  await new Promise((resolve) => setTimeout(resolve, 0));
  return instance.lastFrame() ?? "";
};
```

- **Assertion style:** plain-text `toContain` on `lastFrame()` — NO `toMatchSnapshot` anywhere,
  decoupling assertions from ANSI color codes —
  `.claude/knowledge-base/references/assistant-ui/packages/react-ink/src/tests/MessageContent.test.tsx:82`
  (`expect(frame).toContain("search")`).
- **Vitest config is minimal:** node environment, globals, no color env pinning —
  `.claude/knowledge-base/references/assistant-ui/packages/react-ink/vitest.config.ts:1`.
- **Mock hygiene:** `vi.mock` with `importOriginal` spread —
  `.claude/knowledge-base/references/assistant-ui/packages/react-ink/src/tests/MessageContent.test.tsx:17`.

### ink-ui (ava + ink-testing-library, exact-match ANSI assertions)

- **Exact-frame equality including color codes**, with `chalk` used to build expected values —
  `.claude/knowledge-base/references/ink-ui/test/badge.tsx:8-10`
  (`t.is(lastFrame(), chalk.bgGreen(...))`).
- **Color determinism via env pin:** `FORCE_COLOR: "true"` in the test-runner env —
  `.claude/knowledge-base/references/ink-ui/package.json:71`.
- **Width determinism via layout, not env:** wrap in `<Box width={20}>` —
  `.claude/knowledge-base/references/ink-ui/test/progress-bar.tsx:10-12`.
- **Animation testing via `frames` history array + dedup** —
  `.claude/knowledge-base/references/ink-ui/test/spinner.tsx:11-17`
  (`const {frames, unmount} = render(...)`; `[...new Set(frames)]`).
- **CI quirk handled explicitly:** trailing-newline strip when `process.env['CI']` —
  `.claude/knowledge-base/references/ink-ui/test/spinner.tsx:19-21`.
- **Interactive input via `stdin.write` + delay** —
  `.claude/knowledge-base/references/ink-ui/test/select.tsx:66-67`.

### Synthesis for @theokit/tui M0

The two analogs take OPPOSITE determinism strategies: react-ink strips color out of the assertion
surface (plain-text contains); ink-ui pins color ON (`FORCE_COLOR=true`) and asserts exact ANSI.
Both are deterministic; the flaky middle ground is asserting colors without pinning the env. M0
DoD requires *snapshot* tests, so we adopt the ink-ui-style env pin + Box-width control, executed
under vitest (react-ink's runner) — see ADR D2.

---

## Coverage Corner 2 — Dependencies

*(Answers Q3 — exact dependency contract of the three packages.)*

### Version matrix (verified line-by-line)

| Package | react | ink | Notable runtime deps | engines.node | type |
|---|---|---|---|---|---|
| `@assistant-ui/react-ink` | `^19` (peer) — `.claude/knowledge-base/references/assistant-ui/packages/react-ink/package.json:53` | `>=6` (peer) — `.claude/knowledge-base/references/assistant-ui/packages/react-ink/package.json:52` | `ink-spinner ^5`, `zustand ^5`, `diff ^9`, assistant-ui core pkgs — `package.json:40-48` | not declared (monorepo root pins node >=24) | `module` — `package.json:15` |
| `@inkjs/ui` (ink-ui) | none as peer; `^18.3.1` devDep only | `>=5` (peer) — `.claude/knowledge-base/references/ink-ui/package.json:59` | `chalk ^5.3.0`, `cli-spinners ^3`, `deepmerge ^4.3.1`, `figures ^6.1.0` — `.claude/knowledge-base/references/ink-ui/package.json:33-37` | `>=18` — `.claude/knowledge-base/references/ink-ui/package.json:21` | `module` |
| `ink` (v6, HEAD of clone) | `>=19.2.0` (peer) — `.claude/knowledge-base/references/ink/package.json:109` | — | `yoga-layout ~3.2.1`, `chalk ^5.6.2`, `react-reconciler ^0.33`, ansi utils — `.claude/knowledge-base/references/ink/package.json` deps block | `>=22` — `.claude/knowledge-base/references/ink/package.json:17-18` | `module` |

- **workspace:* resolution (plan checkpoint EC-3):** react-ink's only `workspace:*` entry is the
  devDep `@assistant-ui/x-buildutils` (`package.json:61`), resolving to `0.0.17` at
  `.claude/knowledge-base/references/assistant-ui/packages/x-buildutils/package.json:4`. No runtime
  dep is workspace-internal.
- **Critical fork in the road:** the cloned `ink` HEAD is **Ink 6** — peer react `>=19.2.0`,
  node `>=22`. Ink **5** (what ink-ui targets, peer `>=5`, engines `>=18`, react ^18 in its devDeps
  `.claude/knowledge-base/references/ink-ui/package.json:50`) is the major compatible with the
  roadmap constraints (Node ≥ 20, React 18/19). See ADR D1. Exact `ink@5.x` peer-react range must
  be confirmed against the npm registry during `/deps-audit` (the clone only carries Ink 6's
  manifest) — flagged as a caveat, not a blocker.

---

## Coverage Corner 3 — Tools

*(Answers Q4, Q5 — build/packaging shape and benchmark harness.)*

### Build & packaging (Q4)

- **Nobody uses tsup.** react-ink builds via `aui-build` —
  `.claude/knowledge-base/references/assistant-ui/packages/react-ink/package.json:35` — a wrapper
  over **tsdown** (`import { build } from "tsdown"` at
  `.claude/knowledge-base/references/assistant-ui/packages/x-buildutils/src/index.ts:3`). `ink` and
  `ink-ui` build with **plain `tsc`** (`.claude/knowledge-base/references/ink-ui/package.json:25`,
  `.claude/knowledge-base/references/ink/package.json:22`).
- **Exports map (types-first, ESM single default):**

```json
// .claude/knowledge-base/references/assistant-ui/packages/react-ink/package.json:16-31
"exports": {
  ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" },
  "./internal": { "types": "./dist/internal.d.ts", "default": "./dist/internal.js" }
},
"files": ["dist", "src", "README.md"]
```

  ink and ink-ui ship the same shape with a single `.` entry and `"files": ["build"]`
  (`.claude/knowledge-base/references/ink/package.json:13-16`).
- **tsconfig:** react-ink extends a strictest-based base — `@tsconfig/strictest` via
  `.claude/knowledge-base/references/assistant-ui/packages/x-buildutils/ts/base.json:3` with
  `jsx: react-jsx`, `module: ESNext`, `moduleResolution: bundler`. ink/ink-ui extend
  `@sindresorhus/tsconfig` with `jsx: react` and `isolatedModules: true`
  (`.claude/knowledge-base/references/ink-ui/tsconfig.json:1-15`).
- **Lint/format:** ink & ink-ui: `xo` + `prettier`, lint wired INTO the test script
  (`"test": "tsc --noEmit && xo && ava"` — `.claude/knowledge-base/references/ink-ui/package.json:27`);
  react-ink: monorepo-level `oxlint` (`.claude/knowledge-base/references/assistant-ui/package.json:16`).

### Benchmark harness (Q5)

- **Runner:** custom node script spawning bench files via `tsx` —
  `.claude/knowledge-base/references/assistant-ui/packages/react-ink/benchmarks/run.ts:19`
  (`spawnSync("tsx", [join(benchDir, f)], { stdio: "inherit" })`), wired as
  `"benchmark": "tsx benchmarks/run.ts"`
  (`.claude/knowledge-base/references/assistant-ui/packages/react-ink/package.json:38`). NOT
  `vitest bench`.
- **Workload:** 1000-message thread + 300 streamed tokens @16ms, across 3 render modes
  (legacy/memo/windowed) —
  `.claude/knowledge-base/references/assistant-ui/packages/react-ink/benchmarks/long-thread.bench.tsx:152-155`.
- **Metric:** frame count + mean/peak ms-per-frame via `performance.now()`, distributing wall time
  across `stdout.frames` deltas (honest heuristic, noted in-source) —
  `long-thread.bench.tsx:205-230, 264-269`.
- **Iterations:** 1 discarded warmup + 2 trials per mode —
  `long-thread.bench.tsx:155, 282-310`.
- **Reporting:** console table with per-trial rows, averages, and delta attribution (%); no JSON
  persistence, no CI thresholds — `long-thread.bench.tsx:272-341`.
- **Plan checkpoint EC-4 confirmed:** `ink/benchmark/` emits NO numeric metrics — pure render
  demos (`.claude/knowledge-base/references/ink/benchmark/simple/simple.tsx:43-44`). react-ink's
  harness is the sole metrics-driven prior art.

---

## Coverage Corner 4 — Techniques

*(Answers Q6, Q7 — ChatMessage API shape and Provider/theme stub.)*

### Q6 — Message component API

**react-ink: compound components, role from runtime context.** `MessageRoot` is a thin `Box`
wrapper (`.claude/knowledge-base/references/assistant-ui/packages/react-ink/src/primitives/message/MessageRoot.tsx:4-10`);
`MessageContent` renders parts pulled from context state (`useAuiState((s) => s.message.parts)`)
with per-part render props —
`.claude/knowledge-base/references/assistant-ui/packages/react-ink/src/primitives/message/MessageContent.tsx:24-53`;
`MessageIf` gates on role/status booleans read from context —
`.claude/knowledge-base/references/assistant-ui/packages/react-ink/src/primitives/message/MessageIf.tsx:4-10`.
Role is NOT a prop — it lives in the runtime store.

**gemini-cli: separate per-role components, theme-driven glyphs.** `UserMessage` takes
`text: string, width: number`, renders a `"> "` 2-char prefix colored `theme.text.accent` —
`.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/components/messages/UserMessage.tsx:20-34`;
`GeminiMessage` uses a `"✦ "` prefix and `isPending` —
`.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/components/messages/GeminiMessage.tsx:14-34`.

**ChatMessage v0 proposal (judgment — see ADR D4):** single component, explicit `role` prop
(discoverable, no runtime onboarding), children as content, gemini-style role glyph + token colors:

| Prop | Type | Default | Purpose |
|---|---|---|---|
| `role` | `'user' \| 'assistant'` | required | selects prefix glyph + role colors |
| `children` | `ReactNode` | required | message content (text-only in M0) |

Deliberately dropped for M0 (each returns in a later milestone): context-driven parts system
(M7 adapter re-introduces state), compound Root/Content/If decomposition (M1 when ChatThread
needs it), per-part render props / tool-calls / attachments (M2+), `isPending` (M1 streaming).

### Q7 — Provider/theme stub

- **react-ink:** provider is a re-export of the core runtime provider — the ink package defines NO
  theme of its own —
  `.claude/knowledge-base/references/assistant-ui/packages/react-ink/src/context/AssistantContext.tsx:1`.
- **ink-ui:** `Theme = { components: Record<string, ComponentTheme> }` consumed via
  `useComponentTheme(name)` hook over React context, extended by deep-merge `extendTheme` —
  `.claude/knowledge-base/references/ink-ui/source/theme.tsx:17-26, 59-68`.
- **gemini-cli:** centralized semantic tokens (`text.primary/secondary/link/accent`,
  `background.*`, `border.*`, `ui.*`, `status.error/success/warning`) —
  `.claude/knowledge-base/references/gemini-cli/packages/cli/src/ui/themes/semantic-tokens.ts:9-43`.

**`<TheoTUIProvider>` M0 stub proposal (judgment — see ADR D5):** semantic-token object (gemini
direction, flat for M0) carried by a React context + `useTheoTheme()` hook; default tokens cover
role colors + status; extension seam = ink-ui-style `components` layer added in M6, not now.

---

## Cross-cutting Comparison

| Dimension | react-ink | ink-ui | ink | gemini-cli |
|---|---|---|---|---|
| Test runner | vitest (`package.json:36-37`) | ava (`package.json:27`) | ava + FORCE_COLOR (`package.json:24`) | vitest (out of M0 scope) |
| Color assertion | plain-text contains (`MessageContent.test.tsx:82`) | exact ANSI + chalk (`test/badge.tsx:10`) | exact w/ FORCE_COLOR | n/a |
| Build | tsdown wrapper (`x-buildutils/src/index.ts:3`) | tsc (`package.json:25`) | tsc (`package.json:22`) | esbuild (app, not lib) |
| ink/react targets | ink ≥6 / react ^19 (`package.json:52-53`) | ink ≥5 / react 18 dev (`package.json:59,50`) | IS ink 6; react ≥19.2 (`package.json:109`) | app-pinned |
| Theme | none (core runtime) (`AssistantContext.tsx:1`) | per-component styles (`theme.tsx:17-26`) | n/a | semantic tokens (`semantic-tokens.ts:9-43`) |
| Benchmark | metrics harness (`benchmarks/run.ts:19`) | none | render demos only (`benchmark/simple/simple.tsx:43`) | not examined |

## ADRs

### D1 — Ink 5 + React 18/19 dual peer, Node ≥ 20 (per roadmap lock; Ink 6 rejected for M0)

**Decision:** Depend on `ink@^5` (direct dependency), declare `react` peer as `^18.0.0 || ^19.0.0`,
engines `node >= 20`. Ink stays a **dependency** and React the **only peer**, per the roadmap
constraint table.

**Rationale:** The cloned Ink HEAD (v6) requires react `>=19.2.0` and node `>=22`
(`.claude/knowledge-base/references/ink/package.json:109,17-18`) — both violate the locked roadmap
constraints (Node ≥ 20, React 18/19). ink-ui demonstrates the ink-≥5 + node ≥18 posture
(`.claude/knowledge-base/references/ink-ui/package.json:59,21`). Editing roadmap constraints
mid-flight is forbidden (`rules/cycle-roadmap.md § Anti-patterns`).

**Alternatives considered:** Ink 6 + React 19 only (rejected: breaks roadmap constraint and
narrows the consumer base to node ≥22); ink as peer like react-ink does
(`.claude/knowledge-base/references/assistant-ui/packages/react-ink/package.json:52`) (rejected:
roadmap locks "React is the ONLY required peer" to keep TTFATT low — one `npm i` less for consumers).

**Consequences:** We track Ink 5.x until a between-milestones roadmap revision; exact `ink@5.x`
peer-react range confirmed via registry at `/deps-audit`. Re-evaluate Ink 6 at M6 (theme/robustness)
when capability detection work lands.

### D2 — Test discipline: vitest + ink-testing-library, FORCE_COLOR pinned, Box-width control, snapshot + semantic double assertion

**Decision:** vitest as runner; `ink-testing-library` for render; pin `FORCE_COLOR=1` (and unset
`NO_COLOR`) in vitest env; wrap width-sensitive renders in `<Box width={N}>`; adopt react-ink's
`renderFrame` one-tick helper; assert BOTH a `toMatchSnapshot()` of `lastFrame()` (M0 DoD requires
snapshot) AND at least one plain-text `toContain` per behavior (survives theming churn).

**Rationale:** The analogs prove two opposite-but-deterministic strategies — plain-text
(react-ink, `MessageContent.test.tsx:82`) vs pinned-ANSI exact match (ink-ui,
`test/badge.tsx:10` + `package.json:71`). Flakiness lives only in the unpinned middle. Snapshots
without env pinning would flake between local (truecolor) and CI (dumb) terminals; the pin + width
wrapper removes both flake vectors named in the roadmap risk.

**Alternatives considered:** ava (rejected: roadmap locks vitest; vitest is also react-ink's
choice); plain-text-only assertions (rejected: M0 DoD literally requires snapshot tests);
exact-ANSI-only (rejected: every M6 theme change would rewrite every expected string — DRY).

**Consequences:** Snapshots are stable across terminals; NO_COLOR degradation testing (M6 DoD)
will run as a second matrix axis later, not in M0 — M0 carries one NO_COLOR smoke test only.

### D3 — Build with tsup per M0 DoD lock; tsc acknowledged as the ecosystem default

**Decision:** Keep **tsup** for the M0 build (ESM-only, dts on), as the M0 DoD names it explicitly.

**Rationale:** Evidence shows the ecosystem builds with plain tsc (ink/ink-ui —
`.claude/knowledge-base/references/ink-ui/package.json:25`) or tsdown (react-ink via aui-build —
`.claude/knowledge-base/references/assistant-ui/packages/x-buildutils/src/index.ts:3`); tsup is
nonetheless battle-tested for exactly this shape (ESM lib + dts) and the DoD is locked mid-flight
(`rules/cycle-roadmap.md`: objectives/DoD revised only between milestones).

**Alternatives considered:** plain tsc (simplest, zero extra dep — blocked by DoD wording);
tsdown (react-ink's engine — younger tool, no DoD backing).

**Consequences:** One devDependency more than strictly needed; revisit between milestones if tsup
friction appears. Exports map follows the types-first single-`.` shape
(`.claude/knowledge-base/references/assistant-ui/packages/react-ink/package.json:16-31`, minus the
`./internal` split — YAGNI at M0).

### D4 — ChatMessage v0: single component, explicit role prop (no runtime context)

**Decision:** One `ChatMessage` component with `role: 'user' | 'assistant'` + `children`;
role glyph prefix (gemini pattern) + token colors from the provider.

**Rationale:** react-ink's context-driven compound decomposition
(`MessageIf.tsx:4-10`, `MessageContent.tsx:24-53`) presupposes a runtime store — that arrives at
M7 (stream adapter). For a walking skeleton, an explicit prop is discoverable and testable with
zero onboarding (KISS/YAGNI). gemini-cli ships per-role components with glyph prefixes in
production (`UserMessage.tsx:26`, `GeminiMessage.tsx:28`) — evidence the visual idiom works at scale.

**Alternatives considered:** compound components now (rejected: no second consumer case yet —
Rule of 3); separate `UserMessage`/`AssistantMessage` components (rejected: roadmap names ONE
`ChatMessage` primitive with roles; a single role-switched component mirrors `@theokit/ui`'s API).

**Consequences:** M1 may split internals into Root/Content as ChatThread lands, without breaking
the public `role` prop; parts/tool-calls arrive M2+ as additive props/subcomponents.

### D5 — Theme stub: flat semantic tokens now, component-style layer deferred to M6

**Decision:** `<TheoTUIProvider>` carries a flat semantic-token object (role colors + status),
consumed via a `useTheoTheme()` hook; no per-component style functions in M0.

**Rationale:** gemini-cli's semantic-token taxonomy (`semantic-tokens.ts:9-43`) matches our
terminal-adaptive M6 goal; ink-ui's per-component `styles`/`config` functions + deepmerge
(`theme.tsx:17-26,59-61`) is the right EXTENSION seam but is over-structure for one component
(YAGNI). Flat tokens are forward-compatible: M6 adds the `components` layer without breaking
token names.

**Alternatives considered:** ink-ui full shape now (rejected: 90% dead structure at M0 — the
`/code-quality` dead-code gate would rightly flag it); no provider at all (rejected: M0 DoD
requires the `<TheoTUIProvider>` stub, and the composition-root seam per `rules/architecture.md`
must exist from the first commit).

**Consequences:** Token names chosen at M0 become API; keep the set minimal (role colors, status)
so M6 can re-organize categories additively.

### D6 — Benchmark: react-ink-style tsx harness, mean/peak ms-per-frame, ≥3 measured runs, JSON + docs persistence

**Decision:** Adopt react-ink's harness pattern (custom bench script run via `tsx`, ink-testing
stdout frames + `performance.now()`), simplified to M0 scale: workload = render of a 100-message
static thread + a 300-token streaming append into `ChatMessage`; metrics = frame count, mean and
peak ms/frame; protocol = 1 discarded warmup + **≥3 measured runs** reporting mean ± std dev;
output = console table AND a JSON artifact under `docs/benchmarks/` (committed).

**Rationale:** The only metrics-driven prior art is react-ink's harness
(`benchmarks/long-thread.bench.tsx:205-230`, `run.ts:19`); ink's own benchmarks emit no numbers
(`benchmark/simple/simple.tsx:43-44`). Two upgrades over the prior art, both mandated by project
rules: ≥3 runs with mean ± std dev (`rules/analysis-golden-rule.md § 3` statistical rigor) and
persisted JSON (baseline for regression detection + `rules/public-copy.md § 4` requires a
reproducible artifact under `docs/benchmarks/` before any performance claim).

**Alternatives considered:** `vitest bench` (rejected: no prior art in the analogs for Ink
rendering; tinybench drives ops/sec micro-loops, while the phenomenon measured is frame flushes on
a live Ink `render()` — the custom harness measures the real thing); no benchmark at M0 (rejected:
cycle owner requires benchmark data as acceptance signal).

**Consequences:** M0 ships `benchmarks/` + a committed baseline JSON; later milestones extend the
workload (windowing at M1, tool-cards at M2) against the same metric definitions.

## Recommendations for the project

| # | Recommendation | Linked to | Priority |
|---|---|---|---|
| 1 | Scaffold package.json: `type: module`, types-first `exports` single `.`, `files: ["dist"]`, `sideEffects: false`, engines `node >=20`, react peer `^18 \|\| ^19`, ink `^5` as dependency | Q3, Q4, D1, D3 | HIGH |
| 2 | tsconfig: `strict: true` (strictest-inspired), `jsx: react-jsx`, `module: ESNext`, `moduleResolution: bundler`, `isolatedModules: true`, `declaration` via tsup dts | Q4, D3 | HIGH |
| 3 | Test setup: vitest + ink-testing-library; `renderFrame` helper (one-tick); `FORCE_COLOR=1` pinned in vitest config env; `<Box width={N}>` wrappers; snapshot + toContain double assertion; one NO_COLOR smoke test | Q1, Q2, D2, `rules/testing.md § 3` (deterministic) | HIGH |
| 4 | ChatMessage v0: `role` + `children`, glyph prefix (`> ` user / `✦ ` assistant), colors from provider tokens | Q6, D4 | HIGH |
| 5 | TheoTUIProvider stub: flat semantic tokens (role colors + status), `useTheoTheme()` hook, default theme exported | Q7, D5, `rules/architecture.md § 1` (composition root) | HIGH |
| 6 | Benchmark harness: `benchmarks/chat-message.bench.tsx` + tsx runner; warmup + ≥3 runs; mean ± std dev; JSON artifact committed under `docs/benchmarks/` | Q5, D6, `rules/analysis-golden-rule.md § 3`, `rules/public-copy.md § 4` | HIGH |
| 7 | Wire lint INTO the gate chain like ink-ui does (`test` = typecheck + lint + unit) so CI can't pass with lint drift | Q4, D2 | MEDIUM |
| 8 | At `/deps-audit`: confirm exact `ink@5.x` peer-react range + CVE scan on ink/react/tsup/vitest/ink-testing-library | Q3, D1 | HIGH |

## Blocked questions (if any)

(none — all 7 questions answered)

## Halt-loop progress (audit trail)

- Iterations used: 1 (inline execution — 4 parallel research agents, one synthesis pass; ralph-loop
  not spawned because a session-scoped Stop hook was already active — `rules/loop-engine-convention.md
  § Anti-patterns`, concurrent loops on overlapping state)
- Questions answered: 7 / 7
- Questions blocked: 0
- Citations verified: spot-checked (react-ink peers, ink 6 peers/engines, ink-ui theme/engines) +
  full path-existence sweep in Step 7 sanity check
- Promise emitted at iteration: 1

## Related

- Discovery plan: `.claude/knowledge-base/discoveries/plans/m0-walking-skeleton-plan.md`
- Edge-case review: `.claude/knowledge-base/reviews/m0-walking-skeleton-edge-cases-2026-07-05.md`
- Confidence report: `.claude/knowledge-base/reviews/m0-walking-skeleton-confidence-2026-07-05.md` (generated by `/discover-confidence`)
- Project rules linked: `.claude/rules/architecture.md`, `.claude/rules/testing.md`, `.claude/rules/public-copy.md`, `.claude/rules/analysis-golden-rule.md`
