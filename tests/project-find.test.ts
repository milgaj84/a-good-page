import { describe, expect, it, vi } from 'vitest';
import { ProjectFind, type ProjectFindDeps } from '../src/ui/project-find';

function setup(files = [
  { path: '/lib/A/1.md', label: 'One', group: 'A', text: 'The fog came. More fog.' },
  { path: '/lib/A/2.md', label: 'Two', group: 'A', text: 'Clear.' },
  { path: '/lib/B/3.md', label: 'Three', group: 'B', text: 'Fog again' },
], inProject = true) {
  document.body.innerHTML = `<div id="r"><input id="q" type="search"><input id="rep"><input id="c" type="checkbox"><input id="w" type="checkbox">
    <select id="s"><option value="project">p</option><option value="library">l</option></select><div id="res"></div><p id="sum"></p>
    <button id="do"></button><button id="all"></button><button id="none"></button><button id="close"></button></div>`;
  const apply = vi.fn(async (edits: Array<{ path: string }>) => ({ changed: edits.length, skipped: [] as string[] }));
  const load = vi.fn(async () => files);
  const deps: ProjectFindDeps = { load, apply: apply as unknown as ProjectFindDeps['apply'], inProject: () => inProject };
  const g = (id: string) => document.getElementById(id)!;
  const pf = new ProjectFind({ root: g('r'), query: g('q') as HTMLInputElement, replacement: g('rep') as HTMLInputElement, matchCase: g('c') as HTMLInputElement,
    wholeWord: g('w') as HTMLInputElement, scope: g('s') as HTMLSelectElement, results: g('res'), summary: g('sum'), replace: g('do') as HTMLButtonElement,
    all: g('all'), none: g('none'), close: g('close') }, deps);
  const type = (value: string) => { (g('q') as HTMLInputElement).value = value; g('q').dispatchEvent(new Event('input')); };
  return { pf, g, apply, load, type, boxes: () => Array.from(document.querySelectorAll<HTMLInputElement>('#res .pf-match input')) };
}

describe('Find and replace in many pages', () => {
  it('lists matches grouped by page, all ticked, with a count', async () => {
    vi.useFakeTimers();
    const t = setup();
    await t.pf.open();
    t.type('fog');
    vi.advanceTimersByTime(300);
    expect(document.querySelectorAll('.pf-group')).toHaveLength(2);
    expect(t.boxes()).toHaveLength(3);
    expect(t.boxes().every(b => b.checked)).toBe(true);
    expect(t.g('sum').textContent).toBe('3 of 3 matches ticked in 2 pages');
    expect(t.g('do').textContent).toBe('Replace 3');
    vi.useRealTimers();
  });

  it('shows what would change, and replaces only what is ticked', async () => {
    vi.useFakeTimers();
    const t = setup();
    await t.pf.open();
    t.type('fog');
    vi.advanceTimersByTime(300);
    (t.g('rep') as HTMLInputElement).value = 'mist';
    t.g('rep').dispatchEvent(new Event('input'));
    expect(document.querySelector('.pf-match ins')?.textContent).toBe('mist');
    expect(document.querySelector('.pf-match del')?.textContent).toBe('fog');
    t.boxes()[1].click();
    expect(t.g('do').textContent).toBe('Replace 2');
    t.g('do').click();
    await vi.advanceTimersByTimeAsync(10);
    expect(t.apply).toHaveBeenCalledTimes(1);
    const edits = t.apply.mock.calls[0][0] as Array<{ path: string; newText: string; count: number }>;
    expect(edits.map(e => [e.path, e.count, e.newText])).toEqual([['/lib/A/1.md', 1, 'The mist came. More fog.'], ['/lib/B/3.md', 1, 'mist again']]);
    vi.useRealTimers();
  });

  it('ticks a whole page at once, and Tick none / Tick all', async () => {
    vi.useFakeTimers();
    const t = setup();
    await t.pf.open();
    t.type('fog');
    vi.advanceTimersByTime(300);
    (document.querySelector('.pf-head input') as HTMLInputElement).click();
    expect(t.boxes().map(b => b.checked)).toEqual([false, false, true]);
    t.g('none').click();
    expect(t.g('do').hasAttribute('disabled')).toBe(true);
    t.g('all').click();
    expect(t.boxes().every(b => b.checked)).toBe(true);
    vi.useRealTimers();
  });

  it('says so when nothing is found, and offers the whole Library outside a project', async () => {
    vi.useFakeTimers();
    const t = setup(undefined, false);
    await t.pf.open();
    expect((t.g('s') as HTMLSelectElement).value).toBe('library');
    expect((t.g('s').querySelector('option[value="project"]') as HTMLOptionElement).disabled).toBe(true);
    t.type('zzz');
    vi.advanceTimersByTime(300);
    expect(t.g('sum').textContent).toContain('Nothing found');
    vi.useRealTimers();
  });

  it('reports pages that changed elsewhere instead of overwriting them', async () => {
    vi.useFakeTimers();
    const t = setup();
    t.apply.mockResolvedValueOnce({ changed: 1, skipped: ['Three'] });
    await t.pf.open('fog');
    vi.advanceTimersByTime(300);
    t.g('do').click();
    await vi.advanceTimersByTimeAsync(10);
    expect(t.g('sum').textContent).toContain('Replaced in 1 page.');
    expect(t.g('sum').textContent).toContain('Three');
    vi.useRealTimers();
  });
});
