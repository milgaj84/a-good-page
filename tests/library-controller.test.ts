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
  const trashed: Array<{ item: string; name: string; original: string; position: number | null; trashed_at: number; is_dir: boolean }> = [];
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
    trash: async (_root: string, path: string, position?: number) => {
      const item = '/lib/.trash/' + (trashed.length + 1) + '/' + path.split('/').pop();
      files.set(item, files.get(path)!); files.delete(path);
      trashed.push({ item, name: path.split('/').pop()!, original: path.slice('/lib/'.length), position: position ?? null, trashed_at: 1, is_dir: false });
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
    writeGuarded: async (path: string, content: string, expected: string) => { if (files.get(path) !== expected) throw new Error('changed'); files.set(path, content); },
    pickFolder: async () => null,
    move: async (_root: string, path: string, to: string | null) => {
      const dest = to ?? '/lib'; const name = path.split('/').pop()!; let target = `${dest}/${name}`; let i = 2;
      while (files.has(target)) target = `${dest}/${name.replace(/\.md$/, '')} ${i++}.md`;
      files.set(target, files.get(path)!); files.delete(path); if (dest !== '/lib') dirs.add(dest); return target;
    },
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
    expect(t.last().rows[1]).toMatchObject({ kind: 'file', book: '/lib/Novel', index: 0 });
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
    await t.controller.trash('/lib/Novel/02.md', 'file', '02');
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
    expect(t.last().rows.filter(r => r.kind === 'file').map(r => r.label)).toEqual(['03', '01', '02']);
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
    const rows = t.last().rows.filter(r => r.kind === 'file');
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
    await t.controller.trash('/lib/Novel/02.md', 'file', '02');
    const items = await t.controller.trashItems();
    expect(items.map(i => i.original)).toEqual(['Novel/02.md']);
    await t.controller.restore(items[0]);
    expect(t.files.get('/lib/Novel/02.md')).toBe('# Two');
    expect(t.session.path).toBe('/lib/Novel/02.md');
    expect(await t.controller.trashItems()).toEqual([]);
  });
});

describe('projects', () => {
  it('starts a project with one page and opens it, ready to name', async () => {
    const t = fixture();
    await t.controller.start();
    expect(t.last().blank).toBe(true);
    await t.controller.newProject();
    expect([...t.dirs]).toContain('/lib/New project');
    expect(t.files.has('/lib/New project/Untitled.md')).toBe(true);
    expect(t.session.path).toBe('/lib/New project/Untitled.md');
    expect(t.last().blank).toBe(false);
    expect(t.views.length).toBeGreaterThan(0);
    expect(t.last().renaming).toBe('/lib/New project');
  });

  it('puts the first-run Welcome page inside a Getting started project', async () => {
    const t = fixture();
    await t.controller.start();
    const path = await t.controller.welcomeIfNew();
    expect(path).toBe('/lib/Getting started/Welcome to A Good Page.md');
  });

  it('moves a page into a project, out again, and keeps the open page open', async () => {
    const t = fixture({ '/lib/Draft.md': 'words', '/lib/Novel/01.md': '# One' });
    await t.controller.start();
    await t.controller.open('/lib/Draft.md');
    await t.controller.moveTo('/lib/Draft.md', 'loose', '/lib/Novel', 'Draft');
    expect(t.files.get('/lib/Novel/Draft.md')).toBe('words');
    expect(t.session.path).toBe('/lib/Novel/Draft.md');
    expect(t.moves).toContainEqual(['/lib/Draft.md', '/lib/Novel/Draft.md']);
    await t.controller.moveTo('/lib/Novel/Draft.md', 'file', null, 'Draft');
    expect(t.files.get('/lib/Draft.md')).toBe('words');
    expect(t.session.path).toBe('/lib/Draft.md');
  });

  it('offers other projects, and Unfiled for a page that is in one, in a page\'s menu', async () => {
    const t = fixture({ '/lib/A/01.md': '# a', '/lib/B/01.md': '# b', '/lib/Loose.md': 'x' });
    await t.controller.start();
    await t.controller.toggleBook('/lib/A');
    const open = (t as unknown as { controller: { d: { menu: { open: ReturnType<typeof vi.fn> } } } }).controller.d.menu.open;
    const row = t.last().rows.find(r => r.kind === 'file')!;
    t.controller.rowMenu(row, document.createElement('button'));
    const labels = (open.mock.calls[0][0] as Array<{ label: string }>).map(i => i.label);
    expect(labels).toContain('B');
    expect(labels).not.toContain('A');
    expect(labels).toContain('Unfiled pages');
  });
});

