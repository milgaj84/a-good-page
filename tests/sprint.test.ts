import { describe, expect, it } from 'vitest';
import { SPRINT_KEY, SprintStore, ringGeometry, sprintProgress, type Sprint } from '../src/core/sprint';
import type { KeyValueStore } from '../src/core/ports';

function memory(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, get: (k) => data.get(k) ?? null, set: (k, v) => { data.set(k, v); }, remove: (k) => { data.delete(k); } };
}
const sprint: Sprint = { target: 500, baseline: 1200, docKey: 'doc:/book/a.md', startedAt: 1, celebrated: false };

describe('sprint progress', () => {
  it('counts only new words written since the sprint began', () => {
    expect(sprintProgress(sprint, 1450, 'doc:/book/a.md')).toEqual({ written: 250, target: 500, ratio: 0.5, reached: false, label: '250 of 500 new words' });
  });
  it('clamps at zero after deletions and at one after the target', () => {
    expect(sprintProgress(sprint, 900, 'doc:/book/a.md')!.ratio).toBe(0);
    const done = sprintProgress(sprint, 2000, 'doc:/book/a.md')!;
    expect(done.ratio).toBe(1);
    expect(done.reached).toBe(true);
    expect(done.written).toBe(800);
  });
  it('hides the ring for another document or without a sprint', () => {
    expect(sprintProgress(sprint, 2000, 'doc:/book/b.md')).toBeNull();
    expect(sprintProgress(null, 2000, 'doc:/book/a.md')).toBeNull();
  });
});

describe('ring geometry', () => {
  it('turns a ratio into an SVG stroke offset', () => {
    const empty = ringGeometry(0, 10);
    expect(empty.circumference).toBeCloseTo(62.832, 2);
    expect(empty.offset).toBeCloseTo(62.832, 2);
    expect(ringGeometry(0.25, 10).offset).toBeCloseTo(47.124, 2);
    expect(ringGeometry(1, 10).offset).toBe(0);
    expect(ringGeometry(7, 10).offset).toBe(0);
    expect(ringGeometry(Number.NaN, 10).offset).toBeCloseTo(62.832, 2);
  });
});

describe('SprintStore', () => {
  it('starts, persists and clears a sprint', () => {
    const s = memory();
    const store = new SprintStore(s, () => 42);
    expect(store.start(300, 1000, 'untitled')).toEqual({ target: 300, baseline: 1000, docKey: 'untitled', startedAt: 42, celebrated: false });
    expect(new SprintStore(s, () => 0).current?.target).toBe(300);
    expect(s.data.has(SPRINT_KEY)).toBe(true);
    store.clear();
    expect(store.current).toBeNull();
    expect(s.data.has(SPRINT_KEY)).toBe(false);
  });
  it('rejects targets that are not whole positive numbers of words', () => {
    const store = new SprintStore(memory(), () => 0);
    expect(() => store.start(0, 0, 'untitled')).toThrow();
    expect(() => store.start(-5, 0, 'untitled')).toThrow();
    expect(() => store.start(Number.NaN, 0, 'untitled')).toThrow();
    expect(() => store.start(100001, 0, 'untitled')).toThrow();
    expect(store.start(250.7, -3, 'untitled').target).toBe(250);
    expect(store.current!.baseline).toBe(0);
  });
  it('celebrates once per sprint, even across restarts', () => {
    const s = memory();
    const store = new SprintStore(s, () => 0);
    store.start(10, 0, 'untitled');
    expect(store.markCelebrated()).toBe(true);
    expect(store.markCelebrated()).toBe(false);
    expect(new SprintStore(s, () => 0).markCelebrated()).toBe(false);
  });
  it('ignores damaged saved data', () => {
    const s = memory();
    s.data.set(SPRINT_KEY, '{oops');
    expect(new SprintStore(s, () => 0).current).toBeNull();
    s.data.set(SPRINT_KEY, JSON.stringify({ target: 'many', baseline: 0, docKey: 'x', startedAt: 0 }));
    expect(new SprintStore(s, () => 0).current).toBeNull();
  });
});
