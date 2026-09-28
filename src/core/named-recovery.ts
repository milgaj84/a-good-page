import type { StorageLike } from '../adapters/storage';

export interface NamedRecovery { path: string; baseline: string; content: string; at: number }
const LEGACY = 'hearth.namedRecovery.v1';
const KEY = 'hearth.namedRecovery.v2';
const LIMIT = 8_000_000;
const MAX_DOCUMENTS = 8;
function valid(value: unknown): value is NamedRecovery {
  if (!value || typeof value !== 'object') return false;
  const v = value as Partial<NamedRecovery>;
  return typeof v.path === 'string' && !!v.path.trim() && typeof v.baseline === 'string' &&
    typeof v.content === 'string' && Number.isFinite(v.at) && (v.at as number) >= 0;
}
/** Never evict unsaved writing. A full or unavailable store returns false. */
export class NamedRecoveryStore {
  constructor(private readonly storage: StorageLike | null, private readonly now: () => number) {}
  list(): NamedRecovery[] {
    try {
      const raw = this.storage?.getItem(KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return [];
      const unique = new Map<string, NamedRecovery>();
      for (const item of parsed) if (valid(item) && !unique.has(item.path)) unique.set(item.path, item);
      const legacy = this.storage?.getItem(LEGACY);
      if (legacy) {
        try { const item: unknown = JSON.parse(legacy); if (valid(item) && !unique.has(item.path)) unique.set(item.path, item); }
        catch { /* Corrupt legacy must not hide healthy current records. */ }
      }
      return [...unique.values()].sort((a, b) => a.at - b.at);
    } catch { return []; }
  }
  load(path?: string): NamedRecovery | null {
    const entries = this.list();
    return path ? entries.find(x => x.path === path) ?? null : entries[entries.length - 1] ?? null;
  }
  save(path: string, baseline: string, content: string): boolean {
    const at = this.now();
    if (!path.trim() || !Number.isFinite(at) || at < 0) return false;
    if (content === baseline) { this.clear(path); return this.load(path) === null; }
    try {
      const legacy = this.storage?.getItem(LEGACY);
      if (legacy) { const old: unknown = JSON.parse(legacy); if (!valid(old)) return false; }
      const existing = this.storage?.getItem(KEY);
      if (existing !== null && existing !== undefined) {
        const parsed: unknown = JSON.parse(existing);
        if (!Array.isArray(parsed) || parsed.some(x => !valid(x))) return false;
      }
    } catch { return false; } // Do not overwrite damaged records.
    const entries = this.list().filter(x => x.path !== path);
    entries.push({ path, baseline, content, at });
    if (entries.length > MAX_DOCUMENTS || !this.storage) return false;
    const raw = JSON.stringify(entries);
    if (raw.length > LIMIT) return false;
    try {
      this.storage.setItem(KEY, raw);
      if (this.storage.getItem(KEY) !== raw) return false;
      if (this.storage.getItem(LEGACY)) this.storage.removeItem(LEGACY);
      return true;
    } catch { return false; }
  }
  clear(path: string): void {
    if (!this.storage || !path) return;
    try {
      const before = this.list();
      const entries = before.filter(item => item.path !== path);
      if (before.length === entries.length) return;
      const raw = JSON.stringify(entries);
      this.storage.setItem(KEY, raw);
      if (this.storage.getItem(KEY) === raw && this.storage.getItem(LEGACY)) this.storage.removeItem(LEGACY);
    } catch { /* Do not claim that unsaved words were removed. */ }
  }
  discard(path: string): void { this.clear(path); }
}
