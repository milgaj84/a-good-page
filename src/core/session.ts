import { isPlainTextPath, nameFromPath, UNTITLED } from './paths';
import { FileChangedError, detectOutside, copySuggestion, type DiskProbe, type OutsideState, type ConflictChoice, type FileConflict } from './file-conflict';

export type SaveState = 'saved' | 'dirty' | 'saving' | 'error';

export interface SessionSnapshot {
  path: string | null;
  name: string;
  state: SaveState;
}

export interface EditorPort {
  getMarkdown(): string;
  getPlainText?(): string;
  setMarkdown(markdown: string): void;
  setPlainText?(text: string): void;
  focus(): void;
}

export interface OpenedDocument {
  path: string;
  name: string;
  content: string;
}

export interface FileGateway {
  pickOpenPath(): Promise<string | null>;
  pickSavePath(suggestedName: string): Promise<string | null>;
  read(path: string): Promise<OpenedDocument>;
  probe?(path: string): Promise<DiskProbe>;
  write(path: string, content: string, expected?: string | null): Promise<string>;
}

export interface Prompter {
  confirmDiscard(): Promise<boolean>;
}

export interface DraftStore {
  load(): string | null;
  /** Returns false when the draft could not be stored (for example a full disk). */
  save(markdown: string): boolean | void;
  clear(): void;
  /** Optional: stores a draft whose markdown is read later, keeping serialisation off the keystroke path. */
  saveLazy?(read: () => string): void;
}

export interface SessionEvents {
  onChange(snapshot: SessionSnapshot): void;
  onError(message: string): void;
  onConflict?(conflict: FileConflict): Promise<ConflictChoice>;
  onOutside?(state: OutsideState | null): void;
  onResolved?(message: string): void;
  onDiscard?(path: string): void;
  /** A version of the page must be kept before it is replaced (silent reload of a clean page, or a simplified load). */
  onKeepVersion?(path: string, content: string): void;
  /** The file was loaded and A Good Page's serialised form differs materially from it (tables, images, HTML, footnotes, front matter). */
  onSimplified?(path: string): void;
}

export interface SessionDeps {
  editor: EditorPort;
  files: FileGateway;
  prompter: Prompter;
  drafts: DraftStore;
  events: SessionEvents;
}

export interface OpenOptions {
  /** Suppress error messages, e.g. when silently reopening the last file at launch. */
  quiet?: boolean;
}

function normalizeMarkdown(text: string): string {
  return text.replace(/\r\n?/g, '\n').split('\n').map(line => line.replace(/\s+$/, '')
    .replace(/^(\s*)[*+](\s)/, '$1-$2').replace(/^\s*([-*_])(\s*\1){2,}$/, '---'))
    .filter(line => line.length > 0).join('\n');
}

/** True when the editor's markdown differs from the file in more than whitespace, blank lines and list markers. */
export function simplifiesMarkdown(original: string, serialized: string): boolean {
  return normalizeMarkdown(original) !== normalizeMarkdown(serialized);
}

export function describeError(err: unknown): string {
  if (typeof err === 'string' && err.trim().length > 0) return err;
  if (err instanceof Error && err.message.trim().length > 0) return err.message;
  return 'Something went wrong.';
}

/**
 * Owns the lifecycle of the document being written: open, save, save-as,
 * autosave, drafts for untitled work, and dirty tracking. All I/O is injected.
 */
export class DocumentSession {
  private path: string | null = null;
  private name = UNTITLED;
  private revision = 0;
  private savedRevision = 0;
  private inflight = 0;
  private failed = false;
  private documentId = 0;
  private saveIntent = 0;
  private queue: Promise<unknown> = Promise.resolve();
  private readonly pendingDecisions = new Set<Promise<unknown>>();
  private baseline: string | null = null;
  private conflictHold = false;
  private conflictBusy = false;
  private conflictPath: string | null = null;
  private outside: OutsideState | null = null;
  private checking = false;
  private autosaveFails = 0;
  /** True when the page now open was loaded with formatting the editor simplifies. */
  simplified = false;

  constructor(private readonly deps: SessionDeps) {}

  get isDirty(): boolean {
    return this.revision !== this.savedRevision;
  }

  recoveryBaseline(): string | null { return this.baseline; }

  /** Explicit recovery choice only. A changed disk keeps the guarded save paused. */
  resumeNamedRecovery(path: string, content: string, baseline: string, disk: DiskProbe): boolean {
    if (!path || this.path !== path || this.baseline === null) return false;
    if (isPlainTextPath(path) && this.deps.editor.setPlainText) this.deps.editor.setPlainText(content);
    else this.deps.editor.setMarkdown(content);
    this.revision += 1;
    this.baseline = baseline;
    this.conflictHold = disk.kind !== 'present' || disk.content !== baseline;
    this.failed = this.conflictHold;
    this.outside = detectOutside(path, baseline, disk);
    this.deps.events.onOutside?.(this.outside);
    this.emit();
    return true;
  }

