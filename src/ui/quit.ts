import { DialogFocus } from './dialog-focus';
export type QuitChoice = 'save' | 'discard' | 'cancel';
/** Three-way asynchronous quit decision. Reusing a pending dialog prevents close loops. */
export class QuitDialog {
  private pending: Promise<QuitChoice> | null = null;
  private readonly focus: DialogFocus;
  constructor(private readonly root: HTMLElement, private readonly error: HTMLElement,
    private readonly save: HTMLElement, private readonly discard: HTMLElement, private readonly cancel: HTMLElement) {
    this.focus = new DialogFocus(root);
    root.tabIndex = -1;
    root.addEventListener('keydown', event => { if (event.key === 'Escape' && this.isOpen) { event.preventDefault(); this.cancel.click(); } });
  }
  ask(): Promise<QuitChoice> {
    if (this.pending) return this.pending;
    this.root.classList.add('is-open'); this.root.setAttribute('aria-hidden', 'false');
    this.pending = new Promise(resolve => {
      const finish = (choice: QuitChoice) => {
        this.root.classList.remove('is-open'); this.root.setAttribute('aria-hidden', 'true');
        this.save.removeEventListener('click', onSave); this.discard.removeEventListener('click', onDiscard);
        this.cancel.removeEventListener('click', onCancel); this.pending = null; this.error.textContent = ''; this.focus.close(); resolve(choice);
      };
      const onSave = () => finish('save'); const onDiscard = () => finish('discard'); const onCancel = () => finish('cancel');
      this.save.addEventListener('click', onSave); this.discard.addEventListener('click', onDiscard);
      this.cancel.addEventListener('click', onCancel); this.focus.open(this.cancel);
    });
    return this.pending;
  }
  get isOpen(): boolean { return this.pending !== null; }
  cancelChoice(): boolean { if (!this.isOpen) return false; this.cancel.click(); return true; }
  showError(message: string): void { this.error.textContent = message; }
}
