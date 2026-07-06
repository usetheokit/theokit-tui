import parseDiff from "parse-diff";

// PURE module (plan ADR D10): no ink/React import — the parser is the M7
// seam and a later split renderer reuses this model.

export type DiffLineKind = "add" | "del" | "context";

export interface DiffLine {
  kind: DiffLineKind;
  oldLine?: number;
  newLine?: number;
  /** Content WITHOUT the sign prefix. Tabs preserved (render layers expand). */
  text: string;
}

export interface DiffFile {
  /** Absent for new files (`/dev/null`). parse-diff strips `a/`/`b/`. */
  oldName?: string;
  newName?: string;
  lines: DiffLine[];
  additions: number;
  deletions: number;
}

export interface DiffFold {
  kind: "fold";
  hidden: number;
}

export type DiffRow = DiffLine | DiffFold;

const stripCr = (value: string): string => value.replace(/\r$/, "");

function mapName(raw: string | undefined): string | undefined {
  if (raw === undefined || raw === "/dev/null") {
    return undefined;
  }
  return raw;
}

/**
 * Parse unified-diff TEXT into the typed multi-file model (plan ADR D1).
 * LENIENT like its parse-diff engine: trailing garbage after a valid file is
 * DROPPED (EC-1 — reliable partial-parse detection is not possible with a
 * lenient parser; documented over theater). Throws a typed error only when
 * NOTHING parses out of a non-empty patch (ADR D7).
 */
export function parseUnifiedDiff(patch: string): DiffFile[] {
  if (patch.trim() === "") {
    return [];
  }
  const files = parseDiff(patch);
  if (files.length === 0) {
    throw new TypeError(
      "parseUnifiedDiff: patch did not parse as a unified diff",
    );
  }
  return files.map((file) => {
    const lines: DiffLine[] = [];
    for (const chunk of file.chunks) {
      for (const change of chunk.changes) {
        // `\ No newline at end of file` arrives as a change whose content
        // starts with the backslash marker — suppress, never render (EC).
        if (change.content.startsWith("\\")) {
          continue;
        }
        const text = stripCr(change.content.slice(1));
        if (change.type === "normal") {
          lines.push({
            kind: "context",
            oldLine: change.ln1,
            newLine: change.ln2,
            text,
          });
        } else if (change.type === "del") {
          lines.push({ kind: "del", oldLine: change.ln, text });
        } else {
          lines.push({ kind: "add", newLine: change.ln, text });
        }
      }
    }
    return {
      ...(mapName(file.from) !== undefined
        ? { oldName: mapName(file.from) as string }
        : {}),
      ...(mapName(file.to) !== undefined
        ? { newName: mapName(file.to) as string }
        : {}),
      lines,
      additions: file.additions,
      deletions: file.deletions,
    };
  });
}

/**
 * Collapse runs of unchanged context beyond ±contextLines around changes
 * into `fold` rows (plan ADR D5 — react-ink foldContext shape). Runs of
 * <= 1 hidden line are NOT folded (a one-line fold row saves nothing).
 */
export function foldDiffLines(
  lines: DiffLine[],
  contextLines: number,
): DiffRow[] {
  if (!Number.isInteger(contextLines) || contextLines < 0) {
    throw new TypeError(
      `foldDiffLines: contextLines must be an integer >= 0 — got ${String(contextLines)}`,
    );
  }
  // Mark which context indexes stay visible (within ±contextLines of a change).
  const keep = new Array<boolean>(lines.length).fill(false);
  lines.forEach((line, index) => {
    if (line.kind !== "context") {
      keep[index] = true;
      for (let d = 1; d <= contextLines; d++) {
        if (index - d >= 0) {
          keep[index - d] = true;
        }
        if (index + d < lines.length) {
          keep[index + d] = true;
        }
      }
    }
  });
  const rows: DiffRow[] = [];
  let runStart = -1;
  let hiddenRun = 0;
  const flush = (): void => {
    if (hiddenRun > 1) {
      rows.push({ kind: "fold", hidden: hiddenRun });
    } else if (hiddenRun === 1) {
      // A single hidden line renders as ITSELF — folding it saves nothing.
      rows.push(lines[runStart] as DiffLine);
    }
    hiddenRun = 0;
    runStart = -1;
  };
  lines.forEach((line, index) => {
    if (keep[index] === true) {
      flush();
      rows.push(line);
    } else {
      if (hiddenRun === 0) {
        runStart = index;
      }
      hiddenRun += 1;
    }
  });
  flush();
  return rows;
}
