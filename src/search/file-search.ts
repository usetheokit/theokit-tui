import { readFile, readdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

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
  /** Home directory for `~` expansion in path mode (injectable for tests). */
  home?: string;
}

const DEFAULT_SKIP = new Set([".git", "node_modules"]);
/**
 * B-072 — 50 until 2026-08-20. Fifty is a fine number for a MENU and a bad one for a WALK: the
 * cap applies before ranking, so it decides which paths the ranker ever sees. Measured with the
 * breadth-first walk, 1000 answers `@pack` correctly in 3.7 ms here, 5.9 ms across the umbrella and
 * 12.6 ms over a 150k-file tree — while a full uncapped walk of that last tree is 2.1 seconds, and
 * `searchFiles` runs once per keystroke with no debounce.
 */
const DEFAULT_MAX_RESULTS = 1000;

/** Hidden entries (name starts with `.`) are excluded by default — the file
 * picker convention (Claude Code parity): the cwd walk never descends into them,
 * and a path listing hides them unless the typed partial itself starts with `.`. */
function isHidden(name: string): boolean {
  return name.startsWith(".");
}
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

interface WalkNode {
  dir: string;
  prefix: string;
  depth: number;
}

/**
 * Drains one directory: files land in `results`, subdirectories are QUEUED into `next` rather than
 * descended into. Queuing instead of recursing is the entire B-072 fix.
 *
 * Extracted from `walk` because that function reached a cyclomatic complexity of 13 against a
 * budget of 10 — and because "what happens to one directory" is a cohesive thing to name.
 */
async function drainDir(
  fs: FileSystemLike,
  ig: Ignore,
  node: WalkNode,
  results: string[],
  next: WalkNode[],
  maxResults: number,
): Promise<void> {
  let entries: DirEntryLike[];
  try {
    entries = await fs.readDir(node.dir);
  } catch {
    return; // unreadable dir -> skip, never throw
  }

  for (const entry of entries) {
    if (results.length >= maxResults) {
      return;
    }
    const rel = includedRelPath(entry, ig, node.prefix);
    if (rel === null) {
      continue;
    }
    if (entry.isDirectory) {
      next.push({
        dir: join(node.dir, entry.name),
        prefix: rel,
        depth: node.depth + 1,
      });
    } else {
      results.push(rel);
    }
  }
}

/**
 * Collects cwd-relative file paths, LEVEL BY LEVEL.
 *
 * B-072 — this was depth-first, and that is what made `@pack` miss `package.json`. It recursed into
 * a directory the instant it met one, so a root-level file was hostage to every subtree whose name
 * sorted before it: measured on this repo, the capped walk read six directories — `.`,
 * `benchmarks`, `benchmarks/baselines`, `examples`, `examples/components`, `examples/renderer` —
 * and never opened `package.json`, `src/`, `tests/` or `wiki/`.
 *
 * Breadth-first makes DEPTH decide who survives the cap instead of alphabetical luck, which is the
 * property a human typing a query actually expects: the shallow file they are thinking of comes
 * first. Raising the cap alone does NOT fix it — measured at depth-first with a 1000 cap, an
 * umbrella-sized tree still answered `@pack` with a `coverage/lcov-report/*.html`.
 *
 * The cap still applies BEFORE ranking, deliberately. Ranking everything means walking everything,
 * and `searchFiles` runs once per keystroke with no debounce and no cache: measured, a full walk is
 * 8.4 ms here, 221 ms across the umbrella, and 2.1 SECONDS over `~/Projetos`.
 */
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
  let frontier: WalkNode[] = [{ dir, prefix, depth }];

  while (frontier.length > 0 && results.length < options.maxResults) {
    const next: WalkNode[] = [];

    for (const node of frontier) {
      if (signal?.aborted || results.length >= options.maxResults) {
        return;
      }
      if (node.depth <= options.maxDepth) {
        await drainDir(fs, ig, node, results, next, options.maxResults);
      }
    }

    frontier = next;
  }
}

/** The cwd-relative path for `entry`, or null when skipped / gitignored. */
function includedRelPath(
  entry: DirEntryLike,
  ig: Ignore,
  prefix: string,
): string | null {
  if (DEFAULT_SKIP.has(entry.name) || isHidden(entry.name)) {
    return null; // skip build/vcs dirs AND hidden dotfiles/dot-directories
  }
  const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
  // `ignore` wants a trailing slash to match directory patterns.
  if (ig.ignores(entry.isDirectory ? `${rel}/` : rel)) {
    return null;
  }
  return rel;
}

