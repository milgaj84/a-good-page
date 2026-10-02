export type RowKind = 'book' | 'page' | 'chapter';

export interface SidebarRow {
  path: string;
  kind: RowKind;
  label: string;
  meta?: string;
  current: boolean;
  expanded?: boolean;
  missing?: boolean;
  /** For chapters: the book folder and the position inside it. */
  book?: string;
  index?: number;
}

export interface SearchHit { path: string; book: string | null; title: string; context: string }

export interface SidebarElements {
  tree: HTMLElement;
  search: HTMLInputElement;
}

export interface SidebarEvents {
  open(row: SidebarRow): void;
  toggle(row: SidebarRow): void;
  menu(row: SidebarRow, anchor: HTMLElement): void;
  reorder(book: string, path: string, toIndex: number): void;
  query(text: string): void;
  rename(row: SidebarRow, name: string): void;
  hit(hit: SearchHit): void;
}

export interface SidebarView {
  rows: readonly SidebarRow[];
  hits: readonly SearchHit[];
  renaming: string | null;
  /** Shown when there is nothing to list. */
  empty: string;
}

/** The Library tree: pages and books, with chapters nested under an open book. Dumb on purpose; the controller owns the data. */
export class Sidebar {
  private dragging: SidebarRow | null = null;
  private view: SidebarView = { rows: [], hits: [], renaming: null, empty: '' };

