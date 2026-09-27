export interface TimeSource { now(): number }
export interface SessionSnapshot {
  durationMinutes: number;
  targetWords: number;
  elapsedSeconds: number;
  remainingSeconds: number;
  wordsWritten: number;
  progress: number;
  finished: boolean;
}

/** Injected wall clock includes time spent sleeping; elapsed time never moves backwards. */
export class WritingSession {
  private startedAt: number | null = null;
  private duration = 0;
  private target = 0;
  private baseline = 0;
  private final: SessionSnapshot | null = null;
  private lastElapsed = 0;
  constructor(private readonly clock: TimeSource) {}
  get active(): boolean { return this.startedAt !== null; }
  start(minutes: number, targetWords: number, initialWords: number): SessionSnapshot {
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 180) throw new RangeError('Choose 1–180 minutes.');
    if (!Number.isInteger(targetWords) || targetWords < 0 || targetWords > 1_000_000) throw new RangeError('Choose 0–1,000,000 words.');
    if (!Number.isFinite(initialWords) || initialWords < 0) throw new RangeError('Invalid word count.');
    this.duration = minutes; this.target = targetWords; this.baseline = Math.floor(initialWords);
    this.startedAt = this.clock.now(); this.final = null; this.lastElapsed = 0;
    return this.snapshot(initialWords)!;
  }
  snapshot(currentWords: number): SessionSnapshot | null {
    if (this.startedAt === null) return this.final;
    const elapsed = Math.min(this.duration * 60, Math.max(this.lastElapsed, Math.floor((this.clock.now() - this.startedAt) / 1000)));
    this.lastElapsed = elapsed;
    const written = Math.max(0, Math.floor(currentWords) - this.baseline);
    const data: SessionSnapshot = { durationMinutes: this.duration, targetWords: this.target,
      elapsedSeconds: elapsed, remainingSeconds: this.duration * 60 - elapsed,
      wordsWritten: written, progress: this.target ? Math.min(1, written / this.target) : elapsed / (this.duration * 60),
      finished: elapsed >= this.duration * 60 };
    if (data.finished) { this.startedAt = null; this.final = data; }
    return data;
  }
  stop(currentWords: number): SessionSnapshot | null {
    if (!this.active) return null;
    const result = this.snapshot(currentWords);
    this.startedAt = null; this.final = result;
    return result;
  }
  clear(): void { this.startedAt = null; this.final = null; }
}
