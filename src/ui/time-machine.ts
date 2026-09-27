import { DialogFocus } from './dialog-focus';
import { relativeLabel, type Snapshot } from '../core/snapshots';
import { formatCount } from '../core/stats';
import type { ReaderView } from '../editor/reader';

export interface TimeMachineDeps {
  /** Saved versions for the open document, oldest first. */
  versions(): Promise<Snapshot[]>;
  /** Stores the page as it is now, so a restore can always be reversed; returns the current content. */
  captureCurrent(): Promise<string>;
  restore(content: string): void;
  isPlain(): boolean;
  documentName(): string;
  createReader(element: HTMLElement): ReaderView;
  now(): number;
  notify(message: string): void;
}

function make<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text) node.textContent = text;
  return node;
}

/** Scrub through earlier versions of the manuscript and restore one as an undoable edit. */
export class TimeMachine {
  readonly root = make('div', 'overlay time-overlay');
  private readonly title = make('h2', 'time-title');
  private readonly when = make('p', 'time-when');
  private readonly slider = make('input', 'time-slider');
  private readonly page = make('div', 'time-page');
  private readonly empty = make('p', 'time-empty');
  private readonly restoreButton = make('button', 'time-restore', 'Restore this version');
  private readonly closeButton = make('button', 'time-close', 'Close');
  private readonly focus: DialogFocus;
  private reader: ReaderView | null = null;
  private versions: Snapshot[] = [];
  private generation = 0;

  constructor(host: HTMLElement, private readonly deps: TimeMachineDeps) {
    const sheet = make('div', 'time-sheet');
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-modal', 'true');
    sheet.setAttribute('aria-labelledby', 'time-title');
    this.title.id = 'time-title';
    const head = make('header', 'time-head');
    head.append(make('p', 'session-eyebrow', 'Time Machine'), this.title, this.when);
    this.slider.type = 'range';
    this.slider.min = '0';
    this.slider.step = '1';
    this.slider.setAttribute('aria-label', 'Choose a version');
    this.when.setAttribute('aria-live', 'polite');
    this.empty.textContent = 'No earlier versions yet. A Good Page keeps one as you save and about every ten minutes while you write.';
    this.restoreButton.type = 'button';
    this.closeButton.type = 'button';
    const actions = make('footer', 'time-actions');
    actions.append(this.closeButton, this.restoreButton);
    sheet.append(head, this.slider, this.page, this.empty, actions);
    this.root.append(sheet);
    this.root.tabIndex = -1;
    this.root.setAttribute('aria-hidden', 'true');
    host.append(this.root);
    this.focus = new DialogFocus(this.root);

    this.slider.addEventListener('input', () => this.show(Number(this.slider.value)));
    this.restoreButton.addEventListener('click', () => this.restoreSelected());
    this.closeButton.addEventListener('click', () => this.close());
    this.root.addEventListener('mousedown', (event) => { if (event.target === this.root) this.close(); });
  }

  get isOpen(): boolean { return this.root.classList.contains('is-open'); }

  toggle(): void { if (this.isOpen) this.close(); else void this.open(); }

  async open(): Promise<void> {
    const generation = ++this.generation;
    this.title.textContent = this.deps.documentName();
    this.when.textContent = 'Loading versions…';
    this.versions = [];
    this.paintEmpty(false);
    this.root.classList.add('is-open');
    this.root.setAttribute('aria-hidden', 'false');
    this.focus.open(this.closeButton);
    let versions: Snapshot[];
    let current: string;
    try {
      current = await this.deps.captureCurrent();
      versions = await this.deps.versions();
    } catch (error) {
      if (generation === this.generation) this.when.textContent = 'Versions are unavailable: ' + String(error);
      return;
    }
    if (generation !== this.generation || !this.isOpen) return;
    // A version identical to the page as it is now would change nothing, so it is not offered.
    this.versions = versions.filter((version) => version.content !== current);
    if (!this.versions.length) { this.paintEmpty(true); return; }
    this.slider.max = String(this.versions.length - 1);
    this.slider.value = this.slider.max;
    this.paintEmpty(false);
    this.show(this.versions.length - 1);
    this.focus.open(this.slider);
  }

  close(restore = true): void {
    if (!this.isOpen) return;
    this.generation++;
    this.root.classList.remove('is-open');
    this.root.setAttribute('aria-hidden', 'true');
    this.focus.close(restore);
  }

  /** The open document changed underneath the dialog: its versions no longer apply. */
  documentChanged(): void { this.close(false); }

  private paintEmpty(empty: boolean): void {
    const has = this.versions.length > 0;
    this.empty.hidden = !empty;
    this.slider.hidden = !has;
    this.page.hidden = !has;
    this.restoreButton.disabled = !has;
    if (empty) this.when.textContent = '';
  }

  private show(index: number): void {
    const version = this.versions[index];
    if (!version) return;
    const label = relativeLabel(version.at, this.deps.now());
    const position = (index + 1) + ' of ' + this.versions.length;
    this.when.textContent = label + ' · ' + formatCount(version.words) + ' words · ' + position;
    this.slider.setAttribute('aria-valuetext', label + ', version ' + position);
    this.reader ??= this.deps.createReader(this.page);
    this.reader.show(version.content, this.deps.isPlain());
    this.page.scrollTop = 0;
  }

  private restoreSelected(): void {
    const version = this.versions[Number(this.slider.value)];
    if (!version) return;
    const label = relativeLabel(version.at, this.deps.now());
    this.close(false);
    this.deps.restore(version.content);
    this.deps.notify('Restored: ' + label + '. Undo brings back your newer words.');
  }
}
