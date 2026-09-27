import { DialogFocus } from './dialog-focus';
import { searchPalette, type PaletteItem } from '../core/palette';
import type { Action } from '../core/commands';

export interface PaletteElements { root: HTMLElement; input: HTMLInputElement; list: HTMLElement; empty: HTMLElement }

/** Keyboard-first command dialog. All actions flow through the app's existing dispatcher. */
export class CommandPalette {
  private matches: PaletteItem[] = [];
  private selected = 0;
  private readonly focus: DialogFocus;
  constructor(private readonly els: PaletteElements, private readonly dispatch: (action: Action) => void,
    private readonly canRun: (action: Action) => boolean = () => true) {
    this.focus = new DialogFocus(els.root);
    els.root.tabIndex = -1;
    els.root.setAttribute('aria-hidden', 'true');
    els.input.addEventListener('input', () => { this.selected = 0; this.render(); });
    els.input.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        if (!this.matches.length) return;
        this.selected = (this.selected + (event.key === 'ArrowDown' ? 1 : -1) + this.matches.length) % this.matches.length;
        this.markSelected();
      } else if (event.key === 'Enter') { event.preventDefault(); this.choose(this.selected); }
    });
    els.list.addEventListener('click', (event) => {
      const target = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-index]');
      if (target) this.choose(Number(target.dataset.index));
    });
    els.root.addEventListener('mousedown', (event) => { if (event.target === els.root) this.close(); });
  }
  get isOpen(): boolean { return this.els.root.classList.contains('is-open'); }
  open(): void {
    if (this.isOpen) return;
    this.els.input.value = ''; this.selected = 0; this.render();
    this.els.root.classList.add('is-open'); this.els.root.setAttribute('aria-hidden', 'false');
    this.focus.open(this.els.input);
  }
  close(restore = true): void {
    if (!this.isOpen) return;
    this.els.root.classList.remove('is-open'); this.els.root.setAttribute('aria-hidden', 'true');
    this.focus.close(restore);
  }
  toggle(): void { if (this.isOpen) this.close(); else this.open(); }
  private choose(index: number): void {
    const item = this.matches[index];
    if (!item || !this.canRun(item.action)) return;
    this.close(); this.dispatch(item.action);
  }
  private render(): void {
    this.matches = searchPalette(this.els.input.value);
    const fragment = document.createDocumentFragment();
    this.matches.forEach((item, index) => {
      const button = document.createElement('button'); button.type = 'button';
      button.className = 'command-result'; button.dataset.index = String(index);
      button.id = 'command-result-' + index; button.setAttribute('role', 'option');
      button.disabled = !this.canRun(item.action);
      const name = document.createElement('span'); name.className = 'command-label'; name.textContent = item.label;
      const group = document.createElement('small'); group.textContent = item.group;
      const keys = document.createElement('kbd'); keys.textContent = item.shortcut?.replace('Mod', /Mac|iPhone|iPad/.test(navigator.userAgent) ? '⌘' : 'Ctrl') ?? '';
      button.append(name, group, keys); fragment.append(button);
    });
    this.els.list.replaceChildren(fragment);
    this.els.empty.hidden = this.matches.length > 0;
    this.markSelected();
  }
  private markSelected(): void {
    this.els.list.querySelectorAll<HTMLButtonElement>('button[data-index]').forEach((button, index) => {
      button.setAttribute('aria-selected', String(index === this.selected));
      if (index === this.selected) button.scrollIntoView({ block: 'nearest' });
    });
    const current = this.matches[this.selected];
    if (current) this.els.input.setAttribute('aria-activedescendant', 'command-result-' + this.selected);
    else this.els.input.removeAttribute('aria-activedescendant');
  }
}
