/**
 * Lint test — the shape of the source tree is a contract, not a habit.
 *
 * Why this is a gate and not a review convention: `src/` had grown to 147 files
 * in one directory while the engine half of the same codebase (renderer,
 * input, terminal, keys) stayed properly foldered. Nothing recorded a decision
 * either way, and nothing failed, so the drift was invisible until someone
 * counted. Code review had every opportunity to stop it and did not — a rule
 * that only lives in reviewers' heads is a rule that erodes.
 *
 * The rules below encode ADR 0001 (organise src/ by product domain), ADR 0002
 * (one exported component per module) and ADR 0003 (gate structure in CI).
 *
 * Thresholds are honest about their provenance: files-per-folder <= 25 is
 * folklore, not a researched limit. It is enforced anyway because the failure
 * it prevents is real and the cost of obeying it is a folder split.
 *
 * @internal
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO = fileURLToPath(new URL("../..", import.meta.url));
const SRC = join(REPO, "src");

const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const SOURCE = /\.tsx?$/;
const MAX_FILES_PER_FOLDER = 25;

/** Test-file qualifier segments the tree is allowed to use: `name.<q>.test.tsx`. */
const ALLOWED_TEST_QUALIFIERS = new Set(["integration", "e2e"]);

interface Entry {
  readonly dir: string;
  readonly name: string;
}

function walk(root: string): { dirs: string[]; files: Entry[] } {
  const dirs: string[] = [];
  const files: Entry[] = [];
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop() as string;
    for (const name of readdirSync(current)) {
      const full = join(current, name);
      if (statSync(full).isDirectory()) {
        if (name === "__snapshots__") continue; // vitest-owned
        dirs.push(full);
        stack.push(full);
      } else {
        files.push({ dir: current, name });
      }
    }
  }
  return { dirs, files };
}

const tree = walk(SRC);
const sourceFiles = tree.files.filter((f) => SOURCE.test(f.name));

describe("src/ is organised by domain (ADR 0001)", () => {
  it("no_source_file_sits_directly_under_src_except_the_barrel", () => {
    const loose = sourceFiles
      .filter((f) => f.dir === SRC && f.name !== "index.ts")
      .map((f) => f.name);
    expect(
      loose,
      "put the module in a domain folder under src/ (see docs/adr/0001-organise-src-by-domain.md)",
    ).toEqual([]);
  });

  it("every_folder_under_src_has_a_barrel", () => {
    const missing = tree.dirs
      .filter((d) => !readdirSync(d).includes("index.ts"))
      .map((d) => relative(REPO, d));
    expect(
      missing,
      "a folder without index.ts has no declared surface, so siblings reach past it into private files",
    ).toEqual([]);
  });

  it("no_folder_exceeds_the_files_per_folder_budget", () => {
    const counts = new Map<string, number>();
    for (const f of sourceFiles) {
      counts.set(f.dir, (counts.get(f.dir) ?? 0) + 1);
    }
    const over = [...counts.entries()]
      .filter(([, n]) => n > MAX_FILES_PER_FOLDER)
      .map(([d, n]) => `${relative(REPO, d)} (${n})`);
    expect(
      over,
      `over ${MAX_FILES_PER_FOLDER} source files — split the folder by responsibility`,
    ).toEqual([]);
  });
});

describe("naming is one convention, everywhere (ADR 0003)", () => {
  it("directories_are_kebab_case", () => {
    const bad = tree.dirs
      .map((d) => relative(REPO, d))
      .filter((d) => !KEBAB.test(d.slice(d.lastIndexOf("/") + 1)));
    expect(bad).toEqual([]);
  });

  it("file_stems_are_kebab_case", () => {
    const bad = sourceFiles
      .filter((f) => !KEBAB.test(f.name.split(".")[0] as string))
      .map((f) => join(relative(REPO, f.dir), f.name));
    expect(bad).toEqual([]);
  });

  it("test_files_use_only_registered_qualifiers", () => {
    // `name.<qualifier>.test.tsx` — the qualifier says HOW the test runs, never
    // WHICH case it covers. A per-case qualifier is a describe() block that
    // escaped into the filename, and each new one splits the suite a little
    // further with no rule saying where a reader should look.
    const bad: string[] = [];
    for (const f of sourceFiles) {
      const match = /^[a-z0-9-]+\.([a-z0-9-]+)\.test\.tsx?$/.exec(f.name);
      if (match && !ALLOWED_TEST_QUALIFIERS.has(match[1] as string)) {
        bad.push(join(relative(REPO, f.dir), f.name));
      }
    }
    expect(
      bad,
      `allowed qualifiers: ${[...ALLOWED_TEST_QUALIFIERS].join(", ")} — express anything else as a describe() block`,
    ).toEqual([]);
  });
});

