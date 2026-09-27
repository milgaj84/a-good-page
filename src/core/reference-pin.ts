import type { KeyValueStore } from './ports';
import { isWritingFile } from './paths';

export const REFERENCE_KEY = 'hearth.reference';
export type PinSide = 'left' | 'right';
export interface PinState { path: string | null; side: PinSide; collapsed: boolean }

const EMPTY: PinState = { path: null, side: 'right', collapsed: false };

/** Remembers which notes document is pinned beside the manuscript, and where. */
export class ReferencePin {
  private current: PinState;

  constructor(private readonly store: KeyValueStore) {
    this.current = ReferencePin.load(store.get(REFERENCE_KEY));
  }

  private static load(raw: string | null): PinState {
    try {
      const data = JSON.parse(raw ?? 'null') as Partial<PinState> | null;
      if (!data || typeof data !== 'object') return { ...EMPTY };
      return {
        path: typeof data.path === 'string' && isWritingFile(data.path) ? data.path : null,
        side: data.side === 'left' ? 'left' : 'right',
        collapsed: data.collapsed === true,
      };
    } catch {
      return { ...EMPTY };
    }
  }

  get state(): PinState { return { ...this.current }; }

  pin(path: string): boolean {
    if (!isWritingFile(path)) return false;
    this.update({ path, collapsed: false });
    return true;
  }

  unpin(): void { this.update({ path: null, collapsed: false }); }
  setSide(side: PinSide): void { this.update({ side }); }
  swapSide(): PinSide { this.setSide(this.current.side === 'left' ? 'right' : 'left'); return this.current.side; }
  toggleCollapsed(): boolean { this.update({ collapsed: !this.current.collapsed }); return this.current.collapsed; }

  private update(patch: Partial<PinState>): void {
    this.current = { ...this.current, ...patch };
    this.store.set(REFERENCE_KEY, JSON.stringify(this.current));
  }
}
