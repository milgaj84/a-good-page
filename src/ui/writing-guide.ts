import { FirstRunGuide, type GuideStep } from '../core/first-run';
import { DialogFocus } from './dialog-focus';

export interface GuideElements {
  root: HTMLElement; resume: HTMLButtonElement; title: HTMLElement; copy: HTMLElement; action: HTMLButtonElement;
  skip: HTMLButtonElement; position: HTMLElement; error: HTMLElement;
}
const CONTENT: Record<GuideStep, { title: string; copy: string; action: string }> = {
  create: { title: 'A place for your words', copy: 'Write just as you would on paper. Click below for a new blank page—there are no Markdown symbols to learn.', action: 'Start a new page' },
  save: { title: 'Keep your words', copy: 'Type a sentence, then save it as a Markdown or plain-text file. Both open outside A Good Page, too.', action: 'Save my page' },
  export: { title: 'Share a reading copy', copy: 'See real pages before saving a PDF. Choose a roomy manuscript or a polished reading layout.', action: 'Preview my PDF' },
  done: { title: 'You’re ready to write', copy: 'Your page is yours. Reopen this guide anytime from Help; your manuscript has not been changed by the guide.', action: 'Back to writing' },
};
/** First launch is optional; each step advances only after the actual action succeeds. */
export class WritingGuide {
  private waitingForExport = false;
  private busy = false;
  private readonly focus: DialogFocus;
  constructor(private readonly els: GuideElements, private readonly model: FirstRunGuide,
    private readonly create: () => Promise<boolean>, private readonly save: () => Promise<boolean>,
    private readonly preview: () => Promise<void>, private readonly focusWriter: () => void) {
    this.focus = new DialogFocus(els.root);
    els.root.setAttribute('aria-hidden', 'true');
    els.root.tabIndex = -1;
    els.action.addEventListener('click', () => void this.act());
    els.skip.addEventListener('click', () => this.close(true));
    els.resume.addEventListener('click', () => this.open());
  }
  get shouldOffer(): boolean { return this.model.shouldOffer; }
  get isOpen(): boolean { return this.els.root.classList.contains('is-open'); }
  open(restart = false): void {
    if (restart) this.model.restart();
    this.waitingForExport = false;
    this.els.error.textContent = '';
    this.render(); this.els.resume.hidden = true; this.els.root.classList.add('is-open');
    this.els.root.setAttribute('aria-hidden', 'false'); this.focus.open(this.els.action);
  }
  close(dismiss = false): void {
    if (dismiss) this.model.dismiss();
    this.els.resume.hidden = dismiss || this.model.step !== 'save';
    this.els.root.classList.remove('is-open'); this.els.root.setAttribute('aria-hidden', 'true');
    this.focus.close();
  }
  exported(): void {
    if (!this.waitingForExport) return;
    this.waitingForExport = false;
    this.model.next(true);
    this.open();
  }
  previewClosed(): void {
    if (!this.waitingForExport) return;
    this.waitingForExport = false;
    this.open();
  }
  private render(): void {
    const state = CONTENT[this.model.step];
    this.els.title.textContent = state.title; this.els.copy.textContent = state.copy;
    this.els.action.textContent = state.action;
    this.els.position.textContent = this.model.step === 'done' ? 'All set' :
      'Step ' + (['create', 'save', 'export'].indexOf(this.model.step) + 1) + ' of 3';
    this.els.skip.hidden = this.model.step === 'done';
  }
  private async act(): Promise<void> {
    if (this.busy) return;
    if (this.model.step === 'done') { this.close(true); return; }
    this.busy = true; this.els.action.disabled = true; this.els.skip.disabled = true; this.els.error.textContent = '';
    try {
      if (this.model.step === 'export') {
        this.waitingForExport = true;
        this.close();
        await this.preview();
        if (this.waitingForExport && !document.getElementById('export-preview')?.classList.contains('is-open')) this.previewClosed();
      } else {
        const success = this.model.step === 'create' ? await this.create() : await this.save();
        if (success) {
          const wasCreate = this.model.step === 'create';
          this.model.next(true); this.render();
          if (wasCreate) { this.close(); this.focusWriter(); }
        }
        else this.els.error.textContent = this.model.step === 'save'
          ? 'The latest words are not saved yet. Try Save again or skip the guide.'
          : 'A new page was not created. Try again or skip the guide.';
      }
    } catch (error) {
      this.waitingForExport = false;
      if (!this.isOpen) this.open();
      this.els.error.textContent = 'Could not complete this step: ' + String(error);
    } finally { this.busy = false; this.els.action.disabled = false; this.els.skip.disabled = false; }
  }
}
