import { BackupStore, describeLast, isDue, stampOf, type BackupMode, type BackupSettings } from '../core/backup';
import type { KeyValueStore } from '../core/ports';

export interface BackupDeps {
  store: KeyValueStore;
  root(): string | null;
  io: {
    create(root: string, dest: string, stamp: string, keep: number): Promise<{ path: string; files: number; bytes: number; pruned: number }>;
    restore(root: string, zip: string): Promise<{ restored: string[]; files: number }>;
    defaultDir(root: string): Promise<string>;
    pickFolder(): Promise<string | null>;
    pickZip(): Promise<string | null>;
  };
  notify(message: string): void;
  /** Redraw the settings panel. */
  changed(): void;
  /** Reread the Library after a restore. */
  refreshLibrary(): Promise<void>;
  now(): number;
}

const message = (error: unknown): string => (error instanceof Error ? error.message : String(error));
const CHECK_EVERY_MS = 30 * 60_000;

/** Backs the Library up to a zip (by hand or on a schedule) and restores one next to the existing work. */
export class BackupController {
  private readonly store: BackupStore;
  settings: BackupSettings;
  private busy = false;
  private warned = false;
  private defaultDir: string | null = null;

  constructor(private readonly d: BackupDeps) {
    this.store = new BackupStore(d.store);
    this.settings = this.store.load();
  }

  private save(patch: Partial<BackupSettings>): void {
    this.settings = { ...this.settings, ...patch };
    this.store.save(this.settings);
    this.d.changed();
  }

  /** The folder backups go to: the chosen one, else a sibling of the Library. */
  async folder(): Promise<string | null> {
    if (this.settings.dir) return this.settings.dir;
    const root = this.d.root();
    if (!root) return null;
    this.defaultDir ??= await this.d.io.defaultDir(root).catch(() => null);
    return this.defaultDir;
  }

  status(): string { return describeLast(this.settings, this.d.now()); }

  setMode(mode: BackupMode): void {
    this.save({ mode });
    if (mode !== 'off') void this.runIfDue();
  }

  async chooseFolder(): Promise<void> {
    const picked = await this.d.io.pickFolder();
    if (!picked) return;
    this.defaultDir = null;
    this.save({ dir: picked });
  }

  /** Makes a backup now. `auto` runs quietly and only speaks if it fails (once per session). */
  async backupNow(auto = false): Promise<boolean> {
    const root = this.d.root();
    if (this.busy || !root) return false;
    this.busy = true;
    try {
      const dest = await this.folder();
      if (!dest) throw new Error('Choose a backup folder first.');
      const now = this.d.now();
      const result = await this.d.io.create(root, dest, stampOf(new Date(now)), this.settings.keep);
      this.save({ lastAt: now, lastFiles: result.files, lastPath: result.path });
      this.d.notify(auto ? 'Library backed up (' + result.files + ' files).' : 'Backed up ' + result.files + (result.files === 1 ? ' file' : ' files') + ' to ' + result.path);
      return true;
    } catch (error) {
      if (!auto || !this.warned) this.d.notify('Backup did not finish: ' + message(error));
      if (auto) this.warned = true;
      return false;
    } finally { this.busy = false; }
  }

  async runIfDue(): Promise<void> {
    if (isDue(this.settings, this.d.now())) await this.backupNow(true);
  }

  /** Adds a backup's projects and pages to the Library, never over what is there. */
  async restore(): Promise<void> {
    const root = this.d.root();
    if (!root) return;
    const zip = await this.d.io.pickZip();
    if (!zip) return;
    try {
      const result = await this.d.io.restore(root, zip);
      await this.d.refreshLibrary();
      const list = result.restored.slice(0, 4).join(', ') + (result.restored.length > 4 ? ' and ' + (result.restored.length - 4) + ' more' : '');
      this.d.notify('Restored ' + result.files + (result.files === 1 ? ' file' : ' files') + ' next to your own: ' + list + '.');
    } catch (error) { this.d.notify('Could not restore: ' + message(error)); }
  }

  /** Checks shortly after launch and then every half hour while the app is open. */
  start(): void {
    window.setTimeout(() => void this.runIfDue(), 8_000);
    window.setInterval(() => void this.runIfDue(), CHECK_EVERY_MS);
  }
}
