export interface PickerPage { path: string; label: string; words: number }

export interface PickerElements {
  root: HTMLElement;
  summary: HTMLElement;
  list: HTMLElement;
  all: HTMLElement;
  none: HTMLElement;
}

/** Which pages of a project go into the PDF. Starts with every page ticked; remembers the choice per project. */
export class ExportPicker {
  private pages: PickerPage[] = [];
  private chosen = new Set<string>();
  private key = '';
  private readonly memory = new Map<string, Set<string>>();

  constructor(private readonly els: PickerElements, private readonly changed: () => void) {
    els.all.addEventListener('click', () => this.set(this.pages.map(p => p.path)));
    els.none.addEventListener('click', () => this.set([]));
    els.list.addEventListener('change', (event) => {
      const box = event.target as HTMLInputElement;
      if (!box.dataset.path) return;
      if (box.checked) this.chosen.add(box.dataset.path); else this.chosen.delete(box.dataset.path);
      this.remember();
      this.draw(false);
      this.changed();
    });
  }

  /** Show or hide the whole picker (it only makes sense when exporting a project). */
  show(on: boolean): void { this.els.root.hidden = !on; }

  /** Loads the pages of a project. The same project keeps the current ticks; a project seen before gets its ticks back. */
  setPages(key: string, pages: readonly PickerPage[]): void {
    const same = key === this.key;
    this.key = key;
    this.pages = [...pages];
    const known = same ? this.chosen : this.memory.get(key);
    const present = new Set(this.pages.map(p => p.path));
    this.chosen = known ? new Set([...known].filter(p => present.has(p))) : new Set(present);
    if (known && this.chosen.size === 0 && !same) this.chosen = new Set(present);
    this.remember();
    this.draw(true);
  }

  /** Ticked pages, in project order. */
  selected(): string[] { return this.pages.filter(p => this.chosen.has(p.path)).map(p => p.path); }

  private set(paths: string[]): void {
    this.chosen = new Set(paths);
    this.remember();
    this.draw(true);
    this.changed();
  }

  private remember(): void { this.memory.set(this.key, new Set(this.chosen)); }

  private draw(rebuild: boolean): void {
    const chosenWords = this.pages.filter(p => this.chosen.has(p.path)).reduce((n, p) => n + p.words, 0);
    this.els.summary.textContent = this.chosen.size + ' of ' + this.pages.length + (this.pages.length === 1 ? ' page' : ' pages') +
      ' · ' + chosenWords.toLocaleString() + ' words';
    if (!rebuild) return;
    const rows = this.pages.map((page) => {
      const label = document.createElement('label');
      label.className = 'pick-row';
      const box = document.createElement('input');
      box.type = 'checkbox';
      box.dataset.path = page.path;
      box.checked = this.chosen.has(page.path);
      const name = document.createElement('span');
      name.textContent = page.label;
      const words = document.createElement('small');
      words.textContent = page.words.toLocaleString();
      label.append(box, name, words);
      return label;
    });
    this.els.list.replaceChildren(...rows);
  }
}
