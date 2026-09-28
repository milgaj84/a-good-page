import type { SessionSnapshot } from './session';
import type { NamedRecoveryStore } from './named-recovery';
import type { Scheduler } from './debounce';
/** Saves named unsaved words after typing pauses; never claims a disk save happened. */
export class NamedRecoveryWriter {
  private armed = false;
  private handle: unknown = null;
  private current: SessionSnapshot | null = null;
  private warned = false;
  private deferred: string | null = null;
  constructor(private readonly store: NamedRecoveryStore, private readonly schedule: Scheduler,
    private readonly read: (path: string) => { baseline: string | null; content: string },
    private readonly notify: (message: string) => void, private readonly delay = 500) {}
  arm(): void { this.armed = true; }
  defer(path: string): void { this.deferred = path; this.cancel(); }
  change(snapshot: SessionSnapshot): void {
    this.current = snapshot;
    if (!this.armed || !snapshot.path || snapshot.path === this.deferred) return;
    if (snapshot.state === 'saved') { this.cancel(); this.store.clear(snapshot.path); return; }
    if (this.handle !== null) return;
    this.handle = this.schedule.set(() => { this.handle = null; this.flush(); }, this.delay);
  }
  flush(): void {
    this.cancel();
    const path = this.current?.path;
    if (!this.armed || !path || path === this.deferred || this.current?.state === 'saved') return;
    const { baseline, content } = this.read(path);
    if (baseline === null) return;
    if (!this.store.save(path, baseline, content)) {
      if (!this.warned) this.notify('Local recovery could not be stored. Save a separate copy of your work.');
      this.warned = true;
    } else this.warned = false;
  }
  discard(path: string): void { this.cancel(); this.store.discard(path); if (this.deferred === path) this.deferred = null; }
  private cancel(): void { if (this.handle !== null) this.schedule.clear(this.handle); this.handle = null; }
}
