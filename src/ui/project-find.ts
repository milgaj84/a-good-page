import { buildEdits, searchFiles, type FileMatches, type ReplaceEdit, type SearchFile, type TextMatch } from '../core/project-replace';
import { DialogFocus } from './dialog-focus';

export type FindScope = 'project' | 'library';

export interface ProjectFindElements {
  root: HTMLElement;
  query: HTMLInputElement;
  replacement: HTMLInputElement;
  matchCase: HTMLInputElement;
  wholeWord: HTMLInputElement;
  scope: HTMLSelectElement;
  results: HTMLElement;
  summary: HTMLElement;
  replace: HTMLButtonElement;
  all: HTMLElement;
  none: HTMLElement;
  close: HTMLElement;
}

export interface ReplaceReport { changed: number; skipped: string[] }

export interface ProjectFindDeps {
  /** The pages to search, fresh from disk (the open page as it is on screen). */
  load(scope: FindScope): Promise<SearchFile[]>;
  apply(edits: ReplaceEdit[]): Promise<ReplaceReport>;
  /** Whether the open page belongs to a project, so "This project" means something. */
  inProject(): boolean;
}

const key = (path: string, match: TextMatch): string => path + '@' + match.start;

/** Find and replace across every page of a project (or the whole Library), with each match ticked or not. */
export class ProjectFind {
  private files: SearchFile[] = [];
  private results: FileMatches[] = [];
  private ticked = new Set<string>();
  private timer = 0;
  private generation = 0;
  private readonly focus: DialogFocus;

  constructor(private readonly els: ProjectFindElements, private readonly deps: ProjectFindDeps) {
    this.focus = new DialogFocus(els.root);
    els.root.tabIndex = -1;
    els.root.setAttribute('aria-hidden', 'true');
    els.query.addEventListener('input', () => this.later());
    els.matchCase.addEventListener('change', () => this.search());
    els.wholeWord.addEventListener('change', () => this.search());
    els.scope.addEventListener('change', () => void this.load());
    els.replacement.addEventListener('input', () => this.draw());
    els.replace.addEventListener('click', () => void this.run());
    els.all.addEventListener('click', () => this.tickAll(true));
    els.none.addEventListener('click', () => this.tickAll(false));
    els.close.addEventListener('click', () => this.close());
    els.root.addEventListener('mousedown', (event) => { if (event.target === els.root) this.close(); });
    els.results.addEventListener('change', (event) => this.onTick(event.target as HTMLInputElement));
  }

  get isOpen(): boolean { return this.els.root.classList.contains('is-open'); }

  async open(prefill = ''): Promise<void> {
    this.els.scope.value = this.deps.inProject() ? 'project' : 'library';
    (this.els.scope.querySelector('option[value="project"]') as HTMLOptionElement).disabled = !this.deps.inProject();
    if (prefill.trim()) this.els.query.value = prefill.trim();
    this.els.root.classList.add('is-open');
    this.els.root.setAttribute('aria-hidden', 'false');
    this.focus.open(this.els.query);
    this.els.query.select();
    await this.load();
  }

  close(): void {
    if (!this.isOpen) return;
    window.clearTimeout(this.timer);
    this.els.root.classList.remove('is-open');
    this.els.root.setAttribute('aria-hidden', 'true');
    this.focus.close();
  }

  private async load(): Promise<void> {
    const token = ++this.generation;
    this.els.summary.textContent = 'Reading your pages…';
    try {
      const files = await this.deps.load(this.els.scope.value as FindScope);
      if (token !== this.generation) return;
      this.files = files;
    } catch (error) {
      this.els.summary.textContent = 'Could not read your pages: ' + String(error);
      return;
    }
    this.search();
  }

  private later(): void {
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => this.search(), 220);
  }

  private search(): void {
    const results = searchFiles(this.files, this.els.query.value, { matchCase: this.els.matchCase.checked, wholeWord: this.els.wholeWord.checked });
    this.results = results;
    this.ticked = new Set(results.flatMap(r => r.matches.map(m => key(r.file.path, m))));
    this.draw();
  }

  private tickAll(on: boolean): void {
    this.ticked = on ? new Set(this.results.flatMap(r => r.matches.map(m => key(r.file.path, m)))) : new Set();
    this.draw();
  }

  private onTick(box: HTMLInputElement): void {
    if (box.dataset.page) {
      const found = this.results.find(r => r.file.path === box.dataset.page);
      for (const match of found?.matches ?? []) {
        if (box.checked) this.ticked.add(key(found!.file.path, match)); else this.ticked.delete(key(found!.file.path, match));
      }
    } else if (box.dataset.key) {
      if (box.checked) this.ticked.add(box.dataset.key); else this.ticked.delete(box.dataset.key);
    }
    this.draw();
  }

  private draw(): void {
    const total = this.results.reduce((n, r) => n + r.matches.length, 0);
    const chosen = this.ticked.size;
    const replacement = this.els.replacement.value;
    const groups = this.results.map((result) => {
      const group = document.createElement('section');
      group.className = 'pf-group';
      const head = document.createElement('label');
      head.className = 'pf-head';
      const page = document.createElement('input');
      page.type = 'checkbox';
      page.dataset.page = result.file.path;
      const ticks = result.matches.filter(m => this.ticked.has(key(result.file.path, m))).length;
      page.checked = ticks === result.matches.length;
      page.indeterminate = ticks > 0 && ticks < result.matches.length;
      const name = document.createElement('strong');
      name.textContent = result.file.label;
      const where = document.createElement('small');
      where.textContent = result.file.group + ' · ' + result.matches.length;
      head.append(page, name, where);
      group.append(head);
      for (const match of result.matches) {
        const row = document.createElement('label');
        row.className = 'pf-match';
        const box = document.createElement('input');
        box.type = 'checkbox';
        box.dataset.key = key(result.file.path, match);
        box.checked = this.ticked.has(box.dataset.key);
        const line = document.createElement('small');
        line.textContent = 'line ' + match.line;
        const text = document.createElement('span');
        const hit = document.createElement('del');
        hit.textContent = match.hit;
        const now = document.createElement('ins');
        now.textContent = replacement;
        text.append(document.createTextNode(match.before), hit, now, document.createTextNode(match.after));
        row.append(box, line, text);
        group.append(row);
      }
      return group;
    });
    this.els.results.replaceChildren(...groups);
    const query = this.els.query.value.trim();
    this.els.summary.textContent = !query ? 'Type what to find. Every page of the ' + (this.els.scope.value === 'project' ? 'project' : 'Library') + ' is searched.'
      : total === 0 ? 'Nothing found for “' + query + '”.'
      : chosen + ' of ' + total + (total === 1 ? ' match' : ' matches') + ' ticked in ' + this.results.length + (this.results.length === 1 ? ' page' : ' pages');
    this.els.replace.disabled = chosen === 0;
    this.els.replace.textContent = chosen === 0 ? 'Replace' : 'Replace ' + chosen;
  }

  private async run(): Promise<void> {
    const edits = buildEdits(this.results, this.els.replacement.value, this.ticked, key);
    if (!edits.length) { this.els.summary.textContent = 'Nothing would change.'; return; }
    this.els.replace.disabled = true;
    const report = await this.deps.apply(edits);
    await this.load();
    const skipped = report.skipped.length ? ' ' + report.skipped.length + ' page' + (report.skipped.length === 1 ? '' : 's') + ' changed elsewhere and were left alone: ' + report.skipped.join(', ') + '.' : '';
    this.els.summary.textContent = 'Replaced in ' + report.changed + (report.changed === 1 ? ' page.' : ' pages.') + skipped;
  }
}
