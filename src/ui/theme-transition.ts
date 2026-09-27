import type { Scheduler } from '../core/debounce';

/** Minimal slice of an element so the cross-fade is testable without a DOM. */
export interface ThemeRoot {
  dataset: { theme?: string };
  classList: { add(name: string): void; remove(name: string): void };
}

export const SHIFT_CLASS = 'theme-shifting';

/** Applies a theme and, after the first paint, briefly enables a soft colour cross-fade. */
export class ThemeTransition {
  private handle: unknown = null;
  private first = true;

  constructor(
    private readonly root: ThemeRoot,
    private readonly scheduler: Scheduler,
    private readonly durationMs: number,
    private readonly reducedMotion: () => boolean,
  ) {
    if (!Number.isFinite(durationMs) || durationMs < 0) throw new RangeError('durationMs must be a non-negative finite number');
  }

  get shifting(): boolean {
    return this.handle !== null;
  }

  apply(theme: string): void {
    if (!theme) throw new RangeError('Theme name is required');
    const unchanged = this.root.dataset.theme === theme;
    const animate = !this.first && !unchanged && this.durationMs > 0 && !this.reducedMotion();
    this.first = false;
    if (this.handle !== null) { this.scheduler.clear(this.handle); this.handle = null; }
    if (animate) this.root.classList.add(SHIFT_CLASS); else this.root.classList.remove(SHIFT_CLASS);
    this.root.dataset.theme = theme;
    if (!animate) return;
    this.handle = this.scheduler.set(() => {
      this.root.classList.remove(SHIFT_CLASS);
      this.handle = null;
    }, this.durationMs);
  }
}
