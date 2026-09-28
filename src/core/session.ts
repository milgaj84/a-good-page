import { isPlainTextPath, nameFromPath, UNTITLED } from './paths';
import { FileChangedError, type ConflictChoice, type FileConflict } from './file-conflict';

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
  write(path: string, content: string, expected?: string | null): Promise<string>;
}

export interface Prompter {
  confirmDiscard(): Promise<boolean>;
}

export interface DraftStore {
  load(): string | null;
  save(markdown: string): void;
  clear(): void;
  /** Optional: stores a draft whose markdown is read later, keeping serialisation off the keystroke path. */
  saveLazy?(read: () => string): void;
}

export interface SessionEvents {
  onChange(snapshot: SessionSnapshot): void;
  onError(message: string): void;
  onConflict?(conflict: FileConflict): Promise<ConflictChoice>;
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
  private pendingDecision: Promise<unknown> | null = null;
  private baseline: string | null = null;
  private conflictHold = false;
  private conflictBusy = false;
  private conflictPath: string | null = null;

  constructor(private readonly deps: SessionDeps) {}

  get isDirty(): boolean {
    return this.revision !== this.savedRevision;
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
  async settleWrites(): Promise<void> { await this.queue; await this.pendingDecision; }

  /** Explicit discard on quit must not reopen an untitled draft next launch. */
  discardDraft(): void {
    this.saveIntent += 1;
    if (this.path === null) this.deps.drafts.clear();
  }

  save(): Promise<boolean> {
    return this.path === null ? this.saveAs() : this.writeTo(this.path);
  }

  async saveAs(): Promise<boolean> {
    const id = this.documentId;
    const intent = this.saveIntent;
    try {
      const chosen = await this.deps.files.pickSavePath(this.name + '.md');
      if (!chosen || id !== this.documentId || intent !== this.saveIntent) return false;
      return this.writeTo(chosen, true);
    } catch (error) {
      if (id === this.documentId && intent === this.saveIntent) this.deps.events.onError(describeError(error));
      return false;
    }
  }

  async autosave(): Promise<boolean> {
    if (this.path === null || !this.isDirty || this.conflictHold) return false;
    return this.writeTo(this.path);
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
    this.deps.drafts.clear();
    this.emit();
    this.deps.editor.focus();
  }

  private async confirmLeave(): Promise<boolean> {
    if (!this.isDirty) return true;
    if (this.path !== null) {
      if (await this.writeTo(this.path) && !this.isDirty) return true;
      return this.deps.prompter.confirmDiscard();
    }
    if (this.deps.editor.getMarkdown().trim().length === 0) return true;
    return this.deps.prompter.confirmDiscard();
  }

  /** Writes are serialized so overlapping saves never race each other. */
  private writeTo(target: string, adoptPath = false): Promise<boolean> {
    const revision = this.revision;
    const documentId = this.documentId;
    const content = isPlainTextPath(target)
      ? this.deps.editor.getPlainText?.() ?? this.deps.editor.getMarkdown()
      : this.deps.editor.getMarkdown();
    const job = this.queue.then(() => this.performWrite(target, content, revision, documentId, adoptPath));
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
          if (choice === 'reload' && disk !== null && this.revision === revision && this.path === target) {
            return this.load(target, false, documentId, revision);
          }
          if (choice === 'copy') return this.saveAs();
        } catch (error) { this.deps.events.onError(describeError(error)); }
        finally { this.conflictBusy = false; }
      }
      return ok;
    });
    this.pendingDecision = result;
    void result.then(() => { if (this.pendingDecision === result) this.pendingDecision = null; },
      () => { if (this.pendingDecision === result) this.pendingDecision = null; });
    return result;
  }

  private async performWrite(target: string, content: string, revision: number, documentId: number, adoptPath: boolean): Promise<boolean> {
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
      this.failed = false;
      if (!this.isDirty) this.deps.drafts.clear();
      return true;
    } catch (err) {
      if (documentId === this.documentId && (adoptPath || this.path === target)) {
        this.failed = true;
        if (err instanceof FileChangedError) {
          this.conflictHold = !adoptPath || target === this.path;
          this.conflictPath = target;
          if (this.conflictBusy) this.deps.events.onError('That copy destination changed or already exists. Choose a new filename.');
        } else this.deps.events.onError(describeError(err));
      }
      return false;
    } finally {
      this.inflight -= 1;
      this.emit();
    }
  }
}
