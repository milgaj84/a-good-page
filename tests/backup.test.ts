import { describe, expect, it, vi } from 'vitest';
import { BACKUP_KEY, BackupStore, DEFAULT_BACKUP, describeLast, isDue, sanitizeBackup, stampOf } from '../src/core/backup';
import { BackupController, type BackupDeps } from '../src/app/backup';

const HOUR = 3_600_000;
const mem = () => { const m = new Map<string, string>(); return { m, api: { get: (k: string) => m.get(k) ?? null, set: (k: string, v: string) => { m.set(k, v); }, remove: (k: string) => { m.delete(k); } } }; };

describe('backup settings and schedule', () => {
  it('cleans anything stored', () => {
    expect(sanitizeBackup(null)).toEqual(DEFAULT_BACKUP);
    expect(sanitizeBackup({ mode: 'hourly', keep: 9999, dir: '  ', lastAt: 'x' })).toMatchObject({ mode: 'off', keep: 60, dir: null, lastAt: null });
    expect(sanitizeBackup({ mode: 'weekly', keep: 0, dir: '/b' })).toMatchObject({ mode: 'weekly', keep: 1, dir: '/b' });
  });
  it('knows when an automatic backup is due, with an hour of slack', () => {
    const now = 1_790_000_000_000;
    const s = (over: object) => ({ ...DEFAULT_BACKUP, ...over });
    expect(isDue(s({ mode: 'off' }), now)).toBe(false);
    expect(isDue(s({ mode: 'daily' }), now)).toBe(true);
    expect(isDue(s({ mode: 'daily', lastAt: now - 23 * HOUR - 30 * 60_000 }), now)).toBe(true);
    expect(isDue(s({ mode: 'daily', lastAt: now - 20 * HOUR }), now)).toBe(false);
    expect(isDue(s({ mode: 'weekly', lastAt: now - 3 * 24 * HOUR }), now)).toBe(false);
    expect(isDue(s({ mode: 'weekly', lastAt: now - 7 * 24 * HOUR }), now)).toBe(true);
  });
  it('names backups by local time so they sort and read naturally', () => {
    expect(stampOf(new Date(2026, 9, 3, 14, 5))).toBe('2026-10-03 1405');
    expect(stampOf(new Date(2026, 0, 9, 0, 0))).toBe('2026-01-09 0000');
  });
  it('describes the last backup in plain words', () => {
    const now = 1_790_000_000_000;
    expect(describeLast(DEFAULT_BACKUP, now)).toBe('No backup yet.');
    expect(describeLast({ ...DEFAULT_BACKUP, lastAt: now - 5 * 60_000, lastFiles: 41 }, now)).toBe('Last backup: 5 minutes ago · 41 files');
    expect(describeLast({ ...DEFAULT_BACKUP, lastAt: now - 5 * 60_000, lastFiles: 1 }, now)).toContain('1 file');
  });
  it('survives damaged storage', () => {
    const { m, api } = mem();
    m.set(BACKUP_KEY, '{nope');
    expect(new BackupStore(api).load()).toEqual(DEFAULT_BACKUP);
  });
});

function controller(over: Partial<BackupDeps['io']> = {}, root: string | null = '/lib/My Library') {
  const { m, api } = mem();
  const notes: string[] = [];
  let now = 1_790_000_000_000;
  const io = {
    create: vi.fn(async (_r: string, dest: string, stamp: string) => ({ path: dest + '/My Library backup ' + stamp + '.zip', files: 12, bytes: 999, pruned: 0 })),
    restore: vi.fn(async () => ({ restored: ['Novel (restored)'], files: 3 })),
    defaultDir: vi.fn(async (r: string) => r + ' backups'),
    pickFolder: vi.fn(async () => '/Backups'),
    pickZip: vi.fn(async () => '/Backups/x.zip'),
    ...over,
  };
  const refresh = vi.fn(async () => undefined);
  const c = new BackupController({ store: api, root: () => root, io, notify: m2 => { notes.push(m2); }, changed: () => undefined, refreshLibrary: refresh, now: () => now });
  return { c, io, notes, refresh, m, tick: (ms: number) => { now += ms; } };
}

describe('backup controller', () => {
  it('backs up to the suggested folder beside the Library and remembers when', async () => {
    const t = controller();
    expect(await t.c.backupNow()).toBe(true);
    expect(t.io.create).toHaveBeenCalledWith('/lib/My Library', '/lib/My Library backups', expect.stringMatching(/^\d{4}-\d\d-\d\d \d{4}$/), 7);
    expect(t.c.settings.lastFiles).toBe(12);
    expect(t.c.status()).toContain('12 files');
    expect(t.notes[0]).toContain('Backed up 12 files to /lib/My Library backups/');
  });
  it('uses the folder you chose, and keeps the number you set', async () => {
    const t = controller();
    await t.c.chooseFolder();
    await t.c.backupNow();
    expect(vi.mocked(t.io.create).mock.calls[0][1]).toBe('/Backups');
  });
  it('runs automatically when due, quietly, and not again straight after', async () => {
    const t = controller();
    t.c.setMode('daily');
    await vi.waitFor(() => expect(t.io.create).toHaveBeenCalledTimes(1));
    expect(t.notes.at(-1)).toBe('Library backed up (12 files).');
    await t.c.runIfDue();
    expect(t.io.create).toHaveBeenCalledTimes(1);
    t.tick(25 * HOUR);
    await t.c.runIfDue();
    expect(t.io.create).toHaveBeenCalledTimes(2);
  });
  it('never runs when automatic backups are off', async () => {
    const t = controller();
    await t.c.runIfDue();
    expect(t.io.create).not.toHaveBeenCalled();
  });
  it('explains a failure, and an automatic failure only once per session', async () => {
    const t = controller({ create: vi.fn(async () => { throw new Error('disk full'); }) });
    expect(await t.c.backupNow()).toBe(false);
    expect(t.notes.at(-1)).toContain('disk full');
    const quiet = controller({ create: vi.fn(async () => { throw new Error('disk full'); }) });
    await quiet.c.backupNow(true);
    await quiet.c.backupNow(true);
    expect(quiet.notes).toHaveLength(1);
  });
  it('does nothing without a Library, and does not run two backups at once', async () => {
    const none = controller({}, null);
    expect(await none.c.backupNow()).toBe(false);
    let release: () => void = () => undefined;
    const slow = controller({ create: vi.fn(() => new Promise<{ path: string; files: number; bytes: number; pruned: number }>(r => { release = () => r({ path: 'p', files: 1, bytes: 1, pruned: 0 }); })) });
    const first = slow.c.backupNow();
    await Promise.resolve();
    expect(await slow.c.backupNow()).toBe(false);
    await vi.waitFor(() => expect(slow.io.create).toHaveBeenCalled());
    release();
    expect(await first).toBe(true);
  });
  it('restores next to the existing work, refreshes the Library and says what was added', async () => {
    const t = controller();
    await t.c.restore();
    expect(t.io.restore).toHaveBeenCalledWith('/lib/My Library', '/Backups/x.zip');
    expect(t.refresh).toHaveBeenCalled();
    expect(t.notes[0]).toBe('Restored 3 files next to your own: Novel (restored).');
    const cancelled = controller({ pickZip: vi.fn(async () => null) });
    await cancelled.c.restore();
    expect(cancelled.io.restore).not.toHaveBeenCalled();
    const failing = controller({ restore: vi.fn(async () => { throw new Error('not a backup'); }) });
    await failing.c.restore();
    expect(failing.notes[0]).toContain('not a backup');
  });
});
