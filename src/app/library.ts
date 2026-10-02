import type { DocumentSession, OpenedDocument } from '../core/session';
import type { KeyValueStore } from '../core/ports';
import type { FolderListing } from '../core/quick-switch';
import type { PaletteEntry } from '../core/palette';
import { ProjectService, type ProjectPorts } from '../core/project-service';
import { searchProject, type ProjectFile } from '../core/project';
import { nameFromPath } from '../core/paths';
import { WELCOME_TEXT, WELCOME_TITLE, autoRenameTarget, bookOf, displayName, filterRows, joinPath, parentOf, relativeTo, rootRows, type TreeRow } from '../core/library';
import type { Menu, MenuItem } from '../ui/menu';
import type { TrashItem } from '../adapters/tauri';
import type { SearchHit, Sidebar, SidebarRow } from '../ui/sidebar';

export const LIBRARY_KEY = 'agp.library.v1';
const EXPANDED_KEY = 'agp.library.open.v1';
const WELCOMED_KEY = 'agp.welcomed.v1';

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
    trash(root: string, path: string): Promise<string>;
    write(path: string, content: string): Promise<unknown>;
    pickFolder(): Promise<string | null>;
    listTrash(root: string): Promise<TrashItem[]>;
    restore(root: string, path: string): Promise<string>;
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
  /** Called after every redraw of the tree, so things that depend on it (the next-chapter link) can follow. */
  rendered?(): void;
}

const message = (error: unknown): string => (error instanceof Error ? error.message : String(error));
const stem = (path: string): string => nameFromPath(path);

