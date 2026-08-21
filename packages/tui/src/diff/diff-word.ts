import { diffWordsWithSpace } from "diff";

import type { DiffLine } from "./diff.js";

// M25 diff-word (plan m25-parity-polish-audit T2.1, ADR B): the PURE intra-line
// word-diff. `segmentWords` runs jsdiff over a del/add text pair and marks the
// changed words (leading whitespace of the first change stripped, so an
// indentation change does not light up). `pairIntraLines` pairs EQUAL-LENGTH
// adjacent del/add runs (the assistant-ui recipe) so only genuine line-for-line
// replacements highlight; unequal or non-adjacent runs fall back to whole-line
// color. Opt-in only — the DiffViewer default never calls this.

export interface WordSegment {
  text: string;
  changed: boolean;
}

/** Move any leading whitespace off the first changed segment into a plain one. */
function stripLeadingWhitespace(segments: WordSegment[]): WordSegment[] {
  const first = segments.find((s) => s.changed);
  if (first === undefined) return segments;
  const match = first.text.match(/^\s+/);
  if (match === null) return segments;
  const lead = match[0];
  const rest = first.text.slice(lead.length);
  // Drop the now-empty changed remainder (an indentation-only change) so no inert
  // empty `inverse` span is emitted downstream (review L1).
  return segments.flatMap((s) =>
    s === first
      ? rest === ""
        ? [{ text: lead, changed: false }]
        : [
            { text: lead, changed: false },
            { text: rest, changed: true },
          ]
      : [s],
  );
}

/** Segment a del/add text pair into changed/unchanged word runs. */
export function segmentWords(
  delText: string,
  addText: string,
): { del: WordSegment[]; add: WordSegment[] } {
  const parts = diffWordsWithSpace(delText, addText);
  const del: WordSegment[] = [];
  const add: WordSegment[] = [];
  for (const part of parts) {
    if (part.added) {
      add.push({ text: part.value, changed: true });
    } else if (part.removed) {
      del.push({ text: part.value, changed: true });
    } else {
      del.push({ text: part.value, changed: false });
      add.push({ text: part.value, changed: false });
    }
  }
  return {
    del: stripLeadingWhitespace(del),
    add: stripLeadingWhitespace(add),
  };
}

/**
 * Pair equal-length adjacent del/add runs and return a map from each paired line
 * (by reference) to its word segments. Lines not in an equal-length del→add run
 * are absent (the caller renders them whole-line colored).
 */
/** Segment every line of an equal-length del/add run into the map. */
function pairRun(
  lines: readonly DiffLine[],
  delStart: number,
  addStart: number,
  runLength: number,
  map: Map<DiffLine, WordSegment[]>,
): void {
  for (let k = 0; k < runLength; k += 1) {
    const delLine = lines[delStart + k]!;
    const addLine = lines[addStart + k]!;
    const { del, add } = segmentWords(delLine.text, addLine.text);
    map.set(delLine, del);
    map.set(addLine, add);
  }
}

export function pairIntraLines(lines: readonly DiffLine[]): Map<DiffLine, WordSegment[]> {
  const map = new Map<DiffLine, WordSegment[]>();
  let i = 0;
  while (i < lines.length) {
    if (lines[i]!.kind !== "del") {
      i += 1;
      continue;
    }
    let delEnd = i;
    while (delEnd < lines.length && lines[delEnd]!.kind === "del") delEnd += 1;
    let addEnd = delEnd;
    while (addEnd < lines.length && lines[addEnd]!.kind === "add") addEnd += 1;
    const runLength = delEnd - i;
    if (runLength > 0 && addEnd - delEnd === runLength) {
      pairRun(lines, i, delEnd, runLength, map);
    }
    i = addEnd > i ? addEnd : i + 1;
  }
  return map;
}
