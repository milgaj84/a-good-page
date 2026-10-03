import type { DocumentSession, OpenedDocument } from '../core/session';
import type { KeyValueStore } from '../core/ports';
import type { FolderListing } from '../core/quick-switch';
import type { PaletteEntry } from '../core/palette';
import { ProjectService, type ProjectPorts } from '../core/project-service';
import { chapterInfo, searchProject, type ProjectFile } from '../core/project';
import type { SearchFile } from '../core/project-replace';
import { nameFromPath } from '../core/paths';
import { WELCOME_TEXT, WELCOME_TITLE, autoRenameTarget, bookOf, displayName, filterRows, joinPath, parentOf, relativeTo, rootRows, type TreeRow } from '../core/library';
import { importDocx, type DocxParts } from '../import/docx';
import { mapLimit } from '../core/concurrency';
import { friendly } from '../core/friendly';
import type { Menu, MenuItem } from '../ui/menu';
import type { TrashItem } from '../adapters/tauri';
import type { SearchHit, Sidebar, SidebarRow } from '../ui/sidebar';

export const LIBRARY_KEY = 'agp.library.v1';
const EXPANDED_KEY = 'agp.library.open.v1';
const WELCOMED_KEY = 'agp.welcomed.v1';
const RECENT_KEY = 'agp.library.recent.v1';

export interface LibraryDeps {
  store: KeyValueStore;
  doc: DocumentSession;
  sidebar: Sidebar;
  menu: Menu;
  io: {
    defaultLibrary(): Promise<string>;
    list(root: string, folder?: string): Promise<FolderListing>;
    open(root: string, path: string): Promise<OpenedDocument>;
    order: ProjectPorts['order'];
    saveOrder: ProjectPorts['saveOrder'];
    create(root: string, parent: string | null, name: string, kind: 'file' | 'folder'): Promise<string>;
    rename(root: string, path: string, name: string): Promise<string>;
    trash(root: string, path: string, position?: number): Promise<string>;
    write(path: string, content: string): Promise<unknown>;
    /** Saves only if the file still holds `expected`; throws if it changed meanwhile. */
    writeGuarded(path: string, content: string, expected: string): Promise<unknown>;
    pickFolder(): Promise<string | null>;
    /** The Library Rust remembers, if any. */
    current(): Promise<string | null>;
    /** Carry over a Library an older version remembered; Rust asks you to confirm it. */
    adopt(path: string): Promise<string>;
    /** Switch to a Library used before. */
    use(path: string): Promise<string>;
    move(root: string, path: string, to: string | null): Promise<string>;
    listTrash(root: string): Promise<TrashItem[]>;
    restore(root: string, path: string): Promise<string>;
    pickWord(): Promise<string | null>;
    readWord(path: string): Promise<DocxParts>;
    importFolder(root: string): Promise<{ project: string; pages: number; skipped: string[]; converted: string[] } | null>;
  };
  /** A toast with one button, used to undo moving something to the trash. */
  offerUndo(message: string, label: string, run: () => void): void;
  notify(message: string): void;
  markdown(): string;
  jumpToPhrase(phrase: string): void;
  focusEditor(): void;
  flushAutosave(): void;
  /** Words in the open page, for the sidebar's live count. */
  words(): number;
  changed(): void;
  /** A page or book changed path (rename), so anything keyed by path can follow. */
  moved(from: string, to: string): void;
  /** Opens the PDF preview for a whole project, or for one page (opening it first). */
  exportProject?(path: string): void;
  exportPage?(path: string): void;
  /** Export only these pages (paths inside the project) of one project. */
  exportSelection?(project: string, pages: string[]): void;
  /** Selection mode on or off, and how many pages are ticked, so the action bar can follow. */
  selectionChanged?(count: number, selecting: boolean): void;
  /** Called after every redraw of the tree, so things that depend on it (the next-chapter link) can follow. */
  rendered?(): void;
}

const message = friendly;

/** What Word held that comes across as nothing: said plainly so no one wonders where it went. */
function skippedNote(book: { pictures: number; footnotes?: number; comments?: number }): string {
  const plural = (n: number, word: string): string => n + ' ' + word + (n === 1 ? '' : 's');
  const parts = [book.pictures && plural(book.pictures, 'picture'), book.footnotes && plural(book.footnotes, 'footnote'), book.comments && plural(book.comments, 'comment')].filter(Boolean);
  return parts.length ? ' ' + parts.join(', ') + ' not imported.' : '';
}

/** The size of a project beside its name: its words ("26k words"), or its pages while it has none. Short, so the name stays readable. */
export function projectMeta(chapters: ReadonlyArray<{ file: { words: number } | null }>): string {
  const words = chapters.reduce((sum, c) => sum + (c.file?.words ?? 0), 0);
  if (!words) return chapters.length + (chapters.length === 1 ? ' page' : ' pages');
  return (words >= 10_000 ? Math.round(words / 1000) + 'k' : words.toLocaleString()) + ' words';
}
const stem = (path: string): string => nameFromPath(path);

/** Owns the Library: what is on disk, what the sidebar shows, and every create / rename / move / delete. */
export class LibraryController {
  root: string | null = null;
  private rows: TreeRow[] = [];
  private readonly books = new Map<string, ProjectService>();
  private expanded: Set<string>;
  private renaming: string | null = null;
  private query = '';
  private selecting = false;
  private readonly selected = new Set<string>();
  private readonly looseText = new Map<string, string>();
  private searchStamp = 0;
  private renamingBusy = false;
  private focusAfterRename = false;

