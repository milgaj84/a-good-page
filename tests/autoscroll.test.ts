import { describe, expect, it } from 'vitest';
import { AUTOSCROLL_TUNING, Autoscroll, autoscrollVelocity, type AutoscrollIndicator, type ScrollTarget } from '../src/ui/autoscroll';
import type { FrameClock } from '../src/core/frame';

class Frames implements FrameClock {
  queue = new Map<number, (time: number) => void>();
  next = 1;
  request(callback: (time: number) => void) { const id = this.next++; this.queue.set(id, callback); return id; }
  cancel(handle: unknown) { this.queue.delete(handle as number); }
  run(time: number) { const jobs = [...this.queue.values()]; this.queue.clear(); jobs.forEach(job => job(time)); }
}

class Indicator implements AutoscrollIndicator {
  shown: Array<[number, number]> = [];
  dirs: number[] = [];
  hidden = 0;
  show(x: number, y: number) { this.shown.push([x, y]); }
  direction(dir: -1 | 0 | 1) { this.dirs.push(dir); }
  hide() { this.hidden += 1; }
}

function page(scrollHeight = 5000, clientHeight = 800): ScrollTarget {
  return { scrollTop: 0, scrollHeight, clientHeight };
}

describe('autoscrollVelocity', () => {
  it('is zero inside and on the dead zone edge', () => {
    expect(autoscrollVelocity(0)).toBe(0);
    expect(autoscrollVelocity(AUTOSCROLL_TUNING.deadzone)).toBe(0);
    expect(autoscrollVelocity(-AUTOSCROLL_TUNING.deadzone)).toBe(0);
  });

  it('follows the pointer direction and grows with distance', () => {
    const near = autoscrollVelocity(40);
    const far = autoscrollVelocity(160);
    expect(near).toBeGreaterThan(0);
    expect(far).toBeGreaterThan(near);
    expect(autoscrollVelocity(-40)).toBe(-near);
  });

  it('clamps to the maximum speed', () => {
    expect(autoscrollVelocity(100000)).toBe(AUTOSCROLL_TUNING.maxSpeed);
    expect(autoscrollVelocity(-100000)).toBe(-AUTOSCROLL_TUNING.maxSpeed);
  });

  it('treats non-finite offsets as still and rejects negative tuning', () => {
    expect(autoscrollVelocity(Number.NaN)).toBe(0);
    expect(autoscrollVelocity(Number.POSITIVE_INFINITY)).toBe(0);
    expect(() => autoscrollVelocity(50, { deadzone: -1, gain: 1, maxSpeed: 1 })).toThrow(RangeError);
  });
});

describe('Autoscroll', () => {
  it('ignores other buttons and pages that cannot scroll', () => {
    const frames = new Frames();
    expect(new Autoscroll(page(), new Indicator(), frames).pointerDown(0, 10, 10)).toBe(false);
    expect(new Autoscroll(page(800, 800), new Indicator(), frames).pointerDown(1, 10, 10)).toBe(false);
    expect(frames.queue.size).toBe(0);
  });

  it('click-to-toggle scrolls down smoothly by elapsed time and stops on the next click', () => {
    const frames = new Frames();
    const target = page();
    const indicator = new Indicator();
    const auto = new Autoscroll(target, indicator, frames);
    expect(auto.pointerDown(1, 300, 400)).toBe(true);
    auto.pointerUp(1);
    expect(auto.active).toBe(true);
    expect(indicator.shown).toEqual([[300, 400]]);
    auto.pointerMove(500);
    frames.run(0);
    frames.run(16);
    const afterOne = target.scrollTop;
    expect(afterOne).toBeGreaterThan(0);
    frames.run(32);
    expect(target.scrollTop).toBeGreaterThan(afterOne);
    expect(indicator.dirs[indicator.dirs.length - 1]).toBe(1);
    expect(auto.pointerDown(0, 0, 0)).toBe(true);
    expect(auto.active).toBe(false);
    expect(indicator.hidden).toBe(1);
    expect(frames.queue.size).toBe(0);
  });

  it('hold-and-drag stops on release', () => {
    const auto = new Autoscroll(page(), new Indicator(), new Frames());
    auto.pointerDown(1, 0, 400);
    auto.pointerMove(300);
    auto.pointerUp(1);
    expect(auto.active).toBe(false);
  });

  it('never scrolls past the top or bottom', () => {
    const frames = new Frames();
    const target = page(1000, 800);
    const auto = new Autoscroll(target, new Indicator(), frames);
    auto.pointerDown(1, 0, 400);
    auto.pointerMove(-5000);
    frames.run(0); frames.run(64);
    expect(target.scrollTop).toBe(0);
    auto.pointerMove(5000);
    for (let t = 80; t < 2000; t += 16) frames.run(t);
    expect(target.scrollTop).toBe(200);
  });

  it('caps a long frame gap so a stalled tab does not jump', () => {
    const frames = new Frames();
    const target = page(1000000, 800);
    const auto = new Autoscroll(target, new Indicator(), frames);
    auto.pointerDown(1, 0, 0);
    auto.pointerMove(100000);
    frames.run(0); frames.run(10000);
    expect(target.scrollTop).toBeLessThanOrEqual(Math.ceil(AUTOSCROLL_TUNING.maxSpeed * 0.064));
  });

  it('stop is idempotent', () => {
    const indicator = new Indicator();
    const auto = new Autoscroll(page(), indicator, new Frames());
    auto.stop();
    auto.pointerDown(1, 0, 0);
    auto.stop(); auto.stop();
    expect(indicator.hidden).toBe(1);
  });
});