describe('choosing the Library folder', () => {
  it('remembers folders used before, newest first, and switches to one', async () => {
    const t = fixture({ '/lib/A.md': 'a' });
    await t.controller.start();
    expect(t.controller.recentFolders()).toEqual(['/lib']);
    t.files.set('/lib2/Novel/01.md', '# One');
    t.dirs.add('/lib2'); t.dirs.add('/lib2/Novel');
    await t.controller.useFolder('/lib2');
    expect(t.controller.root).toBe('/lib2');
    expect(t.controller.recentFolders()).toEqual(['/lib2', '/lib']);
    expect(t.last().rows.map(r => r.label)).toContain('Novel');
    expect(t.session.path).toBe('/lib2/Novel/01.md');
  });

  it('does nothing when asked for the folder it already uses, and never creates a page when the new folder is empty', async () => {
    const t = fixture({ '/lib/A.md': 'a' });
    await t.controller.start();
    await t.controller.useFolder('/lib');
    expect(t.views).toHaveLength(1);
    t.dirs.add('/empty');
    await t.controller.useFolder('/empty');
    expect(t.controller.root).toBe('/empty');
    expect(t.last().blank).toBe(true);
    expect([...t.files.keys()].filter(k => k.startsWith('/empty'))).toEqual([]);
  });

  it('opens a menu offering another folder, recent ones and the default', async () => {
    const t = fixture();
    await t.controller.start();
    t.files.set('/other/x.md', 'x'); t.dirs.add('/other');
    await t.controller.useFolder('/other');
    const open = (t as unknown as { controller: { d: { menu: { open: ReturnType<typeof vi.fn> } } } }).controller.d.menu.open;
    t.controller.libraryMenu(document.createElement('button'));
    const labels = (open.mock.calls.at(-1)![0] as Array<{ label: string }>).map(i => i.label);
    expect(labels).toContain('Choose another folder…');
    expect(labels).toContain('lib');
    expect(labels).toContain('Use the default folder');
    expect(labels).not.toContain('other');
  });
});

describe('exporting from the panel', () => {
  it('offers Export project on a project and Export this page on a page', async () => {
    const t = fixture({ '/lib/A/01.md': '# a', '/lib/Loose.md': 'x' });
    await t.controller.start();
    await t.controller.toggleBook('/lib/A');
    const open = (t as unknown as { controller: { d: { menu: { open: ReturnType<typeof vi.fn> } } } }).controller.d.menu.open;
    const labelsFor = (row: SidebarRow) => { t.controller.rowMenu(row, document.createElement('button')); return (open.mock.calls.at(-1)![0] as Array<{ label: string }>).map(i => i.label); };
    expect(labelsFor(t.last().rows.find(r => r.kind === 'project')!)).toContain('Export project…');
    expect(labelsFor(t.last().rows.find(r => r.kind === 'file')!)).toContain('Export this page…');
    expect(labelsFor(t.last().rows.find(r => r.kind === 'loose')!)).toContain('Export this page…');
  });

  it('prepares any project for export, not only the one that is open', async () => {
    const t = fixture({ '/lib/A/01.md': '# a', '/lib/B/01.md': '# b\n\nbee', '/lib/B/02.md': '# b2' });
    await t.controller.start();
    await t.controller.open('/lib/A/01.md');
    const info = await t.controller.bookForExport('/lib/B');
    expect(info?.title).toBe('B');
    expect(info?.service.chapters.map(c => c.path)).toEqual(['01.md', '02.md']);
    expect((await t.controller.bookForExport())?.title).toBe('A');
  });
});

