/** Injectable clock so debouncing is deterministic under test. */
export interface Scheduler {
  set(fn: () => void, ms: number): unknown;
  clear(handle: unknown): void;
}

export const browserScheduler: Scheduler = {
  set: (fn, ms) => setTimeout(fn, ms),
  clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

export class Debouncer {
  private handle: unknown = null;

  constructor(
    private readonly fn: () => void,
    private readonly delayMs: number,
    private readonly scheduler: Scheduler,
  ) {
    if (!Number.isFinite(delayMs) || delayMs < 0) {
      throw new RangeError('delayMs must be a non-negative finite number');
    }
  }

  get pending(): boolean {
    return this.handle !== null;
  }

  trigger(): void {
    this.cancel();
    this.handle = this.scheduler.set(() => {
      this.handle = null;
      this.fn();
    }, this.delayMs);
  }

  cancel(): void {
    if (this.handle !== null) {
      this.scheduler.clear(this.handle);
      this.handle = null;
    }
  }

  /** Runs a pending call immediately; does nothing when idle. */
  flush(): void {
    if (this.handle === null) return;
    this.cancel();
    this.fn();
  }
}
