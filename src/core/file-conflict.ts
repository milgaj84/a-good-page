export type ConflictChoice = 'reload' | 'copy' | 'keep';
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
