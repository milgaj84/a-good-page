import type { ReferencePin } from '../core/reference-pin';
import { isPlainTextPath, nameFromPath } from '../core/paths';
import type { ReaderView } from '../editor/reader';

export interface ReferenceDeps {
  pin: ReferencePin;
  read(path: string): Promise<{ content: string }>;
  pickPath(): Promise<string | null>;
  currentPath(): string | null;
  createReader(element: HTMLElement): ReaderView;
  notify(message: string): void;
}

function button(label: string, title: string, className = 'reference-tool'): HTMLButtonElement {
  const node = document.createElement('button');
  node.type = 'button';
  node.className = className;
  node.textContent = label;
  node.title = title;
  node.setAttribute('aria-label', title);
  return node;
}

/** A read-only notes page pinned beside the manuscript. It never writes the pinned file. */
export class ReferencePanel {
  readonly root = document.createElement('aside');
  private readonly title = document.createElement('h2');
  private readonly body = document.createElement('div');
  private readonly empty = document.createElement('div');
  private readonly status = document.createElement('p');
  private readonly tab = button('Notes', 'Show pinned notes', 'reference-tab');
  private readonly collapse = button('⟨', 'Collapse notes');
  private readonly swap = button('⇄', 'Move notes to the other side');
  private readonly reload = button('↻', 'Reload pinned notes');
  private readonly unpin = button('×', 'Unpin notes');
  private reader: ReaderView | null = null;
  private visible = false;
  private request = 0;

  constructor(host: HTMLElement, private readonly deps: ReferenceDeps) {
    this.root.className = 'reference-panel';
    this.root.id = 'reference-panel';
    this.root.setAttribute('aria-label', 'Pinned notes');
    const head = document.createElement('header');
    head.className = 'reference-head';
    this.title.className = 'reference-title';
    const tools = document.createElement('div');
    tools.className = 'reference-tools';
    tools.append(this.reload, this.swap, this.collapse, this.unpin);
    head.append(this.title, tools);
    this.body.className = 'reference-body';
    this.empty.className = 'reference-empty';
    const copy = document.createElement('p');
    copy.textContent = 'Keep an outline, research or character notes beside your page. Pinned notes are read-only here.';
    const pinCurrent = button('Pin this document', 'Pin the open document as notes', 'reference-choice');
    const choose = button('Choose a file…', 'Choose a notes file to pin', 'reference-choice');
    this.empty.append(copy, pinCurrent, choose);
    this.status.className = 'reference-status';
    this.status.setAttribute('role', 'status');
    this.root.append(head, this.status, this.body, this.empty, this.tab);
    host.append(this.root);

    pinCurrent.addEventListener('click', () => {
      const path = this.deps.currentPath();
      if (path) void this.pinPath(path);
      else this.deps.notify('Save this document first, then pin it as notes.');
    });
    choose.addEventListener('click', () => void this.choose());
    this.tab.addEventListener('click', () => this.toggleCollapsed());
    this.collapse.addEventListener('click', () => this.toggleCollapsed());
    this.swap.addEventListener('click', () => { this.deps.pin.swapSide(); this.paint(); });
    this.reload.addEventListener('click', () => void this.load());
    this.unpin.addEventListener('click', () => { this.deps.pin.unpin(); this.request++; this.showEmpty(); });
    this.paint();
  }

  get isOpen(): boolean { return this.visible && !this.deps.pin.state.collapsed; }

  /** Opens the panel; an existing pin is loaded, otherwise the writer is offered a choice. */
  toggle(): void {
    if (this.visible && !this.deps.pin.state.collapsed) { this.close(); return; }
    this.visible = true;
    if (this.deps.pin.state.collapsed) this.deps.pin.toggleCollapsed();
    this.paint();
    if (this.deps.pin.state.path) void this.load(); else this.showEmpty();
  }

  close(): void {
    this.visible = false;
    this.paint();
  }

  /** Restores a pin on launch without stealing focus. */
  restore(): void {
    if (!this.deps.pin.state.path) return;
    this.visible = true;
    this.paint();
    void this.load();
  }

  private toggleCollapsed(): void {
    this.deps.pin.toggleCollapsed();
    this.paint();
  }

  private async choose(): Promise<void> {
    let path: string | null;
    try {
      path = await this.deps.pickPath();
    } catch (error) {
      this.deps.notify('Could not open the file picker: ' + String(error));
      return;
    }
    if (path) await this.pinPath(path);
  }

  private async pinPath(path: string): Promise<void> {
    if (!this.deps.pin.pin(path)) { this.deps.notify('Notes can be .md, .markdown or .txt files.'); return; }
    this.visible = true;
    this.paint();
    await this.load();
  }

  private async load(): Promise<void> {
    const path = this.deps.pin.state.path;
    if (!path) { this.showEmpty(); return; }
    const request = ++this.request;
    this.title.textContent = nameFromPath(path);
    this.title.title = path;
    this.status.textContent = 'Loading…';
    this.empty.hidden = true;
    this.body.hidden = false;
    try {
      const opened = await this.deps.read(path);
      if (request !== this.request) return;
      this.reader ??= this.deps.createReader(this.body);
      this.reader.show(opened.content, isPlainTextPath(path));
      this.status.textContent = '';
    } catch (error) {
      if (request !== this.request) return;
      this.status.textContent = 'Could not read these notes. The file may have moved. ' + String(error);
    }
  }

  private showEmpty(): void {
    this.title.textContent = 'Notes';
    this.title.removeAttribute('title');
    this.status.textContent = '';
    this.body.hidden = true;
    this.empty.hidden = false;
  }

  private paint(): void {
    const { side, collapsed, path } = this.deps.pin.state;
    this.root.dataset.side = side;
    this.root.classList.toggle('is-open', this.visible);
    this.root.classList.toggle('is-collapsed', collapsed);
    this.root.setAttribute('aria-hidden', String(!this.visible));
    this.collapse.textContent = side === 'left' ? '⟨' : '⟩';
    this.tab.hidden = !collapsed;
    this.reload.hidden = !path;
    this.unpin.hidden = !path;
    document.documentElement.dataset.reference = this.visible && !collapsed ? side : '';
  }
}
