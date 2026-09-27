import { DialogFocus } from './dialog-focus';
import { searchSwitcher, switcherEntries, type HeadingLike, type SwitcherEntry, type WorkspaceFile } from '../core/quick-switch';

export interface SwitcherSource {
  headings(): readonly HeadingLike[];
  currentPath(): string | null;
  /** Workspace documents, or null when no working directory is chosen. May be cached by the caller. */
  files(): Promise<{ files: readonly WorkspaceFile[]; truncated: boolean } | null>;
  jump(pos: number): void;
  openDocument(path: string): void;
  restoreFocus(): void;
}

function make<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text) node.textContent = text;
  return node;
}

/** Ctrl/Cmd+P: type a few letters of a chapter or document and press Enter. */
export class QuickSwitcher {
  readonly root = make('div', 'overlay command-overlay switcher-overlay');
  private readonly input = make('input', 'switcher-input');
  private readonly list = make('div', 'switcher-results');
  private readonly empty = make('p', 'command-empty');
  private readonly note = make('div', 'command-hint', '↑ ↓ to choose · Enter to go · Esc to close');
  private readonly focus: DialogFocus;
  private entries: SwitcherEntry[] = [];
  private matches: SwitcherEntry[] = [];
  private selected = 0;
  private generation = 0;

  constructor(host: HTMLElement, private readonly source: SwitcherSource) {
    const sheet = make('div', 'command-sheet');
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-modal', 'true');
    sheet.setAttribute('aria-label', 'Go to chapter or document');
    this.input.type = 'search';
    this.input.id = 'switcher-input';
    this.input.placeholder = 'Go to a chapter or document…';
    this.input.autocomplete = 'off';
    this.input.spellcheck = false;
    this.input.setAttribute('role', 'combobox');
    this.input.setAttribute('aria-controls', 'switcher-results');
    this.input.setAttribute('aria-expanded', 'true');
    this.input.setAttribute('aria-label', 'Go to a chapter or document');
    this.list.id = 'switcher-results';
    this.list.setAttribute('role', 'listbox');
    this.empty.hidden = true;
    sheet.append(this.input, this.list, this.empty, this.note);
    this.root.append(sheet);
    this.root.tabIndex = -1;
    this.root.setAttribute('aria-hidden', 'true');
    host.append(this.root);
    this.focus = new DialogFocus(this.root);

    this.input.addEventListener('input', () => { this.selected = 0; this.render(); });
    this.input.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        if (!this.matches.length) return;
        this.selected = (this.selected + (event.key === 'ArrowDown' ? 1 : -1) + this.matches.length) % this.matches.length;
        this.markSelected();
      } else if (event.key === 'Enter') { event.preventDefault(); this.choose(this.selected); }
    });
    this.list.addEventListener('click', (event) => {
      const target = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-index]');
      if (target) this.choose(Number(target.dataset.index));
    });
    this.root.addEventListener('mousedown', (event) => { if (event.target === this.root) this.close(); });
  }

  get isOpen(): boolean { return this.root.classList.contains('is-open'); }

  open(): void {
    if (this.isOpen) return;
    const generation = ++this.generation;
    this.input.value = '';
    this.selected = 0;
    this.entries = switcherEntries(this.source.headings(), [], this.source.currentPath());
    this.note.textContent = 'Loading workspace documents…';
    this.render();
    this.root.classList.add('is-open');
    this.root.setAttribute('aria-hidden', 'false');
    this.focus.open(this.input);
    void this.source.files().then((result) => {
      if (generation !== this.generation || !this.isOpen) return;
      this.entries = switcherEntries(this.source.headings(), result?.files ?? [], this.source.currentPath());
      this.note.textContent = !result ? 'Chapters only · choose a working directory to include documents'
        : result.truncated ? 'Large workspace: some documents are not listed · Enter to go' : '↑ ↓ to choose · Enter to go · Esc to close';
      this.render();
    }, (error: unknown) => {
      if (generation !== this.generation || !this.isOpen) return;
      this.note.textContent = 'Workspace documents unavailable: ' + String(error);
    });
  }

  close(restore = true): void {
    if (!this.isOpen) return;
    this.generation++;
    this.root.classList.remove('is-open');
    this.root.setAttribute('aria-hidden', 'true');
    this.focus.close(restore);
  }

  toggle(): void { if (this.isOpen) this.close(); else this.open(); }

  private choose(index: number): void {
    const entry = this.matches[index];
    if (!entry) return;
    this.close(false);
    if (entry.kind === 'chapter') { this.source.jump(entry.pos); this.source.restoreFocus(); }
    else if (entry.path === this.source.currentPath()) this.source.restoreFocus();
    else this.source.openDocument(entry.path);
  }

  private render(): void {
    this.matches = searchSwitcher(this.input.value, this.entries);
    const fragment = document.createDocumentFragment();
    this.matches.forEach((entry, index) => {
      const button = make('button', 'command-result switcher-result');
      button.type = 'button';
      button.dataset.index = String(index);
      button.dataset.kind = entry.kind;
      button.id = 'switcher-result-' + index;
      button.setAttribute('role', 'option');
      const label = make('span', 'command-label', entry.label);
      if (entry.kind === 'chapter') label.style.paddingLeft = (entry.level - 1) * 12 + 'px';
      const detail = make('small', '', entry.detail);
      const kind = make('kbd', '', entry.kind === 'chapter' ? 'Chapter' : 'Document');
      button.append(label, detail, kind);
      fragment.append(button);
    });
    this.list.replaceChildren(fragment);
    this.empty.hidden = this.matches.length > 0;
    this.empty.textContent = this.entries.length ? 'Nothing matches. Try fewer letters.' : 'No headings yet. Add a Title or Heading to jump between chapters.';
    this.markSelected();
  }

  private markSelected(): void {
    this.list.querySelectorAll<HTMLButtonElement>('button[data-index]').forEach((button, index) => {
      button.setAttribute('aria-selected', String(index === this.selected));
      if (index === this.selected) button.scrollIntoView({ block: 'nearest' });
    });
    if (this.matches[this.selected]) this.input.setAttribute('aria-activedescendant', 'switcher-result-' + this.selected);
    else this.input.removeAttribute('aria-activedescendant');
  }
}
