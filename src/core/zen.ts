import type { KeyLike } from './keymap';

export type ZenKey = KeyLike & { isComposing?: boolean };

/** What the editor asks before it lets text be removed. */
export interface ZenPort {
  blockKey(event: ZenKey): boolean;
  blockInput(inputType: string): boolean;
  blockCut(): boolean;
  blockDrag(): boolean;
}

export const ZEN_COOLDOWN_MS = 4000;

/** Backspace and Delete with any modifier, plus the macOS Ctrl+H / Ctrl+D delete keys. IME editing is never blocked. */
export function isDeletionKey(event: ZenKey, isMac: boolean): boolean {
  if (event.isComposing) return false;
  const key = event.key ?? '';
  if (key === 'Backspace' || key === 'Delete') return true;
  const lower = key.toLowerCase();
  return isMac && event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey && (lower === 'h' || lower === 'd');
}

/** Browser delete inputs (word delete, cut, drag); composition text stays editable. */
export function isDeletionInput(inputType: string): boolean {
  return inputType.startsWith('delete') && inputType !== 'deleteCompositionText';
}

export function zenNudge(isMac: boolean): string {
  return 'Zen draft is on, so Backspace and Delete are paused. Keep writing, or press ' +
    (isMac ? '⌘⇧D' : 'Ctrl+Shift+D') + ' to edit.';
}

/** Zen draft: a first-draft mode that pauses deletions and gives a gentle reminder at most once per cooldown. */
export class ZenGuard implements ZenPort {
  private on = false;
  private lastNudge = Number.NEGATIVE_INFINITY;

  constructor(
    private readonly now: () => number,
    private readonly notify: (message: string) => void,
    private readonly isMac: boolean,
    private readonly cooldownMs = ZEN_COOLDOWN_MS,
  ) {
    if (!Number.isFinite(cooldownMs) || cooldownMs < 0) throw new RangeError('cooldownMs must be a finite number ≥ 0');
  }

  get enabled(): boolean {
    return this.on;
  }

  set(on: boolean): boolean {
    this.on = on;
    this.lastNudge = Number.NEGATIVE_INFINITY;
    return on;
  }

  blockKey(event: ZenKey): boolean {
    return this.block(isDeletionKey(event, this.isMac));
  }

  blockInput(inputType: string): boolean {
    return this.block(isDeletionInput(inputType));
  }

  blockCut(): boolean {
    return this.block(true);
  }

  blockDrag(): boolean {
    return this.block(true);
  }

  private block(hit: boolean): boolean {
    if (!this.on || !hit) return false;
    const t = this.now();
    if (!(t - this.lastNudge < this.cooldownMs)) {
      this.lastNudge = t;
      this.notify(zenNudge(this.isMac));
    }
    return true;
  }
}
