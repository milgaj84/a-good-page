import { formatCount } from './stats';

export interface GoalProgress {
  ratio: number;
  label: string;
  reached: boolean;
}

export function goalProgress(words: number, goal: number): GoalProgress | null {
  const target = Number.isFinite(goal) ? Math.floor(goal) : 0;
  if (target <= 0) return null;
  const written = Number.isFinite(words) && words > 0 ? Math.floor(words) : 0;
  return {
    ratio: Math.min(1, written / target),
    reached: written >= target,
    label: formatCount(written) + ' / ' + formatCount(target),
  };
}

/**
 * Celebrates a goal exactly once. reset() primes it with the current progress,
 * so opening a document that is already past its goal stays quiet.
 */
export class GoalTracker {
  private celebrated = false;

  reset(progress: GoalProgress | null): void {
    this.celebrated = progress?.reached ?? false;
  }

  check(progress: GoalProgress | null): boolean {
    if (!progress || !progress.reached || this.celebrated) return false;
    this.celebrated = true;
    return true;
  }
}
