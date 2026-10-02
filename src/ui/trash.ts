import type { TrashItem } from '../adapters/tauri';
import { relativeLabel } from '../core/snapshots';
import { DialogFocus } from './dialog-focus';

export interface TrashElements { root: HTMLElement; list: HTMLElement; close: HTMLElement }

/** Everything moved to the trash, newest first, each with a button that puts it back where it was. */
export class TrashDialog {
  private readonly focus: DialogFocus;

  constructor(
    private readonly els: TrashElements,
    private readonly load: () => Promise<TrashItem[]>,
    private readonly restore: (item: TrashItem) => Promise<void>,
    private readonly now: () => number,
  ) {
    this.focus = new DialogFocus(els.root);
    els.root.tabIndex = -1;
    els.root.setAttribute('aria-hidden', 'true');
    els.close.addEventListener('click', () => this.close());
    els.root.addEventListener('mousedown', (event) => { if (event.target === els.root) this.close(); });
  }

  get isOpen(): boolean { return this.els.root.classList.contains('is-open'); }

  async open(): Promise<void> {
    this.els.root.classList.add('is-open');
    this.els.root.setAttribute('aria-hidden', 'false');
    this.focus.open(this.els.close);
    await this.draw();
  }

  close(): void {
    if (!this.isOpen) return;
    this.els.root.classList.remove('is-open');
    this.els.root.setAttribute('aria-hidden', 'true');
    this.focus.close();
  }

  private async draw(): Promise<void> {
    let items: TrashItem[];
    try { items = await this.load(); }
    catch (error) { this.message('Could not read the trash: ' + String(error)); return; }
    if (!items.length) { this.message('The trash is empty.'); return; }
    const rows = items.map((item) => {
      const row = document.createElement('div');
      row.className = 'trash-row';
      const text = document.createElement('div');
      const name = document.createElement('strong');
      name.textContent = item.name.replace(/\.(md|markdown|txt)$/i, '');
      const where = document.createElement('small');
      const folder = item.original.includes('/') ? item.original.slice(0, item.original.lastIndexOf('/')) : 'Library';
      where.textContent = (item.is_dir ? 'Project · ' : '') + 'from ' + folder + ' · ' + relativeLabel(item.trashed_at, this.now());
      text.append(name, where);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn';
      button.textContent = 'Restore';
      button.setAttribute('aria-label', 'Restore ' + name.textContent);
      button.addEventListener('click', () => {
        button.disabled = true;
        void this.restore(item).then(() => this.close());
      });
      row.append(text, button);
      return row;
    });
    this.els.list.replaceChildren(...rows);
  }

  private message(text: string): void {
    const p = document.createElement('p');
    p.className = 'tree-empty';
    p.textContent = text;
    this.els.list.replaceChildren(p);
  }
}
