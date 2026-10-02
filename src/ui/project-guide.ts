import type { ShareOverview } from '../core/share-overview';
import { PLACES, type NextAction, type NextStep, type Place, type ShareStep } from '../core/workflow';

const make = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text = ''): HTMLElementTagNameMap[K] => {
  const el = document.createElement(tag); el.className = className; el.textContent = text; return el;
};

/** The same three places everywhere: in the top bar and at the top of the project page. */
export class PlaceTabs {
  readonly root = make('nav', 'places');
  private readonly buttons = new Map<Place, HTMLButtonElement>();
  constructor(label: string, go: (place: Place) => void) {
    this.root.setAttribute('aria-label', label);
    for (const item of PLACES) {
      const button = make('button', 'place', item.label);
      button.type = 'button';
      button.title = item.hint + ' (Ctrl/Cmd+Shift+' + item.digit + ')';
      button.dataset.place = item.place;
      button.addEventListener('click', () => go(item.place));
      this.buttons.set(item.place, button);
      this.root.append(button);
    }
    this.mark('write');
  }
  mark(place: Place): void {
    for (const [key, button] of this.buttons) {
      if (key === place) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    }
  }
}

/** A single "what now?" card. It never acts by itself; the writer presses its one button. */
export function drawNextStep(host: HTMLElement, step: NextStep, act: (action: NextAction) => void): void {
  const wasFocused = document.activeElement === host.querySelector('.next-button');
  const title = make('strong', 'next-title', step.title);
  const detail = make('span', 'next-detail', step.detail);
  const button = make('button', 'next-button', step.button);
  button.type = 'button';
  button.addEventListener('click', () => act(step.action));
  const text = make('div', 'next-text');
  text.append(title, detail);
  host.replaceChildren(text, button);
  host.dataset.action = step.action;
  if (wasFocused) button.focus();
}

/** Three numbered steps for sharing; done, current, waiting or blocked. */
export function drawShareSteps(host: HTMLElement, steps: readonly ShareStep[]): void {
  host.replaceChildren(...steps.map(step => {
    const item = make('li', 'share-step', step.label);
    item.dataset.mark = step.mark;
    if (step.mark === 'current') item.setAttribute('aria-current', 'step');
    return item;
  }));
}

/** Keep secondary controls reachable without making them compete with Save or the book path. */
export function attachActionMenus(root: Document = document): void {
  const menus = [...root.querySelectorAll<HTMLDetailsElement>('.more-menu')];
  for (const menu of menus) {
    menu.addEventListener('toggle', () => {
      if (menu.open) for (const other of menus) if (other !== menu) other.open = false;
    });
    menu.addEventListener('click', event => {
      if (!(event.target instanceof HTMLElement) || !event.target.closest('button')) return;
      menu.open = false;
    });
    menu.addEventListener('keydown', event => {
      if (event.key === 'Escape' && menu.open) {
        event.preventDefault(); event.stopPropagation(); menu.open = false;
        menu.querySelector<HTMLElement>('summary')?.focus();
      }
    });
  }
  root.addEventListener('pointerdown', event => {
    if (!(event.target instanceof Node)) return;
    for (const menu of menus) if (menu.open && !menu.contains(event.target)) menu.open = false;
  });
}

/** Live, text-first summary of the exact chapter selection, never a PDF page estimate. */
export function drawShareOverview(host: HTMLElement, summary: ShareOverview): void {
  const heading = make('strong', 'overview-heading', 'Your book PDF');
  const amount = make('span', 'overview-count', summary.selected + ' of ' + summary.available + ' readable chapters · ' + summary.words.toLocaleString() + ' words selected');
  const messages = { choose: 'Choose at least one chapter.', repair: 'Resolve missing or unreadable chapters before sharing.',
    read: 'Read selected chapters through before opening PDF pages.', refresh: 'Pages need refreshing before export.',
    export: 'Preview ready. Sources are checked again at export.' };
  const detail = make('span', 'overview-state', messages[summary.state]);
  host.replaceChildren(heading, amount, detail);
  host.dataset.state = summary.state;
}
