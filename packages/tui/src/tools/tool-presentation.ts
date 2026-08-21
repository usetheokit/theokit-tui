/**
 * How a tool call reads, keyed by the tool names the framework's factories define.
 *
 * The card, the shell envelope, the diff viewer and the meters already ship here. What did not was
 * the mapping from a NAME to its presentation — so every product wrote it: 292 LOC of
 * `HEADERS_BY_TOOL` / `BODY_BY_TOOL` / `APPROVAL_LABELS` downstream, plus a hand-written
 * `tool_name_mismatch` throw in their registry to keep the two halves in sync by discipline.
 *
 * Both halves are ours — the factories own the names, this package owns the rendering — so this is
 * the only place they can be kept together.
 *
 * ## The key list is duplicated knowledge, and that is the lesser evil
 *
 * This package does NOT import `@theokit/agents`, and must not: the dependency runs the other way
 * (`rules/system-design-guardrails.md` § G1). So {@link KNOWN_TOOL_NAMES} is a literal list, measured
 * from the factories rather than transcribed from documentation, and it CAN drift when a tool is
 * added upstream. The cost of drift is a generic header on one tool; the cost of the alternative is
 * a permanent inverted dependency edge. The test asserts the list, so drift shows up as a diff to
 * review rather than as a surprise in a session.
 *
 * ## Everything here treats its input as hostile
 *
 * Tool input and tool output cross from a model and from subprocesses. A renderer that throws on an
 * unexpected shape takes down the session over a string the model got wrong, so every reader below
 * narrows before it reads and every branch has a fallback.
 */
import type { ToolCardResult } from "./tool-card-result.js";

/**
 * The tool names `@theokit/agents/tools` produces, measured on 2026-08-16 by constructing every
 * `create*` factory and reading the `name` it assigns. Not transcribed from docs — a name is the
 * key, and a key that is subtly wrong renders a generic header forever without failing anything.
 */
export const KNOWN_TOOL_NAMES = [
  "apply_patch",
  "current_time",
  "edit_file",
  "git_diff",
  "git_status",
  "glob_files",
  "interactive_shell",
  "list_dir",
  "plan_mode",
  "question",
  "read_file",
  "run_vitest",
  "search_text",
  "shell_exec",
  "todolist",
  "update_plan",
  "web_fetch",
  "web_search",
  "write_file",
  "write_stdin",
] as const;

export type KnownToolName = (typeof KNOWN_TOOL_NAMES)[number];

export interface ToolPresentation {
  /** The one-line row. `active` is "still running", which reads differently from "ran". */
  header: (input: unknown, active: boolean) => string;
  /** How the result renders inside the card. Absent = the surface decides. */
  body?: (result: unknown) => ToolCardResult;
  /** What a human is asked before this runs. Absent = the tool changes nothing. */
  approvalLabel?: (input: unknown) => string;
}

