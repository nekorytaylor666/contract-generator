// Lightweight, dependency-free fuzzy search tuned for Russian (Cyrillic) text.
//
// Goals:
//   1. Typo tolerance — a few wrong/missing/extra letters still match
//      (e.g. "разрабтка" → "Разработка").
//   2. Substring/prefix matches rank above typo matches, so exact intent wins.
//   3. Works on multiple text fields per item (title, category, author, …).
//
// Scoring is "lower is better" (like Fuse.js). Non-matches get `Infinity`.

const CYRILLIC_YO_REGEX = /ё/g;
const WHITESPACE_REGEX = /\s+/;

function normalize(value: string): string {
  // Lowercase + fold "ё"→"е" so users don't have to be precise about it.
  return value.toLowerCase().replace(CYRILLIC_YO_REGEX, "е").trim();
}

function tokenize(value: string): string[] {
  return normalize(value).split(WHITESPACE_REGEX).filter(Boolean);
}

// How many single-character edits we forgive for a token of the given length.
// Short tokens get little slack (otherwise everything matches); longer tokens
// get more, capped so search stays meaningful.
function maxTypos(length: number): number {
  if (length <= 2) {
    return 0;
  }
  if (length <= 5) {
    return 1;
  }
  if (length <= 8) {
    return 2;
  }
  return 3;
}

// Levenshtein edit distance (two-row variant). Tokens are short, so this is
// cheap even across hundreds of candidates.
function levenshtein(a: string, b: string): number {
  if (a === b) {
    return 0;
  }
  if (a.length === 0) {
    return b.length;
  }
  if (b.length === 0) {
    return a.length;
  }

  let previousRow = Array.from({ length: b.length + 1 }, (_, i) => i);
  let currentRow = new Array<number>(b.length + 1);

  for (let i = 0; i < a.length; i++) {
    currentRow[0] = i + 1;
    for (let j = 0; j < b.length; j++) {
      const substitutionCost = a[i] === b[j] ? 0 : 1;
      currentRow[j + 1] = Math.min(
        currentRow[j] + 1, // insertion
        previousRow[j + 1] + 1, // deletion
        previousRow[j] + substitutionCost // substitution
      );
    }
    [previousRow, currentRow] = [currentRow, previousRow];
  }

  return previousRow[b.length];
}

// Best score for a single query token against all tokens of a candidate field.
function bestTokenScore(queryToken: string, textTokens: string[]): number {
  let best = Number.POSITIVE_INFINITY;
  const allowed = maxTypos(queryToken.length);

  for (const textToken of textTokens) {
    if (textToken === queryToken) {
      return 0;
    }
    if (textToken.startsWith(queryToken)) {
      best = Math.min(best, 0.5);
      continue;
    }
    if (textToken.includes(queryToken)) {
      best = Math.min(best, 1);
      continue;
    }

    // Full-token typo distance.
    const distance = levenshtein(queryToken, textToken);
    if (distance <= allowed) {
      best = Math.min(best, 1 + distance);
    }

    // Typo against the matching-length prefix, so "разрабтка" still hits the
    // start of "разработкой" even when the suffix differs.
    const prefix = textToken.slice(0, queryToken.length);
    const prefixDistance = levenshtein(queryToken, prefix);
    if (prefixDistance <= allowed) {
      best = Math.min(best, 1.5 + prefixDistance);
    }
  }

  return best;
}

function scoreField(
  normalizedQuery: string,
  queryTokens: string[],
  field: string
): number {
  const normalizedField = normalize(field);

  // Whole-query substring match — strongest signal, ranked by position.
  const index = normalizedField.indexOf(normalizedQuery);
  if (index === 0) {
    return 0;
  }
  if (index > 0) {
    return 1 + index * 0.001;
  }

  // Token-by-token typo-tolerant match. Every query token must find a home;
  // otherwise the field doesn't match.
  const textTokens = tokenize(field);
  if (textTokens.length === 0) {
    return Number.POSITIVE_INFINITY;
  }

  let total = 0;
  for (const queryToken of queryTokens) {
    const tokenScore = bestTokenScore(queryToken, textTokens);
    if (!Number.isFinite(tokenScore)) {
      return Number.POSITIVE_INFINITY;
    }
    total += tokenScore;
  }

  return 10 + total;
}

export interface FuzzyResult<T> {
  item: T;
  score: number;
}

export interface FuzzySearchOptions {
  /** Cap on returned results (after sorting). */
  limit?: number;
}

/**
 * Fuzzy-search `items` by `query`, matching against one or more text fields.
 *
 * @param query The raw user input.
 * @param items The candidates to search.
 * @param getFields Extracts the searchable strings for an item. Nullish
 *   entries are ignored, so optional fields are safe to return.
 * @returns Matching items sorted best-first. An empty query returns every item
 *   in its original order (score 0).
 */
export function fuzzySearch<T>(
  query: string,
  items: readonly T[],
  getFields: (item: T) => string | (string | null | undefined)[],
  options: FuzzySearchOptions = {}
): FuzzyResult<T>[] {
  const normalizedQuery = normalize(query);

  if (!normalizedQuery) {
    const all = items.map((item) => ({ item, score: 0 }));
    return options.limit ? all.slice(0, options.limit) : all;
  }

  const queryTokens = tokenize(query);
  const results: FuzzyResult<T>[] = [];

  for (const item of items) {
    const rawFields = getFields(item);
    const fields = Array.isArray(rawFields) ? rawFields : [rawFields];

    let bestScore = Number.POSITIVE_INFINITY;
    for (const field of fields) {
      if (!field) {
        continue;
      }
      const fieldScore = scoreField(normalizedQuery, queryTokens, field);
      bestScore = Math.min(bestScore, fieldScore);
    }

    if (Number.isFinite(bestScore)) {
      results.push({ item, score: bestScore });
    }
  }

  results.sort((a, b) => a.score - b.score);

  return options.limit ? results.slice(0, options.limit) : results;
}
