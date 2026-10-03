import type { KeyValueStore } from './ports';
import { relativeLabel } from './snapshots';

export const BACKUP_KEY = 'agp.backup.v1';
export const BACKUP_MODES = ['off', 'daily', 'weekly'] as const;
export type BackupMode = (typeof BACKUP_MODES)[number];

export interface BackupSettings {
  mode: BackupMode;
  /** null means the suggested folder beside the Library. */
  dir: string | null;
  keep: number;
  lastAt: number | null;
  lastFiles: number;
  lastPath: string | null;
}

export const DEFAULT_BACKUP: Readonly<BackupSettings> = Object.freeze({ mode: 'off', dir: null, keep: 7, lastAt: null, lastFiles: 0, lastPath: null });

export function sanitizeBackup(raw: unknown): BackupSettings {
  const o = (raw !== null && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const keep = typeof o.keep === 'number' && Number.isFinite(o.keep) ? Math.min(60, Math.max(1, Math.round(o.keep))) : DEFAULT_BACKUP.keep;
  return {
    mode: (BACKUP_MODES as readonly unknown[]).includes(o.mode) ? (o.mode as BackupMode) : 'off',
    dir: typeof o.dir === 'string' && o.dir.trim() ? o.dir : null,
    keep,
    lastAt: typeof o.lastAt === 'number' && Number.isFinite(o.lastAt) ? o.lastAt : null,
    lastFiles: typeof o.lastFiles === 'number' && o.lastFiles >= 0 ? Math.floor(o.lastFiles) : 0,
    lastPath: typeof o.lastPath === 'string' ? o.lastPath : null,
  };
}

const HOUR = 3_600_000;

/** Whether an automatic backup should run now. An hour of slack keeps "every day" from drifting later each day. */
export function isDue(settings: BackupSettings, now: number): boolean {
  if (settings.mode === 'off') return false;
  if (settings.lastAt === null) return true;
  const gap = settings.mode === 'daily' ? 24 * HOUR : 7 * 24 * HOUR;
  return now - settings.lastAt >= gap - HOUR;
}

const pad = (n: number): string => String(n).padStart(2, '0');

/** "2026-10-03 1432" in the writer's own time, so backups sort by name and read naturally. */
export function stampOf(date: Date): string {
  return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()) + ' ' + pad(date.getHours()) + pad(date.getMinutes());
}

export function describeLast(settings: BackupSettings, now: number): string {
  if (settings.lastAt === null) return 'No backup yet.';
  return 'Last backup: ' + relativeLabel(settings.lastAt, now) + ' · ' + settings.lastFiles + (settings.lastFiles === 1 ? ' file' : ' files');
}

export class BackupStore {
  constructor(private readonly store: KeyValueStore) {}
  load(): BackupSettings {
    try { return sanitizeBackup(JSON.parse(this.store.get(BACKUP_KEY) ?? 'null')); }
    catch { return { ...DEFAULT_BACKUP }; }
  }
  save(settings: BackupSettings): void { this.store.set(BACKUP_KEY, JSON.stringify(settings)); }
}
