import { describe, expect, it } from 'vitest';
import { WritingSession } from '../src/core/writing-session';
describe('timed writing session', () => {
  it('starts at zero and counts only newly written words', () => {
    let now = 1000; const session = new WritingSession({ now: () => now });
    expect(session.start(10, 100, 900).wordsWritten).toBe(0);
    now += 61_000;
    expect(session.snapshot(940)).toMatchObject({ elapsedSeconds: 61, remainingSeconds: 539, wordsWritten: 40, progress: 0.4 });
  });
  it('finishes at the duration even if the timer was throttled', () => {
    let now = 0; const session = new WritingSession({ now: () => now });
    session.start(1, 0, 0); now = 90_000;
    expect(session.snapshot(12)).toMatchObject({ remainingSeconds: 0, wordsWritten: 12, finished: true });
    expect(session.active).toBe(false);
  });
  it('returns no second summary after a timer expires or a manual stop', () => {
    let now = 0; const session = new WritingSession({ now: () => now });
    session.start(1, 0, 0); now = 61_000;
    expect(session.snapshot(4)?.finished).toBe(true);
    expect(session.stop(4)).toBeNull();
    session.start(5, 0, 0);
    expect(session.stop(2)?.wordsWritten).toBe(2);
    expect(session.stop(3)).toBeNull();
  });
  it('counts a sleep interval but never rewinds after a clock correction', () => {
    let now = 100_000; const session = new WritingSession({ now: () => now });
    session.start(10, 100, 10);
    now += 5 * 60_000;
    expect(session.snapshot(20)?.remainingSeconds).toBe(300);
    now -= 2 * 60_000;
    expect(session.snapshot(20)?.remainingSeconds).toBe(300);
    now += 10 * 60_000;
    expect(session.snapshot(20)?.finished).toBe(true);
  });
  it('provides a manual-stop summary and never reports negative words', () => {
    const session = new WritingSession({ now: () => 0 });
    session.start(5, 10, 20);
    expect(session.stop(3)).toMatchObject({ wordsWritten: 0, finished: false });
    session.clear(); expect(session.snapshot(3)).toBeNull();
  });
  it('rejects invalid durations, goals and counts', () => {
    const s = new WritingSession({ now: () => 0 });
    for (const n of [0, -1, 181, 1.5, NaN]) expect(() => s.start(n, 0, 0)).toThrow(RangeError);
    for (const n of [-1, 1_000_001, Infinity]) expect(() => s.start(1, n, 0)).toThrow(RangeError);
    expect(() => s.start(1, 0, -1)).toThrow(RangeError);
  });
});