  constructor(private readonly d: LibraryDeps) {
    let saved: string[] = [];
    try { saved = JSON.parse(d.store.get(EXPANDED_KEY) ?? '[]'); } catch { saved = []; }
    this.expanded = new Set(Array.isArray(saved) ? saved.filter(x => typeof x === 'string') : []);
  }

  private ports(): ProjectPorts {
    return { list: this.d.io.list, read: this.d.io.open, order: this.d.io.order, saveOrder: this.d.io.saveOrder };
  }

  /** Finds (or creates) the Library folder and draws the sidebar. Safe to call again after a folder change. */
  async start(): Promise<void> {
    // The program, not the page, remembers which folder is your Library. An older version kept it in the page:
    // that is carried over once, after Rust asks you to confirm it.
    let root: string | null = await this.d.io.current().catch(() => null);
    if (!root) {
      const legacy = this.d.store.get(LIBRARY_KEY);
      if (legacy) root = await this.d.io.adopt(legacy).catch(() => null);
    }
    try {
      if (!root) throw new Error('none');
      root = (await this.d.io.list(root)).root;
    } catch {
      root = await this.d.io.defaultLibrary();
      root = (await this.d.io.list(root)).root;
    }
    this.root = root;
    this.d.store.set(LIBRARY_KEY, root);
    this.rememberFolder(root);
    await this.refresh();
    this.d.changed();
  }

  /** First launch only: a short, real page that teaches by being read. Returns its path if it was created. */
  async welcomeIfNew(): Promise<string | null> {
    if (!this.root || this.d.store.get(WELCOMED_KEY) || this.rows.length) return null;
    const project = await this.d.io.create(this.root, null, 'Getting started', 'folder');
    const path = await this.d.io.create(this.root, project, WELCOME_TITLE, 'file');
    await this.d.io.write(path, WELCOME_TEXT);
    // Only once the guide really exists is it counted as shown, so a failure tries again next launch.
    this.d.store.set(WELCOMED_KEY, '1');
    this.expanded.add(project);
    await this.refresh();
    return path;
  }

  /** An unsaved untitled draft from an older version becomes a real page, so no words are left without a file. */
  async rescueDraft(content: string): Promise<string | null> {
    if (!this.root || !content.trim()) return null;
    const path = await this.d.io.create(this.root, null, 'Recovered draft', 'file');
    await this.d.io.write(path, content);
    await this.refresh();
    return path;
  }

  /** Libraries used before, newest first, for quick switching. */
  recentFolders(): string[] {
    try {
      const data: unknown = JSON.parse(this.d.store.get(RECENT_KEY) ?? '[]');
      return Array.isArray(data) ? data.filter((x): x is string => typeof x === 'string' && x.length > 0).slice(0, 6) : [];
    } catch { return []; }
  }

  private rememberFolder(path: string): void {
    this.d.store.set(RECENT_KEY, JSON.stringify([path, ...this.recentFolders().filter(p => p !== path)].slice(0, 6)));
  }

  /** Asks for a folder and makes it the Library. */
  /** Shows the Welcome guide again, creating it (and its project) if it is gone. Never overwrites a page you edited. */
  async openWelcome(): Promise<void> {
    if (!this.root) return;
    try {
      let project = this.rows.find(r => r.kind === 'project' && r.name === 'Getting started')?.path;
      if (!project) project = await this.d.io.create(this.root, null, 'Getting started', 'folder');
      const service = this.books.get(project) ?? await this.loadBook(project);
      const entry = service?.chapters.find(c => stem(c.path) === WELCOME_TITLE);
      let path: string;
      if (entry) path = this.chapterPath(project, entry.path);
      else { path = await this.d.io.create(this.root, project, WELCOME_TITLE, 'file'); await this.d.io.write(path, WELCOME_TEXT); }
      this.expanded.add(project);
      await this.refresh();
      await this.open(path);
    } catch (error) { this.d.notify('Could not open the guide: ' + message(error)); }
  }

  async changeFolder(): Promise<void> {
    const picked = await this.d.io.pickFolder();
    if (picked) await this.useFolder(picked);
  }

  /** Makes a folder the Library: saves what is open, shows the new folder, and opens its first page if it has one. */
  async useFolder(picked: string): Promise<void> {
    if (picked === this.root) return;
    picked = await this.d.io.use(picked);
    this.d.flushAutosave();
    if (this.d.doc.isDirty) { await this.d.doc.save(); await this.d.doc.settleWrites(); }
    this.d.store.set(LIBRARY_KEY, picked);
    this.books.clear();
    this.expanded.clear();
    this.renaming = null;
    this.query = '';
    await this.start();
    this.d.notify('Library is now ' + this.root);
    await this.openFirstIfAny();
  }

  /** The default Library folder (Documents/A Good Page), created if needed. */
  async useDefaultFolder(): Promise<void> { await this.useFolder(await this.d.io.defaultLibrary()); }

  /** After switching Library: open a page from it rather than leaving the old one on screen. Never creates anything. */
  async openFirstIfAny(): Promise<boolean> {
    const loose = this.rows.find(r => r.kind === 'loose');
    for (const row of this.rows) {
      if (row.kind !== 'project') continue;
      const service = this.books.get(row.path) ?? await this.loadBook(row.path);
      const entry = service?.chapters.find(c => c.file);
      if (service && entry) return this.open(this.chapterPath(row.path, entry.path));
    }
    return loose ? this.open(loose.path) : false;
  }

