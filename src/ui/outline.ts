import { activeIndex, adjacentChapter, buildOutline, visibleOutline, type HeadingInfo, type OutlineItem } from '../core/outline';

export interface OutlineElements {
  root: HTMLElement;
  list: HTMLElement;
  empty: HTMLElement;
  previous?: HTMLButtonElement;
  next?: HTMLButtonElement;
}

function sameOutline(a: readonly OutlineItem[], b: readonly OutlineItem[]): boolean {
  return (
    a.length === b.length &&
    a.every((item, i) => item.pos === b[i].pos && item.level === b[i].level && item.text === b[i].text)
  );
}

/** Side panel listing the manuscript's headings; click one to jump there. */
export class OutlinePanel {
  private items: OutlineItem[] = [];
  private buttons = new Map<number, HTMLButtonElement>();
  private active = -1;
  /** Keyed by heading text and ordinal, not position, so typing above a section does not reopen it. */
  private collapsed = new Set<string>();
  private caret = 0;
  private shown = true;
  private stale = false;

  constructor(
    private readonly els: OutlineElements,
    onJump: (pos: number) => void,
  ) {
    els.root.setAttribute('aria-hidden', 'true');
    els.list.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      const toggle = target.closest<HTMLButtonElement>('button[data-toggle]');
      const jump = target.closest<HTMLButtonElement>('button[data-index]');
      const item = this.items[Number((toggle ?? jump)?.dataset.index ?? toggle?.dataset.toggle)];
      if (!item) return;
      if (toggle) {
        if (this.collapsed.has(item.key)) this.collapsed.delete(item.key);
        else this.collapsed.add(item.key);
        this.rebuild(); this.highlight(this.caret);
        this.els.list.querySelector<HTMLButtonElement>('button[data-toggle="' + toggle.dataset.toggle + '"]')?.focus();
      } else onJump(item.pos);
    });
    els.previous?.addEventListener('click', () => { const item = adjacentChapter(this.items, this.caret, -1); if (item) onJump(item.pos); });
    els.next?.addEventListener('click', () => { const item = adjacentChapter(this.items, this.caret, 1); if (item) onJump(item.pos); });
  }

  get count(): number { return this.items.length; }

  setVisible(on: boolean): void {
    this.shown = on;
    this.els.root.classList.toggle('is-open', on);
    this.els.root.setAttribute('aria-hidden', String(!on));
    if (on && this.stale) { this.rebuild(); this.highlight(this.caret); }
  }

  update(headings: readonly HeadingInfo[], caret: number): void {
    const next = buildOutline(headings);
    if (!sameOutline(next, this.items)) {
      this.items = next;
      // While the panel is closed only the data is kept current; the DOM is rebuilt when it opens.
      if (this.shown) this.rebuild(); else this.stale = true;
    }
    this.highlight(caret);
  }

  highlight(caret: number): void {
    this.caret = caret;
    if (this.els.previous) this.els.previous.disabled = adjacentChapter(this.items, caret, -1) === null;
    if (this.els.next) this.els.next.disabled = adjacentChapter(this.items, caret, 1) === null;
    const index = activeIndex(this.items, caret);
    if (index === this.active) return;
    const previous = this.buttons.get(this.active);
    if (previous) {
      previous.classList.remove('is-active');
      previous.removeAttribute('aria-current');
    }
    const current = this.buttons.get(index);
    if (current) {
      current.classList.add('is-active');
      current.setAttribute('aria-current', 'location');
    }
    this.active = index;
  }

  private rebuild(): void {
    const items = this.items;
    this.stale = false;
    this.collapsed = new Set([...this.collapsed].filter(key => items.some(item => item.key === key)));
    this.active = -1;
    this.buttons.clear();
    const index = new Map(items.map((item, i) => [item, i]));
    const rows = visibleOutline(items, this.collapsed).map((item) => {
      const i = index.get(item)!;
      const row = document.createElement('div');
      row.className = 'outline-row';
      row.dataset.depth = String(item.depth);
      const gap = item.hasChildren ? document.createElement('button') : document.createElement('span');
      gap.className = 'outline-toggle';
      if (gap instanceof HTMLButtonElement) {
        const open = !this.collapsed.has(item.key);
        gap.type = 'button';
        gap.dataset.toggle = String(i);
        gap.textContent = open ? '▾' : '▸';
        gap.setAttribute('aria-expanded', String(open));
        gap.setAttribute('aria-label', (open ? 'Collapse section: ' : 'Expand section: ') + item.text);
      }
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'outline-item';
      button.dataset.index = String(i);
      button.textContent = item.text;
      button.title = item.text;
      this.buttons.set(i, button);
      row.append(gap, button);
      return row;
    });
    this.els.list.replaceChildren(...rows);
    this.els.empty.hidden = items.length > 0;
  }
}