// ── @ path navigation (Claude Code parity) ──────────────────────────────────
// A `@`-query that names a PATH (has a `/` or a `~` home prefix) switches from
// the cwd fuzzy-walk to a DIRECTORY LISTING: it reads the named directory (with
// `~` expanded to the home dir) and returns its entries filtered by the trailing
// partial. Dirs get a trailing `/` so you can keep navigating; the display prefix
// is kept verbatim (the `~` survives) so completing inserts the path you typed.

/** The split of a path-like `@`-query into a directory to read + a name filter. */
export interface MentionPath {
  /** Absolute directory to `readDir` (`~`-expanded, cwd-resolved). */
  absDir: string;
  /** The trailing partial name to filter entries by (prefix, case-insensitive). */
  partial: string;
  /** The verbatim prefix to re-attach to each result (keeps `~`, trailing `/`). */
  displayDir: string;
}

/** True when the `@`-query names a path (has a separator or a `~` home prefix). */
export function isPathQuery(query: string): boolean {
  return query.includes("/") || query.startsWith("~");
}

/** Split a path-like `@`-query into `{ absDir, partial, displayDir }`. */
export function splitMentionPath(
  query: string,
  cwd: string,
  home: string,
): MentionPath {
  // A bare `~` means "list the home directory".
  const q = query === "~" ? "~/" : query;
  const slash = q.lastIndexOf("/");
  const displayDir = q.slice(0, slash + 1); // "" when there is no slash
  const partial = q.slice(slash + 1);
  const dirSpec = displayDir === "" ? "." : displayDir;
  const expanded = dirSpec.startsWith("~") ? home + dirSpec.slice(1) : dirSpec;
  // resolve() normalizes (strips the trailing slash; an absolute 2nd arg ignores
  // cwd) so the readDir key matches whether the path was ~/absolute/relative.
  const absDir = resolve(cwd, expanded);
  return { absDir, partial, displayDir };
}

/** List the directory named by a path-like `@`-query (never throws → `[]`). */
async function listPathEntries(
  query: string,
  cwd: string,
  home: string,
  fs: FileSystemLike,
  maxResults: number,
): Promise<string[]> {
  const { absDir, partial, displayDir } = splitMentionPath(query, cwd, home);
  let entries: DirEntryLike[];
  try {
    entries = await fs.readDir(absDir);
  } catch {
    return []; // unreadable dir → no results, never throw
  }
  const lower = partial.toLowerCase();
  // Hidden entries surface only when the partial itself opts in with a `.`.
  const showHidden = partial.startsWith(".");
  const matched = entries
    .filter((e) => !DEFAULT_SKIP.has(e.name))
    .filter((e) => showHidden || !isHidden(e.name))
    .filter((e) => e.name.toLowerCase().startsWith(lower))
    // Directories first, then files; alphabetical within each group.
    .sort(
      (a, b) =>
        Number(b.isDirectory) - Number(a.isDirectory) ||
        a.name.localeCompare(b.name),
    );
  return matched
    .slice(0, maxResults)
    .map((e) => `${displayDir}${e.name}${e.isDirectory ? "/" : ""}`);
}

/**
 * The `@`-file provider. When `query` names a PATH (`/` or `~`), lists that
 * directory (`~`-expanded) filtered by the trailing partial — Claude Code's
 * path-navigation idiom. Otherwise walks `cwd` and returns cwd-relative file
 * paths fuzzy-ranked against `query`. Honors `.gitignore` + a default skip-list;
 * bounded + abortable so a huge repo never blocks. Never throws.
 */
export async function searchFiles(
  query: string,
  options: SearchOptions = {},
): Promise<string[]> {
  const cwd = options.cwd ?? process.cwd();
  const fs = options.fs ?? nodeFileSystem;
  const maxResults = options.maxResults ?? DEFAULT_MAX_RESULTS;
  if (isPathQuery(query)) {
    const home = options.home ?? homedir();
    return listPathEntries(query, cwd, home, fs, maxResults);
  }
  const limits = {
    maxResults,
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
