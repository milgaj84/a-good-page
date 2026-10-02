import { describe, expect, it, vi } from 'vitest';
import { LibraryController, LIBRARY_KEY, type LibraryDeps } from '../src/app/library';
import type { SidebarRow, SidebarView } from '../src/ui/sidebar';

/** An in-memory Library, a stand-in session and a recording sidebar: the controller's rules without a window. */
function fixture(seed: Record<string, string> = {}) {
  const files = new Map(Object.entries(seed));
  const dirs = new Set<string>(['/lib']);
  for (const p of files.keys()) { const d = p.slice(0, p.lastIndexOf('/')); if (d !== '/lib') dirs.add(d); }
  const parent = (p: string): string => p.slice(0, p.lastIndexOf('/'));
  const kv = new Map<string, string>([[LIBRARY_KEY, '/lib']]);
  const session = { path: null as string | null, name: 'Untitled', dirty: false, markdown: '' };
  const views: SidebarView[] = [];
  const notes: string[] = [];
  const moves: Array<[string, string]> = [];
  const trashed: Array<{ item: string; name: string; original: string; trashed_at: number; is_dir: boolean }> = [];
  const undos: Array<{ message: string; run: () => void }> = [];
  const doc = {
    snapshot: () => ({ path: session.path, name: session.name, state: 'saved' as const }),
    get isDirty() { return session.dirty; },
    save: async () => true,
    settleWrites: async () => undefined,
    adoptRenamedPath: (path: string) => { session.path = path; session.name = path.split('/').pop()!.replace(/\.md$/, ''); },
    openWorkspacePath: async (_root: string, path: string, read: (r: string, p: string) => Promise<{ content: string }>) => {
      const opened = await read('/lib', path); session.path = path; session.name = path.split('/').pop()!.replace(/\.md$/, ''); session.markdown = opened.content; return true;
    },
  };
  const io = {
    defaultLibrary: async () => '/lib',
    list: async (root: string, folder?: string) => {
      const dir = folder ?? root;
      const entries = [
        ...[...dirs].filter(d => d !== dir && parent(d) === dir && !d.includes('/.')).map(d => ({ name: d.split('/').pop()!, path: d, is_dir: true })),
        ...[...files.keys()].filter(f => parent(f) === dir && f.endsWith('.md')).map(f => ({ name: f.split('/').pop()!, path: f, is_dir: false })),
      ];
      return { root, directory: dir, entries };
    },
    open: async (_r: string, path: string) => { if (!files.has(path)) throw new Error('missing'); return { path, name: path, content: files.get(path)! }; },
    order: async (root: string) => files.get(root + '/.a-good-page.json') ?? null,
    saveOrder: async (root: string, _e: string | null, value: string) => { files.set(root + '/.a-good-page.json', value); return value; },
    create: async (_root: string, par: string | null, name: string, kind: 'file' | 'folder') => {
      const dir = par ?? '/lib'; let n = name; let i = 2;
      const make = (x: string) => (kind === 'file' ? `${dir}/${x}.md` : `${dir}/${x}`);
      while (files.has(make(n)) || dirs.has(make(n))) n = `${name} ${i++}`;
      if (kind === 'file') files.set(make(n), ''); else dirs.add(make(n));
      return make(n);
    },
    rename: async (_root: string, path: string, name: string) => {
      const to = `${parent(path)}/${name}${path.endsWith('.md') ? '.md' : ''}`;
      if (files.has(to) && to !== path) throw new Error('Something with that name already exists here.');
      files.set(to, files.get(path)!); if (to !== path) files.delete(path); return to;
    },
    trash: async (_root: string, path: string) => {
      const item = '/lib/.trash/1/' + path.split('/').pop();
      files.set(item, files.get(path)!); files.delete(path);
      trashed.push({ item, name: path.split('/').pop()!, original: path.slice('/lib/'.length), trashed_at: 1, is_dir: false });
      return item;
    },
    listTrash: async () => [...trashed],
    restore: async (_root: string, item: string) => {
      const entry = trashed.find(t => t.item === item)!;
      const to = '/lib/' + entry.original;
      files.set(to, files.get(item)!); files.delete(item); trashed.splice(trashed.indexOf(entry), 1);
      const d = parent(to); if (d !== '/lib') dirs.add(d);
      return to;
    },
    write: async (path: string, content: string) => { files.set(path, content); },
    pickFolder: async () => null,
  };
  const deps = {
    store: { get: (k: string) => kv.get(k) ?? null, set: (k: string, v: string) => { kv.set(k, v); }, remove: (k: string) => { kv.delete(k); } },
    doc, io,
    sidebar: { render: (v: SidebarView) => { views.push(v); } },
    menu: { open: vi.fn() },
    offerUndo: (message: string, _label: string, run: () => void) => { undos.push({ message, run }); },
    notify: (m: string) => { notes.push(m); },
    markdown: () => session.markdown,
    jumpToPhrase: () => undefined, focusEditor: () => undefined, flushAutosave: () => undefined, words: () => 0, changed: () => undefined,
    moved: (from: string, to: string) => { moves.push([from, to]); },
  } as unknown as LibraryDeps;
  const controller = new LibraryController(deps);
  return { controller, files, dirs, session, views, notes, moves, undos, last: () => views[views.length - 1] };
}

