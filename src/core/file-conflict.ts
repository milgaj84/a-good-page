export type ConflictChoice = 'reload' | 'copy' | 'keep';
export type DiskProbe = { kind: 'present'; content: string } | { kind: 'missing' } | { kind: 'unreadable' };
export type OutsideState = { path: string; kind: 'changed' | 'missing' | 'unreadable'; disk: string | null };
export function detectOutside(path: string, expected: string, probe: DiskProbe): OutsideState | null {
  if (probe.kind === 'present' && probe.content === expected) return null;
  return { path, kind: probe.kind === 'present' ? 'changed' : probe.kind, disk: probe.kind === 'present' ? probe.content : null };
}
export function copySuggestion(name: string): string {
  const dot = name.lastIndexOf('.');
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '.md';
  return stem + '-my-copy' + ext;
}
export class FileChangedError extends Error {
  constructor(readonly path: string) { super('This file changed outside A Good Page. Your words were not overwritten.'); this.name = 'FileChangedError'; }
}
export interface FileConflict { path: string; mine: string; disk: string | null; deleted: boolean; canReload: boolean }
/** Bounded paragraph preview; never truncate the underlying document. */
export function compareParagraphs(mine: string, disk: string | null): { mine: string[]; disk: string[] } {
  const paragraphs = (text: string) => text.replaceAll(String.fromCharCode(13), '').split(String.fromCharCode(10, 10)).slice(0, 300);
  return { mine: paragraphs(mine), disk: disk === null ? [] : paragraphs(disk) };
}

/** A failed recovery capture must not turn into a destructive Reload. */
export async function protectReload(choice: ConflictChoice, preserve: () => Promise<void>): Promise<ConflictChoice> {
  if (choice === 'reload') await preserve();
  return choice;
}

/** Writer-facing wording stays precise when a file cannot be read. */
export function conflictCopy(conflict: Pick<FileConflict, 'deleted' | 'canReload' | 'disk'>): { title: string; message: string } {
  if (!conflict.canReload && conflict.disk !== null) return {
    title: 'That filename is already in use',
    message: 'Nothing was replaced. Choose a different filename for your copy, or keep writing here.',
  };
  if (conflict.deleted) return {
    title: 'This file is unavailable',
    message: 'The file could not be found or read. Your draft remains open and autosave is paused. Save a copy to a different filename before closing.',
  };
  return {
    title: 'This file changed elsewhere',
    message: 'The version on disk differs from the one you opened. Autosave is paused; review both versions before choosing what to keep.',
  };
}
