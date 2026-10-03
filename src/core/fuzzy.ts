/** Letter-by-letter fuzzy matching for the quick switcher: "chtw" finds "Chapter Two". */
import { fold } from './paths';

export interface FuzzyMatch {
  score: number;
  /** Indexes in the text of the matched letters, for highlighting. */
  positions: number[];
}

const START_BONUS = 6;
const WORD_BONUS = 4;
const RUN_BONUS = 6;
const MAX_GAP_PENALTY = 3;
const MAX_TEXT = 240;

function isWordChar(ch: string): boolean {
  return /[\p{L}\p{N}]/u.test(ch);
}

function startsWord(text: string, index: number): boolean {
  if (index === 0) return true;
  const prev = text[index - 1];
  const here = text[index];
  if (!isWordChar(prev)) return true;
  return prev === prev.toLowerCase() && here !== here.toLowerCase(); // camelCase boundary
}

/**
 * Finds the best-scoring way to place every query letter, in order, in the text.
 * Returns null when the letters do not all appear. Spaces in the query are ignored.
 */
export function fuzzyMatch(query: string, text: string): FuzzyMatch | null {
  const q = fold(query).replace(/\s+/g, '');
  if (!q) return { score: 0, positions: [] };
  const original = text.slice(0, MAX_TEXT);
  const t = fold(original);
  const n = q.length;
  const m = t.length;
  if (n > m) return null;
  // best[i][j]: best score with query letter i placed at text index j; from[i][j]: previous index.
  const best: number[][] = [];
  const from: number[][] = [];
  for (let i = 0; i < n; i++) {
    best.push(new Array<number>(m).fill(-Infinity));
    from.push(new Array<number>(m).fill(-1));
    for (let j = i; j < m; j++) {
      if (t[j] !== q[i]) continue;
      const wordBonus = j === 0 ? START_BONUS : startsWord(original, j) ? WORD_BONUS : 0;
      if (i === 0) {
        best[0][j] = 1 + wordBonus - Math.min(1.5, j * 0.1);
        continue;
      }
      for (let k = i - 1; k < j; k++) {
        const prev = best[i - 1][k];
        if (prev === -Infinity) continue;
        const gap = j - k - 1;
        const step = gap === 0 ? 1 + RUN_BONUS : 1 + wordBonus - Math.min(MAX_GAP_PENALTY, gap);
        if (prev + step > best[i][j]) {
          best[i][j] = prev + step;
          from[i][j] = k;
        }
      }
    }
  }
  let end = -1;
  for (let j = 0; j < m; j++) if (best[n - 1][j] > (end < 0 ? -Infinity : best[n - 1][end])) end = j;
  if (end < 0 || best[n - 1][end] === -Infinity) return null;
  const positions: number[] = [];
  for (let i = n - 1, j = end; i >= 0; j = from[i][j], i--) positions.unshift(j);
  return { score: best[n - 1][end], positions };
}

export interface Ranked<T> {
  item: T;
  match: FuzzyMatch;
}

/** Sorts matching items by score; ties keep their original order. */
export function fuzzyRank<T>(query: string, items: readonly T[], text: (item: T) => string, limit = Infinity): Ranked<T>[] {
  const ranked: (Ranked<T> & { index: number })[] = [];
  items.forEach((item, index) => {
    const match = fuzzyMatch(query, text(item));
    if (match) ranked.push({ item, match, index });
  });
  ranked.sort((a, b) => b.match.score - a.match.score || a.index - b.index);
  return ranked.slice(0, limit).map(({ item, match }) => ({ item, match }));
}