describe('Library controller', () => {
  it('lists books and pages, and shows a book\'s chapters once it is opened', async () => {
    const t = fixture({ '/lib/Novel/01.md': '# One', '/lib/Novel/02.md': '# Two', '/lib/Loose.md': 'words' });
    await t.controller.start();
    expect(t.last().rows.map(r => r.label)).toEqual(['Novel', 'Loose']);
    await t.controller.toggleBook('/lib/Novel');
    expect(t.last().rows.map(r => r.label)).toEqual(['Novel', '01', '02', 'Loose']);
    expect(t.last().rows[1]).toMatchObject({ kind: 'chapter', book: '/lib/Novel', index: 0 });
  });

  it('creates a page in the book that is open, otherwise in the Library', async () => {
    const t = fixture({ '/lib/Novel/01.md': '# One' });
    await t.controller.start();
    await t.controller.newPage();
    expect(t.files.has('/lib/Untitled.md')).toBe(true);
    await t.controller.open('/lib/Novel/01.md');
    await t.controller.newPage();
    expect(t.files.has('/lib/Novel/Untitled.md')).toBe(true);
    expect(t.session.path).toBe('/lib/Novel/Untitled.md');
  });

  it('names a new page from its first words, once, and keeps its place in a book', async () => {
    const t = fixture({ '/lib/Novel/01.md': '# One' });
    await t.controller.start();
    await t.controller.open('/lib/Novel/01.md');
    await t.controller.newPage();
    t.session.markdown = '# The Harbour\n\nBoats.';
    await t.controller.maybeAutoRename();
    expect(t.session.path).toBe('/lib/Novel/The Harbour.md');
    expect(t.files.has('/lib/Novel/Untitled.md')).toBe(false);
    expect(JSON.parse(t.files.get('/lib/Novel/.a-good-page.json')!).chapters).toEqual(['01.md', 'The Harbour.md']);
    t.session.markdown = '# Something else entirely';
    await t.controller.maybeAutoRename();
    expect(t.session.path).toBe('/lib/Novel/The Harbour.md');
  });

  it('never renames a page the writer named, and ignores empty pages', async () => {
    const t = fixture({ '/lib/Mine.md': '# Different' });
    await t.controller.start();
    await t.controller.open('/lib/Mine.md');
    t.session.markdown = '# Different';
    await t.controller.maybeAutoRename();
    expect(t.session.path).toBe('/lib/Mine.md');
    await t.controller.newPage();
    t.session.markdown = '   ';
    await t.controller.maybeAutoRename();
    expect(t.session.path).toBe('/lib/Untitled.md');
  });

  it('reports a rename that would overwrite instead of clobbering', async () => {
    const t = fixture({ '/lib/A.md': 'a', '/lib/B.md': 'b' });
    await t.controller.start();
    await t.controller.open('/lib/A.md');
    await t.controller.renameCurrent('B');
    expect(t.session.path).toBe('/lib/A.md');
    expect(t.notes.join(' ')).toContain('already exists');
    expect(t.files.get('/lib/B.md')).toBe('b');
  });

  it('moves a chapter to the trash at once, lands on its neighbour, and offers Undo', async () => {
    const t = fixture({ '/lib/Novel/01.md': '# One', '/lib/Novel/02.md': '# Two', '/lib/Novel/03.md': '# Three' });
    await t.controller.start();
    await t.controller.open('/lib/Novel/02.md');
    await t.controller.trash('/lib/Novel/02.md', 'chapter', '02');
    expect(t.files.has('/lib/Novel/02.md')).toBe(false);
    expect(t.files.has('/lib/.trash/1/02.md')).toBe(true);
    expect(t.session.path).toBe('/lib/Novel/03.md');
    expect(JSON.parse(t.files.get('/lib/Novel/.a-good-page.json')!).chapters).toEqual(['01.md', '03.md']);
    expect(t.undos).toHaveLength(1);
    expect(t.undos[0].message).toContain('02');
    t.undos[0].run();
    await new Promise(r => setTimeout(r, 0));
    expect(t.files.get('/lib/Novel/02.md')).toBe('# Two');
    expect(t.session.path).toBe('/lib/Novel/02.md');
  });

  it('reorders chapters and keeps the order on disk', async () => {
    const t = fixture({ '/lib/Novel/01.md': '# One', '/lib/Novel/02.md': '# Two', '/lib/Novel/03.md': '# Three' });
    await t.controller.start();
    await t.controller.toggleBook('/lib/Novel');
    await t.controller.reorder('/lib/Novel', '/lib/Novel/03.md', 0);
    expect(t.last().rows.filter(r => r.kind === 'chapter').map(r => r.label)).toEqual(['03', '01', '02']);
    expect(JSON.parse(t.files.get('/lib/Novel/.a-good-page.json')!).chapters).toEqual(['03.md', '01.md', '02.md']);
  });

  it('creates a welcome page only on the very first launch', async () => {
    const t = fixture();
    await t.controller.start();
    const path = await t.controller.welcomeIfNew();
    expect(path).toContain('Welcome');
    expect(t.files.get(path!)).toContain('This is your Library');
    expect(await t.controller.welcomeIfNew()).toBeNull();
  });

  it('searches names and text of opened books', async () => {
    const t = fixture({ '/lib/Novel/01.md': '# One\n\nThe fog came in.', '/lib/Novel/02.md': '# Two\n\nSunny.' });
    await t.controller.start();
    await t.controller.search('fog');
    expect(t.last().hits.map(h => h.title)).toEqual(['01']);
    await t.controller.search('zzz');
    expect(t.last().rows).toHaveLength(0);
    expect(t.last().empty).toContain('zzz');
  });

  it('offers pages and chapters to the go-to box, current book first', async () => {
    const t = fixture({ '/lib/Novel/01.md': '# One', '/lib/Loose.md': 'x' });
    await t.controller.start();
    await t.controller.toggleBook('/lib/Novel');
    const labels = t.controller.places('o').map(e => e.label);
    expect(labels).toContain('01');
    expect(labels).toContain('Loose');
  });
});

