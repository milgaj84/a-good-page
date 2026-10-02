import { DialogFocus } from './dialog-focus';
import { SHORTCUTS, formatKeys } from '../core/keymap';

/** The shortcut sheet (Ctrl+/). */
export class HelpSheet {
  private openState = false;
  private readonly focus: DialogFocus;

  constructor(
    private readonly root: HTMLElement,
    list: HTMLElement,
    private readonly closeButton: HTMLElement,
    isMac: boolean,
    private readonly onClose: () => void,
  ) {
    for (const shortcut of SHORTCUTS) {
      const term = document.createElement('dt');
      for (const key of formatKeys(shortcut.keys, isMac)) {
        const kbd = document.createElement('kbd');
        kbd.textContent = key;
        term.append(kbd);
      }
      const detail = document.createElement('dd');
      detail.textContent = shortcut.label;
      list.append(term, detail);
    }
    this.focus = new DialogFocus(root);
    root.tabIndex = -1;
    root.setAttribute('aria-hidden', 'true');
    root.addEventListener('mousedown', (event) => {
      if (event.target === root) this.close();
    });
    closeButton.addEventListener('click', () => this.close());
  }

  get isOpen(): boolean {
    return this.openState;
  }

  open(): void {
    this.openState = true;
    this.root.classList.add('is-open');
    this.root.setAttribute('aria-hidden', 'false');
    this.focus.open(this.closeButton);
    this.root.querySelector('.sheet')?.scrollTo(0, 0);
  }

  close(): void {
    if (!this.openState) return;
    this.openState = false;
    this.root.classList.remove('is-open');
    this.root.setAttribute('aria-hidden', 'true');
    this.focus.close(false);
    this.onClose();
  }

  toggle(): void {
    if (this.openState) this.close();
    else this.open();
  }
}
