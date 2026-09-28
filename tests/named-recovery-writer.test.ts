import { describe, expect, it } from 'vitest';
import { NamedRecoveryStore } from '../src/core/named-recovery';
import { NamedRecoveryWriter } from '../src/core/named-recovery-writer';
import type { Scheduler } from '../src/core/debounce';
function store() { const map = new Map<string, string>(); return new NamedRecoveryStore({
  getItem: k => map.get(k) ?? null, setItem: (k, v) => { map.set(k, v); }, removeItem: k => { map.delete(k); },
}, () => 12); }
function timer() { let task: (() => void) | null = null; const scheduler: Scheduler = {
  set: fn => { task = fn; return 1; }, clear: () => { task = null; },
}; return { scheduler, run: () => { const fn = task; task = null; if (fn) (fn as () => void)(); } }; }
describe('named recovery debounce', () => {
  it('saves dirty named words on pause, then clears on confirmed save', () => {
    const disk = store(), clock = timer(), notices: string[] = [];
    let content = 'Draft';
    const writer = new NamedRecoveryWriter(disk, clock.scheduler, () => ({ baseline: 'Saved', content }), m => notices.push(m));
    writer.arm(); writer.change({ path: 'chapter.md', name: 'chapter', state: 'dirty' });
    expect(disk.load()).toBeNull(); clock.run(); expect(disk.load()?.content).toBe('Draft');
    content = 'More words'; writer.change({ path: 'chapter.md', name: 'chapter', state: 'dirty' });
    writer.flush(); expect(disk.load()?.content).toBe('More words');
    writer.change({ path: 'chapter.md', name: 'chapter', state: 'saved' });
    expect(disk.load()).toBeNull(); expect(notices).toEqual([]);
  });
  it('restarts debounce on every edit and flushes latest words on demand', () => {
    const disk = store(), clock = timer();
    let content = 'First';
    const writer = new NamedRecoveryWriter(disk, clock.scheduler, () => ({ baseline: 'Saved', content }), () => {});
    writer.arm(); writer.change({ path: 'chapter.md', name: 'chapter', state: 'dirty' });
    content = 'Second'; writer.change({ path: 'chapter.md', name: 'chapter', state: 'dirty' });
    writer.flush(); expect(disk.load('chapter.md')?.content).toBe('Second');
  });
  it('clears postponed words only after a confirmed save of those same words', () => {
    const disk = store(), clock = timer(); let words = 'Old disk';
    disk.save('chapter.md', 'Old disk', 'Recovered');
    const writer = new NamedRecoveryWriter(disk, clock.scheduler, () => ({ baseline: 'Old disk', content: words }), () => {});
    writer.defer('chapter.md'); writer.arm();
    writer.change({ path: 'chapter.md', name: 'chapter', state: 'saved' });
    expect(disk.load('chapter.md')?.content).toBe('Recovered');
    words = 'Recovered';
    writer.change({ path: 'chapter.md', name: 'chapter', state: 'saved' });
    expect(disk.load('chapter.md')).toBeNull();
  });
  it('keeps deferred recovery and writes another document independently', () => {
    const disk = store(), clock = timer(), notices: string[] = [];
    disk.save('chapter.md', 'Old', 'Recovered');
    const writer = new NamedRecoveryWriter(disk, clock.scheduler, () => ({ baseline: 'Else', content: 'New' }), m => notices.push(m));
    writer.defer('chapter.md'); writer.arm();
    writer.change({ path: 'chapter.md', name: 'chapter', state: 'saved' });
    expect(disk.load()?.content).toBe('Recovered');
    writer.change({ path: 'other.md', name: 'other', state: 'dirty' }); clock.run();
    expect(disk.load('chapter.md')?.content).toBe('Recovered');
    expect(disk.load('other.md')?.content).toBe('New'); expect(notices).toEqual([]);
    writer.discard('chapter.md'); expect(disk.load('chapter.md')).toBeNull();
    expect(disk.load('other.md')?.content).toBe('New');
  });
});
