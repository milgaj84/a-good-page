import { describe, expect, it, vi } from 'vitest';
import { ExportPicker, PICKS_KEY } from '../src/ui/export-picker';

function setup() {
  document.body.innerHTML = '<details id="r"><summary id="s"></summary><button id="all"></button><button id="none"></button><div id="l"></div></details>';
  const changed = vi.fn();
  const picker = new ExportPicker({ root: document.getElementById('r')!, summary: document.getElementById('s')!, list: document.getElementById('l')!,
    all: document.getElementById('all')!, none: document.getElementById('none')! }, changed);
  const pages = [{ path: 'a.md', label: 'A', words: 100 }, { path: 'b.md', label: 'B', words: 250 }, { path: 'c.md', label: 'C', words: 50 }];
  const boxes = () => Array.from(document.querySelectorAll<HTMLInputElement>('input[type=checkbox]'));
  return { picker, changed, pages, boxes, summary: () => document.getElementById('s')!.textContent };
}

describe('Export page picker', () => {
  it('starts with every page ticked and says how much is included', () => {
    const t = setup();
    t.picker.setPages('P', t.pages);
    expect(t.picker.selected()).toEqual(['a.md', 'b.md', 'c.md']);
    expect(t.summary()).toBe('3 of 3 pages · 400 words');
    expect(t.boxes().every(b => b.checked)).toBe(true);
  });
  it('lets you tick some pages, and keeps them in project order', () => {
    const t = setup();
    t.picker.setPages('P', t.pages);
    t.boxes()[0].click();
    t.boxes()[2].click();
    expect(t.picker.selected()).toEqual(['b.md']);
    expect(t.summary()).toBe('1 of 3 pages · 250 words');
    expect(t.changed).toHaveBeenCalledTimes(2);
  });
  it('All and None change everything at once', () => {
    const t = setup();
    t.picker.setPages('P', t.pages);
    document.getElementById('none')!.click();
    expect(t.picker.selected()).toEqual([]);
    expect(t.boxes().some(b => b.checked)).toBe(false);
    document.getElementById('all')!.click();
    expect(t.picker.selected()).toHaveLength(3);
    expect(t.changed).toHaveBeenCalledTimes(2);
  });
  it('keeps the same project\'s ticks when pages reload, and restores another project\'s later', () => {
    const t = setup();
    t.picker.setPages('P', t.pages);
    t.boxes()[1].click();
    t.picker.setPages('P', t.pages);
    expect(t.picker.selected()).toEqual(['a.md', 'c.md']);
    t.picker.setPages('Q', [{ path: 'x.md', label: 'X', words: 5 }]);
    expect(t.picker.selected()).toEqual(['x.md']);
    t.picker.setPages('P', t.pages);
    expect(t.picker.selected()).toEqual(['a.md', 'c.md']);
  });
  it('drops pages that no longer exist, and can be hidden', () => {
    const t = setup();
    t.picker.setPages('P', t.pages);
    t.picker.setPages('P', t.pages.slice(0, 2));
    expect(t.picker.selected()).toEqual(['a.md', 'b.md']);
    t.picker.show(false);
    expect(document.getElementById('r')!.hidden).toBe(true);
  });
});

describe('Export page picker memory and presets', () => {
  const store = () => { const m = new Map<string, string>(); return { m, api: { get: (k: string) => m.get(k) ?? null, set: (k: string, v: string) => { m.set(k, v); }, remove: (k: string) => { m.delete(k); } } }; };
  const build = (s: ReturnType<typeof store>['api']) => {
    document.body.innerHTML = '<details id="r"><summary id="s"></summary><button id="all"></button><button id="none"></button><div id="l"></div></details>';
    return new ExportPicker({ root: document.getElementById('r')!, summary: document.getElementById('s')!, list: document.getElementById('l')!, all: document.getElementById('all')!, none: document.getElementById('none')! }, () => undefined, s);
  };
  const pages = [{ path: 'a.md', label: 'A', words: 1 }, { path: 'b.md', label: 'B', words: 2 }, { path: 'c.md', label: 'C', words: 3 }];
  it('remembers a project\'s ticks across restarts', () => {
    const s = store();
    const first = build(s.api);
    first.setPages('/lib/P', pages);
    first.choose(['a.md', 'c.md']);
    expect(JSON.parse(s.m.get(PICKS_KEY)!)['/lib/P']).toEqual(['a.md', 'c.md']);
    const second = build(s.api);
    second.setPages('/lib/P', pages);
    expect(second.selected()).toEqual(['a.md', 'c.md']);
  });
  it('ticks exactly the pages it is told to, ignoring pages that are not there', () => {
    const picker = build(store().api);
    picker.setPages('P', pages);
    picker.choose(['b.md', 'zzz.md']);
    expect(picker.selected()).toEqual(['b.md']);
  });
  it('survives damaged storage and keeps only the latest projects', () => {
    const s = store();
    s.m.set(PICKS_KEY, '{nope');
    const picker = build(s.api);
    picker.setPages('P', pages);
    expect(picker.selected()).toHaveLength(3);
    for (let i = 0; i < 40; i++) { picker.setPages('P' + i, pages); picker.choose(['a.md']); }
    expect(Object.keys(JSON.parse(s.m.get(PICKS_KEY)!)).length).toBeLessThanOrEqual(30);
  });
});
