import type { OutsideState } from '../core/file-conflict';
/** Persistent, dismiss-free notice: ignoring a change never silently resumes autosave. */
export class OutsideNotice {
  readonly root = document.createElement('aside');
  private readonly message = document.createElement('span');
  private readonly review = document.createElement('button');
  private readonly keep = document.createElement('button');
  private seen: OutsideState | null = null;
  constructor(host: HTMLElement, onReview: () => void, onKeep: () => void) {
    this.root.className = 'outside-notice';
    this.root.setAttribute('role', 'status');
    this.root.setAttribute('aria-live', 'polite');
    this.root.hidden = true;
    this.review.type = this.keep.type = 'button';
    this.review.textContent = 'Review changes';
    this.keep.textContent = 'Keep writing';
    this.review.addEventListener('click', onReview);
    this.keep.addEventListener('click', onKeep);
    this.root.append(this.message, this.review, this.keep);
    host.append(this.root);
  }
  show(state: OutsideState | null): void {
    if (!state) { this.seen = null; this.root.hidden = true; return; }
    const file = state.path.split(String.fromCharCode(92)).pop()?.split('/').pop() || 'This chapter';
    const verb = state.kind === 'changed' ? 'changed on disk' : state.kind === 'missing' ? 'was moved or deleted' : 'cannot be read right now';
    const next = file + ' ' + verb + '. Autosave is paused.';
    if (this.seen?.path !== state.path || this.seen.kind !== state.kind || this.message.textContent !== next) this.message.textContent = next;
    this.seen = state;
    this.root.hidden = false;
  }
  remind(): void {
    if (!this.seen) return;
    if (!this.message.textContent?.includes('Your draft remains open.'))
      this.message.textContent += ' Your draft remains open.';
  }
}
