import { describe, expect, it, vi } from 'vitest';
import { Sidebar, type SidebarEvents, type SidebarRow } from '../src/ui/sidebar';

function setup(rows: SidebarRow[], renaming: string | null = null) {
  document.body.innerHTML = '<nav id="tree"></nav><input id="q" type="search" />';
  const events: SidebarEvents = { open: vi.fn(), toggle: vi.fn(), menu: vi.fn(), add: vi.fn(), newProject: vi.fn(), reorder: vi.fn(), query: vi.fn(), rename: vi.fn(), hit: vi.fn() };
  const bar = new Sidebar({ tree: document.getElementById('tree')!, search: document.getElementById('q') as HTMLInputElement }, events);
  bar.render({ rows, hits: [], renaming, empty: 'Nothing yet.', blank: false });
  return { bar, events, tree: document.getElementById('tree')! };
}
const chapters = (): SidebarRow[] => ['a', 'b', 'c', 'd'].map((n, i) => ({ path: '/lib/B/' + n + '.md', kind: 'file', label: n, current: false, book: '/lib/B', index: i }));

describe('Sidebar renaming with a nicer label', () => {
  it('edits the file name, not the heading shown', () => {
    const row: SidebarRow = { path: '/lib/B/03-a-letter.md', kind: 'file', label: 'A Letter', fileName: '03-a-letter', current: false, book: '/lib/B', index: 0 };
    const t = setup([row], row.path);
    const input = t.tree.querySelector('.row-input') as HTMLInputElement;
    expect(input.value).toBe('03-a-letter');
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(t.events.rename).toHaveBeenCalledWith(row, '');
  });
});

describe('Sidebar while naming', () => {
  it('keeps the name field and what was typed when the tree is redrawn', () => {
    const rows: SidebarRow[] = [{ path: '/lib/P', kind: 'project', label: 'New project', current: false, expanded: true }];
    const t = setup(rows, '/lib/P');
    const input = t.tree.querySelector('.row-input') as HTMLInputElement;
    input.value = 'Poe';
    t.bar.render({ rows, hits: [], renaming: '/lib/P', empty: '', blank: false });
    const again = t.tree.querySelector('.row-input') as HTMLInputElement;
    expect(again.value).toBe('Poe');
    expect(document.activeElement).toBe(again);
    expect(t.events.rename).not.toHaveBeenCalled();
  });
});

describe('Sidebar sections', () => {
  const rows: SidebarRow[] = [
    { path: '/lib/P', kind: 'project', label: 'P', current: false, expanded: true, meta: '1 page' },
    { path: '/lib/P/a.md', kind: 'file', label: 'a', current: false, book: '/lib/P', index: 0 },
    { path: '/lib/x.md', kind: 'loose', label: 'x', current: false },
  ];
  it('shows Projects, then Unfiled pages, each with its own heading', () => {
    const t = setup(rows);
    const headings = Array.from(t.tree.querySelectorAll('.tree-heading')).map(h => h.textContent?.trim());
    expect(headings[0]).toContain('Projects');
    expect(headings).toContain('Unfiled pages');
    expect(t.tree.querySelector('.row[data-kind="project"] .row-icon')).not.toBeNull();
  });
  it('has a + on a project to add a page, and a + beside Projects to start one', () => {
    const t = setup(rows);
    (t.tree.querySelector('.row[data-kind="project"] .row-btn.add') as HTMLElement).click();
    expect(t.events.add).toHaveBeenCalledWith(rows[0]);
    (t.tree.querySelector('.tree-add') as HTMLElement).click();
    expect(t.events.newProject).toHaveBeenCalled();
    expect(t.tree.querySelector('.row[data-kind="file"] .row-btn.add')).toBeNull();
  });
  it('shows a welcome with one clear next step when the Library is empty', () => {
    document.body.innerHTML = '<nav id="tree"></nav><input id="q" type="search" />';
    const events = { open: vi.fn(), toggle: vi.fn(), menu: vi.fn(), add: vi.fn(), newProject: vi.fn(), reorder: vi.fn(), query: vi.fn(), rename: vi.fn(), hit: vi.fn() } as SidebarEvents;
    const bar = new Sidebar({ tree: document.getElementById('tree')!, search: document.getElementById('q') as HTMLInputElement }, events);
    bar.render({ rows: [], hits: [], renaming: null, empty: '', blank: true });
    const button = document.querySelector('.tree-welcome button') as HTMLElement;
    expect(button.textContent).toContain('first project');
    button.click();
    expect(events.newProject).toHaveBeenCalled();
  });
});

