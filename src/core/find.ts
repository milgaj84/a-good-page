import type { Node as PMNode } from '@tiptap/pm/model';
export interface Match { from: number; to: number }
export interface FindOptions { matchCase?: boolean; wholeWord?: boolean }
const WORD = /[\p{L}\p{N}_]/u;
/** Straight quotes and hyphens in the query also find their typeset forms. */
const LOOSE: Record<string, string> = { "'": '[\'\u2018\u2019]', '"': '["\u201C\u201D]', '-': '[\\-\u2013\u2014]' };
function queryPattern(query: string): string {
  return [...query].map(ch => LOOSE[ch] ?? ch.replace(/[/\\^$*+?.()|[\]{}]/g, '\\$&')).join('');
}
/** Search each text block; positions remain correct across differently styled text runs. */
export function findMatches(doc: PMNode, query: string, options: FindOptions = {}): Match[] {
  if (!query) return [];
  const matcher = new RegExp(queryPattern(query), options.matchCase ? 'gu' : 'giu');
  const matches: Match[] = [];
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    let text = '';
    // One entry per text run, not per character: the map from text offset to document position is built lazily.
    const runs: { start: number; pos: number; length: number }[] = [];
    node.descendants((child, offset) => {
      if (!child.isText || !child.text) return;
      runs.push({ start: text.length, pos: pos + 1 + offset, length: child.text.length });
      text += child.text;
    });
    const at = (index: number): number => {
      let lo = 0, hi = runs.length - 1;
      while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (runs[mid].start <= index) lo = mid; else hi = mid - 1; }
      return runs[lo].pos + index - runs[lo].start;
    };
    for (const found of text.matchAll(matcher)) {
      const start = found.index;
      const end = start + found[0].length;
      if (!found[0].length) continue;
      if (options.wholeWord && ((start > 0 && WORD.test(text[start - 1])) || (end < text.length && WORD.test(text[end])))) continue;
      const first = at(start), last = at(end - 1);
      if (last - first === found[0].length - 1) matches.push({ from: first, to: last + 1 });
    }
    return false;
  });
  return matches;
}
export function nextMatch(matches: readonly Match[], pos: number, direction: 1 | -1): number {
  if (!matches.length) return -1;
  if (direction === 1) { const index = matches.findIndex(m => m.from > pos); return index < 0 ? 0 : index; }
  for (let i = matches.length - 1; i >= 0; i--) if (matches[i].from < pos) return i;
  return matches.length - 1;
}
/** Next surviving occurrence after a replacement, wrapping to the beginning. */
export function matchAtOrAfter(matches: readonly Match[], position: number): number {
  if (!matches.length) return -1;
  const index = matches.findIndex(match => match.from >= position);
  return index < 0 ? 0 : index;
}
