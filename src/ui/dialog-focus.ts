/** Index of the next keyboard-focus target, including wraparound. */
export function tabIndex(current: number, count: number, reverse: boolean): number {
  if (count <= 0) return -1;
  if (current < 0) return reverse ? count - 1 : 0;
  return (current + (reverse ? -1 : 1) + count) % count;
}

/** Keeps keyboard focus inside an open modal and restores the invoker on close. */
const FOCUSABLE = 'button:not([disabled]):not([hidden]), input:not([disabled]):not([hidden]), select:not([disabled]):not([hidden]), textarea:not([disabled]):not([hidden]), [tabindex]:not([tabindex="-1"])';

export class DialogFocus {
  private previous: HTMLElement | null = null;
  private active = false;
  constructor(private readonly root: HTMLElement) {}
  open(initial?: HTMLElement): void {
    if (!this.active) {
      this.previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      this.active = true;
      this.root.addEventListener('keydown', this.onKeydown);
    }
    (initial ?? this.focusable()[0] ?? this.root).focus();
  }
  close(restore = true): void {
    if (!this.active) return;
    this.root.removeEventListener('keydown', this.onKeydown);
    this.active = false;
    const previous = this.previous;
    this.previous = null;
    if (restore && previous?.isConnected && !previous.closest('[aria-hidden="true"]')) previous.focus();
  }
  private focusable(): HTMLElement[] {
    return Array.from(this.root.querySelectorAll<HTMLElement>(FOCUSABLE))
      .filter(element => element.getClientRects().length > 0 && !element.closest('[hidden], [aria-hidden="true"]'));
  }
  private readonly onKeydown = (event: KeyboardEvent): void => {
    if (event.key !== 'Tab') return;
    const items = this.focusable();
    if (!items.length) { event.preventDefault(); this.root.focus(); return; }
    const current = items.indexOf(document.activeElement as HTMLElement);
    if (current < 0 || (event.shiftKey ? current === 0 : current === items.length - 1)) {
      event.preventDefault(); items[tabIndex(current, items.length, event.shiftKey)].focus();
    }
  };
}
