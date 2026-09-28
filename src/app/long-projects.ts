import type { AppAction } from '../core/commands';
import type { KeyValueStore } from '../core/ports';
import type { HeadingLike, ListFolder, CollectedFiles } from '../core/quick-switch';
import { collectWorkspaceFiles } from '../core/quick-switch';
import { ReferencePin } from '../core/reference-pin';
import { SnapshotStore, snapshotDocKey, type AsyncKeyValue } from '../core/snapshots';
import { SprintStore } from '../core/sprint';
import { recoveryFileName } from '../core/recovery';
import type { ReaderView } from '../editor/reader';
import { QuickSwitcher } from '../ui/quick-switcher';
import { ReferencePanel } from '../ui/reference-panel';
import { SprintRing } from '../ui/sprint-ring';
import { TimeMachine } from '../ui/time-machine';

export type LongProjectAction = Extract<AppAction, 'switcher' | 'reference' | 'timeMachine' | 'sprint' | 'polish'>;

export interface LongProjectDeps {
  host: HTMLElement;
  store: KeyValueStore;
  snapshotBackend: AsyncKeyValue;
  now(): number;
  every(ms: number, task: () => void): void;
  /** The open document: path (null when untitled), display name, and whether it is plain text. */
  current(): { path: string | null; name: string; plain: boolean };
  content(): string;
  words(): number;
  headings(): readonly HeadingLike[];
  jump(pos: number): void;
  restoreFocus(): void;
  polish(): number;
  replaceContent(content: string): void;
  workspaceRoot(): string | null;
  listFolder: ListFolder;
  openWorkspaceFile(root: string, path: string): void;
  readFile(path: string): Promise<{ content: string }>;
  pickFile(): Promise<string | null>;
  exportRecoveryCopy(name: string, content: string, livePath: string | null): Promise<boolean>;
  createReader(element: HTMLElement): ReaderView;
  notify(message: string): void;
}

const FILE_CACHE_MS = 30_000;
const SNAPSHOT_EVERY_MS = 10 * 60_000;

/** Quick switcher, pinned notes, sprint ring, version history and typography polish, wired to the app by injection. */
export function createLongProjects(deps: LongProjectDeps) {
  const snapshots = new SnapshotStore(deps.snapshotBackend, deps.now);
  const docKey = () => snapshotDocKey(deps.current().path);
  let cache: { root: string; at: number; files: Promise<CollectedFiles> } | null = null;

  const capture = async (): Promise<string> => {
    const content = deps.content();
    try {
      await snapshots.capture(docKey(), content);
    } catch (error) {
      deps.notify('Could not keep a version: ' + String(error));
    }
    return content;
  };

  const switcher = new QuickSwitcher(deps.host, {
    headings: deps.headings,
    currentPath: () => deps.current().path,
    files: async () => {
      const root = deps.workspaceRoot();
      if (!root) return null;
      if (!cache || cache.root !== root || deps.now() - cache.at > FILE_CACHE_MS) {
        const files = collectWorkspaceFiles(deps.listFolder, root);
        cache = { root, at: deps.now(), files };
        files.catch(() => { if (cache?.files === files) cache = null; });
      }
      return cache.files;
    },
    jump: deps.jump,
    openDocument: (path) => { const root = deps.workspaceRoot(); if (root) deps.openWorkspaceFile(root, path); },
    restoreFocus: deps.restoreFocus,
  });

  const reference = new ReferencePanel(deps.host, {
    pin: new ReferencePin(deps.store), read: deps.readFile, pickPath: deps.pickFile,
    currentPath: () => deps.current().path, createReader: deps.createReader, notify: deps.notify,
  });

  const sprint = new SprintRing(deps.host, {
    sprints: new SprintStore(deps.store, deps.now), words: deps.words, docKey,
    notify: deps.notify, restoreFocus: deps.restoreFocus,
  });

  const timeMachine = new TimeMachine(deps.host, {
    versions: () => snapshots.list(docKey()),
    captureCurrent: capture,
    restore: deps.replaceContent,
    isPlain: () => deps.current().plain,
    documentName: () => deps.current().name,
    createReader: deps.createReader,
    now: deps.now,
    exportCopy: (version) => deps.exportRecoveryCopy(recoveryFileName(deps.current().name, version.at, deps.current().plain), version.content, deps.current().path),
    notify: deps.notify,
  });

  // Identical content is never stored twice, so a quiet timer costs nothing while the writer is away.
  deps.every(SNAPSHOT_EVERY_MS, () => void capture());
  reference.restore();

  const actions: Record<LongProjectAction, () => void> = {
    switcher: () => switcher.toggle(),
    reference: () => reference.toggle(),
    timeMachine: () => timeMachine.toggle(),
    sprint: () => sprint.toggleForm(),
    polish: () => {
      const changed = deps.polish();
      deps.notify(changed ? 'Typography polished: dashes, ellipses and quotes. Undo reverts it.' : 'Typography already looks polished.');
    },
  };

  return {
    actions,
    /** Preserve the current draft before an explicit Reload discards it. Failure blocks Reload. */
    async preserveBeforeReload(): Promise<void> {
      const content = deps.content();
      if (content.trim()) await snapshots.capture(docKey(), content);
    },
    /** Closes the top-most long-project layer; false when none was open. */
    closeLayer(): boolean {
      if (timeMachine.isOpen) { timeMachine.close(); return true; }
      if (switcher.isOpen) { switcher.close(); return true; }
      if (sprint.isOpen) { sprint.closeForm(); return true; }
      return false;
    },
    /** A different document is on the page: keep a version of it and drop state that belonged to the old one. */
    documentLoaded(): void {
      timeMachine.documentChanged();
      sprint.update();
      void capture();
    },
    saved(): void { cache = null; void capture(); },
    statsChanged(): void { sprint.update(); },
  };
}
