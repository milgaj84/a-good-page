import { describe, expect, it } from 'vitest';
import { GoalTracker, goalProgress } from '../src/core/goal';

describe('goalProgress', () => {
  it('is null when there is no valid goal', () => {
    expect(goalProgress(10, 0)).toBeNull();
    expect(goalProgress(10, -1)).toBeNull();
    expect(goalProgress(10, Number.NaN)).toBeNull();
    expect(goalProgress(10, 0.5)).toBeNull();
  });

  it('reports zero progress for an empty page', () => {
    expect(goalProgress(0, 100)).toEqual({ ratio: 0, reached: false, label: '0 / 100' });
  });

  it('treats negative word counts as zero', () => {
    expect(goalProgress(-5, 100)?.ratio).toBe(0);
  });

  it('reports partial progress', () => {
    expect(goalProgress(50, 100)?.ratio).toBe(0.5);
  });

  it('caps the ratio at 1 and marks the goal reached', () => {
    expect(goalProgress(150, 100)).toEqual({ ratio: 1, reached: true, label: '150 / 100' });
    expect(goalProgress(100, 100)?.reached).toBe(true);
  });

  it('formats large numbers', () => {
    expect(goalProgress(1234, 2000)?.label).toBe('1,234 / 2,000');
  });
});

describe('GoalTracker', () => {
  it('celebrates once when the goal is first reached', () => {
    const tracker = new GoalTracker();
    tracker.reset(goalProgress(10, 100));
    expect(tracker.check(goalProgress(99, 100))).toBe(false);
    expect(tracker.check(goalProgress(100, 100))).toBe(true);
    expect(tracker.check(goalProgress(120, 100))).toBe(false);
  });

  it('stays quiet for documents already past the goal', () => {
    const tracker = new GoalTracker();
    tracker.reset(goalProgress(500, 100));
    expect(tracker.check(goalProgress(501, 100))).toBe(false);
  });

  it('does not re-celebrate after deleting and retyping', () => {
    const tracker = new GoalTracker();
    tracker.reset(null);
    expect(tracker.check(goalProgress(100, 100))).toBe(true);
    expect(tracker.check(goalProgress(99, 100))).toBe(false);
    expect(tracker.check(goalProgress(100, 100))).toBe(false);
  });

  it('ignores missing goals', () => {
    const tracker = new GoalTracker();
    expect(tracker.check(null)).toBe(false);
  });
});
