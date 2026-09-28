import { DialogFocus } from './dialog-focus';
import { compareParagraphs, type ConflictChoice, type FileConflict } from '../core/file-conflict';

/** Modal decision surface. No outside version can overwrite the writer's words automatically. */
export class FileConflictDialog {
  readonly root = document.createElement('div');
  private readonly focus = new DialogFocus(this.root);
  private resolve: ((choice: ConflictChoice) => void) | null = null;
  private readonly title = document.createElement('h2');
  private readonly message = document.createElement('p');
  private readonly comparison = document.createElement('div');
  private readonly review = document.createElement('button');
  private readonly reload = document.createElement('button');
  private readonly copy = document.createElement('button');
  private readonly keep = document.createElement('button');

  constructor(host: HTMLElement) {
    this.root.className = 'overlay conflict-overlay';
    this.root.setAttribute('aria-hidden', 'true');
    this.root.tabIndex = -1;
    const sheet = document.createElement('section');
    sheet.className = 'conflict-sheet';
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-modal', 'true');
    sheet.setAttribute('aria-labelledby', 'conflict-title');
    sheet.setAttribute('aria-describedby', 'conflict-message');
    this.title.id = 'conflict-title';
    this.message.id = 'conflict-message';
    this.comparison.className = 'conflict-comparison';
    this.comparison.hidden = true;
    this.review.textContent = 'Review changes';
    this.reload.textContent = 'Reload from disk';
    this.copy.textContent = 'Save my version as a copy';
    this.keep.textContent = 'Keep writing';
    for (const button of [this.review, this.reload, this.copy, this.keep]) button.type = 'button';
    const actions = document.createElement('div');
    actions.className = 'conflict-actions';
    actions.append(this.review, this.reload, this.copy, this.keep);
    sheet.append(this.title, this.message, this.comparison, actions);
    this.root.append(sheet);
    host.append(this.root);
    this.review.addEventListener('click', () => {
      this.comparison.hidden = !this.comparison.hidden;
      this.review.textContent = this.comparison.hidden ? 'Review changes' : 'Hide comparison';
    });
    this.reload.addEventListener('click', () => this.finish('reload'));
    this.copy.addEventListener('click', () => this.finish('copy'));
    this.keep.addEventListener('click', () => this.finish('keep'));
    this.root.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.preventDefault(); this.finish('keep'); }
      event.stopPropagation();
    });
  }

  get isOpen(): boolean { return this.resolve !== null; }

  ask(conflict: FileConflict): Promise<ConflictChoice> {
    if (this.resolve) return Promise.resolve('keep');
    this.title.textContent = 'This file changed elsewhere';
    this.message.textContent = conflict.deleted
      ? 'The file was moved or deleted. Your draft is still here. Save it as a copy before closing.'
      : !conflict.canReload ? 'That destination already contains a file. Choose a new filename for your copy.'
      : 'Another app changed this file. A Good Page stopped saving so neither version is overwritten. Choose what to keep.';
    this.reload.disabled = !conflict.canReload;
    this.comparison.replaceChildren();
    this.comparison.hidden = true;
    this.review.textContent = 'Review changes';
    const data = compareParagraphs(conflict.mine, conflict.disk);
    for (const [label, paragraphs, other] of [
      ['Your draft', data.mine, data.disk], ['On disk', data.disk, data.mine],
    ] as const) {
      const column = document.createElement('div');
      const heading = document.createElement('h3');
      heading.textContent = label;
      column.append(heading);
      for (const text of paragraphs) {
        const item = document.createElement('p');
        item.textContent = text;
        if (!other.includes(text)) item.className = 'conflict-changed';
        column.append(item);
      }
      if (paragraphs.length >= 300) {
        const note = document.createElement('p');
        note.textContent = 'Showing the first 300 paragraphs. The saved files retain the full text.';
        column.append(note);
      }
      this.comparison.append(column);
    }
    this.root.classList.add('is-open');
    this.root.setAttribute('aria-hidden', 'false');
    this.focus.open(this.review);
    return new Promise(resolve => { this.resolve = resolve; });
  }

  close(): void { this.finish('keep'); }
  private finish(choice: ConflictChoice): void {
    const resolve = this.resolve;
    if (!resolve) return;
    this.resolve = null;
    this.root.classList.remove('is-open');
    this.root.setAttribute('aria-hidden', 'true');
    this.focus.close();
    resolve(choice);
  }
}
