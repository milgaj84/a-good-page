import { chapterInfo, manifest, moveChapter, orderFiles, safeChapter, type ProjectFile, type ProjectManifest } from './project';
import type { FolderListing } from './quick-switch';
import { ProjectChangeError } from './project-preview';
export interface ProjectPorts {
  list(root: string, folder?: string): Promise<FolderListing>;
  read(root: string, path: string): Promise<{ content: string }>;
  order(root: string): Promise<string | null>;
  saveOrder(root: string, expected: string | null, value: string): Promise<string>;
}
export interface ProjectEntry { path: string; file: ProjectFile | null; issue: string | null }
export interface ProjectSnapshot { root: string; orderRaw: string | null; chapters: ProjectFile[] }
/** Completeness first: a failed folder or chapter read is an error, never a silent omission. */
export class ProjectService {
  private raw: string | null = null;
  private root: string | null = null;
  private order: ProjectManifest = { version: 1, chapters: [] };
  private files = new Map<string, ProjectEntry>();
  constructor(private readonly io: ProjectPorts) {}
  get chapters(): readonly ProjectEntry[] { return this.order.chapters.map(path => this.files.get(path) ?? { path, file: null, issue: 'Missing from workspace' }); }
  get path(): string | null { return this.root; }
  async open(root: string): Promise<void> {
    const first = await this.io.list(root);
    const base = first.root;
    const queue: { folder: string; rel: string; depth: number; listing?: FolderListing }[] = [{ folder: base, rel: '', depth: 0, listing: first }];
    const paths: string[] = [];
    let visited = 0;
    while (queue.length) {
      const next = queue.shift()!;
      if (++visited > 200 || next.depth > 4) throw Error('Workspace scan limit reached; project order was not loaded.');
      const listing = next.listing ?? await this.io.list(base, next.folder);
      for (const item of listing.entries) {
        const rel = next.rel ? next.rel + '/' + item.name : item.name;
        if (item.is_dir) queue.push({ folder: item.path, rel, depth: next.depth + 1 });
        else if (safeChapter(rel)) paths.push(rel);
      }
    }
    paths.sort((a,b) => a.localeCompare(b));
    const raw = await this.io.order(base);
    const order = orderFiles(paths, raw === null ? null : manifest(JSON.parse(raw)));
    const found = new Map<string, ProjectEntry>();
    const sep = base.includes(String.fromCharCode(92)) ? String.fromCharCode(92) : '/';
    for (const rel of order.chapters) {
      if (!paths.includes(rel)) { found.set(rel, { path: rel, file: null, issue: 'Missing from workspace' }); continue; }
      const full = (base.endsWith(sep) ? base : base + sep) + rel.split('/').join(sep);
      try {
        const doc = await this.io.read(base, full);
        found.set(rel, { path: rel, file: chapterInfo(rel, doc.content), issue: null });
      } catch (error) { found.set(rel, { path: rel, file: null, issue: 'Cannot read: ' + String(error) }); }
    }
    const existing = raw === null ? null : manifest(JSON.parse(raw));
    const changed = raw === null || JSON.stringify(existing) !== JSON.stringify(order);
    const stored = order.chapters.length && changed ? await this.io.saveOrder(base, raw, JSON.stringify(order)) : raw;
    this.root = base; this.raw = stored; this.order = order; this.files = found;
  }
  async move(path: string, direction: -1 | 1): Promise<void> {
    if (!this.root) throw Error('Choose a project folder.');
    const next = moveChapter(this.order, path, direction);
    if (next === this.order) return;
    const value = JSON.stringify(next);
    const written = await this.io.saveOrder(this.root, this.raw, value);
    this.order = next; this.raw = written;
  }
  async omitMissing(path: string): Promise<void> {
    if (!this.root || this.files.get(path)?.file) throw Error('Only missing chapters can be removed from the project order.');
    const next: ProjectManifest = { version: 1, chapters: this.order.chapters.filter(p => p !== path) };
    const written = await this.io.saveOrder(this.root, this.raw, JSON.stringify(next));
    this.order = next; this.raw = written; this.files.delete(path);
  }
  preview(selected: readonly string[]): ProjectSnapshot {
    if (!this.root || !selected.length || new Set(selected).size !== selected.length ||
      selected.some(path => !this.order.chapters.includes(path))) throw Error('Choose at least one valid chapter.');
    if (this.chapters.some(entry => entry.issue)) throw Error('Fix missing or unreadable chapters before compiling.');
    const chapters = selected.map(path => this.files.get(path)!.file!);
    return { root: this.root, orderRaw: this.raw, chapters };
  }
  async verify(snapshot: ProjectSnapshot): Promise<void> {
    if (snapshot.root !== this.root) throw new ProjectChangeError('order', '.a-good-page.json');
    const currentOrder = await this.io.order(snapshot.root).catch(() => {
      throw new ProjectChangeError('order', '.a-good-page.json');
    });
    if (currentOrder !== snapshot.orderRaw) throw new ProjectChangeError('order', '.a-good-page.json');
    for (const file of snapshot.chapters) {
      const sep = snapshot.root.includes(String.fromCharCode(92)) ? String.fromCharCode(92) : '/';
      const full = (snapshot.root.endsWith(sep) ? snapshot.root : snapshot.root + sep) + file.path.split('/').join(sep);
      const current = await this.io.read(snapshot.root, full).catch(() => { throw new ProjectChangeError('missing', file.path); });
      if (current.content !== file.text) throw new ProjectChangeError('content', file.path);
    }
  }
}