/** Owns the Library: what is on disk, what the sidebar shows, and every create / rename / move / delete. */
export class LibraryController {
  root: string | null = null;
  private rows: TreeRow[] = [];
  private readonly books = new Map<string, ProjectService>();
  private expanded: Set<string>;
  private renaming: string | null = null;
  private query = '';
  private renamingBusy = false;

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
    let root = this.d.store.get(LIBRARY_KEY);
    try {
      if (!root) throw new Error('none');
      root = (await this.d.io.list(root)).root;
    } catch {
      root = await this.d.io.defaultLibrary();
      root = (await this.d.io.list(root)).root;
    }
    this.root = root;
    this.d.store.set(LIBRARY_KEY, root);
    await this.refresh();
    this.d.changed();
  }

  /** First launch only: a short, real page that teaches by being read. Returns its path if it was created. */
  async welcomeIfNew(): Promise<string | null> {
    if (!this.root || this.d.store.get(WELCOMED_KEY) || this.rows.length) return null;
    this.d.store.set(WELCOMED_KEY, '1');
    const path = await this.d.io.create(this.root, null, WELCOME_TITLE, 'file');
    await this.d.io.write(path, WELCOME_TEXT);
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

  async changeFolder(): Promise<void> {
    const picked = await this.d.io.pickFolder();
    if (!picked) return;
    if (this.d.doc.isDirty) { this.d.flushAutosave(); await this.d.doc.settleWrites(); }
    this.d.store.set(LIBRARY_KEY, picked);
    this.books.clear();
    this.expanded.clear();
    await this.start();
    this.d.notify('Library is now ' + this.root);
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
    for (const row of this.rows) if (row.kind === 'book' && this.expanded.has(row.path)) await this.loadBook(row.path);
    this.render();
  }

  private async loadBook(path: string): Promise<ProjectService | null> {
    try {
      const service = new ProjectService(this.ports());
      await service.open(path);
      this.books.set(path, service);
      return service;
    } catch (error) {
      this.d.notify('Could not open that book: ' + message(error));
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
      const service = row.kind === 'book' ? this.books.get(row.path) : undefined;
      const chapters = service ? service.chapters : [];
      const opened = row.kind === 'book' && (this.expanded.has(row.path) || Boolean(q));
      const nameHit = rows.some(r => r.path === row.path);
      const chapterHits = chapters.filter(c => !q || (stem(c.path) + ' ' + (c.file?.title ?? '')).toLocaleLowerCase().includes(q.toLocaleLowerCase()));
      if (q && !nameHit && !chapterHits.length) continue;
      out.push({
        path: row.path, kind: row.kind, label: row.name, current: row.kind === 'page' && row.path === current,
        expanded: opened, meta: row.kind === 'book' && service ? service.chapters.length + (service.chapters.length === 1 ? ' chapter' : ' chapters') : undefined,
      });
      if (!opened) continue;
      chapters.forEach((entry, index) => {
        if (q && !chapterHits.includes(entry)) return;
        const full = this.chapterPath(row.path, entry.path);
        const isCurrent = full === current;
        out.push({
          path: full, kind: 'chapter', label: displayName(stem(entry.path), entry.file?.title), fileName: stem(entry.path),
          current: isCurrent, missing: entry.issue !== null,
          meta: entry.issue ? 'missing' : (isCurrent ? live : entry.file!.words).toLocaleString(), book: row.path, index,
        });
      });
    }
    // Current page's live word count for loose pages too.
    for (const r of out) if (r.kind === 'page' && r.current) r.meta = live.toLocaleString();
    this.d.sidebar.render({
      rows: out, hits: q.length >= 2 ? this.textHits(q) : [], renaming: this.renaming,
      empty: q ? 'Nothing here matches “' + q + '”.' : 'Your Library is empty. Press New page to begin.',
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
    return hits;
  }

  async search(text: string): Promise<void> {
    this.query = text;
    if (text.trim().length >= 2) {
      for (const row of this.rows) if (row.kind === 'book' && !this.books.has(row.path)) await this.loadBook(row.path);
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

  async newBook(): Promise<void> {
    if (!this.root) return;
    try {
      const path = await this.d.io.create(this.root, null, 'New book', 'folder');
      this.expanded.add(path);
      this.renaming = path;
      await this.refresh();
    } catch (error) { this.d.notify('Could not create a book: ' + message(error)); }
  }

  // ---------- renaming ----------
  startRename(path: string): void { this.renaming = path; this.render(); }

  /** Sidebar rename commit; an empty name means "cancel". */
  async commitRename(row: SidebarRow, name: string): Promise<void> {
    this.renaming = null;
    if (!name) { this.render(); return; }
    await this.renamePath(row.path, row.kind, name);
  }

  async renameCurrent(name: string): Promise<void> {
    const path = this.d.doc.snapshot().path;
    if (!path || !this.root) return;
    await this.renamePath(path, 'page', name);
  }

  private async renamePath(path: string, kind: SidebarRow['kind'], name: string): Promise<boolean> {
    if (!this.root || this.renamingBusy) return false;
    this.renamingBusy = true;
    try {
      const current = this.d.doc.snapshot().path;
      const touchesCurrent = Boolean(current && (current === path || (kind === 'book' && current.startsWith(path))));
      if (touchesCurrent) {
        this.d.flushAutosave();
        if (this.d.doc.isDirty && !(await this.d.doc.save())) { this.d.notify('Save failed, so the rename was not done.'); return false; }
        await this.d.doc.settleWrites();
      }
      const bookPath = kind === 'book' ? null : bookOf(this.root, path);
      const next = await this.d.io.rename(this.root, path, name);
      if (bookPath) {
        const service = this.books.get(bookPath);
        const base = service?.path ?? bookPath;
        const from = relativeTo(base, path), to = relativeTo(base, next);
        if (service && from && to) await service.renameChapter(from, to).catch(() => undefined);
      }
      if (kind === 'book') {
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
    await this.renamePath(snap.path, 'page', title);
  }

  // ---------- the trash ----------
  async trashItems(): Promise<TrashItem[]> { return this.root ? this.d.io.listTrash(this.root) : []; }

  /** Puts an item back where it was and, when it is a page, opens it. */
  async restore(item: TrashItem): Promise<void> {
    if (!this.root) return;
    try {
      const path = await this.d.io.restore(this.root, item.item);
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
    if (row.kind !== 'chapter' || row.book === undefined || row.index === undefined) return;
    await this.reorder(row.book, row.path, row.index + direction);
  }

  /** Moves to the trash at once and offers Undo; nothing is erased and the trash view can restore it later. */
  async trash(path: string, kind: SidebarRow['kind'], label: string): Promise<void> {
    if (!this.root) return;
    try {
      const current = this.d.doc.snapshot().path;
      const touchesCurrent = Boolean(current && (current === path || (kind === 'book' && current.startsWith(path))));
      if (touchesCurrent) { this.d.flushAutosave(); await this.d.doc.settleWrites(); }
      const book = kind === 'chapter' ? bookOf(this.root, path) : null;
      const neighbour = touchesCurrent && book ? await this.neighbourOf(book, path) : null;
      const original = relativeTo(this.root, path) ?? label;
      const trashed = await this.d.io.trash(this.root, path);
      if (kind === 'book') { this.books.delete(path); this.expanded.delete(path); }
      if (kind === 'chapter' && book) {
        const service = this.books.get(book);
        const rel = relativeTo(service?.path ?? book, path);
        if (service && rel) await service.dropChapter(rel).catch(() => undefined);
      }
      await this.refresh();
      if (touchesCurrent) { if (neighbour) await this.open(neighbour); else await this.openSomething(path); }
      const item: TrashItem = { item: trashed, name: nameFromPath(path), original, trashed_at: Date.now(), is_dir: kind === 'book' };
      this.d.offerUndo('Moved “' + label + '” to the trash.', 'Undo', () => void this.restore(item));
    } catch (error) { this.d.notify('Could not move to the trash: ' + message(error)); }
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
    const page = this.rows.find(r => r.kind === 'page' && r.path !== avoid);
    if (page) { await this.open(page.path); return; }
    for (const row of this.rows) {
      if (row.kind !== 'book') continue;
      const service = this.books.get(row.path) ?? await this.loadBook(row.path);
      const entry = service?.chapters.find(c => c.file);
      if (service && entry) { await this.open(this.chapterPath(row.path, entry.path)); return; }
    }
    await this.newPage(null);
  }

  async removeMissing(row: SidebarRow): Promise<void> {
    if (row.kind !== 'chapter' || !row.book) return;
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
      items.push({ label: 'Remove from this book', run: () => void this.removeMissing(row) });
    } else {
      if (row.kind === 'book') items.push({ label: 'New chapter here', run: () => void this.newPage(row.path) });
      items.push({ label: 'Rename', hint: row.current ? 'F2' : undefined, run: () => this.startRename(row.path) });
      if (row.kind === 'chapter') {
        const service = row.book ? this.books.get(row.book) : undefined;
        const last = service ? service.chapters.length - 1 : 0;
        if ((row.index ?? 0) > 0) items.push({ label: 'Move up', run: () => void this.nudge(row, -1) });
        if ((row.index ?? 0) < last) items.push({ label: 'Move down', run: () => void this.nudge(row, 1) });
      }
      items.push({ separator: true, label: '' });
      items.push({ label: 'Move to trash', danger: true, run: () => void this.trash(row.path, row.kind, row.label) });
    }
    this.d.menu.open(items, anchor.getBoundingClientRect(), anchor.classList.contains('more') ? anchor : null);
  }

  // ---------- going places (palette) ----------
  places(query: string): PaletteEntry[] {
    if (!this.root) return [];
    const current = this.d.doc.snapshot().path;
    const entries: PaletteEntry[] = [];
    for (const row of this.rows) {
      if (row.kind === 'page') {
        entries.push({ label: row.name, group: row.path === current ? 'Open now' : 'Page', keywords: 'go open', run: () => void this.open(row.path) });
      } else {
        const service = this.books.get(row.path);
        for (const entry of service?.chapters ?? []) {
          if (entry.issue) continue;
          const full = this.chapterPath(row.path, entry.path);
          entries.push({ label: displayName(stem(entry.path), entry.file?.title), group: full === current ? 'Open now' : row.name, keywords: 'chapter go open ' + stem(entry.path), run: () => void this.open(full) });
        }
      }
    }
    const q = query.trim();
    const here = this.currentBook();
    const sorted = [...entries].sort((a, b) => Number(b.group === (here ? nameFromPath(here) : '')) - Number(a.group === (here ? nameFromPath(here) : '')));
    return q ? sorted : sorted.slice(0, 8);
  }

  /** The book that holds the open page, with every readable chapter in order; null for a loose page. */
  async bookForExport(): Promise<{ service: ProjectService; title: string } | null> {
    const book = this.currentBook();
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
