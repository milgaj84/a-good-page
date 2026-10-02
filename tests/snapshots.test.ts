import { describe, expect, it } from 'vitest';
import { MemoryAsyncStore, SnapshotStore, pruneSnapshots, relativeLabel, snapshotDocKey, type Snapshot } from '../src/core/snapshots';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const at = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min).getTime();

describe('relative snapshot labels', () => {
  const now = at(2026, 9, 27, 20, 0);
  it('uses short phrases for recent versions', () => {
    expect(relativeLabel(now - 20_000, now)).toBe('Just now');
    expect(relativeLabel(now - 60_000, now)).toBe('1 minute ago');
    expect(relativeLabel(now - 25 * 60_000, now)).toBe('25 minutes ago');
    expect(relativeLabel(now - HOUR, now)).toBe('1 hour ago');
    expect(relativeLabel(now - 3 * HOUR, now)).toBe('3 hours ago');
  });
  it('names the day and time for older versions', () => {
    expect(relativeLabel(at(2026, 9, 27, 9, 0), now)).toBe('Today at 9 AM');
    expect(relativeLabel(at(2026, 9, 26, 16, 0), now)).toBe('Yesterday at 4 PM');
    expect(relativeLabel(at(2026, 9, 26, 0, 30), now)).toBe('Yesterday at 12:30 AM');
    expect(relativeLabel(at(2026, 9, 23, 12, 5), now)).toBe('Wednesday at 12:05 PM');
    expect(relativeLabel(at(2026, 9, 12, 16, 0), now)).toBe('Sep 12 at 4 PM');
    expect(relativeLabel(at(2025, 12, 31, 16, 0), now)).toBe('Dec 31, 2025');
  });
  it('treats a clock that moved backwards as just now', () => {
    expect(relativeLabel(now + 5 * 60_000, now)).toBe('Just now');
  });
});

describe('snapshot keys', () => {
  it('uses the file path, or one shared key for untitled writing', () => {
    expect(snapshotDocKey('/book/draft.md')).toBe('doc:/book/draft.md');
    expect(snapshotDocKey(null)).toBe('untitled');
  });
});

describe('retention', () => {
  const now = at(2026, 9, 27, 20, 0);
  const snap = (time: number, content = 'x' + time): Snapshot => ({ at: time, content, words: 1 });
  it('keeps ten-minute steps for the last hour, hourly for a day and daily for two weeks', () => {
    const times = [
      now - 1 * 60_000, now - 4 * 60_000, // same ten-minute slot: keep the later one
      now - 25 * 60_000,
      now - 2 * HOUR - 5 * 60_000, now - 2 * HOUR - 40 * 60_000, // same hour
      now - 3 * DAY, now - 3 * DAY - 2 * HOUR, // same day
      now - 20 * DAY, // too old
    ];
    const kept = pruneSnapshots(times.map((t) => snap(t)), now).map((s) => s.at);
    expect(kept).toEqual([now - 3 * DAY, now - 2 * HOUR - 5 * 60_000, now - 25 * 60_000, now - 1 * 60_000]);
  });
  it('always keeps the newest version, even if it is older than the window', () => {
    expect(pruneSnapshots([snap(now - 30 * DAY)], now)).toHaveLength(1);
  });
  it('drops the oldest versions to fit the character budget', () => {
    const list = [snap(now - 3 * HOUR, 'aaaa'), snap(now - 2 * HOUR, 'bbbb'), snap(now - HOUR, 'cccc')];
    expect(pruneSnapshots(list, now, { maxChars: 9 }).map((s) => s.content)).toEqual(['bbbb', 'cccc']);
    expect(pruneSnapshots(list, now, { maxChars: 2 })).toEqual([]);
  });
});

