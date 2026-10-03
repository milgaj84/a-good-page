import { groupHits, rowTitle, splitMatches, treeKey, type NavItem } from './sidebar-logic';

/** A project is a folder in the Library; a file is a page inside one; a loose page sits directly in the Library. */
export type RowKind = 'project' | 'file' | 'loose';

export interface SidebarRow {
  path: string;
  kind: RowKind;
  label: string;
  /** The name on disk, when the label shows a nicer heading. Renaming edits this. */
  fileName?: string;
  meta?: string;
  current: boolean;
  expanded?: boolean;
  missing?: boolean;
  /** For files: the project folder and the position inside it. */
  book?: string;
  index?: number;
  /** In selection mode: ticked, or (for a project) some of its pages ticked. */
  selected?: boolean;
  partial?: boolean;
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
  /** The + on a project: add a page to it. */
  add(row: SidebarRow): void;
  newProject(): void;
  reorder(book: string, path: string, toIndex: number): void;
  /** A page was dropped on another project, between its pages, or on Unfiled pages (`project` null). */
  moveInto(from: SidebarRow, project: string | null, index?: number): void;
  /** Selection mode: tick or untick a row. */
  select(row: SidebarRow): void;
  selectMode(): void;
  query(text: string): void;
  rename(row: SidebarRow, name: string): void;
  hit(hit: SearchHit): void;
  /** F2 on a row: start renaming it. Without this the row menu opens instead. */
  startRename?(row: SidebarRow): void;
  /** Delete on a row: move it to the trash (undoable). Without this the row menu opens instead. */
  trash?(row: SidebarRow): void;
}

export interface SidebarView {
  rows: readonly SidebarRow[];
  hits: readonly SearchHit[];
  renaming: string | null;
  /** Shown when searching finds nothing. */
  empty: string;
  /** True when the Library has nothing in it at all, so a welcome with one clear next step is shown. */
  blank?: boolean;
  selecting?: boolean;
  /** The text being searched for, used to highlight it in the results. Falls back to the search field. */
  query?: string;
}

const SVG = (body: string): string => '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">' + body + '</svg>';
const ICONS = {
  project: SVG('<path d="M3.5 8a2 2 0 0 1 2-2h4l2 2.2h7a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/>'),
  file: SVG('<path d="M7 3.5h6.5L18 8v11.5a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-15a1 1 0 0 1 1-1z"/><path d="M13.5 3.5V8H18"/>'),
  plus: SVG('<path d="M12 5.5v13M5.5 12h13"/>'),
  select: SVG('<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8.5 12.2l2.4 2.4 4.6-5"/>'),
  chevron: SVG('<path d="M9.5 6.5l5.5 5.5-5.5 5.5"/>'),
  clear: SVG('<path d="M7 7l10 10M17 7L7 17"/>'),
  more: SVG('<circle cx="6" cy="12" r="1.1"/><circle cx="12" cy="12" r="1.1"/><circle cx="18" cy="12" r="1.1"/>'),
};
function icon(name: keyof typeof ICONS, className: string): HTMLElement {
  const span = document.createElement('span');
  span.className = className;
  span.innerHTML = ICONS[name]; // constant markup above, never user text
  return span;
}

/** The Library tree: projects with their pages, and any unfiled pages. Dumb on purpose; the controller owns the data. */
export class Sidebar {
  private dragging: SidebarRow | null = null;
  private rebuilding = false;
  private view: SidebarView = { rows: [], hits: [], renaming: null, empty: '' };

  private activePath: string | null = null;
  private readonly rowOf = new WeakMap<HTMLElement, SidebarRow>();