/** Reads a string field without trusting the shape it arrived in. */
function str(input: unknown, key: string): string | undefined {
  if (typeof input !== "object" || input === null) return undefined;
  const value = (input as Record<string, unknown>)[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/** The first of `keys` that is present — tools name the same idea differently. */
function firstStr(input: unknown, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const found = str(input, key);
    if (found !== undefined) return found;
  }
  return undefined;
}

/**
 * `Verb subject` / `Verbed subject`. Takes the header's own `(input, active)` shape even though it
 * ignores `input`, because the first draft returned a one-argument function: TypeScript then bound
 * `input` to the `active` slot, so every subject-less tool rendered its running form forever. The
 * unit tests did not catch it — they asserted the header was non-empty, and it was.
 */
function verbPair(active: string, done: string, subject?: string): ToolPresentation["header"] {
  return (_input, isActive) => {
    const verb = isActive ? active : done;
    return subject === undefined ? verb : `${verb} ${subject}`;
  };
}

function pathHeader(active: string, done: string, ...keys: string[]): ToolPresentation["header"] {
  return (input, isActive) => verbPair(active, done, firstStr(input, ...keys))(input, isActive);
}

/** Anything unrecognised. Names the tool, because "Running" alone is a spinner, not a log line. */
function genericPresentation(name: string): ToolPresentation {
  return {
    header: (_input, active) => `${active ? "Running" : "Ran"} ${name}`,
  };
}

function previewOf(result: unknown): ToolCardResult {
  return {
    kind: "preview",
    text: typeof result === "string" ? result : JSON.stringify(result, null, 2),
  };
}

/** A diff card when the result carries a patch; a preview when it does not. */
function diffBody(result: unknown): ToolCardResult {
  const patch = firstStr(result, "patch", "diff");
  return patch === undefined ? previewOf(result) : { kind: "diff", patch };
}

/** An output card when the result looks like a shell envelope; a preview when it does not. */
function shellBody(result: unknown): ToolCardResult {
  if (typeof result !== "object" || result === null) return previewOf(result);
  const record = result as Record<string, unknown>;
  if (typeof record.stdout !== "string" && typeof record.stderr !== "string") {
    return previewOf(result);
  }
  return {
    kind: "output",
    shell: {
      stdout: typeof record.stdout === "string" ? record.stdout : "",
      stderr: typeof record.stderr === "string" ? record.stderr : "",
      exitCode: typeof record.exitCode === "number" ? record.exitCode : 0,
    },
  };
}

/**
 * The defaults. Frozen as a `ReadonlyMap` because a surface that mutated it would change every other
 * surface in the process — which is what {@link toolPresentation} exists to avoid.
 */
const DEFAULT_ENTRIES: readonly (readonly [string, ToolPresentation])[] = [
  [
    "shell_exec",
    {
      header: (input, active) =>
        verbPair("Running", "Ran", firstStr(input, "command", "cmd"))(input, active),
      body: shellBody,
      // The command verbatim: approving "a shell command" is approving anything.
      approvalLabel: (input) => `Run \`${firstStr(input, "command", "cmd") ?? "(no command)"}\`?`,
    },
  ],
  [
    "interactive_shell",
    {
      header: (input, active) =>
        verbPair("Starting", "Started", firstStr(input, "command", "cmd"))(input, active),
      body: shellBody,
      approvalLabel: (input) =>
        `Start an interactive shell for \`${firstStr(input, "command", "cmd") ?? "(no command)"}\`?`,
    },
  ],
  [
    "write_stdin",
    {
      header: pathHeader("Sending input to", "Sent input to", "sessionId", "session_id"),
      approvalLabel: () => "Send input to the running shell?",
    },
  ],
  [
    "apply_patch",
    {
      header: pathHeader("Applying a patch to", "Patched", "path", "file", "filePath"),
      body: diffBody,
      approvalLabel: (input) =>
        `Apply the patch to ${firstStr(input, "path", "file") ?? "the file"}?`,
    },
  ],
  [
    "edit_file",
    {
      header: pathHeader("Editing", "Edited", "path", "file", "filePath"),
      body: diffBody,
      approvalLabel: (input) => `Edit ${firstStr(input, "path", "file") ?? "the file"}?`,
    },
  ],
  [
    "write_file",
    {
      header: pathHeader("Writing", "Wrote", "path", "file", "filePath"),
      body: diffBody,
      approvalLabel: (input) => `Write ${firstStr(input, "path", "file") ?? "the file"}?`,
    },
  ],
  ["read_file", { header: pathHeader("Reading", "Read", "path", "file", "filePath") }],
  ["list_dir", { header: pathHeader("Listing", "Listed", "path", "dir", "directory") }],
  ["glob_files", { header: pathHeader("Matching", "Matched", "pattern", "glob") }],
  ["search_text", { header: pathHeader("Searching for", "Searched for", "pattern", "query") }],
  [
    "git_status",
    {
      header: verbPair("Reading git status", "Read git status"),
      body: shellBody,
    },
  ],
  ["git_diff", { header: verbPair("Reading the diff", "Read the diff"), body: diffBody }],
  [
    "run_vitest",
    {
      header: pathHeader("Running tests in", "Ran tests in", "path", "pattern"),
      body: shellBody,
    },
  ],
  [
    "web_fetch",
    {
      header: pathHeader("Fetching", "Fetched", "url"),
      approvalLabel: (input) => `Fetch ${firstStr(input, "url") ?? "a URL"}?`,
    },
  ],
  [
    "web_search",
    {
      header: pathHeader("Searching the web for", "Searched the web for", "query", "q"),
    },
  ],
  ["current_time", { header: verbPair("Checking the time", "Checked the time") }],
  ["question", { header: pathHeader("Asking", "Asked", "question", "prompt") }],
  ["plan_mode", { header: verbPair("Planning", "Planned") }],
  ["update_plan", { header: verbPair("Updating the plan", "Updated the plan") }],
  ["todolist", { header: verbPair("Updating the to-do list", "Updated the to-do list") }],
];

export const DEFAULT_TOOL_PRESENTATION: ReadonlyMap<string, ToolPresentation> = new Map(
  DEFAULT_ENTRIES,
);

/**
 * The defaults with `overrides` merged over them, per entry and per field.
 *
 * Partial by design: changing one header must not mean restating the other nineteen, which is a fork
 * wearing an override's clothes. An unknown name is answered by a generic entry rather than
 * `undefined`, so a caller never has to guard — and an override for an unknown name is honoured, so
 * a product with its own tool describes it here instead of forking the map.
 */
export function toolPresentation(
  overrides: Readonly<Record<string, Partial<ToolPresentation>>> = {},
): ReadonlyMap<string, ToolPresentation> {
  const merged = new Map<string, ToolPresentation>(DEFAULT_TOOL_PRESENTATION);

  for (const [name, override] of Object.entries(overrides)) {
    const base = merged.get(name) ?? genericPresentation(name);
    merged.set(name, { ...base, ...override });
  }

  // A `get` that answers for every name, so no caller needs an `?? fallback` at the call site — the
  // place such a guard is most often forgotten.
  return {
    get: (name: string) => merged.get(name) ?? genericPresentation(name),
    has: (name: string) => merged.has(name),
    get size() {
      return merged.size;
    },
    keys: () => merged.keys(),
    values: () => merged.values(),
    entries: () => merged.entries(),
    forEach: (fn, thisArg?: unknown) => {
      merged.forEach(fn, thisArg);
    },
    [Symbol.iterator]: () => merged[Symbol.iterator](),
  } as ReadonlyMap<string, ToolPresentation>;
}
