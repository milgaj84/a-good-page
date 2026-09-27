import { normalizeUrl } from '../core/links';
import type { Anchor } from '../core/placement';
import { Popover } from './popover';

/** The editor operations the link bar needs; injected for decoupling. */
export interface LinkTarget {
  currentHref(): string | null;
  apply(href: string): void;
  remove(): void;
  caretRect(): Anchor | null;
  restoreFocus(): void;
}

export interface LinkBarElements {
  root: HTMLElement;
  input: HTMLInputElement;
  apply: HTMLElement;
  remove: HTMLElement;
}

/** A small inline field for adding, editing or removing a link (no window.prompt). */
export class LinkBar {
  private readonly popover: Popover;
  private hadLink = false;

  constructor(
    private readonly els: LinkBarElements,
    private readonly target: LinkTarget,
  ) {
    this.popover = new Popover(els.root, null, () => target.restoreFocus());
    els.input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        this.submit();
      }
    });
    els.input.addEventListener('input', () => els.root.classList.remove('is-invalid'));
    els.apply.addEventListener('click', () => this.submit());
    els.remove.addEventListener('click', () => {
      this.close();
      target.remove();
    });
  }

  get isOpen(): boolean {
    return this.popover.isOpen;
  }

  open(): void {
    const href = this.target.currentHref();
    this.hadLink = href !== null;
    this.els.input.value = href ?? '';
    this.els.remove.hidden = !this.hadLink;
    this.els.root.classList.remove('is-invalid');
    const middle = window.innerWidth / 2;
    const fallback = { left: middle, right: middle, top: 90, bottom: 90 };
    this.popover.show(this.target.caretRect() ?? fallback);
    this.els.input.focus();
    this.els.input.select();
  }

  close(): void {
    this.popover.close();
  }

  private submit(): void {
    const raw = this.els.input.value;
    if (raw.trim().length === 0) {
      this.close();
      if (this.hadLink) this.target.remove();
      return;
    }
    const href = normalizeUrl(raw);
    if (href === null) {
      this.els.root.classList.add('is-invalid');
      this.els.input.focus();
      return;
    }
    this.close();
    this.target.apply(href);
  }
}