  /** The menu on the Library heading: where your writing lives, and a quick way to change it. */
  libraryMenu(anchor: HTMLElement): void {
    const short = (path: string): string => path.split(/[\\/]/).filter(Boolean).slice(-2).join('/');
    const items: MenuItem[] = [
      { heading: true, label: this.root ? 'In ' + short(this.root) : 'No Library yet' },
      { label: 'Choose another folder…', run: () => void this.changeFolder() },
    ];
    const others = this.recentFolders().filter(p => p !== this.root).slice(0, 4);
    if (others.length) {
      items.push({ separator: true, label: '' }, { heading: true, label: 'Recent' });
      for (const path of others) items.push({ label: short(path), run: () => void this.useFolder(path).catch(error => this.d.notify('Could not open that folder: ' + message(error))) });
    }
    items.push({ separator: true, label: '' }, { label: 'Use the default folder', run: () => void this.useDefaultFolder() });
    this.d.menu.open(items, anchor.getBoundingClientRect(), anchor);
  }

  // ---------- reading ----------
  async refresh(): Promise<void> {
    if (!this.root) return;
    try {
      this.rows = rootRows((await this.d.io.list(this.root)).entries);
    } catch (error) {
      this.d.notify('Could not read your Library: ' + message(error));
      return;
    }
    const current = this.d.doc.snapshot().path;
    const home = current && this.root ? bookOf(this.root, current) : null;
    if (home) this.expanded.add(home);
    for (const key of [...this.books.keys()]) if (!this.rows.some(r => r.path === key)) this.books.delete(key);
    await Promise.all(this.rows.filter(r => r.kind === 'project' && this.expanded.has(r.path)).map(r => this.loadBook(r.path)));
    this.render();
  }

  private async loadBook(path: string): Promise<ProjectService | null> {
    try {
      const service = new ProjectService(this.ports());
      await service.open(path);
      this.books.set(path, service);
      return service;
    } catch (error) {
      this.d.notify('Could not open that project: ' + message(error));
      return null;
    }
  }

  currentBook(): string | null {
    const path = this.d.doc.snapshot().path;
    return path && this.root ? bookOf(this.root, path) : null;
  }

  private chapterPath(book: string, rel: string): string { return joinPath(this.books.get(book)?.path ?? book, rel); }

  /** Re-draws the tree and the match list from what is already loaded; no disk reads. */
  render(): void {
    const current = this.d.doc.snapshot().path;
    const live = this.d.words();
    const q = this.query.trim();
    const out: SidebarRow[] = [];
    const rows = q ? filterRows(this.rows, q) : this.rows;
    for (const row of this.rows) {
      const service = row.kind === 'project' ? this.books.get(row.path) : undefined;
      const chapters = service ? service.chapters : [];
      const opened = row.kind === 'project' && (this.expanded.has(row.path) || Boolean(q));
      const nameHit = rows.some(r => r.path === row.path);
      const chapterHits = chapters.filter(c => !q || (stem(c.path) + ' ' + (c.file?.title ?? '')).toLocaleLowerCase().includes(q.toLocaleLowerCase()));
      if (q && !nameHit && !chapterHits.length) continue;
      const projectPages = chapters.filter(c => c.file).map(c => this.chapterPath(row.path, c.path));
      const picked = projectPages.filter(x => this.selected.has(x)).length;
      out.push({
        selected: row.kind === 'loose' ? this.selected.has(row.path) : projectPages.length > 0 && picked === projectPages.length,
        partial: row.kind === 'project' && picked > 0 && picked < projectPages.length,
        path: row.path, kind: row.kind, label: row.name, current: row.kind === 'loose' && row.path === current,
        expanded: opened, meta: row.kind === 'project' && service ? projectMeta(service.chapters) : undefined,
      });
      if (!opened) continue;
      chapters.forEach((entry, index) => {
        if (q && !chapterHits.includes(entry)) return;
        const full = this.chapterPath(row.path, entry.path);
        const isCurrent = full === current;
        out.push({
          path: full, kind: 'file', label: displayName(stem(entry.path), entry.file?.title), fileName: stem(entry.path),
          current: isCurrent, missing: entry.issue !== null, selected: this.selected.has(full),
          meta: entry.issue ? 'missing' : (isCurrent ? live : entry.file!.words).toLocaleString(), book: row.path, index,
        });
      });
    }
    // Current page's live word count for loose pages too.
    for (const r of out) if (r.kind === 'loose' && r.current) r.meta = live.toLocaleString();
    this.d.sidebar.render({
      rows: out, hits: q.length >= 2 ? this.textHits(q) : [], renaming: this.renaming,
      empty: q ? 'Nothing here matches “' + q + '”.' : '',
      blank: !q && this.rows.length === 0,
      selecting: this.selecting,
    });
    this.d.rendered?.();
  }

