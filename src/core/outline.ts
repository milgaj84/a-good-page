export interface HeadingInfo {
  level: number;
  text: string;
  pos: number;
}

export interface OutlineItem extends HeadingInfo {
  depth: number;
  /** Survives edits above: the heading text plus how many identical headings came before it. */
  key: string;
  /** True when the next heading is nested under this one. */
  hasChildren: boolean;
}

export const MAX_DEPTH = 2;

/** Turns raw headings into a tidy outline, indented relative to the highest heading used. */
export function buildOutline(headings: readonly HeadingInfo[]): OutlineItem[] {
  const valid = headings
    .filter((h) => Number.isInteger(h.level) && h.level >= 1 && Number.isFinite(h.pos))
    .map((h) => ({ ...h, text: h.text.replace(/\s+/g, ' ').trim() }))
    .filter((h) => h.text.length > 0);
  if (valid.length === 0) return [];
  const minLevel = Math.min(...valid.map((h) => h.level));
  const seen = new Map<string, number>();
  const items = valid.map((h) => {
    const n = seen.get(h.text) ?? 0;
    seen.set(h.text, n + 1);
    return { ...h, depth: Math.min(MAX_DEPTH, h.level - minLevel), key: h.text + '#' + n, hasChildren: false };
  });
  items.forEach((item, i) => { item.hasChildren = i + 1 < items.length && items[i + 1].depth > item.depth; });
  return items;
}

/** Index of the section containing the caret, or -1 when the caret is above every heading. */
export function activeIndex(items: readonly OutlineItem[], pos: number): number {
  let index = -1;
  for (let i = 0; i < items.length; i += 1) {
    if (items[i].pos <= pos) index = i;
    else break;
  }
  return index;
}

/** A collapsed heading hides descendants up to the next heading at its level. */
export function visibleOutline(items: readonly OutlineItem[], collapsed: ReadonlySet<string>): OutlineItem[] {
  const visible: OutlineItem[] = []; let hiddenDepth = -1;
  for (const item of items) {
    if (hiddenDepth >= 0 && item.depth > hiddenDepth) continue;
    hiddenDepth = -1; visible.push(item);
    if (collapsed.has(item.key)) hiddenDepth = item.depth;
  }
  return visible;
}

/** Chapter headings are the top-level headings present in this manuscript. */
export function adjacentChapter(items: readonly OutlineItem[], caret: number, direction: 1 | -1): OutlineItem | null {
  const chapters = items.filter(item => item.depth === 0);
  if (direction === 1) return chapters.find(item => item.pos > caret) ?? null;
  for (let i = chapters.length - 1; i >= 0; i--) if (chapters[i].pos < caret) return chapters[i];
  return null;
}
