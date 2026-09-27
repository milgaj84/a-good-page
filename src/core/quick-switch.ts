import { fuzzyMatch } from './fuzzy';
import { isWritingFile, nameFromPath } from './paths';

export interface HeadingLike { level: number; text: string; pos: number }
export interface WorkspaceFile { name: string; path: string; /** Folder relative to the workspace root, '' for the root. */ folder: string }

export type SwitcherEntry =
  | { kind: 'chapter'; label: string; detail: string; level: number; pos: number }
  | { kind: 'document'; label: string; detail: string; path: string };

const LEVEL_NAMES: Record<number, string> = { 1: 'Title', 2: 'Heading', 3: 'Subheading' };

/** Chapters of the open manuscript come first, then documents from the workspace. */
export function switcherEntries(headings: readonly HeadingLike[], files: readonly WorkspaceFile[], currentPath: string | null): SwitcherEntry[] {
  const chapters: SwitcherEntry[] = headings
    .filter((h) => h.text.trim().length > 0)
    .map((h) => ({ kind: 'chapter', label: h.text.trim(), detail: LEVEL_NAMES[h.level] ?? 'Heading', level: h.level, pos: h.pos }));
  const documents: SwitcherEntry[] = files.map((f) => ({
    kind: 'document', label: nameFromPath(f.path), path: f.path,
    detail: f.path === currentPath ? 'Open now' : f.folder || 'Workspace',
  }));
  return [...chapters, ...documents];
}

function entryScore(query: string, entry: SwitcherEntry): number | null {
  const own = fuzzyMatch(query, entry.label)?.score ?? null;
  if (entry.kind === 'chapter') return own;
  const folder = entry.detail === 'Open now' || entry.detail === 'Workspace' ? '' : entry.detail + ' ';
  const withFolder = folder ? fuzzyMatch(query, folder + entry.label)?.score ?? null : null;
  if (own === null) return withFolder === null ? null : withFolder - 1;
  return withFolder === null ? own : Math.max(own, withFolder - 1);
}

/** Best matches first; an empty query keeps the natural order. */
export function searchSwitcher(query: string, entries: readonly SwitcherEntry[], limit = 50): SwitcherEntry[] {
  return entries
    .map((entry, index) => ({ entry, index, score: entryScore(query, entry) }))
    .filter((x): x is { entry: SwitcherEntry; index: number; score: number } => x.score !== null)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map((x) => x.entry);
}

export interface FolderEntry { name: string; path: string; is_dir: boolean }
export interface FolderListing { root: string; directory: string; entries: FolderEntry[] }
export type ListFolder = (root: string, directory?: string) => Promise<FolderListing>;
export interface CollectLimits { maxDepth?: number; maxFolders?: number; maxFiles?: number }
export interface CollectedFiles { files: WorkspaceFile[]; truncated: boolean }

/**
 * Walks the workspace breadth first through the existing one-folder listing command,
 * so the root checks in Rust still apply. Bounded, so a huge folder cannot stall the app.
 */
export async function collectWorkspaceFiles(list: ListFolder, root: string, limits: CollectLimits = {}): Promise<CollectedFiles> {
  const maxDepth = limits.maxDepth ?? 4;
  const maxFolders = limits.maxFolders ?? 200;
  const maxFiles = limits.maxFiles ?? 2000;
  const files: WorkspaceFile[] = [];
  const queue: { path: string; folder: string; depth: number }[] = [{ path: root, folder: '', depth: 0 }];
  let listed = 0;
  let truncated = false;
  while (queue.length > 0) {
    const next = queue.shift()!;
    if (next.depth > maxDepth || listed >= maxFolders) { truncated = true; continue; }
    listed++;
    let listing: FolderListing;
    try {
      listing = await list(root, next.depth === 0 ? undefined : next.path);
    } catch (error) {
      if (next.depth === 0) throw error;
      continue;
    }
    for (const entry of listing.entries) {
      if (entry.is_dir) {
        queue.push({ path: entry.path, folder: next.folder ? next.folder + '/' + entry.name : entry.name, depth: next.depth + 1 });
      } else if (isWritingFile(entry.path)) {
        if (files.length >= maxFiles) { truncated = true; break; }
        files.push({ name: entry.name, path: entry.path, folder: next.folder });
      }
    }
  }
  return { files, truncated };
}