describe('restoring and moving to the right place', () => {
  it('puts a restored page back at the position it had', async () => {
    const t = fixture({ '/lib/Novel/01.md': '# One', '/lib/Novel/02.md': '# Two', '/lib/Novel/03.md': '# Three' });
    await t.controller.start();
    await t.controller.toggleBook('/lib/Novel');
    await t.controller.trash('/lib/Novel/02.md', 'file', '02');
    expect((await t.controller.trashItems())[0].position).toBe(1);
    t.undos[0].run();
    await new Promise(r => setTimeout(r, 0));
    expect(JSON.parse(t.files.get('/lib/Novel/.a-good-page.json')!).chapters).toEqual(['01.md', '02.md', '03.md']);
  });

  it('drops a page into a project at a chosen place, and onto a project at the end', async () => {
    const t = fixture({ '/lib/A/01.md': '# a1', '/lib/A/02.md': '# a2', '/lib/B/x.md': '# x', '/lib/Loose.md': 'words' });
    await t.controller.start();
    await t.controller.toggleBook('/lib/A');
    await t.controller.toggleBook('/lib/B');
    const row = t.last().rows.find(r => r.label === 'x')!;
    await t.controller.moveInto(row, '/lib/A', 1);
    expect(JSON.parse(t.files.get('/lib/A/.a-good-page.json')!).chapters).toEqual(['01.md', 'x.md', '02.md']);
    const loose = t.last().rows.find(r => r.kind === 'loose')!;
    await t.controller.moveInto(loose, '/lib/A');
    expect(JSON.parse(t.files.get('/lib/A/.a-good-page.json')!).chapters.at(-1)).toBe('Loose.md');
  });
});

describe('selecting several pages', () => {
  const setupSel = async () => {
    const t = fixture({ '/lib/A/01.md': '# a1', '/lib/A/02.md': '# a2', '/lib/A/03.md': '# a3', '/lib/B/x.md': '# x', '/lib/Loose.md': 'words' });
    const bars: Array<[number, boolean]> = [];
    (t.controller as unknown as { d: { selectionChanged: (n: number, s: boolean) => void } }).d.selectionChanged = (n, s) => { bars.push([n, s]); };
    await t.controller.start();
    await t.controller.toggleBook('/lib/A');
    await t.controller.toggleBook('/lib/B');
    return { t, bars };
  };

  it('ticks single pages and whole projects, and shows partial ticks', async () => {
    const { t, bars } = await setupSel();
    t.controller.toggleSelectMode();
    expect(t.last().selecting).toBe(true);
    await t.controller.toggleSelected(t.last().rows.find(r => r.label === '01')!);
    expect(t.last().rows.find(r => r.kind === 'project' && r.label === 'A')).toMatchObject({ partial: true, selected: false });
    await t.controller.toggleSelected(t.last().rows.find(r => r.kind === 'project' && r.label === 'A')!);
    expect(t.last().rows.find(r => r.kind === 'project' && r.label === 'A')).toMatchObject({ selected: true, partial: false });
    expect(t.controller.selectionCount).toBe(3);
    await t.controller.toggleSelected(t.last().rows.find(r => r.kind === 'project' && r.label === 'A')!);
    expect(t.controller.selectionCount).toBe(0);
    expect(bars.at(-1)).toEqual([0, true]);
    expect(t.controller.endSelect()).toBe(true);
    expect(t.controller.endSelect()).toBe(false);
  });

  it('moves the ticked pages into a project in one go', async () => {
    const { t } = await setupSel();
    t.controller.toggleSelectMode();
    await t.controller.toggleSelected(t.last().rows.find(r => r.kind === 'loose')!);
    await t.controller.toggleSelected(t.last().rows.find(r => r.label === 'x')!);
    await t.controller.moveSelected('/lib/A');
    expect(t.files.has('/lib/A/Loose.md')).toBe(true);
    expect(t.files.has('/lib/A/x.md')).toBe(true);
    expect(t.controller.selectionCount).toBe(0);
  });

  it('trashes the ticked pages together with one Undo that restores them in place', async () => {
    const { t } = await setupSel();
    t.controller.toggleSelectMode();
    await t.controller.toggleSelected(t.last().rows.find(r => r.label === '01')!);
    await t.controller.toggleSelected(t.last().rows.find(r => r.label === '03')!);
    await t.controller.trashSelected();
    expect(t.files.has('/lib/A/01.md')).toBe(false);
    expect(t.files.has('/lib/A/03.md')).toBe(false);
    expect(t.undos).toHaveLength(1);
    expect(t.undos[0].message).toBe('Moved 2 pages to the trash.');
    t.undos[0].run();
    await new Promise(r => setTimeout(r, 20));
    expect(JSON.parse(t.files.get('/lib/A/.a-good-page.json')!).chapters).toEqual(['01.md', '02.md', '03.md']);
  });

  it('hands pages of one project to Export, and refuses a mix', async () => {
    const { t } = await setupSel();
    const calls: Array<[string, string[]]> = [];
    (t.controller as unknown as { d: { exportSelection: (p: string, pages: string[]) => void } }).d.exportSelection = (p, pages) => { calls.push([p, pages]); };
    t.controller.toggleSelectMode();
    await t.controller.toggleSelected(t.last().rows.find(r => r.label === '01')!);
    await t.controller.toggleSelected(t.last().rows.find(r => r.label === '03')!);
    t.controller.exportSelected();
    expect(calls).toEqual([['/lib/A', ['01.md', '03.md']]]);
    expect(t.controller.isSelecting).toBe(false);
    t.controller.toggleSelectMode();
    await t.controller.toggleSelected(t.last().rows.find(r => r.label === '01')!);
    await t.controller.toggleSelected(t.last().rows.find(r => r.label === 'x')!);
    t.controller.exportSelected();
    expect(calls).toHaveLength(1);
    expect(t.notes.at(-1)).toContain('one project');
  });
});