  private textHits(q: string): SearchHit[] {
    const hits: SearchHit[] = [];
    for (const [book, service] of this.books) {
      const files = service.chapters.flatMap(c => (c.file ? [c.file as ProjectFile] : []));
      for (const hit of searchProject(files, q).slice(0, 8)) {
        hits.push({ path: this.chapterPath(book, hit.path), book, title: displayName(stem(hit.path), hit.title), context: hit.context });
        if (hits.length >= 30) return hits;
      }
    }
    for (const [path, text] of this.looseText) {
      const name = path.split(/[\\/]/).pop() ?? path;
      for (const hit of searchProject([chapterInfo(name, text)], q).slice(0, 3)) {
        hits.push({ path, book: null, title: displayName(stem(path), hit.title), context: hit.context });
        if (hits.length >= 30) return hits;
      }
    }
    return hits;
  }

  /** Searches names and the text of every project and unfiled page. Everything read is kept for a minute, so typing is instant. */
  async search(text: string): Promise<void> {
    this.query = text;
    if (text.trim().length >= 2 && this.root) {
      const stale = Date.now() - this.searchStamp > 60_000;
      if (stale) { this.looseText.clear(); for (const key of [...this.books.keys()]) await this.loadBook(key); }
      this.searchStamp = Date.now();
      for (const row of this.rows) {
        if (row.kind === 'project' && !this.books.has(row.path)) await this.loadBook(row.path);
        else if (row.kind === 'loose' && !this.looseText.has(row.path) && this.looseText.size < 200) {
          try { this.looseText.set(row.path, (await this.d.io.open(this.root, row.path)).content); } catch { /* unreadable pages are simply not searched */ }
        }
      }
      if (this.query !== text) return; // the writer kept typing; the newer search will draw
    }
    this.render();
  }

  // ---------- opening ----------
  async open(path: string, phrase?: string): Promise<boolean> {
    if (!this.root) return false;
    this.d.flushAutosave();
    const ok = await this.d.doc.openWorkspacePath(this.root, path, this.d.io.open);
    if (ok && phrase) this.d.jumpToPhrase(phrase);
    if (ok) this.render();
    return ok;
  }

  async toggleBook(path: string): Promise<void> {
    if (this.expanded.has(path)) this.expanded.delete(path);
    else { this.expanded.add(path); if (!this.books.has(path)) await this.loadBook(path); }
    this.d.store.set(EXPANDED_KEY, JSON.stringify([...this.expanded]));
    this.render();
  }

  /** Called when a different page comes onto the screen: reveal its book and mark it. */
  async documentLoaded(): Promise<void> {
    const path = this.d.doc.snapshot().path;
    const home = path && this.root ? bookOf(this.root, path) : null;
    if (home && !this.expanded.has(home)) { this.expanded.add(home); if (!this.books.has(home)) await this.loadBook(home); }
    this.render();
  }

  // ---------- creating ----------
  async newPage(inBook: string | null = this.currentBook()): Promise<void> {
    if (!this.root) return;
    try {
      this.d.flushAutosave();
      const path = await this.d.io.create(this.root, inBook, 'Untitled', 'file');
      if (inBook) this.expanded.add(inBook);
      await this.refresh();
      await this.open(path);
      this.d.focusEditor();
    } catch (error) { this.d.notify('Could not create a page: ' + message(error)); }
  }

  /** A Word file becomes a project: each chapter heading starts a page. The .docx itself is only read. */
  async importWord(picked?: string): Promise<void> {
    if (!this.root) return;
    try {
      const file = picked ?? (await this.d.io.pickWord());
      if (!file) return;
      this.d.flushAutosave();
      const fallback = (file.split(/[\\/]/).pop() ?? 'Imported').replace(/\.docx$/i, '');
      const book = importDocx(await this.d.io.readWord(file), fallback);
      if (!book.pages.length) { this.d.notify('That document has no text to import.'); return; }
      const name = book.title ?? fallback;
      const project = await this.d.io.create(this.root, null, name, 'folder');
      const width = Math.max(2, String(book.pages.length).length);
      let firstPage: string | null = null;
      for (const [i, page] of book.pages.entries()) {
        // Numbered names keep the chapters in order; the page still shows its own title.
        const path = await this.d.io.create(this.root, project, String(i + 1).padStart(width, '0') + ' ' + page.title, 'file');
        await this.d.io.write(path, page.markdown);
        firstPage ??= path;
      }
      this.expanded.add(project);
      await this.refresh();
      if (firstPage) await this.open(firstPage);
      const count = book.pages.length;
      this.d.notify('Imported “' + name + '”: ' + count + (count === 1 ? ' page.' : ' pages.') + skippedNote(book));
    } catch (error) { this.d.notify('Could not import that document: ' + message(error)); }
  }

  /** A folder of .md / .txt pages is copied into a new project. The folder itself is left alone. */
  async importFolder(): Promise<void> {
    if (!this.root) return;
    try {
      this.d.flushAutosave();
      const done = await this.d.io.importFolder(this.root);
      if (!done) return;
      this.expanded.add(done.project);
      await this.refresh();
      const list = (names: string[]): string => names.slice(0, 3).join(', ') + (names.length > 3 ? ', and ' + (names.length - 3) + ' more' : '');
      this.d.notify('Imported “' + stem(done.project) + '”: ' + done.pages + (done.pages === 1 ? ' page.' : ' pages.') +
        (done.converted.length ? ' Converted from an older text format: ' + list(done.converted) + '.' : '') +
        (done.skipped.length ? ' ' + done.skipped.length + (done.skipped.length === 1 ? ' file was' : ' files were') + ' skipped: ' + list(done.skipped) + '.' : ''));
    } catch (error) { this.d.notify('Could not import that folder: ' + message(error)); }
  }