  constructor(private readonly els: SidebarElements, private readonly events: SidebarEvents) {
    const clear = els.search.nextElementSibling instanceof HTMLButtonElement && els.search.nextElementSibling.classList.contains('side-search-clear') ? els.search.nextElementSibling : null;
    const sync = (): void => { if (clear) clear.hidden = !els.search.value; };
    sync();
    els.search.addEventListener('input', () => { sync(); events.query(els.search.value); });
    clear?.addEventListener('click', () => { els.search.value = ''; sync(); events.query(''); els.search.focus(); });
    els.search.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        if (els.search.value) { els.search.value = ''; sync(); events.query(''); }
        else { els.search.blur(); document.querySelector<HTMLElement>('.ProseMirror')?.focus(); }
      } else if (event.key === 'ArrowDown') {
        const target = this.rowEls().find(r => r.tabIndex === 0) ?? this.rowEls()[0];
        if (target) { event.preventDefault(); target.focus(); }
      }
    });
    els.tree.addEventListener('keydown', (event) => this.onKey(event));
    els.tree.addEventListener('focusin', (event) => {
      const row = (event.target as HTMLElement).closest<HTMLElement>('.row');
      if (row?.dataset.path) this.setActive(row);
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
    // A redraw while a name is being typed must not lose the field, its text or its caret.
    const old = tree.querySelector<HTMLInputElement>('.row-input');
    const carry = old && view.renaming !== null && old.closest('.row')?.getAttribute('data-path') === view.renaming
      ? { value: old.value, start: old.selectionStart, end: old.selectionEnd } : null;
    const hadFocus = Boolean(document.activeElement && tree.contains(document.activeElement) && document.activeElement.tagName !== 'INPUT');
    const parts: Node[] = [];
    const loose = view.rows.filter(r => r.kind === 'loose');
    const projects = view.rows.filter(r => r.kind !== 'loose');
    if (view.blank) {
      parts.push(this.welcome());
    } else {
      if (!view.rows.length && !view.hits.length) {
        const empty = document.createElement('p');
        empty.className = 'tree-empty';
        empty.setAttribute('role', 'status');
        empty.textContent = view.empty || 'No matches';
        parts.push(empty);
      }
      if (projects.length || (!view.hits.length && !this.query.trim())) parts.push(this.heading('Projects', true));
      if (projects.length) parts.push(this.group('Projects and their pages', projects));
      if (loose.length) {
        parts.push(this.heading('Unfiled pages', false));
        parts.push(this.group('Unfiled pages', loose));
      }
    }
    if (view.hits.length) {
      parts.push(this.heading('In your text', false));
      const term = view.query ?? this.query;
      for (const group of groupHits(view.hits)) {
        const box = document.createElement('div');
        box.className = 'search-group';
        const title = document.createElement('button');
        title.type = 'button';
        title.className = 'search-title';
        title.textContent = group.title;
        title.title = group.title;
        title.addEventListener('click', () => this.events.hit(group.hits[0]));
        box.append(title);
        for (const hit of group.hits) {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'search-hit';
          for (const seg of splitMatches(hit.context, term)) {
            if (seg.hit) { const mark = document.createElement('mark'); mark.textContent = seg.text; button.append(mark); }
            else button.append(document.createTextNode(seg.text));
          }
          button.addEventListener('click', () => this.events.hit(hit));
          box.append(button);
        }
        parts.push(box);
      }
    }
    this.rebuilding = true;
    tree.replaceChildren(...parts);
    this.rebuilding = false;
    tree.scrollTop = scroll;
    const rows = this.rowEls();
    const active = rows.find(r => r.dataset.path === this.activePath) ?? rows.find(r => r.getAttribute('aria-current') === 'true') ?? rows[0];
    for (const r of rows) r.tabIndex = r === active ? 0 : -1;
    if (active && hadFocus && view.renaming === null) active.focus();
    const input = tree.querySelector<HTMLInputElement>('.row-input');
    if (input) {
      if (carry) { input.value = carry.value; input.focus(); input.setSelectionRange(carry.start ?? carry.value.length, carry.end ?? carry.value.length); }
      else { input.focus(); input.select(); }
    }
  }

  private group(label: string, rows: readonly SidebarRow[]): HTMLElement {
    const el = document.createElement('div');
    el.className = 'tree-group';
    el.setAttribute('role', 'tree');
    el.setAttribute('aria-label', label);
    if (this.view.selecting) el.setAttribute('aria-multiselectable', 'true');
    for (const row of rows) el.append(this.row(row));
    return el;
  }

  private rowEls(): HTMLElement[] { return Array.from(this.els.tree.querySelectorAll<HTMLElement>('.row[data-path]')); }

  private setActive(row: HTMLElement): void {
    this.activePath = row.dataset.path ?? null;
    for (const r of this.rowEls()) r.tabIndex = r === row ? 0 : -1;
  }

  private onKey(event: KeyboardEvent): void {
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' && (target as HTMLInputElement).type !== 'checkbox') return;
    if (event.key === 'Escape' && this.view.selecting) { event.stopPropagation(); this.events.selectMode(); return; }
    const el = target.closest<HTMLElement>('.row');
    const row = el ? this.rowOf.get(el) : undefined;
    if (!el || !row) return;
    const els = this.rowEls();
    const rows = els.map(e => this.rowOf.get(e)!);
    const at = els.indexOf(el);
    const key = event.key;
    const own = target === el || (target as HTMLInputElement).type === 'checkbox';
    const stop = (): void => { event.preventDefault(); event.stopPropagation(); };
    if (key === 'F2') { stop(); if (this.events.startRename && !row.missing) this.events.startRename(row); else this.events.menu(row, this.moreOf(el)); return; }
    if (key === 'Delete') {
      stop();
      if (row.missing) return;
      if (this.events.trash) {
        const near = rows[at + 1] ?? rows[at - 1];
        if (near) this.activePath = near.path;
        this.events.trash(row);
      } else this.events.menu(row, this.moreOf(el));
      return;
    }
    if (key === 'ContextMenu' || (key === 'F10' && event.shiftKey)) { stop(); this.events.menu(row, this.moreOf(el)); return; }
    if (event.altKey && (key === 'ArrowUp' || key === 'ArrowDown') && row.kind === 'file' && row.book !== undefined) {
      stop();
      const next = rows[at + (key === 'ArrowUp' ? -1 : 1)];
      if (next?.kind === 'file' && next.book === row.book && next.index !== undefined) this.events.reorder(row.book, row.path, next.index);
      return;
    }
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if ((key === 'Enter' || key === ' ') && !own) return; // a focused inner button does its own thing
    if (key === ' ' && this.view.selecting && (target as HTMLInputElement).type === 'checkbox') return;
    const move = treeKey(rows as NavItem[], at, key);
    if (!move) return;
    stop();
    if ('to' in move) els[move.to].focus();
    else if ('toggle' in move) {
      if (key === ' ' && this.view.selecting) this.events.select(row);
      else this.events.toggle(row);
    } else if (this.view.selecting) this.events.select(row);
    else this.events.open(row);
  }

  private moreOf(el: HTMLElement): HTMLElement { return el.querySelector<HTMLElement>('.row-btn.more') ?? el; }

  private welcome(): HTMLElement {
    const box = document.createElement('div');
    box.className = 'tree-welcome';
    const title = document.createElement('strong');
    title.textContent = 'Your Library is empty';
    const text = document.createElement('p');
    text.textContent = 'A project holds the pages of one piece of writing: a novel, an essay, a set of notes. Start with a project, or just write a page.';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn-primary';
    button.textContent = 'Create your first project';
    button.addEventListener('click', () => this.events.newProject());
    box.append(title, text, button);
    return box;
  }

  private heading(text: string, withAdd: boolean): HTMLElement {
    const el = document.createElement('div');
    el.className = 'tree-heading';
    const label = document.createElement('span');
    label.textContent = text;
    el.append(label);
    if (text === 'Unfiled pages') {
      el.addEventListener('dragover', (event) => {
        if (this.dragging?.kind !== 'file') return;
        event.preventDefault();
        this.clearMarks();
        el.dataset.drop = 'into';
      });
      el.addEventListener('drop', (event) => {
        const from = this.dragging;
        if (from?.kind !== 'file') return;
        event.preventDefault();
        this.clearMarks();
        this.dragging = null;
        this.events.moveInto(from, null);
      });
    }
    if (withAdd) {
      const add = document.createElement('button');
      add.type = 'button';
      add.className = 'tree-add';
      add.title = 'New project (Ctrl+Shift+N)';
      add.setAttribute('aria-label', 'New project');
      add.innerHTML = ICONS.plus;
      add.addEventListener('click', () => this.events.newProject());
      const select = document.createElement('button');
      select.type = 'button';
      select.className = 'tree-add tree-select';
      select.title = this.view.selecting ? 'Stop selecting pages (Esc)' : 'Select pages: tick several to move, export or trash';
      select.setAttribute('aria-label', 'Select pages');
      select.setAttribute('aria-pressed', String(Boolean(this.view.selecting)));
      select.innerHTML = ICONS.select;
      const word = document.createElement('span');
      word.textContent = 'Select';
      select.append(word);
      select.addEventListener('click', () => this.events.selectMode());
      const group = document.createElement('span');
      group.className = 'tree-add-group';
      group.append(select, add);
      el.append(group);
    }
    return el;
  }

  private row(row: SidebarRow): HTMLElement {
    const el = document.createElement('div');
    el.className = 'row';
    this.rowOf.set(el, row);
    el.setAttribute('role', 'treeitem');
    el.tabIndex = -1;
    el.setAttribute('aria-level', row.kind === 'file' ? '2' : '1');
    el.setAttribute('aria-label', row.label);
    if (row.kind === 'project') el.setAttribute('aria-expanded', String(Boolean(row.expanded)));
    el.setAttribute('aria-selected', String(this.view.selecting ? Boolean(row.selected) : row.current));
    if (this.view.selecting && (row.selected || row.partial)) el.dataset.selected = row.selected ? 'true' : 'partial';
    el.dataset.path = row.path;
    el.dataset.kind = row.kind;
    el.dataset.depth = row.kind === 'file' ? '1' : '0';
    if (row.missing) el.dataset.missing = 'true';
    if (row.current) el.setAttribute('aria-current', 'true');
    if (this.view.renaming === row.path) {
      el.append(icon(row.kind === 'project' ? 'project' : 'file', 'row-icon'));
      const input = document.createElement('input');
      input.className = 'row-input';
      const current = row.fileName ?? row.label;
      input.value = current;
      input.setAttribute('aria-label', 'Name');
      input.title = 'Enter to save, Esc to cancel';
      let done = false;
      const finish = (commit: boolean): void => {
        if (done) return;
        done = true;
        if (commit && input.value.trim() && input.value.trim() !== current) this.events.rename(row, input.value.trim());
        else this.events.rename(row, '');
      };
      input.addEventListener('keydown', (event) => {
        event.stopPropagation();
        if (event.key === 'Enter') { event.preventDefault(); finish(true); }
        else if (event.key === 'Escape') { event.preventDefault(); finish(false); }
      });
      // Keep the typed name when focus goes to a menu or dialog, or the whole window is switched away from.
      input.addEventListener('blur', (event) => {
        if (this.rebuilding || done) return;
        const to = (event as FocusEvent).relatedTarget as HTMLElement | null;
        if (!document.hasFocus() || to?.closest('.menu, [role="dialog"], .overlay')) return;
        finish(true);
      });
      el.append(input);
      return el;
    }
    if (this.view.selecting) {
      const box = document.createElement('input');
      box.type = 'checkbox';
      box.className = 'row-check';
      box.checked = Boolean(row.selected);
      box.indeterminate = Boolean(row.partial);
      box.tabIndex = -1;
      box.setAttribute('aria-label', 'Select ' + row.label);
      box.addEventListener('change', () => this.events.select(row));
      el.append(box);
    }
    const open = document.createElement('button');
    open.type = 'button';
    open.className = 'open';
    open.tabIndex = -1;
    open.title = rowTitle(row.kind, row.label, row.fileName, row.meta);
    if (row.kind === 'project') {
      const chev = document.createElement('span');
      chev.className = 'chev';
      chev.innerHTML = ICONS.chevron;
      open.append(chev);
      open.setAttribute('aria-expanded', String(Boolean(row.expanded)));
    }
    open.append(icon(row.kind === 'project' ? 'project' : 'file', 'row-icon'));
    const label = document.createElement('span');
    label.className = 'label';
    label.textContent = row.label;
    open.append(label);
    if (row.meta) {
      const meta = document.createElement('span');
      meta.className = 'meta';
      meta.textContent = row.meta;
      open.append(meta);
    }
    open.addEventListener('click', () => {
      if (row.kind === 'project') this.events.toggle(row);
      else if (this.view.selecting) this.events.select(row);
      else this.events.open(row);
    });
    el.append(open);
    if (row.kind === 'project') {
      const add = document.createElement('button');
      add.type = 'button';
      add.className = 'row-btn add';
      add.tabIndex = -1;
      add.title = 'Add a page to ' + row.label;
      add.setAttribute('aria-label', 'Add a page to ' + row.label);
      add.innerHTML = ICONS.plus;
      add.addEventListener('click', (event) => { event.stopPropagation(); this.events.add(row); });
      el.append(add);
    }
    const more = document.createElement('button');
    more.type = 'button';
    more.className = 'row-btn more';
    more.tabIndex = -1;
    more.title = 'More actions for ' + row.label + ' (right-click or Shift+F10)';
    more.innerHTML = ICONS.more;
    more.setAttribute('aria-label', 'Actions for ' + row.label);
    more.setAttribute('aria-haspopup', 'menu');
    more.setAttribute('aria-expanded', 'false');
    more.addEventListener('click', (event) => { event.stopPropagation(); this.events.menu(row, more); });
    el.append(more);
    el.addEventListener('contextmenu', (event) => { event.preventDefault(); this.events.menu(row, el); });
    if (!row.missing) this.wireDrag(el, row);
    return el;
  }

  /** Pages drag to reorder, into another project, or out to Unfiled pages; projects accept drops. */
  private wireDrag(el: HTMLElement, row: SidebarRow): void {
    if (row.kind !== 'project' && !this.view.selecting) {
      el.draggable = true;
      el.addEventListener('dragstart', (event) => {
        this.dragging = row;
        el.dataset.dragging = 'true';
        event.dataTransfer?.setData('text/plain', row.path);
        if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
      });
      el.addEventListener('dragend', () => { this.dragging = null; this.clearMarks(); });
    }
    el.addEventListener('dragover', (event) => {
      const from = this.dragging;
      if (!from || from.path === row.path) return;
      if (row.kind === 'project') {
        if (from.book === row.path) return;
        event.preventDefault();
        this.clearMarks();
        el.dataset.drop = 'into';
      } else if (row.kind === 'file') {
        event.preventDefault();
        const box = el.getBoundingClientRect();
        this.clearMarks();
        el.dataset.drop = event.clientY < box.top + box.height / 2 ? 'before' : 'after';
      }
    });
    el.addEventListener('drop', (event) => {
      const from = this.dragging;
      if (!from || from.path === row.path) return;
      if (row.kind === 'project') {
        if (from.book === row.path) return;
        event.preventDefault();
        this.clearMarks();
        this.dragging = null;
        this.events.moveInto(from, row.path);
      } else if (row.kind === 'file' && row.book !== undefined && row.index !== undefined) {
        event.preventDefault();
        let to = row.index + (el.dataset.drop === 'after' ? 1 : 0);
        this.clearMarks();
        this.dragging = null;
        if (from.book === row.book) {
          if (from.index === undefined) return;
          if (from.index < to) to -= 1;
          if (to !== from.index) this.events.reorder(row.book, from.path, to);
        } else this.events.moveInto(from, row.book, to);
      }
    });
  }

  private clearMarks(): void {
    this.els.tree.querySelectorAll<HTMLElement>('[data-drop],[data-dragging]').forEach((n) => { delete n.dataset.drop; delete n.dataset.dragging; });
  }
}
