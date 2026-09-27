/** Injectable animation-frame clock so frame-coalesced work is deterministic under test. */
export interface FrameClock {
  request(callback: (time: number) => void): unknown;
  cancel(handle: unknown): void;
}

export const browserFrames: FrameClock = {
  request: (callback) => requestAnimationFrame(callback),
  cancel: (handle) => cancelAnimationFrame(handle as number),
};

/** Runs a task at most once per frame, however many times it is scheduled before the frame. */
export class FrameTask {
  private handle: unknown = null;

  constructor(private readonly fn: () => void, private readonly frames: FrameClock) {}

  get pending(): boolean {
    return this.handle !== null;
  }

  schedule(): void {
    if (this.handle !== null) return;
    this.handle = this.frames.request(() => {
      this.handle = null;
      this.fn();
    });
  }

  cancel(): void {
    if (this.handle === null) return;
    this.frames.cancel(this.handle);
    this.handle = null;
  }

  /** Runs a scheduled task now; does nothing when idle. */
  flush(): void {
    if (this.handle === null) return;
    this.cancel();
    this.fn();
  }
}

/** Remembers the last key it saw so expensive side effects run only when something really changed. */
export class ChangeLatch {
  private last: string | null = null;

  changed(key: string): boolean {
    if (key === this.last) return false;
    this.last = key;
    return true;
  }

  reset(): void {
    this.last = null;
  }
}
