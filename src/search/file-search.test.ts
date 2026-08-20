import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  isPathQuery,
  searchFiles,
  splitMentionPath,
  type DirEntryLike,
  type FileSystemLike,
} from "./file-search.js";

// M21 T4.1 — the async @-file provider over an INJECTED in-memory filesystem
// (no real disk). Covers the walk, .gitignore + default skips, fuzzy ranking,
// abort, and the never-throws contract.

const dir = (...names: string[]): DirEntryLike[] =>
  names.map((n) => ({ name: n, isDirectory: false }));
const subdir = (name: string): DirEntryLike => ({ name, isDirectory: true });

function fakeFs(
  tree: Record<string, DirEntryLike[]>,
  gitignore: string | null = null,
): FileSystemLike {
  return {
    readDir: async (d) => tree[d] ?? [],
    readGitignore: async () => gitignore,
  };
}

const CWD = "/repo";

describe("searchFiles (M21 T4.1)", () => {
  it("returns_cwd_relative_paths_fuzzy_ranked", async () => {
    const fs = fakeFs({
      "/repo": [...dir("readme.md"), subdir("src")],
      "/repo/src": dir("index.ts", "foo.ts"),
    });
    const results = await searchFiles("foo", { cwd: CWD, fs });
    expect(results).toContain("src/foo.ts");
    expect(results[0]).toBe("src/foo.ts"); // best match first
    expect(results).not.toContain("readme.md");
  });

  it("respects_gitignore", async () => {
    const fs = fakeFs(
      {
        "/repo": dir("keep.ts", "secret.env"),
      },
      "*.env\n",
    );
    const results = await searchFiles("", { cwd: CWD, fs });
    expect(results).toContain("keep.ts");
    expect(results).not.toContain("secret.env");
  });

  it("skips_node_modules_and_dot_git", async () => {
    const fs = fakeFs({
      "/repo": [subdir("node_modules"), subdir(".git"), ...dir("app.ts")],
      "/repo/node_modules": dir("dep.js"),
      "/repo/.git": dir("config"),
    });
    const results = await searchFiles("", { cwd: CWD, fs });
    expect(results).toEqual(["app.ts"]);
  });

  it("hides_dotfiles_and_dot_directories_by_default", async () => {
    // Reported bug: `@` (empty query) surfaced `.claude/.active_plan` etc. A
    // file picker hides hidden entries by default (Claude Code parity); the
    // dot-dir is never even walked into.
    const fs = fakeFs({
      "/repo": [subdir(".claude"), subdir("src"), ...dir(".env", "app.ts")],
      "/repo/.claude": dir(".active_plan"),
      "/repo/src": dir("index.ts"),
    });
    const results = await searchFiles("", { cwd: CWD, fs });
    expect(results.sort()).toEqual(["app.ts", "src/index.ts"]);
    expect(results.some((p) => p.includes(".claude"))).toBe(false);
    expect(results).not.toContain(".env");
  });

  it("aborts_when_the_signal_is_already_aborted", async () => {
    const fs = fakeFs({ "/repo": dir("a.ts", "b.ts") });
    const controller = new AbortController();
    controller.abort();
    const results = await searchFiles("", {
      cwd: CWD,
      fs,
      signal: controller.signal,
    });
    expect(results).toEqual([]);
  });

  it("respects_max_results_and_returns_empty_on_an_unreadable_root", async () => {
    const many = fakeFs({
      "/repo": dir("a.ts", "b.ts", "c.ts"),
    });
    expect(
      (await searchFiles("", { cwd: CWD, fs: many, maxResults: 2 })).length,
    ).toBe(2);

    const throwing: FileSystemLike = {
      readDir: async () => {
        throw new Error("EACCES");
      },
      readGitignore: async () => null,
    };
    expect(await searchFiles("", { cwd: CWD, fs: throwing })).toEqual([]);
  });

  it("respects_max_depth", async () => {
    const fs = fakeFs({
      "/repo": [subdir("a")],
      "/repo/a": [subdir("b")],
      "/repo/a/b": dir("deep.ts"),
    });
    const shallow = await searchFiles("", { cwd: CWD, fs, maxDepth: 1 });
    expect(shallow).toEqual([]); // deep.ts is at depth 2
    const deep = await searchFiles("", { cwd: CWD, fs, maxDepth: 5 });
    expect(deep).toContain("a/b/deep.ts");
  });

  it("walks_the_real_filesystem_via_the_default_adapter", async () => {
    // Exercises nodeFileSystem (real readDir + readGitignore) over this src dir.
    const srcDir = fileURLToPath(new URL(".", import.meta.url));
    const results = await searchFiles("fuzzy", {
      cwd: srcDir,
      maxResults: 200,
    });
    expect(results).toContain("fuzzy.ts");
  });
});

const HOME = "/home/dev";

describe("isPathQuery (@ path mode — Claude Code parity)", () => {
  it("plain_words_are_not_paths", () => {
    expect(isPathQuery("retry")).toBe(false);
    expect(isPathQuery("")).toBe(false);
  });
  it("a_slash_or_tilde_makes_it_a_path", () => {
    expect(isPathQuery("src/")).toBe(true);
    expect(isPathQuery("~")).toBe(true);
    expect(isPathQuery("~/Desk")).toBe(true);
    expect(isPathQuery("/etc/")).toBe(true);
  });
});

