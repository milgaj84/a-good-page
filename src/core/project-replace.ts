export interface ReplaceOptions { matchCase: boolean; wholeWord: boolean }

export interface TextMatch {
  start: number;
  end: number;
  /** 1-based line of the match, for the writer's bearings. */
  line: number;
  before: string;
  hit: string;
  after: string;
}

const CONTEXT = 38;
const WORD = '[\\p{L}\\p{N}_]';

function escapeRegex(text: string): string {
  return text.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
}

/**
 * Every occurrence of `query` in a page's source text, in order, with a little of the line around it.
 * The source is the Markdown (or plain text) as it sits in the file, so nothing about the page's formatting is lost.
 */
export function findInText(text: string, query: string, options: ReplaceOptions, limit = 500): TextMatch[] {
  if (!query) return [];
  const core = escapeRegex(query);
  const pattern = options.wholeWord ? `(?<!${WORD})${core}(?!${WORD})` : core;
  let matcher: RegExp;
  try { matcher = new RegExp(pattern, options.matchCase ? 'gu' : 'giu'); } catch { return []; }
  const out: TextMatch[] = [];
  for (const found of text.matchAll(matcher)) {
    const start = found.index;
    const end = start + found[0].length;
    const lineStart = text.lastIndexOf('\n', start - 1) + 1;
    const lineEndAt = text.indexOf('\n', end);
    const lineEnd = lineEndAt < 0 ? text.length : lineEndAt;
    const beforeFrom = Math.max(lineStart, start - CONTEXT);
    const afterTo = Math.min(lineEnd, end + CONTEXT);
    let line = 1;
    for (let i = text.indexOf('\n'); i >= 0 && i < start; i = text.indexOf('\n', i + 1)) line++;
    out.push({
      start, end, line,
      before: (beforeFrom > lineStart ? '…' : '') + text.slice(beforeFrom, start),
      hit: found[0],
      after: text.slice(end, afterTo) + (afterTo < lineEnd ? '…' : ''),
    });
    if (out.length >= limit) break;
  }
  return out;
}

/** The page's text with the chosen matches replaced. Matches must come from `findInText` on the same text. */
export function replaceMatches(text: string, matches: readonly TextMatch[], replacement: string): string {
  let result = text;
  for (const match of [...matches].sort((a, b) => b.start - a.start)) {
    result = result.slice(0, match.start) + replacement + result.slice(match.end);
  }
  return result;
}

export interface SearchFile { path: string; label: string; group: string; text: string }

export interface FileMatches { file: SearchFile; matches: TextMatch[] }

/** All matches across pages, keeping only pages that have some. */
export function searchFiles(files: readonly SearchFile[], query: string, options: ReplaceOptions, perFile = 500, total = 2000): FileMatches[] {
  const out: FileMatches[] = [];
  let count = 0;
  for (const file of files) {
    if (count >= total) break;
    const matches = findInText(file.text, query, options, Math.min(perFile, total - count));
    if (matches.length) { out.push({ file, matches }); count += matches.length; }
  }
  return out;
}

export interface ReplaceEdit { path: string; label: string; oldText: string; newText: string; count: number }

/** The edits to make: one per page, built only from the matches that are still ticked. */
export function buildEdits(results: readonly FileMatches[], replacement: string, ticked: ReadonlySet<string>, key: (path: string, match: TextMatch) => string): ReplaceEdit[] {
  const edits: ReplaceEdit[] = [];
  for (const { file, matches } of results) {
    const chosen = matches.filter(m => ticked.has(key(file.path, m)));
    if (!chosen.length) continue;
    const newText = replaceMatches(file.text, chosen, replacement);
    if (newText !== file.text) edits.push({ path: file.path, label: file.label, oldText: file.text, newText, count: chosen.length });
  }
  return edits;
}
