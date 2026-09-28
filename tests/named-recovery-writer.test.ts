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
  it('keeps deferred recovery after an Escape and refuses to replace it from another document', () => {
    const disk = store(), clock = timer(), notices: string[] = [];
    disk.save('chapter.md', 'Old', 'Recovered');
    const writer = new NamedRecoveryWriter(disk, clock.scheduler, () => ({ baseline: 'Else', content: 'New' }), m => notices.push(m));
    writer.defer('chapter.md'); writer.arm();
    writer.change({ path: 'chapter.md', name: 'chapter', state: 'saved' });
    expect(disk.load()?.content).toBe('Recovered');
    writer.change({ path: 'other.md', name: 'other', state: 'dirty' }); clock.run();
    expect(disk.load()?.content).toBe('Recovered'); expect(notices).toHaveLength(1);
    writer.discard('chapter.md'); expect(disk.load()).toBeNull();
  });
});