  snapshot(): SessionSnapshot {
    return { path: this.path, name: this.name, state: this.state() };
  }

  restoreDraft(): boolean {
    const draft = this.deps.drafts.load();
    if (draft === null || draft.trim().length === 0) return false;
    this.deps.editor.setMarkdown(draft);
    this.documentId += 1;
    this.revision += 1;
    this.emit();
    return true;
  }

  markEdited(): void {
    this.revision += 1;
    if (this.path === null) {
      const { drafts, editor } = this.deps;
      if (drafts.saveLazy) drafts.saveLazy(() => editor.getMarkdown());
      else drafts.save(editor.getMarkdown());
    }
    this.emit();
  }

  /** Wait for already requested writes before deciding whether it is safe to close. */
  async settleWrites(): Promise<void> {
    await this.queue;
    while (this.pendingDecisions.size) await Promise.all([...this.pendingDecisions]);
  }

  /** Explicit discard on quit must not reopen an untitled draft next launch. */
  discardDraft(): void {
    this.saveIntent += 1;
    if (this.path === null) this.deps.drafts.clear();
    else this.deps.events.onDiscard?.(this.path);
  }

  save(): Promise<boolean> {
    return this.path === null ? this.saveAs() : this.writeTo(this.path);
  }

  async saveAs(): Promise<boolean> {
    const id = this.documentId;
    const intent = this.saveIntent;
    try {
      const suggested = this.path ? copySuggestion(this.path.split(String.fromCharCode(92)).pop()?.split('/').pop() || this.name + '.md') : this.name + '.md';
      const chosen = await this.deps.files.pickSavePath(suggested);
      if (!chosen || id !== this.documentId || intent !== this.saveIntent) return false;
      return this.writeTo(chosen, true);
    } catch (error) {
      if (id === this.documentId && intent === this.saveIntent) this.deps.events.onError(describeError(error));
      return false;
    }
  }

  async autosave(): Promise<boolean> {
    if (this.path === null || !this.isDirty || this.conflictHold) return false;
    return this.writeTo(this.path, false, false);
  }

  async open(): Promise<boolean> {
    const start = this.documentId;
    const before = this.revision;
    if (!(await this.confirmLeave()) || !this.unchanged(start, before)) return false;
    const revision = this.revision;
    const chosen = await this.deps.files.pickOpenPath();
    if (!chosen || !this.unchanged(start, revision)) return false;
    return this.load(chosen, false, start, revision);
  }

  async openPath(path: string, options: OpenOptions = {}): Promise<boolean> {
    if (path.trim().length === 0) return false;
    const start = this.documentId;
    const before = this.revision;
    if (!(await this.confirmLeave()) || !this.unchanged(start, before)) return false;
    return this.load(path, options.quiet === true, start, this.revision);
  }

  /** Scoped workspace read shares the same save/discard protection as Open. */
  async openWorkspacePath(root: string, path: string,
    read: (root: string, path: string) => Promise<OpenedDocument>): Promise<boolean> {
    if (!root.trim() || !path.trim()) return false;
    const id = this.documentId, revision = this.revision;
    if (!(await this.confirmLeave()) || !this.unchanged(id, revision)) return false;
    return this.load(path, false, id, this.revision, selected => read(root, selected));
  }

  async newDocument(): Promise<boolean> {
    const start = this.documentId;
    const before = this.revision;
    if (!(await this.confirmLeave()) || !this.unchanged(start, before)) return false;
    this.reset(null, UNTITLED, '');
    return true;
  }

  /** The file on disk was renamed (the content is unchanged): follow it without reloading the page. */
  adoptRenamedPath(path: string): void {
    if (this.path === null || path.trim().length === 0) return;
    this.path = path;
    this.name = nameFromPath(path);
    this.emit();
  }

  /** Focus/refresh probe; reads only, never reloads or writes. */
  async checkOutside(): Promise<OutsideState | null> {
    if (!this.path || this.baseline === null || !this.deps.files.probe || this.checking) return this.outside;
    const id = this.documentId, path = this.path, expected = this.baseline;
    this.checking = true;
    let probe: DiskProbe;
    try { probe = await this.deps.files.probe(path); }
    catch { probe = { kind: 'unreadable' }; }
    finally { this.checking = false; }
    if (id !== this.documentId || path !== this.path || expected !== this.baseline) return this.outside;
    const next = detectOutside(path, expected, probe);
    if (next?.kind === 'changed' && !this.isDirty && this.inflight === 0 && !this.conflictBusy) {
      // Nothing of mine is unsaved: take the new file quietly, after keeping a copy of the page as it was.
      const revision = this.revision;
      this.deps.events.onKeepVersion?.(path, this.currentText(path));
      if (await this.load(path, true, id, revision)) {
        this.deps.events.onResolved?.('Reloaded: this page changed on disk. The earlier version is in Time Machine.');
        return null;
      }
    }
    this.outside = next;
    if (next) { this.conflictHold = true; this.failed = true; this.emit(); }
    else if (this.conflictHold) { this.conflictHold = false; this.failed = false; this.emit(); }
    this.deps.events.onOutside?.(next);
    return next;
  }

