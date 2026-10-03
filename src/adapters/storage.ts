import type { KeyValueStore } from '../core/ports';
import type { DraftStore } from '../core/session';
import type { Scheduler } from '../core/debounce';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Wraps Web Storage so quota errors or disabled storage never crash the editor. */
export class SafeStore implements KeyValueStore {
  constructor(private readonly backend: StorageLike | null) {}

  get(key: string): string | null {
    if (!this.backend) return null;
    try {
      return this.backend.getItem(key);
    } catch {
      return null;
    }
  }

  set(key: string, value: string): void {
    if (!this.backend) return;
    try {
      this.backend.setItem(key, value);
    } catch {
      // Storage full or unavailable: silently degrade.
    }
  }

  remove(key: string): void {
    if (!this.backend) return;
    try {
      this.backend.removeItem(key);
    } catch {
      // Storage unavailable: nothing to remove.
    }
  }
}

export const DRAFT_KEY = 'hearth.draft';

export class LocalDraftStore implements DraftStore {
  constructor(private readonly store: KeyValueStore) {}

  load(): string | null {
    return this.store.get(DRAFT_KEY);
  }

  /** Returns false when the draft could not be stored (storage full or unavailable). */
  save(markdown: string): boolean {
    if (markdown.trim().length === 0) {
      this.store.remove(DRAFT_KEY);
      return true;
    }
    this.store.set(DRAFT_KEY, markdown);
    return this.store.get(DRAFT_KEY) === markdown;
  }

  clear(): void {
    this.store.remove(DRAFT_KEY);
  }
}

/**
 * Keeps untitled drafts off the keystroke path: the (lazy) markdown is serialised and written
 * once typing pauses, and on flush() before quitting. Clearing always wins over a pending save.
 */
export class DebouncedDraftStore implements DraftStore {
  private pending: (() => string) | null = null;
  private handle: unknown = null;

  constructor(
    private readonly inner: DraftStore,
    private readonly scheduler: Scheduler,
    private readonly delayMs: number,
    /** Called once when drafts start failing to save; called again only after a save has worked in between. */
    private readonly onFail?: () => void,
  ) {
    if (!Number.isFinite(delayMs) || delayMs < 0) throw new RangeError('delayMs must be a non-negative finite number');
  }

  private failing = false;

  get hasPending(): boolean {
    return this.pending !== null;
  }

  load(): string | null {
    this.flush();
    return this.inner.load();
  }

  save(markdown: string): void {
    this.saveLazy(() => markdown);
  }

  /** Defers even the serialisation, so a burst of keystrokes costs one getMarkdown(). */
  saveLazy(read: () => string): void {
    this.pending = read;
    if (this.handle !== null) return;
    this.handle = this.scheduler.set(() => { this.handle = null; this.flush(); }, this.delayMs);
  }

  flush(): void {
    this.stopTimer();
    const read = this.pending;
    this.pending = null;
    if (!read) return;
    const ok = this.inner.save(read()) !== false;
    if (!ok && !this.failing) this.onFail?.();
    this.failing = !ok;
  }

  clear(): void {
    this.stopTimer();
    this.pending = null;
    this.inner.clear();
  }

  private stopTimer(): void {
    if (this.handle === null) return;
    this.scheduler.clear(this.handle);
    this.handle = null;
  }
}

export function browserStorage(): StorageLike | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
