# `knip.json` — why it is shaped this way

The gate answers ONE question: **is this module reachable from what the package actually
publishes?** Not "does anything mention it", and not "does a test import it".

`pnpm lint` runs it as `knip --production --include files`. Each of those three parts is
load-bearing and each was chosen after measuring the alternative.

## `--production`, and why the default run is not wired

Under its defaults knip treats every test file as an entry point, so a module whose only importer is
its own test is reachable. Measured on this tree 2026-08-19:

|                              | `knip` (defaults) | `knip --production` |
| ---------------------------- | ----------------- | ------------------- |
| `src/renderer/kill-ring.ts`  | not reported      | **reported**        |
| `src/renderer/undo-stack.ts` | not reported      | **reported**        |

Both are complete, tested M21 modules whose own headers say they are "held by the composer via a
ref". Nothing imports them. That is the blind spot B-024 was filed about, and `frame-budget.ts`
(75 LOC, nine tests, zero non-test importers for four days) was the case that surfaced it.

**A correction, measured:** B-024 says the sibling repo has the fix configured. Read
`modelo/TheoCode/knip.jsonc` — it declares `"entry": [..., "src/**/*.test.ts"]` for every workspace,
so it has the same blind spot. What it DOES solve is `includeEntryExports`, a different gap, and a
real one; adopting it here is a followup, not this file.

## `--include files`, and the 30 findings deferred

Without it the production run also reports 30 unused exports — real findings, and a cleanup with its
own risk. Reporting them here would have landed this gate red on arrival, and a gate that lands red
is a gate that gets removed. The export sweep is a followup that owns them.

## The entries

The four `exports` subpaths are the package's real surface. `examples/` and `benchmarks/` are
DECLARED ENTRIES rather than ignored paths: they are unreachable from `exports` by design — each is
its own root — but a dead module imported only by a dead example must stay visible, and ignoring the
directory would hide it. Declaring them costs 8 lines and reports 37 fewer false findings.

`tests/**` IS ignored. Its fixtures and harnesses are consumed by tests, so their production
reachability is not a question this gate asks; leaving them in reported 9 files that are exactly
what they should be.

## The six exemptions, each with a reason

`ignore` here is not "we do not care". It is "this file is dead, we know, and the decision that
retires it is somewhere else". An unexplained exemption is how the sibling's own cleanup ended with
120 survivors and not one recorded reason.

| File                                  | Why it is dead                                                                                                     | Who owns the decision |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | --------------------- |
| `src/renderer/kill-ring.ts` (43 LOC)  | complete + tested; its header describes a composer integration that does not exist. 0 production importers, 1 test | B-065                 |
| `src/renderer/undo-stack.ts` (28 LOC) | same shape, same header, same measurement                                                                          | B-065                 |
| `src/search/index.ts`                 | an internal barrel. Its own comment says `src/chat` consumes it; measured, `src/chat` imports the concrete modules | B-066                 |
| `src/renderer/hooks/index.ts`         | `src/index.ts:26` reaches `./renderer/hooks/use-overlay.js` DIRECTLY, so the barrel has no importer                | B-066                 |
| `src/renderer/input/index.ts`         | same — the barrel is bypassed                                                                                      | B-066                 |
| `src/renderer/output/index.ts`        | same                                                                                                               | B-066                 |

Nothing was deleted to make this gate green. Deleting 71 LOC of tested code and four barrels from a
published package is a change that deserves its own measurement, not a side effect of configuring a
detector.

**Every entry here is a full path, never a glob** (except `tests/**`, which is a category). A glob
would let a new dead file inherit an exemption nobody granted it.
