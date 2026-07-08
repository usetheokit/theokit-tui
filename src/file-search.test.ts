import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  searchFiles,
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
