import type { KeyLike } from './keymap';

/** How the chrome is shown or hidden; the DOM side is injected so the rules stay testable. */
export interface GhostView {
  fade(hidden: boolean): void;
}

export type WritingKey = KeyLike & { isComposing?: boolean };

const WRITING_KEYS = new Set(['Enter', 'Backspace', 'Delete', 'Tab']);

/** True for keys that put words on the page. Shortcuts and navigation keys leave the chrome alone. */
export function isWritingKey(event: WritingKey): boolean {
  if (event.isComposing) return true;
  const key = event.key ?? '';
  // AltGr arrives as Ctrl+Alt on Windows and still types a character.
  const altGr = event.ctrlKey && event.altKey && !event.metaKey;
  if ((event.ctrlKey || event.metaKey) && !altGr) return false;
  return [...key].length === 1 || WRITING_KEYS.has(key);
}

/**
 * Ghost chrome: hides the top bar, footer and scrollbars once writing starts and brings
 * them back on a real mouse move or Esc. The pointer baseline is frozen while hidden, so
 * the synthetic mousemove a browser fires when the page scrolls under a still cursor
 * never counts as movement, while slow deliberate drift still does.
 */
export class GhostChrome {
  private hiddenState = false;
  private enabledState = true;
  private last: { x: number; y: number } | null = null;

  constructor(
    private readonly view: GhostView,
    private readonly threshold = 3,
  ) {
    if (!Number.isFinite(threshold) || threshold < 0) throw new RangeError('threshold must be a finite number ≥ 0');
  }

  get hidden(): boolean {
    return this.hiddenState;
  }

  get enabled(): boolean {
    return this.enabledState;
  }

  setEnabled(on: boolean): void {
    this.enabledState = on;
    if (!on) this.show();
  }

  input(): void {
    if (!this.enabledState || this.hiddenState) return;
    this.hiddenState = true;
    this.view.fade(true);
  }

  pointer(x: number, y: number): void {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const base = this.last;
    if (base === null || !this.hiddenState) {
      this.last = { x, y };
      return;
    }
    if (Math.hypot(x - base.x, y - base.y) > this.threshold) {
      this.last = { x, y };
      this.show();
    }
  }

  escape(): void {
    this.show();
  }

  private show(): void {
    if (!this.hiddenState) return;
    this.hiddenState = false;
    this.view.fade(false);
  }
}
