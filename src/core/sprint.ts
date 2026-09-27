import type { KeyValueStore } from './ports';
import { formatCount } from './stats';

export const SPRINT_KEY = 'hearth.sprint';
export const MAX_SPRINT_TARGET = 100_000;

/** A word target for new writing in one document, counted from a baseline. */
export interface Sprint { target: number; baseline: number; docKey: string; startedAt: number; celebrated: boolean }
export interface SprintProgress { written: number; target: number; ratio: number; reached: boolean; label: string }

export function sprintProgress(sprint: Sprint | null, words: number, docKey: string): SprintProgress | null {
  if (!sprint || sprint.docKey !== docKey) return null;
  const written = Math.max(0, Math.floor(words) - sprint.baseline);
  const ratio = Math.min(1, written / sprint.target);
  return { written, target: sprint.target, ratio, reached: written >= sprint.target,
    label: formatCount(written) + ' of ' + formatCount(sprint.target) + ' new words' };
}

/** Circle stroke values for an SVG progress ring. */
export function ringGeometry(ratio: number, radius: number): { circumference: number; offset: number } {
  const circumference = 2 * Math.PI * radius;
  const clamped = Number.isFinite(ratio) ? Math.min(1, Math.max(0, ratio)) : 0;
  return { circumference, offset: clamped >= 1 ? 0 : circumference * (1 - clamped) };
}

function valid(data: unknown): data is Sprint {
  if (!data || typeof data !== 'object') return false;
  const s = data as Sprint;
  return Number.isInteger(s.target) && s.target > 0 && Number.isFinite(s.baseline) && typeof s.docKey === 'string' && Number.isFinite(s.startedAt);
}

export class SprintStore {
  private sprint: Sprint | null;

  constructor(private readonly store: KeyValueStore, private readonly now: () => number) {
    this.sprint = null;
    try {
      const data: unknown = JSON.parse(store.get(SPRINT_KEY) ?? 'null');
      if (valid(data)) this.sprint = { ...data, celebrated: data.celebrated === true };
    } catch {
      this.sprint = null;
    }
  }

  get current(): Sprint | null { return this.sprint; }

  start(target: number, baseline: number, docKey: string): Sprint {
    const words = Math.floor(target);
    if (!Number.isFinite(target) || words < 1 || words > MAX_SPRINT_TARGET) {
      throw new Error('Choose a sprint goal between 1 and ' + formatCount(MAX_SPRINT_TARGET) + ' words.');
    }
    this.sprint = { target: words, baseline: Math.max(0, Math.floor(baseline) || 0), docKey, startedAt: this.now(), celebrated: false };
    this.save();
    return this.sprint;
  }

  /** True the first time only, so the glow never repeats for one sprint. */
  markCelebrated(): boolean {
    if (!this.sprint || this.sprint.celebrated) return false;
    this.sprint = { ...this.sprint, celebrated: true };
    this.save();
    return true;
  }

  clear(): void {
    this.sprint = null;
    this.store.remove(SPRINT_KEY);
  }

  private save(): void { this.store.set(SPRINT_KEY, JSON.stringify(this.sprint)); }
}
