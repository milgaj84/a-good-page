import { countWords } from './stats';

/** One saved version of a document. */
export interface Snapshot { at: number; content: string; words: number }

/** Async key-value storage, so snapshots can live in IndexedDB instead of the small localStorage quota. */
export interface AsyncKeyValue {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export class MemoryAsyncStore implements AsyncKeyValue {
  readonly data = new Map<string, string>();
  async get(key: string): Promise<string | null> { return this.data.get(key) ?? null; }
  async set(key: string, value: string): Promise<void> { this.data.set(key, value); }
  async remove(key: string): Promise<void> { this.data.delete(key); }
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const PREFIX = 'hearth.snapshots.v1:';
const INDEX_KEY = PREFIX + 'index';

export interface RetentionLimits {
  /** Total characters kept per document; the oldest versions go first. */
  maxChars?: number;
  maxDocuments?: number;
}
const DEFAULT_MAX_CHARS = 8_000_000;
const DEFAULT_MAX_DOCUMENTS = 40;

export function snapshotDocKey(path: string | null): string {
  return path ? 'doc:' + path : 'untitled';
}

function slot(at: number, now: number): string | null {
  const age = now - at;
  if (age < HOUR) return 'm' + Math.floor(at / (10 * MINUTE));
  if (age < DAY) return 'h' + Math.floor(at / HOUR);
  if (age < 14 * DAY) return 'd' + new Date(at).toDateString();
  return null;
}

/**
 * Thins the history: ten-minute steps for the last hour, hourly for a day, daily for two weeks.
 * The first AND latest version in each step survive, so the state from before a mistake is not replaced by the mistake.
 * The newest version always survives the time window. Over the size cap the oldest go first, but never the newest five
 * or the first version of today.
 */
export function pruneSnapshots(list: readonly Snapshot[], now: number, limits: RetentionLimits = {}): Snapshot[] {
  const sorted = [...list].sort((a, b) => a.at - b.at);
  const groups = new Map<string, Snapshot[]>();
  sorted.forEach((snap, index) => {
    const key = slot(snap.at, now) ?? (index === sorted.length - 1 ? 'newest' : null);
    if (key) groups.set(key, [...(groups.get(key) ?? []), snap]);
  });
  const keep = new Set<Snapshot>();
  for (const group of groups.values()) { keep.add(group[0]); keep.add(group[group.length - 1]); }
  const kept = sorted.filter((s) => keep.has(s));
  const midnight = new Date(now).setHours(0, 0, 0, 0);
  const protectedSet = new Set<Snapshot>(kept.slice(-5));
  const firstToday = kept.find((s) => s.at >= midnight);
  if (firstToday) protectedSet.add(firstToday);
  const maxChars = limits.maxChars ?? DEFAULT_MAX_CHARS;
  let total = kept.reduce((sum, s) => sum + s.content.length, 0);
  for (let i = 0; i < kept.length && total > maxChars; ) {
    if (protectedSet.has(kept[i])) { i++; continue; }
    total -= kept[i].content.length;
    kept.splice(i, 1);
  }
  return kept;
}

function parseList(raw: string | null): Snapshot[] {
  if (!raw) return [];
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.filter((s): s is Snapshot => !!s && typeof s === 'object' &&
      Number.isFinite((s as Snapshot).at) && typeof (s as Snapshot).content === 'string' && Number.isFinite((s as Snapshot).words));
  } catch {
    return [];
  }
}

function parseIndex(raw: string | null): Record<string, number> {
  try {
    const data: unknown = raw ? JSON.parse(raw) : {};
    if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
    return Object.fromEntries(Object.entries(data).filter(([, v]) => Number.isFinite(v))) as Record<string, number>;
  } catch {
    return {};
  }
}

/** Keeps a thinned version history per document. Writes are queued so overlapping captures never lose data. */
export class SnapshotStore {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly backend: AsyncKeyValue, private readonly now: () => number, private readonly limits: RetentionLimits = {}) {}

  list(docKey: string): Promise<Snapshot[]> {
    return this.enqueue(async () => parseList(await this.backend.get(PREFIX + docKey)).sort((a, b) => a.at - b.at));
  }

