// M21 fuzzy (plan m21-premium-capabilities T4.1, Feature C / ADR C1): the
// subsequence fuzzy matcher — a faithful port of pi's fuzzy.ts. All query chars
// must appear in order (not necessarily consecutive); LOWER score = better.
// Consecutive runs and word-boundary matches are rewarded, gaps penalized, an
// exact match strongly preferred. Hand-rolled (not fzf/fuzzysort) because our
// candidate sets are small — YAGNI on async/index machinery (ADR C1).

export interface FuzzyMatch {
  matches: boolean;
  score: number;
}

const WORD_BOUNDARY = /[\s\-_./:]/;

/** Score contribution of one matched char + the new consecutive-run count. */
function charScore(
  i: number,
  lastMatchIndex: number,
  consecutive: number,
  prevChar: string,
): { delta: number; consecutive: number } {
  let delta = 0;
  let cons = consecutive;
  if (lastMatchIndex === i - 1) {
    cons++;
    delta -= cons * 5; // reward a consecutive run
  } else {
    cons = 0;
    if (lastMatchIndex >= 0) {
      delta += (i - lastMatchIndex - 1) * 2; // penalize a gap
    }
  }
  if (i === 0 || WORD_BOUNDARY.test(prevChar)) {
    delta -= 10; // reward a word-boundary match
  }
  delta += i * 0.1; // slight later-match penalty
  return { delta, consecutive: cons };
}

function scoreQuery(query: string, textLower: string): FuzzyMatch {
  if (query.length === 0) {
    return { matches: true, score: 0 };
  }
  if (query.length > textLower.length) {
    return { matches: false, score: 0 };
  }
  let queryIndex = 0;
  let score = 0;
  let lastMatchIndex = -1;
  let consecutive = 0;
  for (let i = 0; i < textLower.length && queryIndex < query.length; i++) {
    if (textLower[i] !== query[queryIndex]) {
      continue;
    }
    const r = charScore(i, lastMatchIndex, consecutive, textLower[i - 1] ?? "");
    score += r.delta;
    consecutive = r.consecutive;
    lastMatchIndex = i;
    queryIndex++;
  }
  if (queryIndex < query.length) {
    return { matches: false, score: 0 };
  }
  return { matches: true, score: query === textLower ? score - 100 : score };
}

/** Does `query` fuzzy-match `text`? Lower score is better. Case-insensitive. */
export function fuzzyMatch(query: string, text: string): FuzzyMatch {
  return scoreQuery(query.toLowerCase(), text.toLowerCase());
}

/** Rank `candidates` by fuzzy score against `query` (best first); drop non-matches. */
export function fuzzyRank(query: string, candidates: readonly string[]): string[] {
  return candidates
    .map((text) => ({ text, match: fuzzyMatch(query, text) }))
    .filter((entry) => entry.match.matches)
    .sort((a, b) => a.match.score - b.match.score)
    .map((entry) => entry.text);
}
