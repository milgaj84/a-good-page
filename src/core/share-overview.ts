import type { ProjectEntry } from './project-service';
import type { PreviewState } from './workflow';

export interface ShareOverview {
  selected: number;
  words: number;
  available: number;
  blocked: number;
  state: 'choose' | 'repair' | 'read' | 'refresh' | 'export';
}

/** Counts only readable selected chapters; never implies that a preview is already fresh. */
export function shareOverview(entries: readonly ProjectEntry[], selected: ReadonlySet<string>, preview: PreviewState): ShareOverview {
  const chosen = entries.filter(entry => entry.file !== null && selected.has(entry.path));
  const blocked = entries.filter(entry => entry.file === null).length;
  const state = blocked ? 'repair' : !chosen.length ? 'choose' : preview === 'stale' ? 'refresh' : preview === 'ready' ? 'export' : 'read';
  return { selected: chosen.length, words: chosen.reduce((sum, entry) => sum + entry.file!.words, 0),
    available: entries.length - blocked, blocked, state };
}