  /** Stores a version unless it is blank or identical to the latest one. Returns true when stored. */
  capture(docKey: string, content: string): Promise<boolean> {
    const at = this.now(); // the moment the writer's words existed, not when the queue reaches them
    return this.enqueue(async () => {
      if (content.trim().length === 0) return false;
      const list = parseList(await this.backend.get(PREFIX + docKey)).sort((a, b) => a.at - b.at);
      if (list.length > 0 && list[list.length - 1].content === content) return false;
      list.push({ at, content, words: countWords(content) });
      await this.backend.set(PREFIX + docKey, JSON.stringify(pruneSnapshots(list, at, this.limits)));
      await this.touch(docKey, at);
      return true;
    });
  }

  /**
   * A renamed page (or a renamed book, and every chapter in it) keeps its history: versions move to the new path.
   * Existing versions at the new path are merged, never overwritten. Returns how many documents moved.
   */
  rekey(from: string, to: string): Promise<number> {
    return this.enqueue(async () => {
      if (from === to) return 0;
      const index = parseIndex(await this.backend.get(INDEX_KEY));
      const fromKey = snapshotDocKey(from);
      const toKey = snapshotDocKey(to);
      const under = (key: string): boolean => key === fromKey || key.startsWith(fromKey + '/') || key.startsWith(fromKey + '\\');
      let moved = 0;
      for (const key of Object.keys(index).filter(under)) {
        const next = toKey + key.slice(fromKey.length);
        const mine = parseList(await this.backend.get(PREFIX + key));
        const theirs = parseList(await this.backend.get(PREFIX + next));
        const seen = new Set<string>();
        const merged = [...theirs, ...mine].sort((a, b) => a.at - b.at)
          .filter((s) => { const id = s.at + ':' + s.content.length; if (seen.has(id)) return false; seen.add(id); return true; });
        await this.backend.set(PREFIX + next, JSON.stringify(pruneSnapshots(merged, this.now(), this.limits)));
        await this.backend.remove(PREFIX + key);
        index[next] = Math.max(index[key] ?? 0, index[next] ?? 0);
        delete index[key];
        moved++;
      }
      if (moved) await this.backend.set(INDEX_KEY, JSON.stringify(index));
      return moved;
    });
  }

  private async touch(docKey: string, at: number): Promise<void> {
    const index = parseIndex(await this.backend.get(INDEX_KEY));
    index[docKey] = at;
    const keys = Object.keys(index).sort((a, b) => index[b] - index[a]);
    for (const old of keys.slice(this.limits.maxDocuments ?? DEFAULT_MAX_DOCUMENTS)) {
      delete index[old];
      await this.backend.remove(PREFIX + old);
    }
    await this.backend.set(INDEX_KEY, JSON.stringify(index));
  }

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task, task);
    this.queue = run.catch(() => undefined);
    return run;
  }
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function clockTime(date: Date): string {
  const hour = date.getHours() % 12 || 12;
  const minutes = date.getMinutes();
  const suffix = date.getHours() < 12 ? 'AM' : 'PM';
  return minutes === 0 ? hour + ' ' + suffix : hour + ':' + String(minutes).padStart(2, '0') + ' ' + suffix;
}

function daysBetween(a: Date, b: Date): number {
  const start = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  const end = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
  return Math.round((end - start) / DAY);
}

/** "Just now", "3 hours ago", "Yesterday at 4 PM", "Sep 12 at 4 PM". */
export function relativeLabel(at: number, now: number): string {
  const age = now - at;
  if (age < MINUTE) return 'Just now';
  if (age < HOUR) { const m = Math.floor(age / MINUTE); return m === 1 ? '1 minute ago' : m + ' minutes ago'; }
  if (age < 6 * HOUR) { const h = Math.floor(age / HOUR); return h === 1 ? '1 hour ago' : h + ' hours ago'; }
  const then = new Date(at);
  const today = new Date(now);
  const days = daysBetween(then, today);
  if (days === 0) return 'Today at ' + clockTime(then);
  if (days === 1) return 'Yesterday at ' + clockTime(then);
  if (days < 7) return WEEKDAYS[then.getDay()] + ' at ' + clockTime(then);
  if (then.getFullYear() === today.getFullYear()) return MONTHS[then.getMonth()] + ' ' + then.getDate() + ' at ' + clockTime(then);
  return MONTHS[then.getMonth()] + ' ' + then.getDate() + ', ' + then.getFullYear();
}
