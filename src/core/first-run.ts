import type { KeyValueStore } from './ports';
/** The Save step is complete only when the current revision reached disk. */
export function guideSaveComplete(written: boolean, stillDirty: boolean): boolean {
  return written && !stillDirty;
}
export const FIRST_RUN_KEY = 'hearth.firstRun.v1';
export type GuideStep = 'create' | 'save' | 'export' | 'done';
export class FirstRunGuide {
  private index = 0;
  constructor(private readonly store: KeyValueStore) {}
  get shouldOffer(): boolean { return this.store.get(FIRST_RUN_KEY) !== 'done'; }
  get step(): GuideStep { return (['create', 'save', 'export', 'done'] as const)[this.index]; }
  next(success: boolean): GuideStep {
    if (success && this.index < 3) this.index++;
    if (this.index === 3) this.dismiss();
    return this.step;
  }
  restart(): void { this.index = 0; }
  dismiss(): void { this.store.set(FIRST_RUN_KEY, 'done'); }
}
