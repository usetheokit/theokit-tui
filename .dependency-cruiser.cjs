/**
 * B-023 — layering was enforced by review attention, and review attention missed a cycle.
 *
 * Every `/code-quality` run on this package reported the same INFO — "no architecture rules
 * declared" — so its dependency detector was skipped on every audit. `rules/architecture.md` § 4
 * said boundary enforcement is code review and that no project-agnostic tool ships with the
 * ruleset; the sibling repo has had one configured since its own B-010, which is what makes that
 * sentence a measurement rather than a policy.
 *
 * WHAT IS DELIBERATELY ABSENT: folder-layering rules. Measured on this tree, the domain graph runs
 * in both directions — `layout → prompts` (3 edges) and `prompts → layout` (7), `agent → chat` (5)
 * and `status → agent` (3). Any layering rule would fail on the day it landed, against a design
 * nobody agreed to, and a rule that must be waived immediately teaches everyone to waive rules.
 * So this file declares what the tree can actually pass. It catches cycles and dev-dependency
 * leaks; it does NOT make the layering enforced, and saying so is the point.
 *
 * The first run of `no-circular` found one real cycle —
 * `renderer/host-config.ts → renderer/text-measure.ts → renderer/host-config.ts`. It was broken by
 * moving the node type to its own leaf module, not by an exception naming those two files: a gate
 * that passes because it was told not to look is the defect this item was filed about.
 */
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      comment:
        "Acyclic Dependencies Principle — a cycle makes both ends untestable in isolation. " +
        "TypeScript erases an `import type`, so a type-only cycle has no runtime cost; it is still " +
        "refused, because dependency-cruiser reports both directions as plain imports and the only " +
        "way to allow it would be a path exception naming the very files the rule found.",
      severity: "error",
      from: {},
      to: { circular: true },
    },
    {
      name: "not-to-dev-dep",
      comment:
        "A devDependency reaching production code compiles here and breaks in a consumer's install, " +
        "where devDependencies are not there. Tests and benchmarks are exempt: that is where a dev " +
        "dependency belongs.\n\n" +
        "`npm-peer` is excluded, and the exclusion is load-bearing rather than a convenience. The " +
        "first run of this rule reported 47 violations: 46 were `react`, which this package declares " +
        "as a PEER dependency (a component library must not bundle the host's React) and also as a " +
        "devDependency so its own build and tests can run. dependency-cruiser reports it as " +
        "['npm-peer','npm-dev','import'], and flagging it would have made the rule fire on every " +
        "component in the package on day one. The rule was wrong, not the code — the fix is here " +
        "and not in 46 per-file exceptions.",
      severity: "error",
      from: { path: "^src", pathNot: "\\.(test|bench)\\.(ts|tsx)$" },
      to: { dependencyTypes: ["npm-dev"], dependencyTypesNot: ["npm-peer"] },
    },
    {
      name: "no-orphans",
      comment:
        "A module nothing imports. WARN, not error: entry points and ambient declaration files are " +
        "legitimately unimported, so this reports rather than blocks.",
      severity: "warn",
      from: { orphan: true, pathNot: "\\.d\\.ts$|^src/index\\.ts$" },
      to: {},
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsConfig: { fileName: "tsconfig.json" },
    tsPreCompilationDeps: true,
  },
};
