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
  private buttons: HTMLButtonElement[] = [];
  private active = -1;
  private collapsed = new Set<number>();
  private caret = 0;

  constructor(
    private readonly els: OutlineElements,
    onJump: (pos: number) => void,
  ) {
    els.root.setAttribute('aria-hidden', 'true');
    els.list.addEventListener('click', (event) => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-index]');
      const item = button ? this.items[Number(button.dataset.index)] : undefined;
      if (!item) return;
      if ((event.target as HTMLElement).closest('[data-toggle]')) {
        if (this.collapsed.has(item.pos)) this.collapsed.delete(item.pos);
        else this.collapsed.add(item.pos);
        this.rebuild(this.items); this.highlight(this.caret);
      } else onJump(item.pos);
    });
    els.previous?.addEventListener('click', () => { const item = adjacentChapter(this.items, this.caret, -1); if (item) onJump(item.pos); });
    els.next?.addEventListener('click', () => { const item = adjacentChapter(this.items, this.caret, 1); if (item) onJump(item.pos); });
  }

  get count(): number { return this.items.length; }

  setVisible(on: boolean): void {
    this.els.root.classList.toggle('is-open', on);
    this.els.root.setAttribute('aria-hidden', String(!on));
  }

  update(headings: readonly HeadingInfo[], caret: number): void {
    const next = buildOutline(headings);
    if (!sameOutline(next, this.items)) this.rebuild(next);
    this.highlight(caret);
  }

  highlight(caret: number): void {
    this.caret = caret;
    if (this.els.previous) this.els.previous.disabled = adjacentChapter(this.items, caret, -1) === null;
    if (this.els.next) this.els.next.disabled = adjacentChapter(this.items, caret, 1) === null;
    const index = activeIndex(this.items, caret);
    if (index === this.active) return;
    const previous = this.buttons.find(b => Number(b.dataset.index) === this.active);
    if (previous) {
      previous.classList.remove('is-active');
      previous.removeAttribute('aria-current');
    }
    const current = this.buttons.find(b => Number(b.dataset.index) === index);
    if (current) {
      current.classList.add('is-active');
      current.setAttribute('aria-current', 'location');
    }
    this.active = index;
  }

  private rebuild(items: OutlineItem[]): void {
    this.items = items;
    this.collapsed = new Set([...this.collapsed].filter(pos => items.some(item => item.pos === pos)));
    this.active = -1;
    const shown = visibleOutline(items, this.collapsed);
    this.buttons = shown.map((item) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'outline-item';
      button.dataset.index = String(items.indexOf(item));
      button.dataset.depth = String(item.depth);
      const toggle = document.createElement('span'); toggle.dataset.toggle = 'true';
      const hasChildren = items.some((other, i) => i > items.indexOf(item) && other.depth > item.depth &&
        !items.slice(items.indexOf(item) + 1, i).some(mid => mid.depth <= item.depth));
      toggle.textContent = hasChildren ? (this.collapsed.has(item.pos) ? '▸' : '▾') : ' ';
      toggle.setAttribute('aria-label', this.collapsed.has(item.pos) ? 'Expand section' : 'Collapse section');
      button.append(toggle, document.createTextNode(item.text));
      button.setAttribute('aria-expanded', String(!this.collapsed.has(item.pos)));
      button.title = item.text;
      return button;
    });
    this.els.list.replaceChildren(...this.buttons);
    this.els.empty.hidden = items.length > 0;
  }
}
