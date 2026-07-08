// M21 word-navigation (plan m21-premium-capabilities T3.1, Feature B): pure
// grapheme-safe word boundaries via Intl.Segmenter (granularity "word") — a
// faithful port of pi's word-navigation.ts (its utils inlined). `findWordBackward`
// skips trailing whitespace then stops at the previous word/punctuation boundary;
// `findWordForward` mirrors it. ASCII punctuation inside a word-like segment is a
// boundary (so `foo.bar` navigates in three hops). No mutation, no I/O.

const wordSegmenter = new Intl.Segmenter(undefined, { granularity: "word" });
const PUNCTUATION_REGEX = /[(){}[\]<>.,;:'"!?+\-=*/\\|&%^$#@~`]/;

type Seg = Intl.SegmentData;

function isWhitespace(segment: string): boolean {
  return /\s/.test(segment);
}

/** Chars of trailing whitespace popped off the end of `segments`. */
function popTrailingWhitespace(segments: Seg[]): number {
  let len = 0;
  while (
    segments.length > 0 &&
    isWhitespace(segments[segments.length - 1]!.segment)
  ) {
    len += segments.pop()!.segment.length;
  }
  return len;
}

/** Chars to move back inside one word-like segment (to its last punct boundary). */
function wordLikeBackLen(segment: string): number {
  const matches = [...segment.matchAll(new RegExp(PUNCTUATION_REGEX, "g"))];
  if (matches.length === 0) {
    return segment.length;
  }
  const lastMatch = matches[matches.length - 1]!;
  return segment.length - (lastMatch.index + lastMatch[0].length);
}

/** Chars of a trailing punctuation run popped off the end of `segments`. */
function popPunctuationRun(segments: Seg[]): number {
  let len = 0;
  while (segments.length > 0) {
    const last = segments[segments.length - 1]!;
    if (last.isWordLike || isWhitespace(last.segment)) {
      break;
    }
    len += segments.pop()!.segment.length;
  }
  return len;
}

/** Cursor position one word BACKWARD from `cursor` (0 at start). Pure. */
export function findWordBackward(text: string, cursor: number): number {
  if (cursor <= 0) {
    return 0;
  }
  const segments = [...wordSegmenter.segment(text.slice(0, cursor))];
  const afterWhitespace = cursor - popTrailingWhitespace(segments);
  if (segments.length === 0) {
    return afterWhitespace;
  }
  const last = segments[segments.length - 1]!;
  return last.isWordLike
    ? afterWhitespace - wordLikeBackLen(last.segment)
    : afterWhitespace - popPunctuationRun(segments);
}

/** Chars of leading whitespace consumed from the front iterator. */
function skipLeadingWhitespace(iterator: Iterator<Seg>): {
  len: number;
  next: IteratorResult<Seg>;
} {
  let len = 0;
  let next = iterator.next();
  while (!next.done && isWhitespace(next.value.segment)) {
    len += next.value.segment.length;
    next = iterator.next();
  }
  return { len, next };
}

/** Chars of a leading punctuation run consumed from the front iterator. */
function skipPunctuationRunForward(
  iterator: Iterator<Seg>,
  first: IteratorResult<Seg>,
): number {
  let len = 0;
  let next = first;
  while (
    !next.done &&
    !next.value.isWordLike &&
    !isWhitespace(next.value.segment)
  ) {
    len += next.value.segment.length;
    next = iterator.next();
  }
  return len;
}

/** Cursor position one word FORWARD from `cursor` (length at end). Pure. */
export function findWordForward(text: string, cursor: number): number {
  if (cursor >= text.length) {
    return text.length;
  }
  const iterator = wordSegmenter.segment(text.slice(cursor))[Symbol.iterator]();
  const { len: wsLen, next } = skipLeadingWhitespace(iterator);
  let newCursor = cursor + wsLen;
  if (next.done) {
    return newCursor;
  }
  if (next.value.isWordLike) {
    newCursor +=
      PUNCTUATION_REGEX.exec(next.value.segment)?.index ??
      next.value.segment.length;
  } else {
    newCursor += skipPunctuationRunForward(iterator, next);
  }
  return newCursor;
}
