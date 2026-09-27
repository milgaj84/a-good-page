import type { Node as PMNode } from '@tiptap/pm/model';
export interface Match { from: number; to: number }
export interface FindOptions { matchCase?: boolean; wholeWord?: boolean }
const WORD = /[\p{L}\p{N}_]/u;
/** Search each text block; positions remain correct across differently styled text runs. */
export function findMatches(doc: PMNode, query: string, options: FindOptions = {}): Match[] {
  if (!query) return [];
  const escaped = query.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  const matcher = new RegExp(escaped, options.matchCase ? 'gu' : 'giu');
  const matches: Match[] = [];
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    let text = ''; const positions: number[] = [];
    node.descendants((child, offset) => {
      if (!child.isText || !child.text) return;
      for (let i = 0; i < child.text.length; i++) { text += child.text[i]; positions.push(pos + 1 + offset + i); }
    });
    for (const found of text.matchAll(matcher)) {
      const at = found.index;
      const end = at + found[0].length;
      if (options.wholeWord && ((at > 0 && WORD.test(text[at - 1])) || (end < text.length && WORD.test(text[end])))) continue;
      const first = positions[at], last = positions[end - 1];
      if (first !== undefined && last !== undefined && last - first === found[0].length - 1)
        matches.push({ from: first, to: last + 1 });
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