describe("splitMentionPath", () => {
  it("expands_tilde_to_home", () => {
    expect(splitMentionPath("~/Desktop/re", "/repo", HOME)).toEqual({
      absDir: "/home/dev/Desktop",
      partial: "re",
      displayDir: "~/Desktop/",
    });
  });
  it("bare_tilde_lists_home", () => {
    expect(splitMentionPath("~", "/repo", HOME)).toEqual({
      absDir: "/home/dev",
      partial: "",
      displayDir: "~/",
    });
  });
  it("relative_dir_resolves_against_cwd", () => {
    expect(splitMentionPath("src/comp", "/repo", HOME)).toEqual({
      absDir: "/repo/src",
      partial: "comp",
      displayDir: "src/",
    });
  });
  it("absolute_dir_is_kept", () => {
    expect(splitMentionPath("/etc/ho", "/repo", HOME)).toEqual({
      absDir: "/etc",
      partial: "ho",
      displayDir: "/etc/",
    });
  });
});

describe("searchFiles — @ path navigation", () => {
  it("lists_a_home_directory_via_tilde_with_a_prefix_filter", async () => {
    const fs = fakeFs({
      "/home/dev": [
        subdir("Área de Trabalho"),
        subdir("Documents"),
        ...dir("notes.txt"),
      ],
    });
    const results = await searchFiles("~/Áre", {
      cwd: "/repo",
      home: HOME,
      fs,
    });
    // Prefix "Áre" → the space-bearing dir, returned with its trailing slash and
    // the `~/` display prefix (so completing it inserts `~/Área de Trabalho/`).
    expect(results).toEqual(["~/Área de Trabalho/"]);
  });

  it("lists_a_directory_dirs_first_then_files", async () => {
    const fs = fakeFs({
      "/repo/src": [subdir("hooks"), ...dir("index.ts", "app.tsx")],
    });
    const results = await searchFiles("src/", { cwd: "/repo", home: HOME, fs });
    expect(results).toEqual(["src/hooks/", "src/app.tsx", "src/index.ts"]);
  });

  it("an_unreadable_directory_yields_no_results_never_throws", async () => {
    const fs: FileSystemLike = {
      readDir: async () => {
        throw new Error("EACCES");
      },
      readGitignore: async () => null,
    };
    await expect(
      searchFiles("~/nope/", { cwd: "/repo", home: HOME, fs }),
    ).resolves.toEqual([]);
  });

  it("a_plain_query_still_uses_the_cwd_fuzzy_walk", async () => {
    const fs = fakeFs({ "/repo": dir("retry.ts", "readme.md") });
    const results = await searchFiles("retry", {
      cwd: "/repo",
      home: HOME,
      fs,
    });
    expect(results).toContain("retry.ts");
  });

  it("hides_hidden_entries_unless_the_partial_starts_with_a_dot", async () => {
    const fs = fakeFs({
      "/home/dev": [
        subdir(".ansible"),
        subdir("Documents"),
        ...dir(".bashrc", "notes.txt"),
      ],
    });
    // `@~/` lists the home dir but hides the dotfiles (the `@~/` clutter bug).
    const shown = await searchFiles("~/", { cwd: "/repo", home: HOME, fs });
    expect(shown).toEqual(["~/Documents/", "~/notes.txt"]);
    // Typing the dot opts back in — `@~/.` reveals hidden entries, dirs-first.
    const dotted = await searchFiles("~/.", { cwd: "/repo", home: HOME, fs });
    expect(dotted).toEqual(["~/.ansible/", "~/.bashrc"]);
  });
});

describe("B-072 — a root-level file is not hostage to subtrees that sort before it", () => {
  it("finds_a_root_file_behind_a_subtree_larger_than_the_cap", async () => {
    // The defect, reproduced as the item filed it. `walk` was depth-first and recursed into a
    // directory the instant it met one, so `package.json` was never reached once `aaa-src/` — which
    // sorts before it — had filled the cap. Measured on the real tree, the capped walk read six
    // directories and never opened `package.json`, `src/`, `tests/` or `wiki/`.
    const fs = fakeFs({
      "/repo": [subdir("aaa-src"), ...dir("package.json"), subdir("zzz")],
      "/repo/aaa-src": dir(
        ...Array.from({ length: 60 }, (_, i) => `f${String(i)}.ts`),
      ),
      "/repo/zzz": dir("last.ts"),
    });

    // `maxResults: 50` is LOAD-BEARING, and leaving it out was a real defect in the first version
    // of this test. The fixture's 60 files were sized against the OLD hard-coded cap of 50 — and
    // the same commit raised that cap to 1000, so the fixture sat 16x BELOW it, the cap was never
    // reached, and traversal order stopped mattering. The test passed against the unfixed
    // depth-first walk: its name was false and its detection power was zero.
    //
    // Caught by the review criterion "where did the expected value come from?" — here the expected
    // value was fine and the FIXTURE SIZE was the thing quietly coupled to a literal that moved.
    const hits = await searchFiles("pack", { cwd: CWD, fs, maxResults: 50 });

    expect(hits).toContain("package.json");
  });

  it("reaches_shallow_files_before_deep_ones", async () => {
    // The ordering property BFS buys, stated as behaviour rather than as an implementation note:
    // DEPTH decides who survives the cap, not alphabetical luck.
    const fs = fakeFs({
      "/repo": [subdir("aaa"), ...dir("shallow.ts")],
      "/repo/aaa": [subdir("deep")],
      "/repo/aaa/deep": [subdir("deeper")],
      "/repo/aaa/deep/deeper": dir(
        ...Array.from({ length: 30 }, (_, i) => `f${String(i)}.ts`),
      ),
    });

    const hits = await searchFiles("", { cwd: CWD, fs, maxResults: 5 });

    expect(hits).toContain("shallow.ts");
  });
});
