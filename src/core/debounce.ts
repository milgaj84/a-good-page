/** Injectable clock so debouncing is deterministic under test. */
export interface Scheduler {
  set(fn: () => void, ms: number): unknown;
  clear(handle: unknown): void;
}

export const browserScheduler: Scheduler = {
  set: (fn, ms) => setTimeout(fn, ms),
  clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

export interface DebounceOptions {
  /** Longest a call may be postponed by continuous triggering, so steady typing still saves. */
  maxWait?: number;
}

export class Debouncer {
  private handle: unknown = null;
  private maxHandle: unknown = null;

  constructor(
    private readonly fn: () => void,
    private readonly delayMs: number,
    private readonly scheduler: Scheduler,
    private readonly options: DebounceOptions = {},
  ) {
    if (!Number.isFinite(delayMs) || delayMs < 0) {
      throw new RangeError('delayMs must be a non-negative finite number');
    }
  }

  get pending(): boolean {
    return this.handle !== null;
  }

  trigger(): void {
    if (this.handle !== null) this.scheduler.clear(this.handle);
    this.handle = this.scheduler.set(() => this.fire(), this.delayMs);
    const wait = this.options.maxWait;
    if (wait !== undefined && this.maxHandle === null) this.maxHandle = this.scheduler.set(() => this.fire(), wait);
  }

  private fire(): void {
    this.cancel();
    this.fn();
  }

  cancel(): void {
    if (this.handle !== null) {
      this.scheduler.clear(this.handle);
      this.handle = null;
    }
    if (this.maxHandle !== null) {
      this.scheduler.clear(this.maxHandle);
      this.maxHandle = null;
    }
  }

  /** Runs a pending call immediately; does nothing when idle. */
  flush(): void {
    if (this.handle === null) return;
    this.cancel();
    this.fn();
  }
}
