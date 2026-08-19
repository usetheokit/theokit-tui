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

Nothing was deleted to make this gate green. Deleting 71 LOC of tested code from a published package
is a change that deserves its own measurement, not a side effect of configuring a detector.

**The four barrel rows are gone, and were replaced by a rule rather than by a deletion (B-066).**
`src/**/index.ts` is now an `entry`. The reason is structural rather than cosmetic: ADR 0002 makes a
barrel the _mechanism_ of privacy — a folder is private BY not being re-exported from the root — so
an internal domain's barrel having zero importers is the EXPECTED state, not a defect. Measured
across the whole tree, no sibling domain imports another domain's barrel at all; deep imports are
the house pattern.

Two gates disagreed and the list was the manual patch between them: `tests/lint/structure.test.ts`
MANDATES a barrel for every folder under `src/`, and knip called that same barrel unused. Deleting
the four was measured and refused — it turns that test red, naming those exact folders. The rule
means the next internal domain gets the right answer without a new line here.

The gate is not weakened, and that was measured rather than asserted. With the two remaining rows
temporarily unexempted, knip still reports `kill-ring.ts` and `undo-stack.ts`; and a scratch module
exported from its own barrel and imported by nothing is still reported under the new rule. Declaring
a barrel an entry makes the BARREL a root, not its exports. The accepted cost is that a barrel which
is itself entirely dead is now invisible.

**Every entry here is a full path, never a glob** (except `tests/**`, which is a category). A glob
would let a new dead file inherit an exemption nobody granted it.