describe("the -model suffix means something (ADR 0004)", () => {
  it("model_suffix_is_only_used_when_a_same_stem_view_sits_beside_it", () => {
    // The suffix marked the headless half of a component pair — but it was
    // right 3 times out of 8, and 23 further headless modules never used it,
    // so it predicted nothing. Now it is structural: `x-model.ts` is legal
    // only when `x.tsx` is its neighbour. Everything else drops the suffix and
    // lets the domain folder and the file's own name carry the meaning.
    const bad: string[] = [];
    for (const f of sourceFiles) {
      if (!f.name.endsWith("-model.ts") || f.name.includes(".test.")) continue;
      const stem = f.name.slice(0, -"-model.ts".length);
      const hasView = readdirSync(f.dir).includes(`${stem}.tsx`);
      if (!hasView) bad.push(join(relative(REPO, f.dir), f.name));
    }
    expect(
      bad,
      "either add the paired view or drop the -model suffix — a marker that is right less than half the time is worse than no marker",
    ).toEqual([]);
  });
});

describe("filenames name their subject, not their milestone (ADR 0003)", () => {
  it("no_filename_is_prefixed_with_an_internal_milestone_id", () => {
    // `skeleton-parity.md` sorts by project chronology and means nothing to
    // a reader outside this repo's history. Keep the milestone INSIDE the file.
    const roots = ["src", "tests", "benchmarks", "examples", "wiki", "docs"];
    const bad: string[] = [];
    for (const root of roots) {
      const base = join(REPO, root);
      let entries: string[];
      try {
        entries = readdirSync(base);
      } catch {
        continue;
      }
      const stack = entries.map((e) => join(base, e));
      while (stack.length > 0) {
        const full = stack.pop() as string;
        if (statSync(full).isDirectory()) {
          stack.push(...readdirSync(full).map((e) => join(full, e)));
          continue;
        }
        const name = full.slice(full.lastIndexOf("/") + 1);
        if (/^m\d+[-.]/i.test(name)) bad.push(relative(REPO, full));
      }
    }
    expect(bad.sort()).toEqual([]);
  });
});

describe("one exported component per module (ADR 0002)", () => {
  // A component is a top-level `const`/`function` whose name is PascalCase (not
  // SCREAMING_SNAKE — those are constants) and whose body renders JSX. The body
  // runs to the NEXT top-level declaration of any kind, and JSDoc is stripped
  // first: a doc comment mentioning `<Box>` does not make an interface a
  // component. Both were false positives while this rule was being written.
  const SCREAMING = /^[A-Z0-9_]+$/;
  const DECL =
    /^(export\s+)?(?:async\s+)?(const|function|class|interface|type)\s+([A-Za-z_$][\w$]*)/gm;
  const JSX = /<[A-Za-z][\w.]*[\s/>]/;

  /** Longest an inline (non-exported) component may be before it must become a
   * module. ADR 0002: extract when reused, tested independently, or beyond this
   * — never reflexively. `heuristic`, like every threshold in this file. */
  const MAX_INLINE_COMPONENT_LOC = 40;

  interface Component {
    readonly name: string;
    readonly exported: boolean;
    readonly loc: number;
  }

  function componentsIn(text: string): Component[] {
    const decls = [...text.matchAll(DECL)].map((m) => ({
      at: m.index as number,
      exported: Boolean(m[1]),
      kind: m[2] as string,
      name: m[3] as string,
    }));
    const found: Component[] = [];
    for (const [i, d] of decls.entries()) {
      if (d.kind !== "const" && d.kind !== "function") continue;
      if (!/^[A-Z]/.test(d.name) || SCREAMING.test(d.name)) continue;
      const end = decls[i + 1]?.at ?? text.length;
      const body = text.slice(d.at, end).replace(/\/\*\*[\s\S]*?\*\//g, "");
      if (!JSX.test(body)) continue;
      found.push({
        name: d.name,
        exported: d.exported,
        loc: body.split("\n").length - 1,
      });
    }
    return found;
  }

  const modules = sourceFiles
    .filter((f) => f.name.endsWith(".tsx") && !f.name.includes(".test."))
    .map((f) => ({
      path: join(relative(REPO, f.dir), f.name),
      components: componentsIn(readFileSync(join(f.dir, f.name), "utf8")),
    }));

  it("no_module_exports_more_than_one_component", () => {
    const offenders = modules
      .filter((m) => m.components.filter((c) => c.exported).length > 1)
      .map(
        (m) =>
          `${m.path}: ${m.components
            .filter((c) => c.exported)
            .map((c) => c.name)
            .join(", ")}`,
      );
    expect(offenders, "two exported components are two modules wearing one filename").toEqual([]);
  });

  it("no_inline_component_outgrows_the_extraction_budget", () => {
    const offenders = modules.flatMap((m) =>
      m.components
        .filter((c) => !c.exported && c.loc > MAX_INLINE_COMPONENT_LOC)
        .map((c) => `${m.path}: ${c.name} (${c.loc} LOC)`),
    );
    expect(
      offenders,
      `over ${MAX_INLINE_COMPONENT_LOC} LOC inline — an inline component cannot be tested, benchmarked or reused without being promoted first`,
    ).toEqual([]);
  });
});