describe('SnapshotStore', () => {
  function setup(start = at(2026, 9, 27, 12)) {
    let clock = start;
    const backend = new MemoryAsyncStore();
    const store = new SnapshotStore(backend, () => clock);
    return { backend, store, tick: (ms: number) => { clock += ms; } };
  }
  it('captures versions oldest first and skips unchanged or blank content', async () => {
    const { store, tick } = setup();
    expect(await store.capture('doc:a', 'One two')).toBe(true);
    expect(await store.capture('doc:a', 'One two')).toBe(false);
    expect(await store.capture('doc:a', '   ')).toBe(false);
    tick(HOUR);
    expect(await store.capture('doc:a', 'One two three')).toBe(true);
    const list = await store.list('doc:a');
    expect(list.map((s) => s.words)).toEqual([2, 3]);
    expect(await store.list('doc:b')).toEqual([]);
  });
  it('replaces a version in the same ten-minute slot', async () => {
    const { store, tick } = setup();
    await store.capture('doc:a', 'first');
    tick(60_000);
    await store.capture('doc:a', 'second');
    expect((await store.list('doc:a')).map((s) => s.content)).toEqual(['second']);
  });
  it('recovers from damaged stored data', async () => {
    const { store, backend } = setup();
    await backend.set('hearth.snapshots.v1:doc:a', '{not json');
    expect(await store.list('doc:a')).toEqual([]);
    await backend.set('hearth.snapshots.v1:doc:a', JSON.stringify([{ at: 'x' }, { at: 1, content: 'ok', words: 1 }]));
    expect((await store.list('doc:a')).map((s) => s.content)).toEqual(['ok']);
  });
  it('forgets the least recently used documents beyond the document limit', async () => {
    let clock = 1_000;
    const backend = new MemoryAsyncStore();
    const store = new SnapshotStore(backend, () => clock, { maxDocuments: 2 });
    for (const key of ['doc:a', 'doc:b', 'doc:c']) { clock += 1_000; await store.capture(key, 'text of ' + key); }
    expect(await store.list('doc:a')).toEqual([]);
    expect(await store.list('doc:c')).toHaveLength(1);
    expect(await backend.get('hearth.snapshots.v1:doc:a')).toBeNull();
  });
  it('serialises overlapping captures so none is lost', async () => {
    const { store, tick } = setup();
    const first = store.capture('doc:a', 'alpha');
    tick(HOUR);
    const second = store.capture('doc:a', 'alpha beta');
    await Promise.all([first, second]);
    expect(await store.list('doc:a')).toHaveLength(2);
  });
});

describe('History follows a rename', () => {
  const NOW = 1_700_000_000_000;
  it('moves a page\'s versions to its new path and merges with any already there', async () => {
    const backend = new MemoryAsyncStore();
    const store = new SnapshotStore(backend, () => NOW);
    await store.capture(snapshotDocKey('/lib/Untitled.md'), 'first words');
    const later = new SnapshotStore(backend, () => NOW + 30 * 60_000);
    await later.capture(snapshotDocKey('/lib/Harbour.md'), 'different words');
    expect(await store.rekey('/lib/Untitled.md', '/lib/Harbour.md')).toBe(1);
    expect((await store.list(snapshotDocKey('/lib/Harbour.md'))).map(s => s.content)).toEqual(['first words', 'different words']);
    expect(await store.list(snapshotDocKey('/lib/Untitled.md'))).toEqual([]);
  });
  it('moves every chapter when a book is renamed, and nothing else', async () => {
    const backend = new MemoryAsyncStore();
    const store = new SnapshotStore(backend, () => NOW);
    await store.capture(snapshotDocKey('/lib/Novel/01.md'), 'one');
    await store.capture(snapshotDocKey('/lib/Novel/part/02.md'), 'two');
    await store.capture(snapshotDocKey('/lib/Novel2/03.md'), 'other book');
    expect(await store.rekey('/lib/Novel', '/lib/Saga')).toBe(2);
    expect((await store.list(snapshotDocKey('/lib/Saga/01.md')))[0].content).toBe('one');
    expect((await store.list(snapshotDocKey('/lib/Saga/part/02.md')))[0].content).toBe('two');
    expect((await store.list(snapshotDocKey('/lib/Novel2/03.md')))[0].content).toBe('other book');
  });
  it('does nothing for an unknown path or an unchanged name', async () => {
    const store = new SnapshotStore(new MemoryAsyncStore(), () => NOW);
    expect(await store.rekey('/lib/A.md', '/lib/B.md')).toBe(0);
    expect(await store.rekey('/lib/A.md', '/lib/A.md')).toBe(0);
  });
});