  /** A project starts with one page, so there is something to write in at once; its name is ready to type over. */
  async newProject(): Promise<void> {
    if (!this.root) return;
    try {
      this.d.flushAutosave();
      const folder = await this.d.io.create(this.root, null, 'New project', 'folder');
      const first = await this.d.io.create(this.root, folder, 'Untitled', 'file');
      this.expanded.add(folder);
      await this.refresh();
      await this.open(first);
      // The editor takes focus a frame after a page opens; let it, so it cannot steal focus from the name field.
      await new Promise(resolve => setTimeout(resolve, 120));
      this.renaming = folder;
      this.focusAfterRename = true;
      this.render();
    } catch (error) { this.d.notify('Could not create a project: ' + message(error)); }
  }

  // ---------- renaming ----------
  startRename(path: string): void { this.renaming = path; this.render(); }

  /** Sidebar rename commit; an empty name means "cancel". */
  async commitRename(row: SidebarRow, name: string): Promise<void> {
    this.renaming = null;
    const focus = this.focusAfterRename;
    this.focusAfterRename = false;
    if (name) await this.renamePath(row.path, row.kind, name);
    else this.render();
    if (focus) this.d.focusEditor();
  }

  async renameCurrent(name: string): Promise<void> {
    const path = this.d.doc.snapshot().path;
    if (!path || !this.root) return;
    await this.renamePath(path, 'file', name);
  }

  private async renamePath(path: string, kind: SidebarRow['kind'], name: string): Promise<boolean> {
    if (!this.root || this.renamingBusy) return false;
    this.renamingBusy = true;
    try {
      const current = this.d.doc.snapshot().path;
      const touchesCurrent = Boolean(current && (current === path || (kind === 'project' && relativeTo(path, current) !== null)));
      if (touchesCurrent) {
        this.d.flushAutosave();
        if (this.d.doc.isDirty && !(await this.d.doc.save())) { this.d.notify('Save failed, so the rename was not done.'); return false; }
        await this.d.doc.settleWrites();
      }
      const bookPath = kind === 'project' ? null : bookOf(this.root, path);
      const next = await this.d.io.rename(this.root, path, name);
      if (bookPath) {
        const service = this.books.get(bookPath);
        const base = service?.path ?? bookPath;
        const from = relativeTo(base, path), to = relativeTo(base, next);
        if (service && from && to) await service.renameChapter(from, to).catch(() => undefined);
      }
      if (kind === 'project') {
        this.books.delete(path);
        if (this.expanded.delete(path)) this.expanded.add(next);
      }
      this.d.moved(path, next);
      if (touchesCurrent && current) this.d.doc.adoptRenamedPath(next + current.slice(path.length));
      await this.refresh();
      this.d.changed();
      return true;
    } catch (error) {
      this.d.notify(message(error));
      return false;
    } finally { this.renamingBusy = false; }
  }

  /** A new page names itself from its first words, once, and only while it still has its placeholder name. */
  async maybeAutoRename(): Promise<void> {
    const snap = this.d.doc.snapshot();
    if (!snap.path || !this.root || this.renamingBusy || this.renaming) return;
    if (relativeTo(this.root, snap.path) === null) return;
    const title = autoRenameTarget(snap.name, this.d.markdown());
    if (!title) return;
    this.d.flushAutosave();
    if (!(await this.d.doc.save())) return;
    const still = this.d.doc.snapshot();
    if (still.path !== snap.path || autoRenameTarget(still.name, this.d.markdown()) === null) return;
    await this.renamePath(snap.path, 'file', title);
  }

  // ---------- moving between projects ----------
  /** Moves a page into a project (or out to the Library when `dest` is null). Never overwrites; Rust numbers a clash. */
  async moveTo(path: string, kind: SidebarRow['kind'], dest: string | null, label: string, index?: number, quiet = false): Promise<boolean> {
    if (!this.root || kind === 'project') return false;
    try {
      const current = this.d.doc.snapshot().path;
      const touchesCurrent = current === path;
      if (touchesCurrent) {
        this.d.flushAutosave();
        if (this.d.doc.isDirty && !(await this.d.doc.save())) { this.d.notify('Save failed, so the page was not moved.'); return false; }
        await this.d.doc.settleWrites();
      }
      const from = kind === 'file' ? bookOf(this.root, path) : null;
      const next = await this.d.io.move(this.root, path, dest);
      if (from) {
        const service = this.books.get(from);
        const rel = service ? relativeTo(service.path ?? from, path) : null;
        if (service && rel) await service.dropChapter(rel).catch(() => undefined);
      }
      this.d.moved(path, next);
      if (touchesCurrent) this.d.doc.adoptRenamedPath(next);
      if (dest) { this.expanded.add(dest); this.books.delete(dest); }
      await this.refresh();
      if (dest && index !== undefined) {
        const target = this.books.get(dest);
        const rel = target ? relativeTo(target.path ?? dest, next) : null;
        if (target && rel) { await target.moveTo(rel, index).catch(() => undefined); this.render(); }
      }
      if (!quiet) this.d.notify('Moved “' + label + '” ' + (dest ? 'into “' + nameFromPath(dest) + '”.' : 'out to Unfiled pages.'));
      return true;
    } catch (error) { this.d.notify('Could not move it: ' + message(error)); return false; }
  }

