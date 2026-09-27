import { describe, expect, it } from 'vitest';
import { ChangeLatch, FrameTask, type FrameClock } from '../src/core/frame';
import { DebouncedDraftStore } from '../src/adapters/storage';
import type { Scheduler } from '../src/core/debounce';
import type { DraftStore } from '../src/core/session';

class Frames implements FrameClock {
  queue = new Map<number, (time: number) => void>();
  next = 1;
  request(callback: (time: number) => void) { const id = this.next++; this.queue.set(id, callback); return id; }
  cancel(handle: unknown) { this.queue.delete(handle as number); }
  run() { const jobs = [...this.queue.values()]; this.queue.clear(); jobs.forEach(job => job(0)); }
}

class Clock implements Scheduler {
  jobs = new Map<number, () => void>();
  next = 1;
  set(fn: () => void) { const id = this.next++; this.jobs.set(id, fn); return id; }
  clear(handle: unknown) { this.jobs.delete(handle as number); }
  fire() { const jobs = [...this.jobs.values()]; this.jobs.clear(); jobs.forEach(job => job()); }
}

class Memory implements DraftStore {
  value: string | null = null;
  saves = 0;
  load() { return this.value; }
  save(markdown: string) { this.saves += 1; this.value = markdown; }
  clear() { this.value = null; }
}

describe('FrameTask', () => {
  it('coalesces many schedules into one run per frame', () => {
    const frames = new Frames();
    let runs = 0;
    const task = new FrameTask(() => { runs += 1; }, frames);
    task.schedule(); task.schedule(); task.schedule();
    expect(frames.queue.size).toBe(1);
    frames.run();
    expect(runs).toBe(1);
    expect(task.pending).toBe(false);
  });

  it('cancel drops and flush runs a pending task once', () => {
    const frames = new Frames();
    let runs = 0;
    const task = new FrameTask(() => { runs += 1; }, frames);
    task.flush();
    expect(runs).toBe(0);
    task.schedule(); task.cancel(); frames.run();
    expect(runs).toBe(0);
    task.schedule(); task.flush(); frames.run();
    expect(runs).toBe(1);
  });
});

describe('ChangeLatch', () => {
  it('reports only real changes, including the first value', () => {
    const latch = new ChangeLatch();
    expect(latch.changed('a')).toBe(true);
    expect(latch.changed('a')).toBe(false);
    expect(latch.changed('')).toBe(true);
    latch.reset();
    expect(latch.changed('')).toBe(true);
  });
});

describe('DebouncedDraftStore', () => {
  it('reads markdown once per typing burst', () => {
    const clock = new Clock();
    const inner = new Memory();
    const drafts = new DebouncedDraftStore(inner, clock, 500);
    let reads = 0;
    for (let i = 0; i < 50; i += 1) drafts.saveLazy(() => { reads += 1; return 'draft ' + i; });
    expect(inner.value).toBeNull();
    expect(clock.jobs.size).toBe(1);
    clock.fire();
    expect(reads).toBe(1);
    expect(inner.value).toBe('draft 49');
    expect(drafts.hasPending).toBe(false);
  });

  it('flush writes immediately and is a no-op when idle', () => {
    const inner = new Memory();
    const drafts = new DebouncedDraftStore(inner, new Clock(), 500);
    drafts.flush();
    expect(inner.saves).toBe(0);
    drafts.save('kept');
    drafts.flush();
    expect(inner.value).toBe('kept');
    expect(inner.saves).toBe(1);
  });

  it('clear cancels a pending save so a discarded draft never comes back', () => {
    const clock = new Clock();
    const inner = new Memory();
    const drafts = new DebouncedDraftStore(inner, clock, 500);
    drafts.save('old');
    drafts.clear();
    clock.fire();
    expect(inner.value).toBeNull();
    expect(clock.jobs.size).toBe(0);
  });

  it('load flushes first, so it always sees the latest words', () => {
    const drafts = new DebouncedDraftStore(new Memory(), new Clock(), 500);
    drafts.save('latest');
    expect(drafts.load()).toBe('latest');
  });

  it('rejects invalid delays', () => {
    expect(() => new DebouncedDraftStore(new Memory(), new Clock(), -1)).toThrow(RangeError);
    expect(() => new DebouncedDraftStore(new Memory(), new Clock(), Number.NaN)).toThrow(RangeError);
  });
});
