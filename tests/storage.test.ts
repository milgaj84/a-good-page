import { describe, expect, it } from 'vitest';
import { DRAFT_KEY, DebouncedDraftStore, LocalDraftStore, SafeStore, type StorageLike } from '../src/adapters/storage';

class MapStorage implements StorageLike {
  data = new Map<string, string>();
  getItem(key: string) { return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { this.data.set(key, value); }
  removeItem(key: string) { this.data.delete(key); }
}

const broken: StorageLike = {
  getItem: () => { throw new Error('denied'); },
  setItem: () => { throw new Error('quota'); },
  removeItem: () => { throw new Error('denied'); },
};

describe('SafeStore', () => {
  it('round-trips values', () => {
    const store = new SafeStore(new MapStorage());
    store.set('k', 'v');
    expect(store.get('k')).toBe('v');
    store.remove('k');
    expect(store.get('k')).toBeNull();
  });

  it('returns null and never throws without a backend', () => {
    const store = new SafeStore(null);
    expect(store.get('k')).toBeNull();
    expect(() => store.set('k', 'v')).not.toThrow();
    expect(() => store.remove('k')).not.toThrow();
  });

  it('swallows backend errors', () => {
    const store = new SafeStore(broken);
    expect(store.get('k')).toBeNull();
    expect(() => store.set('k', 'v')).not.toThrow();
    expect(() => store.remove('k')).not.toThrow();
  });
});

describe('LocalDraftStore', () => {
  it('saves, loads and clears drafts', () => {
    const backend = new MapStorage();
    const drafts = new LocalDraftStore(new SafeStore(backend));
    drafts.save('Once upon a time');
    expect(drafts.load()).toBe('Once upon a time');
    drafts.clear();
    expect(drafts.load()).toBeNull();
  });

  it('removes the draft when saving blank content', () => {
    const backend = new MapStorage();
    const drafts = new LocalDraftStore(new SafeStore(backend));
    drafts.save('words');
    drafts.save('   \n ');
    expect(backend.getItem(DRAFT_KEY)).toBeNull();
  });
});

describe('draft save failures', () => {
  const full: StorageLike = { getItem: () => null, setItem: () => { throw new Error('QuotaExceededError'); }, removeItem: () => {} };
  it('reports a draft that could not be stored', () => {
    expect(new LocalDraftStore(new SafeStore(full)).save('words')).toBe(false);
    expect(new LocalDraftStore(new SafeStore(new MapStorage())).save('words')).toBe(true);
  });
  it('tells the caller once, not at every pause, until a save works again', () => {
    let tasks: Array<() => void> = [];
    const scheduler = { set: (fn: () => void) => { tasks.push(fn); return tasks.length; }, clear: () => {} };
    const backend = new MapStorage();
    let broken = true;
    const flaky: StorageLike = { getItem: (k) => backend.getItem(k), removeItem: (k) => backend.removeItem(k),
      setItem: (k, v) => { if (broken) throw new Error('quota'); backend.setItem(k, v); } };
    let fails = 0;
    const drafts = new DebouncedDraftStore(new LocalDraftStore(new SafeStore(flaky)), scheduler, 10, () => { fails++; });
    for (const text of ['a', 'ab', 'abc']) { drafts.save(text); drafts.flush(); }
    expect(fails).toBe(1);
    broken = false; drafts.save('abcd'); drafts.flush();
    broken = true; drafts.save('abcde'); drafts.flush();
    expect(fails).toBe(2);
    tasks = [];
  });
});
