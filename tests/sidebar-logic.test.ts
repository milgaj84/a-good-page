import { describe, expect, it, vi } from 'vitest';
import { groupHits, rowTitle, splitMatches, treeKey, type NavItem } from '../src/ui/sidebar-logic';
import { Sidebar, type SidebarEvents, type SidebarRow } from '../src/ui/sidebar';

const items: NavItem[] = [
  { kind: 'project', expanded: true }, { kind: 'file' }, { kind: 'file' },
  { kind: 'project', expanded: false }, { kind: 'loose' },
];

describe('treeKey', () => {
  it('moves up and down, stopping at the ends', () => {
    expect(treeKey(items, 0, 'ArrowDown')).toEqual({ to: 1 });
    expect(treeKey(items, 0, 'ArrowUp')).toBeNull();
    expect(treeKey(items, 4, 'ArrowDown')).toBeNull();
    expect(treeKey(items, 2, 'Home')).toEqual({ to: 0 });
    expect(treeKey(items, 2, 'End')).toEqual({ to: 4 });
  });
  it('expands, enters, collapses and goes to the parent', () => {
    expect(treeKey(items, 3, 'ArrowRight')).toEqual({ toggle: true });
    expect(treeKey(items, 0, 'ArrowRight')).toEqual({ to: 1 });
    expect(treeKey(items, 0, 'ArrowLeft')).toEqual({ toggle: true });
    expect(treeKey(items, 3, 'ArrowLeft')).toBeNull();
    expect(treeKey(items, 2, 'ArrowLeft')).toEqual({ to: 0 });
    expect(treeKey(items, 4, 'ArrowLeft')).toBeNull();
  });
  it('Enter toggles projects and opens pages', () => {
    expect(treeKey(items, 0, 'Enter')).toEqual({ toggle: true });
    expect(treeKey(items, 1, 'Enter')).toEqual({ open: true });
    expect(treeKey(items, 4, ' ')).toEqual({ open: true });
  });
  it('copes with nothing focused and with an empty tree', () => {
    expect(treeKey(items, -1, 'ArrowDown')).toEqual({ to: 0 });
    expect(treeKey([], 0, 'ArrowDown')).toBeNull();
  });
});

describe('splitMatches', () => {
  it('marks every case-insensitive occurrence', () => {
    expect(splitMatches('The Rain in spain rains', 'rain')).toEqual([
      { text: 'The ', hit: false }, { text: 'Rain', hit: true }, { text: ' in spain ', hit: false }, { text: 'rain', hit: true }, { text: 's', hit: false },
    ]);
  });
  it('leaves text alone without a query and escapes regex characters', () => {
    expect(splitMatches('a b', '  ')).toEqual([{ text: 'a b', hit: false }]);
    expect(splitMatches('cost (a+b)', '(a+b)')).toEqual([{ text: 'cost ', hit: false }, { text: '(a+b)', hit: true }]);
  });
  it('falls back to single words when the phrase is not there', () => {
    expect(splitMatches('red and blue', 'blue red').filter(s => s.hit).map(s => s.text)).toEqual(['red', 'blue']);
  });
});

describe('groupHits and rowTitle', () => {
  it('puts snippets of one page under one title, keeping order', () => {
    const g = groupHits([
      { path: '/a', title: 'A', context: '1' }, { path: '/b', title: 'B', context: '2' }, { path: '/a', title: 'A', context: '3' },
    ]);
    expect(g.map(x => [x.title, x.hits.map(h => h.context)])).toEqual([['A', ['1', '3']], ['B', ['2']]]);
  });
  it('builds a hover title with the file name and the word count', () => {
    expect(rowTitle('file', 'A Letter', '03-a-letter', '1,204')).toBe('A Letter (file: 03-a-letter) · 1,204 words');
    expect(rowTitle('project', 'Novel', undefined, '3 pages')).toBe('Novel · 3 pages');
    expect(rowTitle('file', 'x', 'x', 'missing')).toBe('x · missing');
  });
});

function setup(rows: SidebarRow[], extra: Partial<SidebarEvents> = {}, hits: Parameters<Sidebar['render']>[0]['hits'] = []) {
  document.body.innerHTML = '<nav id="tree"></nav><input id="q" type="search" /><button class="side-search-clear" hidden></button>';
  const events: SidebarEvents = { open: vi.fn(), toggle: vi.fn(), menu: vi.fn(), add: vi.fn(), newProject: vi.fn(), moveInto: vi.fn(), select: vi.fn(), selectMode: vi.fn(), reorder: vi.fn(), query: vi.fn(), rename: vi.fn(), hit: vi.fn(), ...extra };
  const q = document.getElementById('q') as HTMLInputElement;
  const bar = new Sidebar({ tree: document.getElementById('tree')!, search: q }, events);
  bar.render({ rows, hits, renaming: null, empty: '', blank: false });
  return { bar, events, tree: document.getElementById('tree')!, q };
}
const rows: SidebarRow[] = [
  { path: '/P', kind: 'project', label: 'P', current: false, expanded: true },
  { path: '/P/a.md', kind: 'file', label: 'a', current: false, book: '/P', index: 0, meta: '12' },
  { path: '/P/b.md', kind: 'file', label: 'b', current: true, book: '/P', index: 1 },
];
const press = (el: Element, key: string, init: KeyboardEventInit = {}): void => { el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init })); };