describe('Sidebar', () => {
  it('shows a friendly line when there is nothing to list', () => {
    expect(setup([]).tree.textContent).toContain('Nothing yet.');
  });
  it('opens a page and toggles a project on click', () => {
    const t = setup([{ path: '/lib/B', kind: 'project', label: 'B', current: false, expanded: false }, { path: '/lib/p.md', kind: 'loose', label: 'p', current: false }]);
    (t.tree.querySelectorAll('.open')[0] as HTMLElement).click();
    (t.tree.querySelectorAll('.open')[1] as HTMLElement).click();
    expect(t.events.toggle).toHaveBeenCalledTimes(1);
    expect(t.events.open).toHaveBeenCalledTimes(1);
  });
  it('offers row actions from a button that is always reachable by keyboard', () => {
    const t = setup(chapters());
    const more = t.tree.querySelector('.more') as HTMLButtonElement;
    expect(more.getAttribute('aria-label')).toContain('Actions for');
    more.click();
    expect(t.events.menu).toHaveBeenCalled();
  });
  it('commits a rename on Enter, and cancels on Escape', () => {
    const rows = chapters();
    const t = setup(rows, rows[1].path);
    const input = t.tree.querySelector('.row-input') as HTMLInputElement;
    input.value = 'bee';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(t.events.rename).toHaveBeenCalledWith(rows[1], 'bee');
    const again = setup(rows, rows[1].path);
    (again.tree.querySelector('.row-input') as HTMLInputElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(again.events.rename).toHaveBeenCalledWith(rows[1], '');
  });
  it('turns a drop into the right final position', () => {
    const rows = chapters();
    const t = setup(rows);
    const els = Array.from(t.tree.querySelectorAll<HTMLElement>('.row'));
    const drag = (from: number, onto: number, after: boolean): void => {
      els[from].dispatchEvent(new Event('dragstart', { bubbles: true }));
      els[onto].getBoundingClientRect = () => ({ top: 0, height: 20, bottom: 20, left: 0, right: 0, width: 0, x: 0, y: 0, toJSON: () => ({}) });
      const over = new Event('dragover', { bubbles: true, cancelable: true }) as Event & { clientY: number };
      over.clientY = after ? 15 : 3;
      els[onto].dispatchEvent(over);
      els[onto].dispatchEvent(new Event('drop', { bubbles: true, cancelable: true }));
    };
    drag(0, 2, false); // a before c  -> b a c d
    expect(t.events.reorder).toHaveBeenLastCalledWith('/lib/B', rows[0].path, 1);
    drag(3, 0, false); // d before a  -> d a b c
    expect(t.events.reorder).toHaveBeenLastCalledWith('/lib/B', rows[3].path, 0);
    drag(1, 2, true); // b after c -> a c b d
    expect(t.events.reorder).toHaveBeenLastCalledWith('/lib/B', rows[1].path, 2);
  });
  it('does not reorder when dropped where it already is', () => {
    const rows = chapters();
    const t = setup(rows);
    const els = Array.from(t.tree.querySelectorAll<HTMLElement>('.row'));
    els[1].dispatchEvent(new Event('dragstart', { bubbles: true }));
    els[2].getBoundingClientRect = () => ({ top: 0, height: 20, bottom: 20, left: 0, right: 0, width: 0, x: 0, y: 0, toJSON: () => ({}) });
    const over = new Event('dragover', { bubbles: true, cancelable: true }) as Event & { clientY: number };
    over.clientY = 3;
    els[2].dispatchEvent(over);
    els[2].dispatchEvent(new Event('drop', { bubbles: true, cancelable: true }));
    expect(t.events.reorder).not.toHaveBeenCalled();
  });
});
