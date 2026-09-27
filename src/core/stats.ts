export const DEFAULT_WPM = 230;

const HAS_WORD_CHAR = /[\p{L}\p{N}]/u;

function safeCount(n: number): number {
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

function wordsLabel(n: number): string {
  return n === 1 ? ' word' : ' words';
}

/** Formats a count with thousands separators; invalid or negative values become 0. */
export function formatCount(n: number): string {
  return safeCount(n).toLocaleString('en-US');
}

/** Counts words a writer would count: tokens that contain at least one letter or digit. */
export function countWords(text: string | null | undefined): number {
  if (!text) return 0;
  return text.split(/\s+/u).filter((token) => HAS_WORD_CHAR.test(token)).length;
}

export function readingMinutes(words: number, wpm: number = DEFAULT_WPM): number {
  if (!Number.isFinite(wpm) || wpm <= 0) {
    throw new RangeError('wpm must be a positive number');
  }
  if (!Number.isFinite(words) || words <= 0) return 0;
  return Math.max(1, Math.ceil(words / wpm));
}

export function formatStats(words: number, wpm: number = DEFAULT_WPM): string {
  const safe = safeCount(words);
  const label = formatCount(safe) + wordsLabel(safe);
  const minutes = readingMinutes(safe, wpm);
  return minutes === 0 ? label : label + ' · ' + minutes + ' min read';
}

export function formatSelection(selected: number, total: number): string {
  const s = safeCount(selected);
  const t = Math.max(safeCount(total), s);
  return formatCount(s) + ' of ' + formatCount(t) + wordsLabel(t) + ' selected';
}