  /** Review a fresh disk probe before asking, and recheck it before acting. */
  async reviewOutside(): Promise<boolean> {
    const state = await this.checkOutside();
    if (!state || !this.deps.events.onConflict || !this.deps.files.probe) return false;
    const id = this.documentId, revision = this.revision, path = this.path;
    const mine = this.currentText(path);
    const choice = await this.deps.events.onConflict({ path: state.path, mine, disk: state.disk,
      deleted: state.kind !== 'changed', canReload: state.kind === 'changed' });
    if (id !== this.documentId || path !== this.path) return false;
    if (choice === 'keep') { this.deps.events.onResolved?.('Your draft remains open. Autosave is paused until the file conflict is resolved.'); return false; }
    const latest = await this.deps.files.probe(state.path).catch((): DiskProbe => ({ kind: 'unreadable' }));
    const unchangedDisk = latest.kind === 'present' ? state.kind === 'changed' && latest.content === state.disk : latest.kind === state.kind;
    if (!unchangedDisk || (choice === 'reload' && this.revision !== revision)) {
      await this.checkOutside();
      this.deps.events.onError('The file or your draft changed during review. Review the latest version before choosing.');
      return false;
    }
    if (choice === 'reload' && latest.kind === 'present') {
      const ok = await this.load(state.path, false, id, revision);
      if (ok) this.deps.events.onResolved?.('File on disk reloaded. Your previous draft is in Time Machine. Autosave resumed.');
      return ok;
    }
    if (choice === 'copy') {
      const ok = await this.saveAs();
      if (ok) this.deps.events.onResolved?.('Your draft is saved as a separate copy. The outside file was not changed. Autosave resumed.');
      return ok;
    }
    return false;
  }

  private currentText(path: string | null): string {
    return isPlainTextPath(path) ? this.deps.editor.getPlainText?.() ?? this.deps.editor.getMarkdown() : this.deps.editor.getMarkdown();
  }

  private unchanged(id: number, revision: number): boolean {
    return id === this.documentId && revision === this.revision;
  }

  private async load(path: string, quiet: boolean, id: number, revision: number,
    reader: (path: string) => Promise<OpenedDocument> = selected => this.deps.files.read(selected)): Promise<boolean> {
    try {
      const doc = await reader(path);
      if (!this.unchanged(id, revision)) return false;
      this.reset(doc.path, doc.name || nameFromPath(doc.path), doc.content);
      return true;
    } catch (err) {
      if (this.unchanged(id, revision) && !quiet) this.deps.events.onError(describeError(err));
      return false;
    }
  }

  /** Repeated background save failures speak up on the 1st, 5th, 25th... failure, not at every pause. */
  private autosaveFailed(): boolean {
    this.autosaveFails += 1;
    let n = this.autosaveFails;
    while (n > 1 && n % 5 === 0) n /= 5;
    return n === 1;
  }

  private state(): SaveState {
    if (this.inflight > 0) return 'saving';
    if (this.failed) return 'error';
    return this.isDirty ? 'dirty' : 'saved';
  }

  private emit(): void {
    this.deps.events.onChange(this.snapshot());
  }

  private reset(path: string | null, name: string, content: string): void {
    if (isPlainTextPath(path) && this.deps.editor.setPlainText) this.deps.editor.setPlainText(content);
    else this.deps.editor.setMarkdown(content);
    this.path = path;
    this.name = name;
    this.documentId += 1;
    this.saveIntent += 1;
    this.revision += 1;
    this.savedRevision = this.revision;
    this.failed = false;
    this.baseline = path === null ? null : content;
    this.conflictHold = false;
    this.conflictPath = null;
    this.outside = null;
    this.deps.events.onOutside?.(null);
    this.deps.drafts.clear();
    this.simplified = path !== null && !isPlainTextPath(path) && simplifiesMarkdown(content, this.deps.editor.getMarkdown());
    if (this.simplified && path !== null) {
      // The editor will rewrite this file in its own shape on the next save: keep the original first.
      this.deps.events.onKeepVersion?.(path, content);
      this.deps.events.onSimplified?.(path);
    }
    this.emit();
    this.deps.editor.focus();
  }

