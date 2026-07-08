import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

import ignore, { type Ignore } from "ignore";

import { fuzzyRank } from "./fuzzy.js";

// M21 file-search (plan m21-premium-capabilities T4.1, Feature C / ADR C4): the
// `@`-mention provider — an async cwd walk that respects `.gitignore` (via the
// `ignore` package — Rule 9, don't reimplement git-ignore semantics) plus a
// default skip-list, returning cwd-relative paths fuzzy-ranked against the query.
// The filesystem is injected behind an interface (DIP — `rules/architecture.md`
// § 2) so tests run against an in-memory tree, no real disk. This is the ONLY
// I/O module in M21; it protects the input thread via a bounded walk + abort.

/** A directory entry the walker needs — a `Dirent` subset. */
export interface DirEntryLike {
  name: string;
  isDirectory: boolean;
}

/** The filesystem surface (injectable — real disk or an in-memory fake). */
export interface FileSystemLike {
  readDir(dir: string): Promise<DirEntryLike[]>;
  readGitignore(cwd: string): Promise<string | null>;
}

export interface SearchOptions {
  cwd?: string;
  fs?: FileSystemLike;
  maxResults?: number;
  maxDepth?: number;
  signal?: AbortSignal;
}

const DEFAULT_SKIP = new Set([".git", "node_modules"]);
const DEFAULT_MAX_RESULTS = 50;
const DEFAULT_MAX_DEPTH = 8;

/** The real filesystem, backed by node:fs/promises. */
export const nodeFileSystem: FileSystemLike = {
  async readDir(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries.map((e) => ({ name: e.name, isDirectory: e.isDirectory() }));
  },
  async readGitignore(cwd) {
    try {
      return await readFile(join(cwd, ".gitignore"), "utf8");
    } catch {
      return null;
    }
  },
};

async function walk(
  fs: FileSystemLike,
  ig: Ignore,
  dir: string,
  prefix: string,
  depth: number,
  results: string[],
  options: Required<Pick<SearchOptions, "maxResults" | "maxDepth">>,
  signal?: AbortSignal,
): Promise<void> {
  if (depth > options.maxDepth || results.length >= options.maxResults) {
    return;
  }
  if (signal?.aborted) {
    return;
  }
  let entries: DirEntryLike[];
  try {
    entries = await fs.readDir(dir);
  } catch {
    return; // unreadable dir → skip, never throw
  }
  for (const entry of entries) {
    if (results.length >= options.maxResults) {
      return;
    }
    const rel = includedRelPath(entry, ig, prefix);
    if (rel === null) {
      continue;
    }
    if (entry.isDirectory) {
      await walk(
        fs,
        ig,
        join(dir, entry.name),
        rel,
        depth + 1,
        results,
        options,
        signal,
      );
    } else {
      results.push(rel);
    }
  }
}

/** The cwd-relative path for `entry`, or null when skipped / gitignored. */
function includedRelPath(
  entry: DirEntryLike,
  ig: Ignore,
  prefix: string,
): string | null {
  if (DEFAULT_SKIP.has(entry.name)) {
    return null;
  }
  const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
  // `ignore` wants a trailing slash to match directory patterns.
  if (ig.ignores(entry.isDirectory ? `${rel}/` : rel)) {
    return null;
  }
  return rel;
}

/**
 * Walk `cwd` and return cwd-relative file paths fuzzy-ranked against `query`
 * (best first). Honors `.gitignore` + a default skip-list; bounded + abortable so
 * a huge repo never blocks. Never throws — an unreadable tree yields `[]`.
 */
export async function searchFiles(
  query: string,
  options: SearchOptions = {},
): Promise<string[]> {
  const cwd = options.cwd ?? process.cwd();
  const fs = options.fs ?? nodeFileSystem;
  const limits = {
    maxResults: options.maxResults ?? DEFAULT_MAX_RESULTS,
    maxDepth: options.maxDepth ?? DEFAULT_MAX_DEPTH,
  };
  const ig = ignore();
  const gitignore = await fs.readGitignore(cwd);
  if (gitignore) {
    ig.add(gitignore);
  }
  const results: string[] = [];
  await walk(fs, ig, cwd, "", 0, results, limits, options.signal);
  return fuzzyRank(query, results);
}
