import { describe, expect, it } from 'vitest';
import { SHIFT_CLASS, ThemeTransition, type ThemeRoot } from '../src/ui/theme-transition';
import type { Scheduler } from '../src/core/debounce';

class FakeScheduler implements Scheduler {
  tasks = new Map<number, () => void>();
  private next = 1;
  set(fn: () => void): unknown { const id = this.next++; this.tasks.set(id, fn); return id; }
  clear(handle: unknown): void { this.tasks.delete(handle as number); }
  runAll(): void { const fns = [...this.tasks.values()]; this.tasks.clear(); fns.forEach(fn => fn()); }
}

function fakeRoot(): ThemeRoot & { classes: Set<string> } {
  const classes = new Set<string>();
  return { classes, dataset: {}, classList: { add: n => { classes.add(n); }, remove: n => { classes.delete(n); } } };
}

describe('ThemeTransition', () => {
  it('applies the first theme instantly without a cross-fade', () => {
    const root = fakeRoot(); const clock = new FakeScheduler();
    new ThemeTransition(root, clock, 500, () => false).apply('paper');
    expect(root.dataset.theme).toBe('paper');
    expect(root.classes.has(SHIFT_CLASS)).toBe(false);
    expect(clock.tasks.size).toBe(0);
  });

  it('cross-fades later changes and cleans up afterwards', () => {
    const root = fakeRoot(); const clock = new FakeScheduler();
    const shift = new ThemeTransition(root, clock, 500, () => false);
    shift.apply('paper'); shift.apply('night');
    expect(root.dataset.theme).toBe('night');
    expect(root.classes.has(SHIFT_CLASS)).toBe(true);
    expect(shift.shifting).toBe(true);
    clock.runAll();
    expect(root.classes.has(SHIFT_CLASS)).toBe(false);
    expect(shift.shifting).toBe(false);
  });

  it('keeps only one pending cleanup when themes change rapidly', () => {
    const root = fakeRoot(); const clock = new FakeScheduler();
    const shift = new ThemeTransition(root, clock, 500, () => false);
    shift.apply('paper'); shift.apply('sepia'); shift.apply('sage'); shift.apply('midnight');
    expect(clock.tasks.size).toBe(1);
    expect(root.dataset.theme).toBe('midnight');
  });

  it('skips animation for reduced motion, zero duration, or the same theme', () => {
    const reduced = fakeRoot(); const a = new ThemeTransition(reduced, new FakeScheduler(), 500, () => true);
    a.apply('paper'); a.apply('night');
    expect(reduced.classes.has(SHIFT_CLASS)).toBe(false);
    const zero = fakeRoot(); const b = new ThemeTransition(zero, new FakeScheduler(), 0, () => false);
    b.apply('paper'); b.apply('night');
    expect(zero.classes.has(SHIFT_CLASS)).toBe(false);
    const same = fakeRoot(); const c = new ThemeTransition(same, new FakeScheduler(), 500, () => false);
    c.apply('paper'); c.apply('paper');
    expect(same.classes.has(SHIFT_CLASS)).toBe(false);
  });

  it('rejects invalid durations and empty theme names', () => {
    expect(() => new ThemeTransition(fakeRoot(), new FakeScheduler(), -1, () => false)).toThrow(RangeError);
    expect(() => new ThemeTransition(fakeRoot(), new FakeScheduler(), Number.NaN, () => false)).toThrow(RangeError);
    expect(() => new ThemeTransition(fakeRoot(), new FakeScheduler(), 10, () => false).apply('')).toThrow(RangeError);
  });
});
