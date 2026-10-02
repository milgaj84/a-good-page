import { describe, expect, it } from 'vitest';
import { ViewMemory, VIEW_KEY } from '../src/core/view-memory';
import { displayName } from '../src/core/library';

const memory = () => { const m = new Map<string, string>(); return { m, store: { get: (k: string) => m.get(k) ?? null, set: (k: string, v: string) => { m.set(k, v); }, remove: (k: string) => { m.delete(k); } } }; };

describe('where you were on a page', () => {
  it('remembers the caret and scroll position per page', () => {
    const { store } = memory();
    const v = new ViewMemory(store);
    v.set('/lib/A.md', { caret: 120, scroll: 900.7 }, 1);
    expect(v.get('/lib/A.md')).toEqual({ caret: 120, scroll: 900 });
    expect(v.get('/lib/B.md')).toBeNull();
    expect(v.get(null)).toBeNull();
  });
  it('keeps only the most recently used pages', () => {
    const { store } = memory();
    const v = new ViewMemory(store);
    for (let i = 0; i < 80; i++) v.set('/lib/' + i + '.md', { caret: i, scroll: 0 }, i);
    expect(v.get('/lib/0.md')).toBeNull();
    expect(v.get('/lib/79.md')).toEqual({ caret: 79, scroll: 0 });
  });
  it('follows a rename, for a page or a whole book', () => {
    const { store } = memory();
    const v = new ViewMemory(store);
    v.set('/lib/A.md', { caret: 5, scroll: 1 }, 1);
    v.set('/lib/Novel/01.md', { caret: 9, scroll: 2 }, 2);
    v.move('/lib/A.md', '/lib/Alpha.md');
    v.move('/lib/Novel', '/lib/Saga');
    expect(v.get('/lib/Alpha.md')).toEqual({ caret: 5, scroll: 1 });
    expect(v.get('/lib/A.md')).toBeNull();
    expect(v.get('/lib/Saga/01.md')).toEqual({ caret: 9, scroll: 2 });
  });
  it('survives damaged storage', () => {
    const { m, store } = memory();
    m.set(VIEW_KEY, '{nope');
    expect(new ViewMemory(store).get('/lib/A.md')).toBeNull();
    m.set(VIEW_KEY, JSON.stringify({ '/lib/A.md': { caret: 'x', scroll: 1 } }));
    expect(new ViewMemory(store).get('/lib/A.md')).toBeNull();
  });
});

describe('display names', () => {
  it('shows the heading when the file is named after it', () => {
    expect(displayName('03-a-letter-unsent', 'A Letter Unsent')).toBe('A Letter Unsent');
    expect(displayName('Harbour Lights', 'Harbour Lights')).toBe('Harbour Lights');
    expect(displayName('chapter-1', 'Chapter 1')).toBe('Chapter 1');
  });
  it('keeps the writer\'s own file name when it says something different', () => {
    expect(displayName('01', 'One')).toBe('01');
    expect(displayName('Field Notes', 'Loose Notes')).toBe('Field Notes');
    expect(displayName('Untitled', null)).toBe('Untitled');
    expect(displayName('Draft', '   ')).toBe('Draft');
    expect(displayName('2024', '2024')).toBe('2024');
  });
});
