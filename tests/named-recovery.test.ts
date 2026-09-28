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
    expect(store.save('b.md', '', 'b')).toBe(true);
    expect(store.list().map(x => x.content)).toEqual(['a', 'b']);
    x.data.set('hearth.namedRecovery.v1', '{bad'); expect(store.list()).toHaveLength(2);
  });
  it('migrates a legacy record without dropping a second document', () => {
    const x = memory(), store = new NamedRecoveryStore(x.storage, () => 20);
    x.data.set('hearth.namedRecovery.v1', JSON.stringify({ path: 'old.md', baseline: 'old', content: 'draft', at: 1 }));
    expect(store.save('new.md', 'saved', 'new draft')).toBe(true);
    expect(store.list().map(v => v.path)).toEqual(['old.md', 'new.md']);
    expect(x.data.has('hearth.namedRecovery.v1')).toBe(false);
  });
  it('rejects invalid records and refuses a ninth record without evicting earlier drafts', () => {
    const x = memory(), store = new NamedRecoveryStore(x.storage, () => 4);
    x.data.set('hearth.namedRecovery.v2', JSON.stringify([{ path: '', baseline: '', content: 'bad', at: -1 }]));
    expect(store.list()).toEqual([]);
    expect(store.save('safe.md', '', 'words')).toBe(false);
    x.data.delete('hearth.namedRecovery.v2');
    for (let n = 0; n < 8; n++) expect(store.save('file' + n + '.md', '', 'draft' + n)).toBe(true);
    expect(store.save('ninth.md', '', 'last')).toBe(false);
    expect(store.list()).toHaveLength(8);
  });
  it('does not overwrite a damaged current ledger on save', () => {
    const x = memory(), store = new NamedRecoveryStore(x.storage, () => 5);
    x.data.set('hearth.namedRecovery.v2', '{damaged');
    expect(store.save('a.md', '', 'new words')).toBe(false);
    expect(x.data.get('hearth.namedRecovery.v2')).toBe('{damaged');
  });
  it('detects quota and unavailable storage instead of claiming safety', () => {
    const bad = { getItem: () => null, setItem: () => { throw Error('quota'); }, removeItem: () => {} };
    expect(new NamedRecoveryStore(bad, () => 0).save('a.md', '', 'words')).toBe(false);
    expect(new NamedRecoveryStore(null, () => 0).save('a.md', '', 'words')).toBe(false);
    expect(new NamedRecoveryStore(memory().storage, () => 0).save('a.md', '', 'x'.repeat(8_000_001))).toBe(false);
  });
});