describe('names and the next chapter', () => {
  it('shows a heading-style name for files named after their heading, and keeps other names', async () => {
    const t = fixture({ '/lib/Novel/03-a-letter-unsent.md': '# A Letter Unsent\n\nx', '/lib/Novel/02.md': '# Two\n\nx' });
    await t.controller.start();
    await t.controller.toggleBook('/lib/Novel');
    const rows = t.last().rows.filter(r => r.kind === 'chapter');
    expect(rows.map(r => r.label)).toEqual(['02', 'A Letter Unsent']);
    expect(rows.map(r => r.fileName)).toEqual(['02', '03-a-letter-unsent']);
  });

  it('finds the chapter after the open one, and none at the end or for loose pages', async () => {
    const t = fixture({ '/lib/Novel/01.md': '# One', '/lib/Novel/02.md': '# Two', '/lib/Loose.md': 'x' });
    await t.controller.start();
    const go = async (path: string) => { await t.controller.open(path); await t.controller.documentLoaded(); };
    await go('/lib/Novel/01.md');
    expect(t.controller.nextChapter()).toEqual({ path: '/lib/Novel/02.md', label: '02' });
    await go('/lib/Novel/02.md');
    expect(t.controller.nextChapter()).toBeNull();
    await go('/lib/Loose.md');
    expect(t.controller.nextChapter()).toBeNull();
  });
});

describe('sidebar rows', () => {
  it('marks only the open page as current', async () => {
    const t = fixture({ '/lib/A.md': 'a', '/lib/B.md': 'b' });
    await t.controller.start();
    await t.controller.open('/lib/B.md');
    const rows: readonly SidebarRow[] = t.last().rows;
    expect(rows.filter(r => r.current).map(r => r.label)).toEqual(['B']);
  });
});

describe('history and the trash', () => {
  it('tells History about every rename, so versions follow the file', async () => {
    const t = fixture({ '/lib/A.md': 'a', '/lib/Novel/01.md': '# One' });
    await t.controller.start();
    await t.controller.open('/lib/A.md');
    await t.controller.renameCurrent('Alpha');
    expect(t.moves).toEqual([['/lib/A.md', '/lib/Alpha.md']]);
    await t.controller.newPage();
    t.session.markdown = '# Fresh start';
    await t.controller.maybeAutoRename();
    expect(t.moves[t.moves.length - 1]).toEqual(['/lib/Untitled.md', '/lib/Fresh start.md']);
  });

  it('restores a trashed chapter to its book and opens it', async () => {
    const t = fixture({ '/lib/Novel/01.md': '# One', '/lib/Novel/02.md': '# Two' });
    await t.controller.start();
    await t.controller.open('/lib/Novel/01.md');
    await t.controller.trash('/lib/Novel/02.md', 'chapter', '02');
    const items = await t.controller.trashItems();
    expect(items.map(i => i.original)).toEqual(['Novel/02.md']);
    await t.controller.restore(items[0]);
    expect(t.files.get('/lib/Novel/02.md')).toBe('# Two');
    expect(t.session.path).toBe('/lib/Novel/02.md');
    expect(await t.controller.trashItems()).toEqual([]);
  });
});

describe('older untitled drafts', () => {
  it('become real pages instead of staying without a file', async () => {
    const t = fixture();
    await t.controller.start();
    const path = await t.controller.rescueDraft('Words I had not saved.');
    expect(t.files.get(path!)).toBe('Words I had not saved.');
    expect(await t.controller.rescueDraft('   ')).toBeNull();
  });
});