  private async confirmLeave(): Promise<boolean> {
    if (!this.isDirty) return true;
    if (this.path !== null) {
      if (await this.writeTo(this.path) && !this.isDirty) return true;
      const discard = await this.deps.prompter.confirmDiscard();
      if (discard) this.deps.events.onDiscard?.(this.path);
      return discard;
    }
    if (this.deps.editor.getMarkdown().trim().length === 0) return true;
    return this.deps.prompter.confirmDiscard();
  }

  /** Writes are serialized so overlapping saves never race each other. */
  private writeTo(target: string, adoptPath = false, explicit = true): Promise<boolean> {
    const revision = this.revision;
    const documentId = this.documentId;
    const content = isPlainTextPath(target)
      ? this.deps.editor.getPlainText?.() ?? this.deps.editor.getMarkdown()
      : this.deps.editor.getMarkdown();
    const job = this.queue.then(() =>
      !explicit && this.conflictHold ? false : this.performWrite(target, content, revision, documentId, adoptPath, explicit));
    this.queue = job;
    const result = job.then(async (ok) => {
      if (!ok && this.conflictPath === target && !this.conflictBusy && this.deps.events.onConflict &&
          documentId === this.documentId) {
        this.conflictBusy = true;
        this.conflictPath = null;
        try {
          let disk: string | null = null;
          try { disk = (await this.deps.files.read(target)).content; } catch { /* Deleted or inaccessible. */ }
          if (documentId !== this.documentId) return false;
          const choice = await this.deps.events.onConflict({ path: target, mine: content, disk, deleted: disk === null, canReload: target === this.path && disk !== null });
          if (documentId !== this.documentId) return false;
           if (choice !== 'keep' && this.deps.files.probe) {
             const probe = await this.deps.files.probe(target).catch((): DiskProbe => ({ kind: 'unreadable' }));
             const same = probe.kind === 'present' ? probe.content === disk : disk === null && probe.kind === 'missing';
             if (!same || (choice === 'reload' && this.revision !== revision)) {
               const state = detectOutside(target, this.baseline ?? '', probe);
               this.outside = state; this.deps.events.onOutside?.(state);
               this.deps.events.onError('The file or your draft changed during review. Review the latest version before choosing.');
               return false;
             }
           }
           if (choice === 'reload' && disk !== null && this.revision === revision && this.path === target) {
             const ok = await this.load(target, false, documentId, revision);
             if (ok) this.deps.events.onResolved?.('File on disk reloaded. Your previous draft is in Time Machine. Autosave resumed.');
             return ok;
           }
           if (choice === 'copy') {
             const ok = await this.saveAs();
             if (ok) this.deps.events.onResolved?.('Your draft is saved as a separate copy. The outside file was not changed. Autosave resumed.');
             return ok;
           }
           this.deps.events.onResolved?.('Your draft remains open. Autosave is paused until the file conflict is resolved.');
        } catch (error) { this.deps.events.onError(describeError(error)); }
        finally { this.conflictBusy = false; }
      }
      return ok;
    });
    this.pendingDecisions.add(result);
    void result.then(() => { this.pendingDecisions.delete(result); },
      () => { this.pendingDecisions.delete(result); });
    return result;
  }

  private async performWrite(target: string, content: string, revision: number, documentId: number, adoptPath: boolean, explicit = true): Promise<boolean> {
    if (documentId !== this.documentId || (!adoptPath && this.path !== target)) return false;
    this.inflight += 1;
    this.emit();
    try {
      const expected = adoptPath && target !== this.path ? null : this.baseline;
      const written = await this.deps.files.write(target, content, expected);
      if (documentId !== this.documentId || (!adoptPath && this.path !== target)) return false;
      if (adoptPath) {
        this.path = written;
        this.name = nameFromPath(written);
      }
      this.savedRevision = Math.max(this.savedRevision, revision);
      this.baseline = content;
      this.conflictHold = false;
      this.conflictPath = null;
      this.outside = null;
      this.deps.events.onOutside?.(null);
      this.failed = false;
      this.autosaveFails = 0;
      if (!this.isDirty) this.deps.drafts.clear();
      return true;
    } catch (err) {
      if (documentId === this.documentId && (adoptPath || this.path === target)) {
        this.failed = true;
        if (err instanceof FileChangedError) {
          this.conflictHold = !adoptPath || target === this.path;
          this.conflictPath = target;
          if (!adoptPath && target === this.path) void this.checkOutside();
          if (this.conflictBusy) this.deps.events.onError('That copy destination changed or already exists. Choose a new filename.');
        } else if (explicit || this.autosaveFailed()) this.deps.events.onError(describeError(err));
      }
      return false;
    } finally {
      this.inflight -= 1;
      this.emit();
    }
  }
}