  /** A page dropped on a project, between its pages, or on Unfiled pages. */
  async moveInto(from: SidebarRow, project: string | null, index?: number): Promise<void> {
    await this.moveTo(from.path, from.kind, project, from.label, index);
  }

  /** The projects, for "Move to…" lists. */
  projectList(): Array<{ name: string; path: string }> {
    return this.rows.filter(r => r.kind === 'project').map(r => ({ name: r.name, path: r.path }));
  }

  // ---------- find and replace in many pages ----------
  /** Every page of the open project (or of the whole Library), read fresh from disk. */
  async filesForSearch(scope: 'project' | 'library'): Promise<SearchFile[]> {
    if (!this.root) return [];
    const out: SearchFile[] = [];
    const current = this.currentBook();
    const projects = scope === 'project' ? (current ? [current] : []) : this.rows.filter(r => r.kind === 'project').map(r => r.path).slice(0, 100);
    for (const project of projects) {
      const service = await this.loadBook(project);
      if (!service) continue;
      this.books.set(project, service);
      for (const entry of service.chapters) {
        if (entry.file) out.push({ path: this.chapterPath(project, entry.path), label: displayName(stem(entry.path), entry.file.title), group: nameFromPath(project), text: entry.file.text });
      }
    }
    if (scope === 'library') {
      for (const row of this.rows.filter(r => r.kind === 'loose').slice(0, 300)) {
        try { out.push({ path: row.path, label: row.name, group: 'Unfiled', text: (await this.d.io.open(this.root, row.path)).content }); } catch { /* unreadable pages are simply not searched */ }
      }
    }
    return out;
  }

  /** Saves a replaced page only if it is exactly as it was when searched. False means it changed elsewhere and was left alone. */
  async writeReplaced(path: string, newText: string, oldText: string): Promise<boolean> {
    try { await this.d.io.writeGuarded(path, newText, oldText); return true; } catch { return false; }
  }

  /** After many pages changed on disk: reread what is shown. */
  async afterBulkEdit(): Promise<void> { this.looseText.clear(); this.searchStamp = 0; await this.refresh(); }

  // ---------- selecting several pages ----------
  get selectionCount(): number { return this.selected.size; }
  get isSelecting(): boolean { return this.selecting; }

  private announceSelection(): void { this.d.selectionChanged?.(this.selected.size, this.selecting); }

  toggleSelectMode(): void {
    this.selecting = !this.selecting;
    if (!this.selecting) this.selected.clear();
    this.announceSelection();
    this.render();
  }

  /** Leaves selection mode; false when it was not on. */
  endSelect(): boolean {
    if (!this.selecting) return false;
    this.selecting = false;
    this.selected.clear();
    this.announceSelection();
    this.render();
    return true;
  }

  /** Ticks or unticks a page; a project ticks or unticks all of its pages. */
  async toggleSelected(row: SidebarRow): Promise<void> {
    if (row.kind === 'project') {
      const service = this.books.get(row.path) ?? await this.loadBook(row.path);
      const pages = (service?.chapters ?? []).filter(c => c.file).map(c => this.chapterPath(row.path, c.path));
      const all = pages.length > 0 && pages.every(p => this.selected.has(p));
      for (const page of pages) { if (all) this.selected.delete(page); else this.selected.add(page); }
    } else if (this.selected.has(row.path)) this.selected.delete(row.path);
    else this.selected.add(row.path);
    this.announceSelection();
    this.render();
  }

  private selectedPaths(): string[] { return [...this.selected]; }
  private kindOf(path: string): SidebarRow['kind'] { return this.root && bookOf(this.root, path) ? 'file' : 'loose'; }

  async moveSelected(dest: string | null): Promise<void> {
    const paths = this.selectedPaths();
    let moved = 0;
    for (const path of paths) if (await this.moveTo(path, this.kindOf(path), dest, stem(path), undefined, true)) moved++;
    this.selected.clear();
    this.announceSelection();
    this.render();
    const where = dest ? 'into “' + nameFromPath(dest) + '”.' : 'out to Unfiled pages.';
    if (moved) this.d.notify('Moved ' + moved + (moved === 1 ? ' page ' : ' pages ') + where + (moved < paths.length ? ' ' + (paths.length - moved) + ' could not be moved.' : ''));
  }

  async trashSelected(): Promise<void> {
    const paths = this.selectedPaths();
    if (!paths.length) return;
    // Positions are read first, because each page removed shifts the ones after it.
    const positions = new Map(paths.map(p => [p, this.positionOf(p)] as const));
    const items: TrashItem[] = [];
    for (const path of paths) {
      const item = await this.trashOne(path, this.kindOf(path), stem(path), positions.get(path));
      if (item) items.push(item);
    }
    this.selected.clear();
    this.announceSelection();
    this.render();
    if (!items.length) return;
    const ordered = [...items].sort((a, b) => (a.position ?? 1e9) - (b.position ?? 1e9));
    this.d.offerUndo('Moved ' + items.length + (items.length === 1 ? ' page' : ' pages') + ' to the trash.', 'Undo', () => void (async () => { for (const item of ordered) await this.restore(item); })());
  }

