/** Small pure helpers for the Library tree: keyboard moves, match highlighting and grouping. */

export interface NavItem { kind: 'project' | 'file' | 'loose'; expanded?: boolean }
export type NavMove = { to: number } | { toggle: true } | { open: true } | null;

/** What a key does on item `at`: move focus, expand/collapse, or open. Mirrors the WAI-ARIA tree pattern. */
export function treeKey(items: readonly NavItem[], at: number, key: string): NavMove {
  const item = items[at];
  if (!item) return items.length && (key === 'ArrowDown' || key === 'Home' || key === 'End') ? { to: key === 'End' ? items.length - 1 : 0 } : null;
  switch (key) {
    case 'ArrowDown': return at < items.length - 1 ? { to: at + 1 } : null;
    case 'ArrowUp': return at > 0 ? { to: at - 1 } : null;
    case 'Home': return { to: 0 };
    case 'End': return { to: items.length - 1 };
    case 'ArrowRight':
      if (item.kind !== 'project') return null;
      if (!item.expanded) return { toggle: true };
      return items[at + 1]?.kind === 'file' ? { to: at + 1 } : null;
    case 'ArrowLeft':
      if (item.kind === 'project') return item.expanded ? { toggle: true } : null;
      if (item.kind === 'file') {
        for (let i = at - 1; i >= 0; i--) if (items[i].kind === 'project') return { to: i };
      }
      return null;
    case 'Enter': case ' ': return item.kind === 'project' ? { toggle: true } : { open: true };
    default: return null;
  }
}

export interface Segment { text: string; hit: boolean }

/** Splits `text` around every case-insensitive occurrence of the phrase (or, failing that, of its words). */
export function splitMatches(text: string, query: string): Segment[] {
  const phrase = query.trim();
  if (!phrase) return [{ text, hit: false }];
  const escape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const words = phrase.split(/\s+/).filter(w => w.length > 1);
  const pattern = new RegExp([phrase, ...words].map(escape).join('|'), 'giu');
  const out: Segment[] = [];
  let last = 0;
  for (const m of text.matchAll(pattern)) {
    if (!m[0]) continue;
    const at = m.index ?? 0;
    if (at > last) out.push({ text: text.slice(last, at), hit: false });
    out.push({ text: m[0], hit: true });
    last = at + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), hit: false });
  return out.length ? out : [{ text, hit: false }];
}

export interface HitLike { path: string; title: string; context: string }
export interface HitGroup<T extends HitLike> { path: string; title: string; hits: T[] }

/** One entry per page, in first-seen order, with its snippets under it. */
export function groupHits<T extends HitLike>(hits: readonly T[]): HitGroup<T>[] {
  const groups = new Map<string, HitGroup<T>>();
  for (const hit of hits) {
    const group = groups.get(hit.path);
    if (group) group.hits.push(hit);
    else groups.set(hit.path, { path: hit.path, title: hit.title, hits: [hit] });
  }
  return [...groups.values()];
}

/** The hover text for a row: full name, file name when it differs, and the size. */
export function rowTitle(kind: NavItem['kind'], label: string, fileName: string | undefined, meta: string | undefined): string {
  let text = label;
  if (fileName && fileName !== label) text += ' (file: ' + fileName + ')';
  if (meta) text += kind === 'project' ? ' · ' + meta : /^[\d.,\s]+$/.test(meta) ? ' · ' + meta + ' words' : ' · ' + meta;
  return text;
}
