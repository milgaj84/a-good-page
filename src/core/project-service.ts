import { chapterInfo, manifest, moveChapter, moveChapterTo, renameInOrder, orderFiles, safeChapter, type ProjectFile, type ProjectManifest } from './project';
import type { FolderListing } from './quick-switch';
import { ProjectChangeError } from './project-preview';
import { rankRelinks, relinkOrder, type RelinkCandidate } from './project-relink';
import { projectHealth, type ProjectHealth } from './project-health';
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
  private available: string[] = [];
  private recorded = new Set<string>();
  constructor(private readonly io: ProjectPorts) {}
  get chapters(): readonly ProjectEntry[] { return this.order.chapters.map(path => this.files.get(path) ?? { path, file: null, issue: 'Missing from workspace' }); }
  get path(): string | null { return this.root; }
  health(): ProjectHealth { return projectHealth(this.chapters,this.available,this.recorded); }
  async open(root: string, persistOrder = true): Promise<void> {
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
    const missing = order.chapters.some(path=>!paths.includes(path));
    const stored = persistOrder && order.chapters.length && changed && !missing ? await this.io.saveOrder(base, raw, JSON.stringify(order)) : raw;
    this.root = base; this.raw = stored; this.order = order; this.files = found; this.available = paths;
    this.recorded = new Set(stored !== null ? manifest(JSON.parse(stored)).chapters : []);
  }
  private full(path: string): string {
    if(!this.root)throw Error('Choose a project folder.');
    const sep=this.root.includes(String.fromCharCode(92))?String.fromCharCode(92):'/';
    return (this.root.endsWith(sep)?this.root:this.root+sep)+path.split('/').join(sep);
  }
  /** Read bounded, workspace-validated alternatives; suggestions are never applied automatically. */
  async relinkCandidates(missing: string): Promise<{ candidates: RelinkCandidate[]; files: Map<string, ProjectFile> }> {
    if(!this.root||this.files.get(missing)?.issue===null||!this.order.chapters.includes(missing))throw Error('Choose a missing chapter.');
    const files=new Map<string, ProjectFile>();
    for(const path of this.available.filter(p=>!this.recorded.has(p))) {
      try { const doc=await this.io.read(this.root,this.full(path)); files.set(path,chapterInfo(path,doc.content)); }
      catch { /* An unreadable candidate cannot be offered for relinking. */ }
    }
    return {candidates:rankRelinks(missing,[...files.values()]),files};
  }
  /** Check the proposed file again before guarded manifest write; keep old order on any failure. */
  async relink(missing: string, replacement: string, expectedText: string): Promise<void> {
    if(!this.root||this.files.get(missing)?.issue===null||!this.available.includes(replacement)||this.recorded.has(replacement))
      throw Error('Choose a new, unused writing file in this workspace.');
    const chapters=relinkOrder(this.order.chapters.filter(path=>path!==replacement),missing,replacement);
    const doc=await this.io.read(this.root,this.full(replacement));
    if(doc.content!==expectedText)throw Error(replacement+' changed during review. Refresh suggestions.');
    const next={version:1 as const,chapters};
    const written=await this.io.saveOrder(this.root,this.raw,JSON.stringify(next));
    this.files.delete(missing);this.files.set(replacement,{path:replacement,file:chapterInfo(replacement,doc.content),issue:null});
    this.order=next;this.raw=written;this.recorded=new Set(next.chapters);
  }
  async move(path: string, direction: -1 | 1): Promise<void> {
    if (!this.root) throw Error('Choose a project folder.');
    const next = moveChapter(this.order, path, direction);
    if (next === this.order) return;
    const value = JSON.stringify(next);
    const written = await this.io.saveOrder(this.root, this.raw, value);
    this.order = next; this.raw = written; this.recorded = new Set(next.chapters);
  }
  /** Drag and drop: one guarded write for any distance. */
  async moveTo(path: string, index: number): Promise<void> {
    if (!this.root) throw Error('Choose a project folder.');
    const next = moveChapterTo(this.order, path, index);
    if (next === this.order) return;
    const written = await this.io.saveOrder(this.root, this.raw, JSON.stringify(next));
    this.order = next; this.raw = written; this.recorded = new Set(next.chapters);
  }
  /** A renamed file keeps its place in the book. */
  async renameChapter(from: string, to: string): Promise<void> {
    if (!this.root) throw Error('Choose a project folder.');
    const next = renameInOrder(this.order, from, to);
    if (next === this.order) return;
    const written = await this.io.saveOrder(this.root, this.raw, JSON.stringify(next));
    this.order = next; this.raw = written; this.recorded = new Set(next.chapters);
  }
  /** A chapter that was moved to the trash leaves the order. */
  async dropChapter(path: string): Promise<void> {
    if (!this.root) throw Error('Choose a project folder.');
    const next: ProjectManifest = { version: 1, chapters: this.order.chapters.filter(p => p !== path) };
    if (next.chapters.length === this.order.chapters.length) return;
    const written = await this.io.saveOrder(this.root, this.raw, JSON.stringify(next));
    this.order = next; this.raw = written; this.recorded = new Set(next.chapters); this.files.delete(path);
  }
  async omitMissing(path: string): Promise<void> {
    if (!this.root || this.files.get(path)?.file) throw Error('Only missing chapters can be removed from the project order.');
    const next: ProjectManifest = { version: 1, chapters: this.order.chapters.filter(p => p !== path) };
    const written = await this.io.saveOrder(this.root, this.raw, JSON.stringify(next));
    this.order = next; this.raw = written; this.recorded = new Set(next.chapters); this.files.delete(path);
  }
  preview(selected: readonly string[]): ProjectSnapshot {
    if (!this.root || !selected.length || new Set(selected).size !== selected.length ||
      selected.some(path => !this.order.chapters.includes(path))) throw Error('Choose at least one valid chapter.');
    if (this.chapters.some(entry => entry.issue)) throw Error('Fix missing or unreadable chapters before compiling.');
    const chapters = selected.map(path => this.files.get(path)!.file!);
    return { root: this.root, orderRaw: this.raw, chapters };
  }
  /** Verify disk sources before showing a reading view; export verifies again. */
  async previewVerified(selected: readonly string[]): Promise<ProjectSnapshot> {
    const snapshot = this.preview(selected);
    await this.verify(snapshot);
    return snapshot;
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