  /** Hands the ticked pages of one project to Export; pages from several places cannot be exported together. */
  exportSelected(): void {
    const paths = this.selectedPaths();
    if (!paths.length || !this.root) return;
    const books = new Set(paths.map(p => bookOf(this.root!, p)));
    const [book] = [...books];
    if (books.size !== 1 || !book) {
      this.d.notify(books.size > 1 ? 'Choose pages from one project to export them together.' : 'Unfiled pages are exported one at a time: ⋯ → Export this page.');
      return;
    }
    const base = this.books.get(book)?.path ?? book;
    this.d.exportSelection?.(book, paths.flatMap(p => relativeTo(base, p) ?? []));
    this.endSelect();
  }

  /** Where a page sits in its project's order, or undefined for an unfiled page. */
  private positionOf(path: string): number | undefined {
    const book = this.root ? bookOf(this.root, path) : null;
    const service = book ? this.books.get(book) : undefined;
    const rel = service ? relativeTo(service.path ?? book!, path) : null;
    const at = service && rel ? service.chapters.findIndex(c => c.path === rel) : -1;
    return at >= 0 ? at : undefined;
  }

  // ---------- the trash ----------
  async trashItems(): Promise<TrashItem[]> { return this.root ? this.d.io.listTrash(this.root) : []; }

  /** Puts an item back where it was and, when it is a page, opens it. */
  async restore(item: TrashItem): Promise<void> {
    if (!this.root) return;
    try {
      const path = await this.d.io.restore(this.root, item.item);
      const home = item.is_dir ? null : bookOf(this.root, path);
      if (home && typeof item.position === 'number') {
        // A fresh read adds the restored page at the end; put it back where it was.
        const service = await this.loadBook(home);
        const rel = service ? relativeTo(service.path ?? home, path) : null;
        if (service && rel) { await service.moveTo(rel, item.position).catch(() => undefined); this.expanded.add(home); }
      }
      await this.refresh();
      if (!item.is_dir) await this.open(path);
      else { this.expanded.add(path); await this.refresh(); }
      this.d.notify('Restored “' + item.original.replace(/\.(md|markdown|txt)$/i, '') + '”.');
    } catch (error) { this.d.notify('Could not restore: ' + message(error)); }
  }

  // ---------- moving and removing ----------
  async reorder(book: string, path: string, toIndex: number): Promise<void> {
    const service = this.books.get(book);
    const rel = service ? relativeTo(service.path ?? book, path) : null;
    if (!service || !rel) return;
    try { await service.moveTo(rel, toIndex); this.render(); }
    catch (error) { this.d.notify('The order was not saved: ' + message(error)); await this.refresh(); }
  }

  async nudge(row: SidebarRow, direction: -1 | 1): Promise<void> {
    if (row.kind !== 'file' || row.book === undefined || row.index === undefined) return;
    await this.reorder(row.book, row.path, row.index + direction);
  }

  /** Moves to the trash at once and offers Undo; nothing is erased and the trash view can restore it later. */
  async trash(path: string, kind: SidebarRow['kind'], label: string): Promise<void> {
    const item = await this.trashOne(path, kind, label, this.positionOf(path));
    if (item) this.d.offerUndo('Moved “' + label + '” to the trash.', 'Undo', () => void this.restore(item));
  }

  /** Does the move and the bookkeeping, without any announcement. Returns what is now in the trash, or null on failure. */
  private async trashOne(path: string, kind: SidebarRow['kind'], label: string, position?: number): Promise<TrashItem | null> {
    if (!this.root) return null;
    try {
      const current = this.d.doc.snapshot().path;
      const touchesCurrent = Boolean(current && (current === path || (kind === 'project' && relativeTo(path, current) !== null)));
      if (touchesCurrent) { this.d.flushAutosave(); await this.d.doc.settleWrites(); }
      const book = kind === 'file' ? bookOf(this.root, path) : null;
      const neighbour = touchesCurrent && book ? await this.neighbourOf(book, path) : null;
      const original = relativeTo(this.root, path) ?? label;
      const trashed = await this.d.io.trash(this.root, path, position);
      if (kind === 'project') { this.books.delete(path); this.expanded.delete(path); }
      if (kind === 'file' && book) {
        const service = this.books.get(book);
        const rel = relativeTo(service?.path ?? book, path);
        if (service && rel) await service.dropChapter(rel).catch(() => undefined);
      }
      await this.refresh();
      if (touchesCurrent) { if (neighbour) await this.open(neighbour); else await this.openSomething(path); }
      return { item: trashed, name: nameFromPath(path), original, position: position ?? null, trashed_at: Date.now(), is_dir: kind === 'project' };
    } catch (error) { this.d.notify('Could not move to the trash: ' + message(error)); return null; }
  }

  /** The chapter after the open one, for the "next chapter" link at the end of a page. */
  nextChapter(): { path: string; label: string } | null {
    const current = this.d.doc.snapshot().path;
    const book = current && this.root ? bookOf(this.root, current) : null;
    const service = book ? this.books.get(book) : undefined;
    if (!book || !service) return null;
    const readable = service.chapters.filter(c => c.file);
    const at = readable.findIndex(c => this.chapterPath(book, c.path) === current);
    const next = at >= 0 ? readable[at + 1] : undefined;
    return next ? { path: this.chapterPath(book, next.path), label: displayName(stem(next.path), next.file?.title) } : null;
  }

