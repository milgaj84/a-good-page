import { describe, expect, it } from 'vitest';
import { Debouncer, type Scheduler } from '../src/core/debounce';

class FakeScheduler implements Scheduler {
  now = 0;
  private nextId = 1;
  private tasks = new Map<number, { at: number; fn: () => void }>();

  set(fn: () => void, ms: number): unknown {
    const id = this.nextId++;
    this.tasks.set(id, { at: this.now + ms, fn });
    return id;
  }

  clear(handle: unknown): void {
    this.tasks.delete(handle as number);
  }

  advance(ms: number): void {
    this.now += ms;
    const due = [...this.tasks.entries()].sort((a, b) => a[1].at - b[1].at);
    for (const [id, task] of due) {
      if (task.at <= this.now && this.tasks.has(id)) {
        this.tasks.delete(id);
        task.fn();
      }
    }
  }
}

function setup(delay = 100) {
  const clock = new FakeScheduler();
  let calls = 0;
  const debouncer = new Debouncer(() => { calls += 1; }, delay, clock);
  return { clock, debouncer, calls: () => calls };
}

describe('Debouncer', () => {
  it('fires once after the delay', () => {
    const { clock, debouncer, calls } = setup();
    debouncer.trigger();
    clock.advance(99);
    expect(calls()).toBe(0);
    clock.advance(1);
    expect(calls()).toBe(1);
    expect(debouncer.pending).toBe(false);
  });

  it('restarts the timer on every trigger', () => {
    const { clock, debouncer, calls } = setup();
    debouncer.trigger();
    clock.advance(80);
    debouncer.trigger();
    clock.advance(80);
    expect(calls()).toBe(0);
    clock.advance(20);
    expect(calls()).toBe(1);
  });

  it('cancel prevents the call', () => {
    const { clock, debouncer, calls } = setup();
    debouncer.trigger();
    debouncer.cancel();
    clock.advance(500);
    expect(calls()).toBe(0);
  });

  it('flush runs a pending call immediately and only once', () => {
    const { clock, debouncer, calls } = setup();
    debouncer.trigger();
    debouncer.flush();
    expect(calls()).toBe(1);
    clock.advance(500);
    expect(calls()).toBe(1);
  });

  it('flush is a no-op when idle', () => {
    const { debouncer, calls } = setup();
    debouncer.flush();
    expect(calls()).toBe(0);
  });

  it('accepts a zero delay', () => {
    const { clock, debouncer, calls } = setup(0);
    debouncer.trigger();
    expect(debouncer.pending).toBe(true);
    clock.advance(0);
    expect(calls()).toBe(1);
  });

  it('rejects negative or non-finite delays', () => {
    const clock = new FakeScheduler();
    expect(() => new Debouncer(() => undefined, -1, clock)).toThrow(RangeError);
    expect(() => new Debouncer(() => undefined, Number.NaN, clock)).toThrow(RangeError);
  });
});

describe('Debouncer maxWait', () => {
  it('still fires during continuous triggering, then starts a new window', () => {
    const clock = new FakeScheduler();
    let calls = 0;
    const debouncer = new Debouncer(() => { calls += 1; }, 100, clock, { maxWait: 1000 });
    for (let t = 0; t < 1000; t += 50) { debouncer.trigger(); clock.advance(50); }
    expect(calls).toBe(1);
    expect(debouncer.pending).toBe(false);
    debouncer.trigger();
    clock.advance(100);
    expect(calls).toBe(2);
    clock.advance(5000);
    expect(calls).toBe(2);
  });
  it('without maxWait continuous triggering never fires', () => {
    const { clock, debouncer, calls } = setup();
    for (let t = 0; t < 2000; t += 50) { debouncer.trigger(); clock.advance(50); }
    expect(calls()).toBe(0);
  });
});
