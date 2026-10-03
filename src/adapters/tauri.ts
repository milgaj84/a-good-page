import { invoke } from '@tauri-apps/api/core';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { ask } from '@tauri-apps/plugin-dialog';
import type { FileGateway, OpenedDocument, Prompter } from '../core/session';
import { exportRecoveryCopyWith } from '../core/recovery';
import { FileChangedError, type DiskProbe } from '../core/file-conflict';

// Every file and folder picker runs in Rust. The page never names a place on its own: what you pick is
// remembered there, and any other path the page asks for is refused.
const pickSave = (suggested: string, kind: 'writing' | 'pdf' | 'docx' | 'md'): Promise<string | null> =>
  invoke<string | null>('pick_save_file', { suggested, kind });

export const tauriFiles: FileGateway = {
  pickOpenPath: () => invoke<string | null>('pick_open_file', { kind: 'writing' }),
  pickSavePath: (suggestedName: string) => pickSave(suggestedName, 'writing'),
  read: (path: string) => invoke<OpenedDocument>('open_document', { path }),
  probe: (path: string) => invoke<DiskProbe>('probe_document', { path }),
  write: (path: string, content: string, expected?: string | null) => {
    if (expected === undefined) return invoke<string>('save_document', { path, content });
    return invoke<string>('guarded_save_document', { path, content, expected }).catch((error: unknown) => {
      if (String(error).includes('AGP_FILE_CHANGED')) throw new FileChangedError(path);
      throw error;
    });
  },
};

export async function exportPdfFile(suggestedName: string, bytes: Uint8Array, recheck?: () => Promise<void>): Promise<string | null> {
  const path = await pickSave(suggestedName + '.pdf', 'pdf');
  if (!path) return null;
  const target = /\.pdf$/i.test(path) ? path : path + '.pdf';
  if (recheck) await recheck();
  return invoke<string>('export_pdf', { path: target, bytes: Array.from(bytes) });
}

/** Saves a Word or Markdown export through the same guarded write as PDF. Returns the path, or null when the dialog was cancelled. */
export async function exportDocumentFile(suggestedName: string, bytes: Uint8Array, format: 'docx' | 'md', recheck?: () => Promise<void>): Promise<string | null> {
  const extension = format;
  const path = await pickSave(suggestedName + '.' + extension, format);
  if (!path) return null;
  const target = new RegExp('\\.' + extension + '$', 'i').test(path) ? path : path + '.' + extension;
  if (recheck) await recheck();
  return invoke<string>('export_document', { path: target, bytes: Array.from(bytes), kind: format });
}

/** Save a selected historic version separately. A cancelled dialog never changes the open document. */
export async function exportRecoveryCopy(name: string, content: string, livePath: string | null): Promise<boolean> {
  return exportRecoveryCopyWith(name, content, livePath, navigator.userAgent.includes('Windows'),
    (suggestedName) => pickSave(suggestedName, 'writing'),
    (path, words) => tauriFiles.write(path, words, null));
}

/** The Library: a default folder, and create / rename / trash inside it. Rust re-validates every path. */
export function defaultLibrary(): Promise<string> { return invoke<string>('default_library'); }
export function createEntry(root: string, parent: string | null, name: string, kind: 'file' | 'folder'): Promise<string> {
  return invoke<string>('create_entry', { root, parent, name, kind });
}
export function renameEntry(root: string, path: string, newName: string): Promise<string> {
  return invoke<string>('rename_entry', { root, path, newName });
}
export function moveEntry(root: string, path: string, to: string | null): Promise<string> {
  return invoke<string>('move_entry', { root, path, to });
}
export interface BackupSummary { path: string; files: number; bytes: number; pruned: number }
export interface RestoreSummary { restored: string[]; files: number }
export function createBackup(root: string, dest: string, stamp: string, keep: number): Promise<BackupSummary> {
  return invoke<BackupSummary>('create_backup', { root, dest, stamp, keep });
}
export function restoreBackup(root: string, zip: string): Promise<RestoreSummary> {
  return invoke<RestoreSummary>('restore_backup', { root, zip });
}
export function defaultBackupDir(root: string): Promise<string> { return invoke<string>('default_backup_dir', { root }); }
export function chooseBackupFile(): Promise<string | null> { return invoke<string | null>('pick_open_file', { kind: 'zip' }); }
export function trashEntry(root: string, path: string, position?: number): Promise<string> {
  return invoke<string>('trash_entry', { root, path, position: position ?? null });
}
export interface TrashItem { item: string; name: string; original: string; position?: number | null; trashed_at: number; is_dir: boolean }
export function listTrash(root: string): Promise<TrashItem[]> { return invoke<TrashItem[]>('list_trash', { root }); }
export function restoreEntry(root: string, path: string): Promise<string> { return invoke<string>('restore_entry', { root, path }); }
/** A plain yes/no in the system's own dialog, for the few actions that cannot be undone from inside the app. */
export function confirmAction(message: string, okLabel: string): Promise<boolean> {
  return ask(message, { title: 'A Good Page', kind: 'warning', okLabel, cancelLabel: 'Cancel' });
}

