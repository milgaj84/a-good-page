import type { Scheduler } from '../core/debounce';
import type { GoalProgress } from '../core/goal';
import type { SaveState } from '../core/session';

export interface ChromeElements {
  app: HTMLElement;
  title: HTMLInputElement;
  saveState: HTMLElement;
  saveText: HTMLElement;
  stats: HTMLElement;
  goal: HTMLElement;
  goalFill: HTMLElement;
  focusButton: HTMLElement;
  toast: HTMLElement;
}

/** Plain words for the one thing a writer needs to know: are my words safe? */
export const SAVE_WORDS: Record<SaveState, string> = {
  saved: 'Saved',
  dirty: 'Saving soon…',
  saving: 'Saving…',
  error: 'Could not save · press Ctrl+S',
};

/** The quiet UI around the page: title, save state, word count and toasts. */
export class Chrome {
  private toastHandle: unknown = null;
  private isTyping = false;

  constructor(private readonly els: ChromeElements, private readonly scheduler: Scheduler) {}

  // Called on every keystroke and mouse move: only touch the DOM when the state flips.
  typing(): void {
    if (this.isTyping) return;
    this.isTyping = true;
    this.els.app.classList.add('is-typing');
  }

  awake(): void {
    if (!this.isTyping) return;
    this.isTyping = false;
    this.els.app.classList.remove('is-typing');
  }

  setName(name: string): void {
    if (document.activeElement !== this.els.title) this.els.title.value = name;
  }

  setSaveState(state: SaveState, mac = false): void {
    this.els.saveState.dataset.state = state;
    this.els.saveText.textContent = mac ? SAVE_WORDS[state].replace('Ctrl', '⌘') : SAVE_WORDS[state];
  }

  setStats(text: string): void {
    this.els.stats.textContent = text;
  }

  setGoal(progress: GoalProgress | null): void {
    const { goal, goalFill } = this.els;
    goal.classList.toggle('is-visible', progress !== null);
    goal.classList.toggle('is-reached', progress?.reached ?? false);
    goalFill.style.transform = 'scaleX(' + (progress?.ratio ?? 0) + ')';
    goal.title = progress ? progress.label + ' words' : '';
  }

  celebrate(message: string): void { this.toast(message, 4200); }

  setFocus(on: boolean): void {
    this.els.app.classList.toggle('focus-mode', on);
  }

  /** A toast that also offers one action, such as Undo. It stays a little longer so there is time to use it. */
  toastAction(message: string, label: string, run: () => void, durationMs = 9000): void {
    this.toast(message, durationMs);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'toast-action';
    button.textContent = label;
    button.addEventListener('click', () => {
      this.els.toast.classList.remove('is-visible', 'has-action');
      run();
    });
    this.els.toast.append(button);
    this.els.toast.classList.add('has-action');
  }

  toast(message: string, durationMs = 2600): void {
    this.els.toast.classList.remove('has-action');
    this.els.toast.textContent = message;
    this.els.toast.classList.add('is-visible');
    if (this.toastHandle !== null) this.scheduler.clear(this.toastHandle);
    this.toastHandle = this.scheduler.set(() => {
      this.els.toast.classList.remove('is-visible');
      this.toastHandle = null;
    }, durationMs);
  }
}