describe('Sidebar keyboard and semantics', () => {
  it('has tree roles and exactly one tab stop, on the open page', () => {
    const t = setup(rows);
    expect(t.tree.querySelector('[role="tree"]')).not.toBeNull();
    const stops = Array.from(t.tree.querySelectorAll('[tabindex="0"]'));
    expect(stops.length).toBe(1);
    expect((stops[0] as HTMLElement).dataset.path).toBe('/P/b.md');
    expect(t.tree.querySelector('.row[data-kind="project"]')?.getAttribute('aria-expanded')).toBe('true');
    expect(t.tree.querySelector('.row[data-kind="file"]')?.getAttribute('aria-level')).toBe('2');
    t.tree.querySelectorAll<HTMLElement>('.row button').forEach(b => expect(b.tabIndex).toBe(-1));
  });
  it('moves with the arrows and opens with Enter', () => {
    const t = setup(rows);
    const els = Array.from(t.tree.querySelectorAll<HTMLElement>('.row'));
    els[1].focus();
    press(els[1], 'ArrowDown');
    expect(document.activeElement).toBe(els[2]);
    press(els[2], 'Enter');
    expect(t.events.open).toHaveBeenCalledWith(rows[2]);
    press(els[2], 'ArrowLeft');
    expect(document.activeElement).toBe(els[0]);
    press(els[0], 'Enter');
    expect(t.events.toggle).toHaveBeenCalledWith(rows[0]);
  });
  it('Alt+Up reorders, F2 renames, Delete trashes, falling back to the menu', () => {
    const startRename = vi.fn(); const trash = vi.fn();
    const t = setup(rows, { startRename, trash });
    const els = Array.from(t.tree.querySelectorAll<HTMLElement>('.row'));
    press(els[2], 'ArrowUp', { altKey: true });
    expect(t.events.reorder).toHaveBeenCalledWith('/P', '/P/b.md', 0);
    press(els[2], 'ArrowDown', { altKey: true });
    expect(t.events.reorder).toHaveBeenCalledTimes(1);
    press(els[1], 'F2');
    expect(startRename).toHaveBeenCalledWith(rows[1]);
    press(els[1], 'Delete');
    expect(trash).toHaveBeenCalledWith(rows[1]);
    const plain = setup(rows);
    press(plain.tree.querySelectorAll<HTMLElement>('.row')[1], 'Delete');
    expect(plain.events.menu).toHaveBeenCalled();
  });
  it('keeps focus on the same page when redrawn', () => {
    const t = setup(rows);
    const first = t.tree.querySelectorAll<HTMLElement>('.row')[1];
    first.focus();
    t.bar.render({ rows, hits: [], renaming: null, empty: '' });
    expect((document.activeElement as HTMLElement).dataset.path).toBe('/P/a.md');
  });
  it('Escape leaves selection mode', () => {
    const t = setup(rows);
    t.bar.render({ rows, hits: [], renaming: null, empty: '', selecting: true });
    press(t.tree.querySelector('.row')!, 'Escape');
    expect(t.events.selectMode).toHaveBeenCalled();
  });
});

describe('Sidebar search and rename', () => {
  it('highlights the term with mark elements, grouped under one page title', () => {
    const hits = [
      { path: '/P/a.md', book: '/P', title: 'A <b>', context: 'a Rain fell' }, { path: '/P/a.md', book: '/P', title: 'A <b>', context: 'more rain' },
    ];
    const t = setup(rows, {}, hits);
    t.bar.render({ rows: [], hits, renaming: null, empty: '', query: 'rain' });
    expect(t.tree.querySelectorAll('.search-group').length).toBe(1);
    expect(Array.from(t.tree.querySelectorAll('mark')).map(m => m.textContent)).toEqual(['Rain', 'rain']);
    expect(t.tree.querySelector('.search-title')?.textContent).toBe('A <b>');
    expect(t.tree.querySelector('.search-title b')).toBeNull();
  });
  it('shows No matches, clears with Escape and with the x button', () => {
    const t = setup(rows);
    t.bar.render({ rows: [], hits: [], renaming: null, empty: '' });
    expect(t.tree.querySelector('.tree-empty')?.textContent).toBe('No matches');
    t.q.value = 'hello';
    press(t.q, 'Escape');
    expect(t.q.value).toBe('');
    expect(t.events.query).toHaveBeenLastCalledWith('');
    t.q.value = 'x'; t.q.dispatchEvent(new Event('input'));
    const clear = document.querySelector('.side-search-clear') as HTMLButtonElement;
    expect(clear.hidden).toBe(false);
    clear.click();
    expect(t.q.value).toBe('');
    expect(clear.hidden).toBe(true);
  });
  it('does not commit a rename when focus moves to a menu', () => {
    const t = setup(rows);
    t.bar.render({ rows, hits: [], renaming: '/P/a.md', empty: '' });
    const input = t.tree.querySelector('.row-input') as HTMLInputElement;
    input.value = 'typed';
    const menu = document.createElement('div'); menu.className = 'menu'; const b = document.createElement('button'); menu.append(b); document.body.append(menu);
    input.dispatchEvent(new FocusEvent('blur', { relatedTarget: b }));
    expect(t.events.rename).not.toHaveBeenCalled();
    expect(t.tree.contains(input)).toBe(true);
    input.dispatchEvent(new FocusEvent('blur'));
    expect(t.events.rename).toHaveBeenCalledWith(rows[1], 'typed');
  });
});
