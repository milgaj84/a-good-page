import { placePopover, type Anchor } from '../core/placement';

/** A floating panel that positions itself next to an anchor and closes on outside clicks. */
export class Popover {
  private openState = false;

  constructor(
    private readonly el: HTMLElement,
    private readonly trigger: HTMLElement | null = null,
    private readonly onClose: () => void = () => undefined,
  ) {
    el.setAttribute('aria-hidden', 'true');
    document.addEventListener('mousedown', (event) => {
      if (!this.openState) return;
      const target = event.target as Node;
      if (this.el.contains(target) || (this.trigger?.contains(target) ?? false)) return;
      this.close();
    });
    window.addEventListener('resize', () => this.close());
  }

  get isOpen(): boolean {
    return this.openState;
  }

  show(anchor: Anchor): void {
    this.el.classList.add('is-open');
    this.el.setAttribute('aria-hidden', 'false');
    this.trigger?.setAttribute('aria-expanded', 'true');
    const box = this.el.getBoundingClientRect();
    const spot = placePopover(
      anchor,
      { width: box.width, height: box.height },
      { width: window.innerWidth, height: window.innerHeight },
    );
    this.el.style.left = spot.left + 'px';
    this.el.style.top = spot.top + 'px';
    this.el.dataset.side = spot.above ? 'above' : 'below';
    this.openState = true;
  }

  close(): void {
    if (!this.openState) return;
    this.openState = false;
    this.el.classList.remove('is-open');
    this.el.setAttribute('aria-hidden', 'true');
    this.trigger?.setAttribute('aria-expanded', 'false');
    this.onClose();
  }
}
