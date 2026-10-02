import type { KeyValueStore } from '../core/ports';

export const PICKS_KEY = 'agp.export.picks.v1';
const MAX_REMEMBERED = 30;

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

  constructor(private readonly els: PickerElements, private readonly changed: () => void, private readonly store?: KeyValueStore) {
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
    const known = same ? this.chosen : this.memory.get(key) ?? this.stored(key);
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

  /** Ticks exactly these pages (for "Export these selected pages"), without asking for a new preview. */
  choose(paths: readonly string[]): void {
    const present = new Set(this.pages.map(p => p.path));
    this.chosen = new Set(paths.filter(p => present.has(p)));
    this.remember();
    this.draw(true);
  }

  private readStore(): Record<string, string[]> {
    try {
      const data: unknown = JSON.parse(this.store?.get(PICKS_KEY) ?? '{}');
      return data && typeof data === 'object' && !Array.isArray(data) ? data as Record<string, string[]> : {};
    } catch { return {}; }
  }

  private stored(key: string): Set<string> | undefined {
    const list = this.readStore()[key];
    return Array.isArray(list) ? new Set(list.filter(x => typeof x === 'string')) : undefined;
  }

  private remember(): void {
    this.memory.set(this.key, new Set(this.chosen));
    if (!this.store || !this.key) return;
    const all = this.readStore();
    delete all[this.key];
    all[this.key] = [...this.chosen];
    const keep = Object.entries(all).slice(-MAX_REMEMBERED);
    this.store.set(PICKS_KEY, JSON.stringify(Object.fromEntries(keep)));
  }

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
