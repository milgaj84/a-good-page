import type { StorageLike } from '../adapters/storage';

export interface NamedRecovery { path: string; baseline: string; content: string; at: number }
const KEY = 'hearth.namedRecovery.v1';
const LIMIT = 8_000_000;
/** One crash-recovery record for the current named manuscript; no silent loss on quota failure. */
export class NamedRecoveryStore {
  constructor(private readonly storage: StorageLike | null, private readonly now: () => number) {}
  load(): NamedRecovery | null {
    try {
      const raw = this.storage?.getItem(KEY); if (!raw) return null;
      const item: unknown = JSON.parse(raw);
      if (!item || typeof item !== 'object') return null;
      const v = item as Partial<NamedRecovery>;
      return typeof v.path === 'string' && !!v.path && typeof v.baseline === 'string' &&
        typeof v.content === 'string' && Number.isFinite(v.at) ? v as NamedRecovery : null;
    } catch { return null; }
  }
  save(path: string, baseline: string, content: string): boolean {
    if (!path || content === baseline) { this.clear(path); return true; }
    const existing = this.load();
    if (existing && existing.path !== path) return false;
    const record: NamedRecovery = { path, baseline, content, at: this.now() };
    const raw = JSON.stringify(record);
    if (raw.length > LIMIT || !this.storage) return false;
    try { this.storage.setItem(KEY, raw); return this.storage.getItem(KEY) === raw; }
    catch { return false; }
  }
  clear(path: string): void {
    if (!this.storage || this.load()?.path !== path) return;
    try { this.storage.removeItem(KEY); } catch { /* Leave recovery intact if storage is unavailable. */ }
  }
  discard(path: string): void { this.clear(path); }
}
