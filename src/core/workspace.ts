import type { KeyValueStore } from './ports';
export const RECENT_WORKSPACES_KEY = 'hearth.workspaces.recent.v1';
export const ACTIVE_WORKSPACE_KEY = 'hearth.workspaces.active.v1';
export const MAX_RECENT_WORKSPACES = 5;

function usable(value: unknown): value is string { return typeof value === 'string' && value.trim().length > 0; }
/** Persist successful directory selections only; malformed storage degrades to empty. */
export class WorkspaceHistory {
  constructor(private readonly storage: KeyValueStore) {}
  get recent(): string[] {
    try {
      const data: unknown = JSON.parse(this.storage.get(RECENT_WORKSPACES_KEY) ?? '[]');
      return Array.isArray(data) ? [...new Set(data.filter(usable))].slice(0, MAX_RECENT_WORKSPACES) : [];
    } catch { return []; }
  }
  get active(): string | null { const value = this.storage.get(ACTIVE_WORKSPACE_KEY); return usable(value) ? value : null; }
  forget(path: string): void {
    this.storage.set(RECENT_WORKSPACES_KEY, JSON.stringify(this.recent.filter(item => item !== path)));
    if (this.active === path) this.storage.remove(ACTIVE_WORKSPACE_KEY);
  }
  select(path: string): void {
    if (!usable(path)) throw new RangeError('Choose a working directory.');
    this.storage.set(ACTIVE_WORKSPACE_KEY, path);
    this.storage.set(RECENT_WORKSPACES_KEY, JSON.stringify([path, ...this.recent.filter(p => p !== path)].slice(0, MAX_RECENT_WORKSPACES)));
  }
}

/** Keep the native Save As picker inside the viewed folder on either desktop path style. */
export function suggestedSavePath(folder: string | null, filename: string): string {
  if (!folder) return filename;
  const separator=folder.includes('\\') ? '\\' : '/';
  return folder.replace(/[\\/]$/, '') + separator + filename;
}

/** A local, case-insensitive filter: it never triggers a recursive disk search. */
export function filterWorkspaceItems<T extends { name: string }>(items: readonly T[], query: string): T[] {
  const needle=query.trim().toLocaleLowerCase();
  return needle ? items.filter(item=>item.name.toLocaleLowerCase().includes(needle)) : [...items];
}

/** Arrow navigation wraps among visible entries only. */
export function nextWorkspaceIndex(current: number, count: number, direction: 1 | -1): number {
  if (count <= 0) return -1;
  return (current + direction + count) % count;
}