  constructor(private readonly els: SidebarElements, private readonly events: SidebarEvents) {
    els.search.addEventListener('input', () => events.query(els.search.value));
    els.search.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && els.search.value) { els.search.value = ''; events.query(''); event.stopPropagation(); }
    });
  }

  get query(): string { return this.els.search.value; }
  /** Live word count for the open page without rebuilding the tree. */
  setCurrentMeta(text: string): void {
    const meta = this.els.tree.querySelector<HTMLElement>('.row[aria-current="true"] .meta');
    if (meta) meta.textContent = text;
  }
  focusSearch(): void { this.els.search.focus(); this.els.search.select(); }

  render(view: SidebarView): void {
    this.view = view;
    const tree = this.els.tree;
    const scroll = tree.scrollTop;
    const parts: Node[] = [];
    const pages = view.rows.filter(r => r.kind === 'page');
    const books = view.rows.filter(r => r.kind !== 'page');
    if (!view.rows.length && !view.hits.length) {
      const empty = document.createElement('p');
      empty.className = 'tree-empty';
      empty.textContent = view.empty;
      parts.push(empty);
    }
    for (const row of books) parts.push(this.row(row));
    if (books.length && pages.length) parts.push(this.heading('Pages'));
    for (const row of pages) parts.push(this.row(row));
    if (view.hits.length) {
      parts.push(this.heading('In your text'));
      for (const hit of view.hits) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'search-hit';
        const title = document.createElement('b');
        title.textContent = hit.title;
        button.append(title, document.createTextNode(hit.context));
        button.addEventListener('click', () => this.events.hit(hit));
        parts.push(button);
      }
    }
    tree.replaceChildren(...parts);
    tree.scrollTop = scroll;
    tree.querySelector<HTMLInputElement>('.row-input')?.focus();
    tree.querySelector<HTMLInputElement>('.row-input')?.select();
  }

  private heading(text: string): HTMLElement {
    const el = document.createElement('div');
    el.className = 'tree-heading';
    el.textContent = text;
    return el;
  }

  private row(row: SidebarRow): HTMLElement {
    const el = document.createElement('div');
    el.className = 'row';
    el.dataset.path = row.path;
    el.dataset.depth = row.kind === 'chapter' ? '1' : '0';
    if (row.missing) el.dataset.missing = 'true';
    if (row.current) el.setAttribute('aria-current', 'true');
    if (this.view.renaming === row.path) {
      const input = document.createElement('input');
      input.className = 'row-input';
      input.value = row.label;
      input.setAttribute('aria-label', 'Name');
      let done = false;
      const finish = (commit: boolean): void => {
        if (done) return;
        done = true;
        if (commit && input.value.trim() && input.value.trim() !== row.label) this.events.rename(row, input.value.trim());
        else this.events.rename(row, '');
      };
      input.addEventListener('keydown', (event) => {
        event.stopPropagation();
        if (event.key === 'Enter') { event.preventDefault(); finish(true); }
        else if (event.key === 'Escape') { event.preventDefault(); finish(false); }
      });
      input.addEventListener('blur', () => finish(true));
      el.append(input);
      return el;
    }
    const open = document.createElement('button');
    open.type = 'button';
    open.className = 'open';
    if (row.kind === 'book') {
      const chev = document.createElement('span');
      chev.className = 'chev';
      chev.textContent = row.expanded ? '▾' : '▸';
      open.append(chev);
      open.setAttribute('aria-expanded', String(Boolean(row.expanded)));
    }
    const label = document.createElement('span');
    label.className = 'label';
    label.textContent = row.label;
    label.title = row.label;
    open.append(label);
    if (row.meta) {
      const meta = document.createElement('span');
      meta.className = 'meta';
      meta.textContent = row.meta;
      open.append(meta);
    }
    open.addEventListener('click', () => (row.kind === 'book' ? this.events.toggle(row) : this.events.open(row)));
    el.append(open);
    if (!row.missing) {
      const more = document.createElement('button');
      more.type = 'button';
      more.className = 'more';
      more.textContent = '⋯';
      more.setAttribute('aria-label', 'Actions for ' + row.label);
      more.setAttribute('aria-haspopup', 'menu');
      more.setAttribute('aria-expanded', 'false');
      more.addEventListener('click', (event) => { event.stopPropagation(); this.events.menu(row, more); });
      el.append(more);
    } else {
      const more = document.createElement('button');
      more.type = 'button';
      more.className = 'more';
      more.textContent = '⋯';
      more.setAttribute('aria-label', 'Actions for missing chapter ' + row.label);
      more.setAttribute('aria-expanded', 'false');
      more.addEventListener('click', (event) => { event.stopPropagation(); this.events.menu(row, more); });
      el.append(more);
    }
    el.addEventListener('contextmenu', (event) => { event.preventDefault(); this.events.menu(row, el); });
    if (row.kind === 'chapter' && row.book !== undefined && !row.missing) this.makeDraggable(el, row);
    return el;
  }

  private makeDraggable(el: HTMLElement, row: SidebarRow): void {
    el.draggable = true;
    el.addEventListener('dragstart', (event) => {
      this.dragging = row;
      el.dataset.dragging = 'true';
      event.dataTransfer?.setData('text/plain', row.path);
      if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
    });
    el.addEventListener('dragend', () => { this.dragging = null; this.clearMarks(); });
    el.addEventListener('dragover', (event) => {
      const from = this.dragging;
      if (!from || from.book !== row.book || from.path === row.path) return;
      event.preventDefault();
      const box = el.getBoundingClientRect();
      this.clearMarks();
      el.dataset.drop = event.clientY < box.top + box.height / 2 ? 'before' : 'after';
    });
    el.addEventListener('drop', (event) => {
      const from = this.dragging;
      if (!from || from.book !== row.book || row.index === undefined || from.index === undefined || row.book === undefined) return;
      event.preventDefault();
      let to = row.index + (el.dataset.drop === 'after' ? 1 : 0);
      if (from.index < to) to -= 1;
      this.clearMarks();
      this.dragging = null;
      if (to !== from.index) this.events.reorder(row.book, from.path, to);
    });
  }

  private clearMarks(): void {
    this.els.tree.querySelectorAll<HTMLElement>('[data-drop],[data-dragging]').forEach((n) => { delete n.dataset.drop; delete n.dataset.dragging; });
  }
}