  /** The chapter next to this one (later first), so removing a chapter lands you somewhere sensible. */
  private async neighbourOf(book: string, path: string): Promise<string | null> {
    const service = this.books.get(book) ?? await this.loadBook(book);
    if (!service) return null;
    const readable = service.chapters.filter(c => c.file).map(c => this.chapterPath(book, c.path));
    const at = readable.indexOf(path);
    return readable[at + 1] ?? readable[at - 1] ?? null;
  }

  /** After the open page is removed: open another one, or start a fresh page. Never leaves a dead editor. */
  async openSomething(avoid: string | null = null): Promise<void> {
    const page = this.rows.find(r => r.kind === 'loose' && r.path !== avoid);
    if (page) { await this.open(page.path); return; }
    for (const row of this.rows) {
      if (row.kind !== 'project') continue;
      const service = this.books.get(row.path) ?? await this.loadBook(row.path);
      const entry = service?.chapters.find(c => c.file);
      if (service && entry) { await this.open(this.chapterPath(row.path, entry.path)); return; }
    }
    await this.newPage(null);
  }

  async removeMissing(row: SidebarRow): Promise<void> {
    if (row.kind !== 'file' || !row.book) return;
    const service = this.books.get(row.book);
    const rel = service ? relativeTo(service.path ?? row.book, row.path) : null;
    if (!service || !rel) return;
    try { await service.omitMissing(rel); await this.refresh(); }
    catch (error) { this.d.notify(message(error)); }
  }

  // ---------- menus ----------
  rowMenu(row: SidebarRow, anchor: HTMLElement): void {
    const items: MenuItem[] = [];
    if (row.missing) {
      items.push({ label: 'Remove from this project', run: () => void this.removeMissing(row) });
    } else {
      if (row.kind === 'project') items.push({ label: 'Add a page', run: () => void this.newPage(row.path) }, { label: 'Export project…', run: () => this.d.exportProject?.(row.path) });
      else items.push({ label: 'Export this page…', run: () => this.d.exportPage?.(row.path) });
      items.push({ label: 'Rename', hint: row.current ? 'F2' : undefined, run: () => this.startRename(row.path) });
      if (row.kind === 'file') {
        const service = row.book ? this.books.get(row.book) : undefined;
        const last = service ? service.chapters.length - 1 : 0;
        if ((row.index ?? 0) > 0) items.push({ label: 'Move up', run: () => void this.nudge(row, -1) });
        if ((row.index ?? 0) < last) items.push({ label: 'Move down', run: () => void this.nudge(row, 1) });
      }
      if (row.kind !== 'project') {
        const projects = this.rows.filter(r => r.kind === 'project' && r.path !== row.book);
        if (projects.length || row.kind === 'file') {
          items.push({ separator: true, label: '' });
          items.push({ heading: true, label: 'Move to' });
          for (const project of projects.slice(0, 12)) items.push({ label: project.name, run: () => void this.moveTo(row.path, row.kind, project.path, row.label) });
          if (row.kind === 'file') items.push({ label: 'Unfiled pages', run: () => void this.moveTo(row.path, row.kind, null, row.label) });
        }
      }
      items.push({ separator: true, label: '' });
      items.push({ label: 'Move to trash', danger: true, run: () => void this.trash(row.path, row.kind, row.label) });
    }
    this.d.menu.open(items, anchor.getBoundingClientRect(), anchor.classList.contains('more') ? anchor : null);
  }

  // ---------- going places (palette) ----------
  /** Reads the pages of collapsed projects once, so the palette can find a page in any project. */
  async warmPlaces(): Promise<void> {
    const cold = this.rows.filter(r => r.kind === 'project' && !this.books.has(r.path));
    if (!cold.length || cold.length > 40) return;
    await mapLimit(cold, 3, row => this.loadBook(row.path));
  }

  places(query: string): PaletteEntry[] {
    if (!this.root) return [];
    const current = this.d.doc.snapshot().path;
    const entries: PaletteEntry[] = [];
    for (const row of this.rows) {
      if (row.kind === 'loose') {
        entries.push({ label: row.name, group: row.path === current ? 'Open now' : 'Unfiled', keywords: 'go open page', run: () => void this.open(row.path) });
      } else {
        const service = this.books.get(row.path);
        for (const entry of service?.chapters ?? []) {
          if (entry.issue) continue;
          const full = this.chapterPath(row.path, entry.path);
          entries.push({ label: displayName(stem(entry.path), entry.file?.title), group: full === current ? 'Open now' : row.name, keywords: 'page file go open ' + stem(entry.path), run: () => void this.open(full) });
        }
      }
    }
    const q = query.trim();
    const here = this.currentBook();
    const sorted = [...entries].sort((a, b) => Number(b.group === (here ? nameFromPath(here) : '')) - Number(a.group === (here ? nameFromPath(here) : '')));
    return q ? sorted : sorted.slice(0, 8);
  }

  /** The book that holds the open page, with every readable chapter in order; null for a loose page. */
  async bookForExport(project: string | null = null): Promise<{ service: ProjectService; title: string } | null> {
    const book = project ?? this.currentBook();
    if (!book) return null;
    const service = this.books.get(book) ?? await this.loadBook(book);
    if (!service) return null;
    await service.open(book, false);
    this.books.set(book, service);
    return { service, title: nameFromPath(book) };
  }

  /** Folder of the open page's parent, used for "new page here". */
  parentFolder(): string | null {
    const path = this.d.doc.snapshot().path;
    return path ? parentOf(path) : null;
  }
}
