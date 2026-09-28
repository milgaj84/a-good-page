import { describe, expect, it } from 'vitest';
import { NamedRecoveryStore } from '../src/core/named-recovery';
function memory() {
  const data = new Map<string, string>();
  return { data, storage: { getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
    removeItem: (key: string) => { data.delete(key); } } };
}
describe('named crash recovery', () => {
  it('retains exact Unicode words and their disk baseline; removes only after save', () => {
    const x = memory(), store = new NamedRecoveryStore(x.storage, () => 42);
    expect(store.save('/book/a.md', 'Old', 'New — words')).toBe(true);
    expect(store.load()).toEqual({ path: '/book/a.md', baseline: 'Old', content: 'New — words', at: 42 });
    store.clear('/book/b.md'); expect(store.load()?.content).toBe('New — words');
    store.clear('/book/a.md'); expect(store.load()).toBeNull();
  });
  it('never silently replaces a recovery for another file or trusts malformed data', () => {
    const x = memory(), store = new NamedRecoveryStore(x.storage, () => 0);
    expect(store.save('a.md', '', 'a')).toBe(true);
    expect(store.save('b.md', '', 'b')).toBe(false);
    expect(store.load()?.content).toBe('a');
    x.data.set('hearth.namedRecovery.v1', '{bad'); expect(store.load()).toBeNull();
  });
  it('detects quota and unavailable storage instead of claiming safety', () => {
    const bad = { getItem: () => null, setItem: () => { throw Error('quota'); }, removeItem: () => {} };
    expect(new NamedRecoveryStore(bad, () => 0).save('a.md', '', 'words')).toBe(false);
    expect(new NamedRecoveryStore(null, () => 0).save('a.md', '', 'words')).toBe(false);
    expect(new NamedRecoveryStore(memory().storage, () => 0).save('a.md', '', 'x'.repeat(8_000_001))).toBe(false);
  });
});