export const tauriPrompter: Prompter = {
  confirmDiscard: () =>
    ask('These words have not been saved yet. Discard them?', {
      title: 'A Good Page',
      kind: 'warning',
      okLabel: 'Discard',
      cancelLabel: 'Keep writing',
    }),
};

export async function setWindowTitle(title: string): Promise<void> {
  try {
    await getCurrentWindow().setTitle(title);
  } catch {
    // Title is cosmetic; ignore failures (e.g. running in a plain browser).
  }
}

/** Block native close synchronously, then destroy only after work is safely saved. */
export function onCloseRequested(beforeClose: () => Promise<boolean>): void {
  const window = getCurrentWindow();
  let closing = false;
  window.onCloseRequested((event) => {
    event.preventDefault();
    if (closing) return;
    closing = true;
    void beforeClose().then(async (safe) => {
      if (safe) await window.destroy();
    }).catch((error) => { console.error('Could not close A Good Page', error); }).finally(() => { closing = false; });
  }).catch((error) => { console.error('Could not register close handler', error); });
}

export interface FileDropHandlers {
  onHover(active: boolean): void;
  onDrop(path: string): void;
}

/** Files dragged from the desktop onto the window. Silently unavailable outside Tauri. */
export function onFileDrop(handlers: FileDropHandlers): void {
  try {
    getCurrentWebview()
      .onDragDropEvent((event) => {
        const payload = event.payload;
        if (payload.type === 'enter' || payload.type === 'over') {
          handlers.onHover(true);
        } else if (payload.type === 'leave') {
          handlers.onHover(false);
        } else if (payload.type === 'drop') {
          handlers.onHover(false);
          if (payload.paths.length > 0) handlers.onDrop(payload.paths[0]);
        }
      })
      .catch(() => undefined);
  } catch {
    // Not running inside Tauri.
  }
}

/** Native fullscreen for the writer's chrome-free view. */
export async function setWritingFullscreen(active: boolean): Promise<void> {
  await getCurrentWindow().setFullscreen(active);
}

/** Only the selected directory is scanned. No recursive walk or filesystem plugin grant. */
export interface WorkspaceEntry { name: string; path: string; is_dir: boolean }
export interface WorkspaceListing { root: string; directory: string; entries: WorkspaceEntry[] }
/** Choose a folder to be your Library. Rust remembers the choice. */
export function pickLibraryFolder(): Promise<string | null> { return invoke<string | null>('pick_folder', { purpose: 'library' }); }
/** Choose a folder for backups. */
export function pickBackupFolder(): Promise<string | null> { return invoke<string | null>('pick_folder', { purpose: 'backup' }); }
/** The Library chosen last time, kept by the program rather than by the page. */
export function currentLibrary(): Promise<string | null> { return invoke<string | null>('current_library'); }
/** Switch to a Library used before. */
export function useLibrary(path: string): Promise<string> { return invoke<string>('use_library', { path }); }
/** Carry over a Library remembered by an older version, after the program asks you to confirm the folder. */
export function adoptLibrary(path: string): Promise<string> { return invoke<string>('adopt_library', { path }); }
export function listWorkingDirectory(root: string, directory?: string): Promise<WorkspaceListing> {
  return invoke<WorkspaceListing>('list_workspace', { root, directory: directory ?? null });
}

/** Workspace clicks are revalidated on the Rust side immediately before opening. */
export function openWorkingFile(root: string, path: string): Promise<OpenedDocument> {
  return invoke<OpenedDocument>('open_workspace_file', { root, path });
}

/** The small project order file lives beside chapters; only the chosen root is accepted by Rust. */
export function readProjectOrder(root: string): Promise<string | null> {
  return invoke<string | null>('read_project_order', { root });
}
export function writeProjectOrder(root: string, expected: string | null, value: string): Promise<string> {
  return invoke<string>('write_project_order', { root, expected, value });
}