describe('Library-wide search and the welcome guide', () => {
  it('finds text in unfiled pages as well as in projects', async () => {
    const t = fixture({ '/lib/A/01.md': '# One\n\nThe fog came in.', '/lib/Loose.md': '# Loose\n\nFog on the hill.' });
    await t.controller.start();
    await t.controller.search('fog');
    expect(t.last().hits.map(h => h.title).sort()).toEqual(['01', 'Loose']);
    expect(t.last().hits.find(h => h.title === 'Loose')?.book).toBeNull();
  });

  it('shows the welcome guide again, reusing an existing one and never overwriting your edits', async () => {
    const t = fixture();
    await t.controller.start();
    await t.controller.openWelcome();
    expect(t.session.path).toBe('/lib/Getting started/Welcome to A Good Page.md');
    expect(t.files.get(t.session.path!)).toContain('Projects and pages');
    t.files.set(t.session.path!, 'my own notes');
    await t.controller.openWelcome();
    expect(t.files.get('/lib/Getting started/Welcome to A Good Page.md')).toBe('my own notes');
    expect([...t.dirs].filter(d => d.includes('Getting started'))).toHaveLength(1);
  });
});

describe('finding and replacing in many pages', () => {
  const seed = { '/lib/A/01.md': '# One\n\nThe fog came.', '/lib/A/02.md': '# Two\n\nSunny.', '/lib/B/x.md': '# X\n\nMore fog.', '/lib/Loose.md': 'fog on the hill' };

  it('reads the open project, or the whole Library with unfiled pages, fresh from disk', async () => {
    const t = fixture(seed);
    await t.controller.start();
    await t.controller.open('/lib/A/01.md');
    expect((await t.controller.filesForSearch('project')).map(f => f.group + '/' + f.label)).toEqual(['A/01', 'A/02']);
    const all = await t.controller.filesForSearch('library');
    expect(all.map(f => f.label).sort()).toEqual(['01', '02', 'Loose', 'X']);
    expect(all.find(f => f.label === 'Loose')?.group).toBe('Unfiled');
    t.files.set('/lib/A/02.md', '# Two\n\nStormy fog.');
    expect((await t.controller.filesForSearch('project')).find(f => f.label === '02')?.text).toContain('Stormy');
  });

  it('writes a replaced page only if it is still as it was searched', async () => {
    const t = fixture(seed);
    await t.controller.start();
    expect(await t.controller.writeReplaced('/lib/B/x.md', '# X\n\nMore mist.', '# X\n\nMore fog.')).toBe(true);
    expect(t.files.get('/lib/B/x.md')).toBe('# X\n\nMore mist.');
    t.files.set('/lib/Loose.md', 'someone else edited this');
    expect(await t.controller.writeReplaced('/lib/Loose.md', 'mist on the hill', 'fog on the hill')).toBe(false);
    expect(t.files.get('/lib/Loose.md')).toBe('someone else edited this');
  });

  it('refreshes what the sidebar shows after a bulk edit', async () => {
    const t = fixture(seed);
    await t.controller.start();
    await t.controller.search('fog');
    expect(t.last().hits.length).toBeGreaterThan(0);
    t.files.set('/lib/Loose.md', 'mist on the hill');
    await t.controller.afterBulkEdit();
    await t.controller.search('fog');
    expect(t.last().hits.map(h => h.title)).not.toContain('Loose');
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
