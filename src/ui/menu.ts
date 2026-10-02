export interface MenuItem {
  label: string;
  hint?: string;
  danger?: boolean;
  separator?: boolean;
  run?: () => void;
}

export interface MenuAnchor { left: number; top: number; right: number; bottom: number }

/** One small pop-up list, reused for row actions, Tools and the Library menu. */
export class Menu {
  private el: HTMLElement | null = null;
  private opener: HTMLElement | null = null;

  constructor() {
    document.addEventListener('mousedown', (event) => {
      if (this.el && !this.el.contains(event.target as Node) && !this.opener?.contains(event.target as Node)) this.close(false);
    });
    window.addEventListener('resize', () => this.close(false));
  }

  get isOpen(): boolean { return this.el !== null; }

  /** Opens next to `anchor`; `up` opens above it (for buttons at the bottom of the window). */
  open(items: readonly MenuItem[], anchor: MenuAnchor, opener: HTMLElement | null = null, up = false): void {
    this.close(false);
    const el = document.createElement('div');
    el.className = 'menu';
    el.setAttribute('role', 'menu');
    for (const item of items) {
      if (item.separator) { el.append(document.createElement('hr')); continue; }
      const button = document.createElement('button');
      button.type = 'button';
      button.setAttribute('role', 'menuitem');
      if (item.danger) button.dataset.danger = 'true';
      const label = document.createElement('span');
      label.textContent = item.label;
      button.append(label);
      if (item.hint) { const kbd = document.createElement('kbd'); kbd.textContent = item.hint; button.append(kbd); }
      button.addEventListener('click', () => { this.close(); item.run?.(); });
      el.append(button);
    }
    el.addEventListener('keydown', (event) => {
      const buttons = Array.from(el.querySelectorAll<HTMLButtonElement>('button'));
      const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
      if (event.key === 'ArrowDown') { event.preventDefault(); buttons[(at + 1) % buttons.length]?.focus(); }
      else if (event.key === 'ArrowUp') { event.preventDefault(); buttons[(at - 1 + buttons.length) % buttons.length]?.focus(); }
    });
    document.body.append(el);
    const box = el.getBoundingClientRect();
    const left = Math.max(8, Math.min(window.innerWidth - box.width - 8, anchor.right - box.width));
    const top = up ? anchor.top - box.height - 6 : anchor.bottom + 6;
    el.style.left = left + 'px';
    el.style.top = Math.max(8, Math.min(window.innerHeight - box.height - 8, top)) + 'px';
    this.el = el;
    this.opener = opener;
    opener?.setAttribute('aria-expanded', 'true');
    el.querySelector<HTMLButtonElement>('button')?.focus();
  }

  close(restoreFocus = true): boolean {
    if (!this.el) return false;
    this.el.remove();
    this.el = null;
    this.opener?.setAttribute('aria-expanded', 'false');
    if (restoreFocus) this.opener?.focus();
    this.opener = null;
    return true;
  }
}
