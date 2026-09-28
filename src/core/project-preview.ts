import type { ProjectEntry, ProjectSnapshot } from './project-service';
export interface PreviewInventory { included: { path: string; title: string; words: number; order: number }[]; excluded: string[]; totalWords: number }
/** One immutable summary drives the visual inventory and export status. */
export function previewInventory(entries: readonly ProjectEntry[], snapshot: ProjectSnapshot): PreviewInventory {
  const included = snapshot.chapters.map((file, index) => ({ path: file.path, title: file.title, words: file.words, order: index + 1 }));
  const chosen = new Set(included.map(item => item.path));
  return { included, excluded: entries.filter(item => !chosen.has(item.path)).map(item => item.path),
    totalWords: included.reduce((sum, item) => sum + item.words, 0) };
}
export type ProjectChangeKind = 'order' | 'missing' | 'content';
export class ProjectChangeError extends Error {
  constructor(readonly kind: ProjectChangeKind, readonly path: string) {
    super(kind === 'order' ? 'Project order changed. Refresh preview.' :
      kind === 'missing' ? path + ' is missing or unreadable. Refresh preview.' :
        path + ' changed on disk. Refresh preview before export.');
    this.name = 'ProjectChangeError';
  }
}
