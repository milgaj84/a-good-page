import type { KeyValueStore } from './ports';

export const VIEW_KEY = 'agp.view.v1';
const MAX_PAGES = 60;

export interface PageView { caret: number; scroll: number }

/** Where you were on each page: the caret and the scroll position, for the pages you used most recently. */
export class ViewMemory {
  constructor(private readonly store: KeyValueStore) {}

  private read(): Record<string, PageView & { at: number }> {
    try {
      const data: unknown = JSON.parse(this.store.get(VIEW_KEY) ?? '{}');
      if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
      const out: Record<string, PageView & { at: number }> = {};
      for (const [path, v] of Object.entries(data as Record<string, unknown>)) {
        const view = v as Partial<PageView & { at: number }>;
        if (Number.isFinite(view?.caret) && Number.isFinite(view?.scroll)) {
          out[path] = { caret: Math.max(0, view.caret as number), scroll: Math.max(0, view.scroll as number), at: Number(view.at) || 0 };
        }
      }
      return out;
    } catch { return {}; }
  }

  get(path: string | null): PageView | null {
    if (!path) return null;
    const found = this.read()[path];
    return found ? { caret: found.caret, scroll: found.scroll } : null;
  }

  set(path: string | null, view: PageView, now: number): void {
    if (!path) return;
    const all = this.read();
    all[path] = { caret: Math.max(0, Math.floor(view.caret)), scroll: Math.max(0, Math.floor(view.scroll)), at: now };
    const keep = Object.entries(all).sort((a, b) => b[1].at - a[1].at).slice(0, MAX_PAGES);
    this.store.set(VIEW_KEY, JSON.stringify(Object.fromEntries(keep)));
  }

  /** A renamed page keeps its place. */
  move(from: string, to: string): void {
    const all = this.read();
    for (const key of Object.keys(all)) {
      if (key === from || key.startsWith(from + '/') || key.startsWith(from + '\\')) {
        all[to + key.slice(from.length)] = all[key];
        delete all[key];
      }
    }
    this.store.set(VIEW_KEY, JSON.stringify(all));
  }
}
