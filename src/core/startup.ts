import type { DocumentSession } from './session';
/** Restore writing first; an old path never replaces a recovered untitled draft. */
export async function restoreLastDocument(
  doc: Pick<DocumentSession, 'restoreDraft' | 'openPath' | 'snapshot'>,
  lastPath: string | null,
  notify: (message: string) => void,
): Promise<boolean> {
  if (doc.restoreDraft()) { notify('Welcome back. Your draft is right where you left it.'); return true; }
  if (lastPath && await doc.openPath(lastPath, { quiet: true })) {
    notify('Welcome back to ' + doc.snapshot().name + '.'); return true;
  }
  return false;
}
